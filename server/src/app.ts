import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fstatic from "@fastify/static";
import { existsSync } from "node:fs";
import { z } from "zod";
import { config } from "./config.js";
import { pool, q, tx } from "./db.js";
import { fmtCode, hashPassword, newInviteCode, newToken, normCode, passwordOk, sha256, verifyPassword } from "./security.js";
import { sendMail } from "./mail.js";

const FREE_LIMIT = 3;
const COOKIE = "tt_session";
const TRASH_MS = 30 * 864e5;

type User = { id: string; email: string; role: "tutor" | "student"; name: string; brand: string; plan: "free" | "pro"; settings: Record<string, unknown>; isAdmin: boolean };

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new HttpError(status, message); };

/* ---------- validation ---------- */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = z.number().int().min(0).max(100_000_000);
const str = (max: number) => z.string().trim().max(max);

const studentIn = z.object({
  name: str(120).min(1),
  subject: str(300).min(1),
  email: str(200).default(""),
  phone: str(60).default(""),
  rate: money,
  rates: z.record(z.string().max(100), money).default({}),
  note: str(4000).default(""),
  cancelMode: z.enum(["off", "percent", "fixed"]).default("off"),
  cancelPct: z.number().int().min(0).max(100).default(0),
  cancelFixed: money.default(0),
  active: z.boolean().optional(),
});
const lessonIn = z.object({
  sid: z.string().regex(UUID),
  subject: str(120).default(""),
  date: z.string().regex(DATE),
  time: z.string().regex(TIME),
  min: z.number().int().min(1).max(1440),
  topic: str(300).default(""),
  prep: str(4000).default(""),
  notes: str(4000).default(""),
  hw: str(2000).default(""),
  hd: z.union([z.string().regex(DATE), z.literal("")]).default(""),
  status: z.enum(["planned", "done", "cancelled"]),
  paid: z.boolean().default(false),
  amount: money,
  fee: money.default(0),
});
const lessonPatch = z.object({
  subject: str(120), date: z.string().regex(DATE), time: z.string().regex(TIME), min: z.number().int().min(1).max(1440),
  topic: str(300), prep: str(4000), notes: str(4000), hw: str(2000), hd: z.union([z.string().regex(DATE), z.literal("")]),
  status: z.enum(["planned", "done", "cancelled"]), paid: z.boolean(), amount: money, fee: money, sid: z.string().regex(UUID),
}).partial();
const settingsIn = z.object({
  theme: z.enum(["light", "dark", "pink", "green"]),
  dur: z.number().int().min(1).max(1440),
  time: z.string().regex(TIME),
  rate: money,
  wk: z.enum(["mon", "sun"]),
  late: z.boolean(),
  goal: money,
  tpl: z.array(z.object({ n: str(80).min(1), t: str(2000).min(1) })).max(50),
  onbBilling: z.boolean(),
  welcomeSkipped: z.boolean(),
}).partial();
const eventIn = z.object({
  title: str(120).min(1),
  cat: z.enum(["school", "tutor", "extra", "other"]).default("other"),
  repeat: z.enum(["w", "o"]),
  weekday: z.number().int().min(0).max(6).default(0),
  date: z.union([z.string().regex(DATE), z.literal("")]).default(""),
  start: z.string().regex(TIME),
  end: z.string().regex(TIME),
}).refine((e) => e.end > e.start, { message: "Koniec musi być po początku." })
  .refine((e) => e.repeat === "w" || !!e.date, { message: "Wybierz datę." });

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) fail(400, "Nieprawidłowe dane: " + r.error.issues.map((i) => (i.path.join(".") ? i.path.join(".") + " – " : "") + i.message).join("; "));
  return (r as { data: z.infer<T> }).data;
}

/* ---------- row mapping ---------- */
const isAdminEmail = (email: string) => config.adminEmails.includes(String(email).toLowerCase());
const mapUser = (u: any): User => ({ id: u.id, email: u.email, role: u.role, name: u.name, brand: u.brand, plan: u.plan, settings: u.settings || {}, isAdmin: isAdminEmail(u.email) });
const mapStudent = (r: any) => ({
  id: r.id, name: r.name, subject: r.subject, email: r.email, phone: r.phone, rate: r.rate, rates: r.rates || {}, note: r.note,
  cancelMode: r.cancel_mode, cancelPct: r.cancel_pct, cancelFixed: r.cancel_fixed, active: r.active,
  inviteCode: r.invite_code ? fmtCode(r.invite_code) : null, linked: !!r.linked_user_id,
});
const mapLesson = (r: any) => ({
  id: r.id, sid: r.student_id, subject: r.subject, date: r.date, time: r.time, min: r.min, topic: r.topic, prep: r.prep,
  notes: r.notes, hw: r.hw, hd: r.hw_due || "", status: r.status, paid: r.paid, amount: r.amount, fee: r.fee,
});
const mapEvent = (r: any) => ({ id: r.id, title: r.title, cat: r.cat, repeat: r.repeat, weekday: r.weekday, date: r.date || "", start: r.start_time, end: r.end_time });

/* ---------- sessions ---------- */
async function createSession(reply: FastifyReply, userId: string, remember: boolean) {
  const token = newToken();
  const expires = new Date(Date.now() + config.sessionDays * 864e5);
  await q("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [sha256(token), userId, expires]);
  await q("UPDATE users SET last_login_at=now() WHERE id=$1", [userId]);
  reply.setCookie(COOKIE, token, {
    path: "/", httpOnly: true, sameSite: "lax", secure: config.prod,
    ...(remember ? { expires } : {}),
  });
}

async function currentUser(req: FastifyRequest): Promise<User | null> {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const rows = await q("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.blocked_at IS NULL", [sha256(token)]);
  return rows[0] ? mapUser(rows[0]) : null;
}

async function need(req: FastifyRequest, role?: "tutor" | "student"): Promise<User> {
  const u = await currentUser(req);
  if (!u) return fail(401, "Zaloguj się, aby kontynuować.");
  if (role && u.role !== role) fail(403, role === "tutor" ? "Ta funkcja jest dostępna tylko dla korepetytorów." : "Ta funkcja jest dostępna tylko dla uczniów.");
  return u;
}

/* ---------- tutor helpers ---------- */
async function activeCount(tutorId: string, db = pool as any) {
  return Number((await q("SELECT count(*)::int AS n FROM students WHERE tutor_id=$1 AND active AND deleted_at IS NULL", [tutorId], db))[0].n);
}
async function ensureCanActivate(u: User, db = pool as any) {
  if (u.plan === "free" && (await activeCount(u.id, db)) >= FREE_LIMIT)
    fail(402, `Plan Free pozwala mieć do ${FREE_LIMIT} aktywnych uczniów. Zarchiwizuj jednego z uczniów lub włącz Pro.`);
}
async function ownStudent(tutorId: string, id: string, db = pool as any) {
  if (!UUID.test(id)) fail(404, "Nie znaleziono ucznia.");
  const r = (await q("SELECT * FROM students WHERE id=$1 AND tutor_id=$2 AND deleted_at IS NULL", [id, tutorId], db))[0];
  return r || fail(404, "Nie znaleziono ucznia.");
}
async function ownLesson(tutorId: string, id: string, db = pool as any) {
  if (!UUID.test(id)) fail(404, "Nie znaleziono lekcji.");
  const r = (await q("SELECT l.* FROM lessons l JOIN students s ON s.id=l.student_id WHERE l.id=$1 AND l.tutor_id=$2 AND l.deleted_at IS NULL AND s.deleted_at IS NULL", [id, tutorId], db))[0];
  return r || fail(404, "Nie znaleziono lekcji.");
}

async function tutorData(u: User) {
  await q("DELETE FROM students WHERE tutor_id=$1 AND deleted_at < now() - interval '30 days'", [u.id]);
  await q("DELETE FROM lessons WHERE tutor_id=$1 AND deleted_at < now() - interval '30 days'", [u.id]);
  const students = await q("SELECT * FROM students WHERE tutor_id=$1 AND deleted_at IS NULL ORDER BY created_at", [u.id]);
  const lessons = await q("SELECT l.* FROM lessons l JOIN students s ON s.id=l.student_id WHERE l.tutor_id=$1 AND l.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY l.date, l.time", [u.id]);
  const ts = await q("SELECT s.id, s.name, s.deleted_at, (SELECT count(*)::int FROM lessons l WHERE l.student_id=s.id AND l.deleted_at IS NULL) AS n FROM students s WHERE s.tutor_id=$1 AND s.deleted_at IS NOT NULL", [u.id]);
  const tl = await q("SELECT l.id, l.date, l.time, l.deleted_at, s.name FROM lessons l JOIN students s ON s.id=l.student_id WHERE l.tutor_id=$1 AND l.deleted_at IS NOT NULL AND s.deleted_at IS NULL", [u.id]);
  const trash = [
    ...ts.map((r: any) => ({ kind: "student", id: r.id, name: r.name, lessons: r.n, deletedAt: new Date(r.deleted_at).getTime() })),
    ...tl.map((r: any) => ({ kind: "lesson", id: r.id, name: r.name, date: r.date, time: r.time, deletedAt: new Date(r.deleted_at).getTime() })),
  ].sort((a, b) => b.deletedAt - a.deletedAt);
  return { students: students.map(mapStudent), lessons: lessons.map(mapLesson), trash };
}

async function linkCode(userId: string, code: string, db = pool as any) {
  const n = normCode(code);
  if (n.length !== 16) fail(400, "Kod ma 16 znaków (litery i cyfry), np. ABCD-EFGH-JKLM-NPQR.");
  const s = (await q("SELECT * FROM students WHERE invite_code=$1 AND deleted_at IS NULL", [n], db))[0];
  if (!s) fail(404, "Nie znaleziono kodu. Sprawdź kod lub poproś korepetytora o nowy.");
  if (s.linked_user_id && s.linked_user_id !== userId) fail(409, "Ten kod został już użyty przez inne konto ucznia. Poproś korepetytora o nowy kod.");
  if (s.tutor_id === userId) fail(400, "To Twój własny kod.");
  await q("UPDATE students SET linked_user_id=$1 WHERE id=$2", [userId, s.id], db);
}

/* ---------- app ---------- */
export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: true, bodyLimit: 5 * 1024 * 1024 });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    if (err.statusCode === 429) return reply.status(429).send({ error: "Zbyt wiele prób. Spróbuj ponownie za chwilę." });
    if (err.validation || err.statusCode === 400) return reply.status(400).send({ error: "Nieprawidłowe żądanie." });
    app.log.error(err);
    return reply.status(500).send({ error: "Wystąpił błąd serwera. Spróbuj ponownie." });
  });

  // Security headers + CSRF guard (state-changing requests must come from our own origin).
  app.addHook("onRequest", async (req) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.url.startsWith("/api/")) {
      const origin = req.headers.origin;
      if (origin) {
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        if (new URL(origin).host !== host) fail(403, "Niedozwolone źródło żądania.");
      }
    }
  });
  app.addHook("onSend", async (req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
  });

  const authLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  app.get("/api/health", async () => { await q("SELECT 1"); return { ok: true }; });

  /* ----- auth ----- */
  app.post("/api/auth/register", authLimit, async (req, reply) => {
    const b = parse(z.object({
      role: z.enum(["tutor", "student"]), name: str(120).min(1), email: z.string().trim().toLowerCase().max(200).regex(/^\S+@\S+\.\S+$/),
      password: z.string(), brand: str(120).default(""), code: z.string().max(40).default(""), remember: z.boolean().default(true),
    }), req.body);
    if (!passwordOk(b.password)) fail(400, "Hasło musi mieć co najmniej 8 znaków oraz literę i cyfrę.");
    if ((await q("SELECT 1 FROM users WHERE email=$1", [b.email])).length) fail(409, "Konto z tym adresem już istnieje – zaloguj się.");
    const hash = await hashPassword(b.password);
    const user = await tx(async (c) => {
      const u = (await q("INSERT INTO users(email,password_hash,role,name,brand) VALUES ($1,$2,$3,$4,$5) RETURNING *", [b.email, hash, b.role, b.name, b.role === "tutor" ? b.brand : ""], c))[0];
      if (b.role === "student" && b.code.trim()) await linkCode(u.id, b.code, c);
      return u;
    });
    await createSession(reply, user.id, b.remember);
    return { user: mapUser(user) };
  });

  app.post("/api/auth/login", authLimit, async (req, reply) => {
    const b = parse(z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200), remember: z.boolean().default(false) }), req.body);
    const u = (await q("SELECT * FROM users WHERE email=$1", [b.email]))[0];
    const ok = u ? await verifyPassword(b.password, u.password_hash) : (await hashPassword("x"), false);
    if (!u || !ok) fail(401, "Nieprawidłowy e-mail lub hasło.");
    if (u.blocked_at) fail(403, "To konto zostało zablokowane. Skontaktuj się z administratorem TutorTrack.");
    await createSession(reply, u.id, b.remember);
    return { user: mapUser(u) };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const t = req.cookies[COOKIE];
    if (t) await q("DELETE FROM sessions WHERE token_hash=$1", [sha256(t)]);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => ({ user: await currentUser(req) }));

  app.post("/api/auth/forgot", authLimit, async (req) => {
    const b = parse(z.object({ email: z.string().trim().toLowerCase().max(200) }), req.body);
    const u = (await q("SELECT * FROM users WHERE email=$1", [b.email]))[0];
    let devLink: string | undefined;
    if (u) {
      const token = newToken();
      await q("INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES ($1,$2,now() + interval '1 hour')", [sha256(token), u.id]);
      const link = `${config.appUrl}/reset-hasla?token=${token}`;
      const sent = await sendMail(u.email, "TutorTrack – ustaw nowe hasło",
        `Cześć ${u.name}!\n\nAby ustawić nowe hasło do TutorTrack, otwórz link (ważny 1 godzinę):\n${link}\n\nJeśli to nie Ty, zignoruj tę wiadomość.`);
      if (!sent && !config.prod) devLink = link;
    }
    return { ok: true, ...(devLink ? { devLink } : {}) };
  });

  app.post("/api/auth/reset", authLimit, async (req) => {
    const b = parse(z.object({ token: z.string().max(200), password: z.string() }), req.body);
    if (!passwordOk(b.password)) fail(400, "Hasło musi mieć co najmniej 8 znaków oraz literę i cyfrę.");
    const r = (await q("SELECT * FROM password_resets WHERE token_hash=$1 AND NOT used AND expires_at > now()", [sha256(b.token)]))[0];
    if (!r) fail(400, "Link do zmiany hasła jest nieprawidłowy lub wygasł. Poproś o nowy.");
    await tx(async (c) => {
      await q("UPDATE password_resets SET used=true WHERE token_hash=$1", [r.token_hash], c);
      await q("UPDATE users SET password_hash=$1 WHERE id=$2", [await hashPassword(b.password), r.user_id], c);
      await q("DELETE FROM sessions WHERE user_id=$1", [r.user_id], c);
    });
    return { ok: true };
  });

  /* ----- account ----- */
  app.patch("/api/me", async (req) => {
    const u = await need(req);
    const b = parse(z.object({ name: str(120).min(1).optional(), brand: str(120).optional(), settings: settingsIn.optional() }), req.body);
    const settings = b.settings ? { ...u.settings, ...b.settings } : u.settings;
    const row = (await q("UPDATE users SET name=COALESCE($2,name), brand=COALESCE($3,brand), settings=$4 WHERE id=$1 RETURNING *", [u.id, b.name ?? null, b.brand ?? null, JSON.stringify(settings)]))[0];
    return { user: mapUser(row) };
  });

  app.post("/api/me/password", authLimit, async (req, reply) => {
    const u = await need(req);
    const b = parse(z.object({ current: z.string().max(200), next: z.string() }), req.body);
    const row = (await q("SELECT password_hash FROM users WHERE id=$1", [u.id]))[0];
    if (!(await verifyPassword(b.current, row.password_hash))) fail(400, "Obecne hasło jest nieprawidłowe.");
    if (!passwordOk(b.next)) fail(400, "Hasło musi mieć co najmniej 8 znaków oraz literę i cyfrę.");
    await q("UPDATE users SET password_hash=$1 WHERE id=$2", [await hashPassword(b.next), u.id]);
    await q("DELETE FROM sessions WHERE user_id=$1", [u.id]);
    await createSession(reply, u.id, true);
    return { ok: true };
  });

  app.delete("/api/me", authLimit, async (req, reply) => {
    const u = await need(req);
    const b = parse(z.object({ password: z.string().max(200) }), req.body);
    const row = (await q("SELECT password_hash FROM users WHERE id=$1", [u.id]))[0];
    if (!(await verifyPassword(b.password, row.password_hash))) fail(400, "Hasło jest nieprawidłowe.");
    await q("DELETE FROM users WHERE id=$1", [u.id]);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  app.post("/api/me/plan", async (req) => {
    const u = await need(req, "tutor");
    const b = parse(z.object({ plan: z.enum(["free", "pro"]) }), req.body);
    const row = (await q("UPDATE users SET plan=$2 WHERE id=$1 RETURNING *", [u.id, b.plan]))[0];
    return { user: mapUser(row) };
  });

  /* ----- tutor data ----- */
  app.get("/api/tutor/data", async (req) => tutorData(await need(req, "tutor")));

  app.post("/api/students", async (req) => {
    const u = await need(req, "tutor");
    const b = parse(studentIn, req.body);
    await ensureCanActivate(u);
    const r = (await q(`INSERT INTO students(tutor_id,name,subject,email,phone,rate,rates,note,cancel_mode,cancel_pct,cancel_fixed)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [u.id, b.name, b.subject, b.email, b.phone, b.rate, JSON.stringify(b.rates), b.note, b.cancelMode, b.cancelPct, b.cancelFixed]))[0];
    return { student: mapStudent(r) };
  });

  app.patch("/api/students/:id", async (req) => {
    const u = await need(req, "tutor");
    const id = (req.params as any).id;
    const s = await ownStudent(u.id, id);
    const b = parse(studentIn.partial(), req.body);
    if (b.active === true && !s.active) await ensureCanActivate(u);
    const m = { ...mapStudent(s), ...b };
    const r = (await q(`UPDATE students SET name=$3,subject=$4,email=$5,phone=$6,rate=$7,rates=$8,note=$9,cancel_mode=$10,cancel_pct=$11,cancel_fixed=$12,active=$13
      WHERE id=$1 AND tutor_id=$2 RETURNING *`,
      [id, u.id, m.name, m.subject, m.email, m.phone, m.rate, JSON.stringify(m.rates), m.note, m.cancelMode, m.cancelPct, m.cancelFixed, m.active]))[0];
    return { student: mapStudent(r) };
  });

  app.delete("/api/students/:id", async (req) => {
    const u = await need(req, "tutor");
    const id = (req.params as any).id;
    await ownStudent(u.id, id);
    if (u.plan === "pro") await q("UPDATE students SET deleted_at=now() WHERE id=$1", [id]);
    else await q("DELETE FROM students WHERE id=$1", [id]);
    return { ok: true, trashed: u.plan === "pro" };
  });

  app.post("/api/students/:id/invite", async (req) => {
    const u = await need(req, "tutor");
    const id = (req.params as any).id;
    await ownStudent(u.id, id);
    for (let i = 0; i < 5; i++) {
      try {
        const r = (await q("UPDATE students SET invite_code=$2, linked_user_id=NULL WHERE id=$1 RETURNING *", [id, newInviteCode()]))[0];
        return { student: mapStudent(r) };
      } catch (e: any) { if (e.code !== "23505") throw e; }
    }
    return fail(500, "Nie udało się utworzyć kodu.");
  });

  app.delete("/api/students/:id/invite", async (req) => {
    const u = await need(req, "tutor");
    const id = (req.params as any).id;
    await ownStudent(u.id, id);
    const r = (await q("UPDATE students SET invite_code=NULL, linked_user_id=NULL WHERE id=$1 RETURNING *", [id]))[0];
    return { student: mapStudent(r) };
  });

  app.post("/api/lessons", async (req) => {
    const u = await need(req, "tutor");
    const b = parse(lessonIn, req.body);
    await ownStudent(u.id, b.sid);
    const r = (await q(`INSERT INTO lessons(tutor_id,student_id,subject,date,time,min,topic,prep,notes,hw,hw_due,status,paid,amount,fee)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [u.id, b.sid, b.subject, b.date, b.time, b.min, b.topic, b.prep, b.notes, b.hw, b.hd || null, b.status, b.paid, b.amount, b.fee]))[0];
    return { lesson: mapLesson(r) };
  });

  async function patchLesson(u: User, id: string, b: z.infer<typeof lessonPatch>, db: any = pool) {
    const l = await ownLesson(u.id, id, db);
    if (b.sid && b.sid !== l.student_id) await ownStudent(u.id, b.sid, db);
    const m = { ...mapLesson(l), ...b };
    const r = (await q(`UPDATE lessons SET student_id=$2,subject=$3,date=$4,time=$5,min=$6,topic=$7,prep=$8,notes=$9,hw=$10,hw_due=$11,status=$12,paid=$13,amount=$14,fee=$15
      WHERE id=$1 RETURNING *`,
      [id, m.sid, m.subject, m.date, m.time, m.min, m.topic, m.prep, m.notes, m.hw, m.hd || null, m.status, m.paid, m.amount, m.fee], db))[0];
    return mapLesson(r);
  }

  app.patch("/api/lessons/:id", async (req) => {
    const u = await need(req, "tutor");
    return { lesson: await patchLesson(u, (req.params as any).id, parse(lessonPatch, req.body)) };
  });

  app.post("/api/lessons/batch", async (req) => {
    const u = await need(req, "tutor");
    const b = parse(z.object({ ids: z.array(z.string().regex(UUID)).min(1).max(500), patch: lessonPatch }), req.body);
    const lessons = await tx(async (c) => { const out = []; for (const id of b.ids) out.push(await patchLesson(u, id, b.patch, c)); return out; });
    return { lessons };
  });

  app.delete("/api/lessons/:id", async (req) => {
    const u = await need(req, "tutor");
    const id = (req.params as any).id;
    await ownLesson(u.id, id);
    if (u.plan === "pro") await q("UPDATE lessons SET deleted_at=now() WHERE id=$1", [id]);
    else await q("DELETE FROM lessons WHERE id=$1", [id]);
    return { ok: true, trashed: u.plan === "pro" };
  });

  app.post("/api/trash/:kind/:id/restore", async (req) => {
    const u = await need(req, "tutor");
    const { kind, id } = req.params as any;
    if (!UUID.test(id)) fail(404, "Nie znaleziono elementu.");
    if (kind === "student") {
      const s = (await q("SELECT * FROM students WHERE id=$1 AND tutor_id=$2 AND deleted_at IS NOT NULL", [id, u.id]))[0];
      if (!s) fail(404, "Nie znaleziono elementu.");
      if (s.active) await ensureCanActivate(u);
      await q("UPDATE students SET deleted_at=NULL WHERE id=$1", [id]);
    } else {
      const r = await q("UPDATE lessons l SET deleted_at=NULL FROM students s WHERE l.id=$1 AND l.tutor_id=$2 AND s.id=l.student_id AND s.deleted_at IS NULL RETURNING l.id", [id, u.id]);
      if (!r.length) fail(404, "Najpierw przywróć ucznia tej lekcji.");
    }
    return { ok: true };
  });

  app.delete("/api/trash/:kind/:id", async (req) => {
    const u = await need(req, "tutor");
    const { kind, id } = req.params as any;
    if (!UUID.test(id)) fail(404, "Nie znaleziono elementu.");
    await q(`DELETE FROM ${kind === "student" ? "students" : "lessons"} WHERE id=$1 AND tutor_id=$2 AND deleted_at IS NOT NULL`, [id, u.id]);
    return { ok: true };
  });

  app.delete("/api/trash", async (req) => {
    const u = await need(req, "tutor");
    await q("DELETE FROM lessons WHERE tutor_id=$1 AND deleted_at IS NOT NULL", [u.id]);
    await q("DELETE FROM students WHERE tutor_id=$1 AND deleted_at IS NOT NULL", [u.id]);
    return { ok: true };
  });

  app.get("/api/export", async (req) => {
    const u = await need(req, "tutor");
    const d = await tutorData(u);
    return { app: "tutortrack", version: 2, exportedAt: new Date().toISOString(), plan: u.plan, settings: u.settings, students: d.students.map(({ inviteCode, linked, ...s }) => s), lessons: d.lessons };
  });

  app.post("/api/import", async (req) => {
    const u = await need(req, "tutor");
    const b = parse(z.object({ students: z.array(z.any()).max(5000), lessons: z.array(z.any()).max(100000) }), req.body);
    const studs = b.students.map((s: any) => ({ old: String(s.id), data: parse(studentIn.extend({ active: z.boolean().default(true) }), s) }));
    const less = b.lessons.map((l: any) => ({ sidOld: String(l.sid), data: parse(lessonIn.omit({ sid: true }), { ...l, hd: l.hd || "", prep: l.prep || "", hw: l.hw || "", fee: l.fee || 0 }) }));
    if (u.plan === "free" && studs.filter((s) => s.data.active).length > FREE_LIMIT)
      fail(402, `Kopia zawiera więcej niż ${FREE_LIMIT} aktywnych uczniów. Włącz Pro albo zarchiwizuj uczniów w pliku.`);
    await tx(async (c) => {
      await q("DELETE FROM students WHERE tutor_id=$1", [u.id], c);
      const map = new Map<string, string>();
      for (const s of studs) {
        const d = s.data;
        const r = (await q(`INSERT INTO students(tutor_id,name,subject,email,phone,rate,rates,note,cancel_mode,cancel_pct,cancel_fixed,active)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [u.id, d.name, d.subject, d.email, d.phone, d.rate, JSON.stringify(d.rates), d.note, d.cancelMode, d.cancelPct, d.cancelFixed, d.active], c))[0];
        map.set(s.old, r.id);
      }
      for (const l of less) {
        const sid = map.get(l.sidOld);
        if (!sid) continue;
        const d = l.data;
        await q(`INSERT INTO lessons(tutor_id,student_id,subject,date,time,min,topic,prep,notes,hw,hw_due,status,paid,amount,fee)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [u.id, sid, d.subject, d.date, d.time, d.min, d.topic, d.prep, d.notes, d.hw, d.hd || null, d.status, d.paid, d.amount, d.fee], c);
      }
    });
    return tutorData(u);
  });

  /* ----- student ----- */
  app.get("/api/student/data", async (req) => {
    const u = await need(req, "student");
    const links = await q(`SELECT s.id, s.name, s.subject, t.name AS tutor_name, t.brand AS tutor_brand
      FROM students s JOIN users t ON t.id=s.tutor_id WHERE s.linked_user_id=$1 AND s.deleted_at IS NULL ORDER BY s.created_at`, [u.id]);
    const ls = await q(`SELECT l.* FROM lessons l JOIN students s ON s.id=l.student_id
      WHERE s.linked_user_id=$1 AND s.deleted_at IS NULL AND l.deleted_at IS NULL ORDER BY l.date, l.time`, [u.id]);
    const ev = await q("SELECT * FROM student_events WHERE user_id=$1 ORDER BY created_at", [u.id]);
    const done = await q("SELECT h.lesson_id FROM homework_done h WHERE h.user_id=$1", [u.id]);
    return {
      links: links.map((s: any) => ({
        sid: s.id, tutor: s.tutor_brand || s.tutor_name, studentName: s.name, subject: s.subject,
        lessons: ls.filter((l: any) => l.student_id === s.id).map((l: any) => ({
          id: l.id, date: l.date, time: l.time, min: l.min, subject: l.subject || s.subject.split(",")[0].trim(), topic: l.topic, status: l.status,
          notes: l.status === "done" ? l.notes : "", hw: l.status === "done" ? l.hw : "", hd: l.status === "done" ? l.hw_due || "" : "",
          amount: l.status === "cancelled" ? l.fee : l.amount, paid: l.paid,
        })),
      })),
      events: ev.map(mapEvent),
      done: done.map((d: any) => d.lesson_id),
    };
  });

  app.post("/api/student/link", authLimit, async (req) => {
    const u = await need(req, "student");
    const b = parse(z.object({ code: z.string().max(40) }), req.body);
    await linkCode(u.id, b.code);
    return { ok: true };
  });

  app.delete("/api/student/link/:sid", async (req) => {
    const u = await need(req, "student");
    const sid = (req.params as any).sid;
    if (!UUID.test(sid)) fail(404, "Nie znaleziono połączenia.");
    await q("UPDATE students SET linked_user_id=NULL WHERE id=$1 AND linked_user_id=$2", [sid, u.id]);
    await q("DELETE FROM homework_done h USING lessons l WHERE h.lesson_id=l.id AND l.student_id=$1 AND h.user_id=$2", [sid, u.id]);
    return { ok: true };
  });

  app.post("/api/student/events", async (req) => {
    const u = await need(req, "student");
    const b = parse(eventIn, req.body);
    if ((await q("SELECT count(*)::int AS n FROM student_events WHERE user_id=$1", [u.id]))[0].n >= 500) fail(400, "Osiągnięto limit zajęć w grafiku.");
    const r = (await q("INSERT INTO student_events(user_id,title,cat,repeat,weekday,date,start_time,end_time) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [u.id, b.title, b.cat, b.repeat, b.weekday, b.repeat === "o" ? b.date : null, b.start, b.end]))[0];
    return { event: mapEvent(r) };
  });

  app.patch("/api/student/events/:id", async (req) => {
    const u = await need(req, "student");
    const id = (req.params as any).id;
    if (!UUID.test(id)) fail(404, "Nie znaleziono zajęć.");
    const b = parse(eventIn, req.body);
    const r = (await q("UPDATE student_events SET title=$3,cat=$4,repeat=$5,weekday=$6,date=$7,start_time=$8,end_time=$9 WHERE id=$1 AND user_id=$2 RETURNING *",
      [id, u.id, b.title, b.cat, b.repeat, b.weekday, b.repeat === "o" ? b.date : null, b.start, b.end]))[0];
    if (!r) fail(404, "Nie znaleziono zajęć.");
    return { event: mapEvent(r) };
  });

  app.delete("/api/student/events/:id", async (req) => {
    const u = await need(req, "student");
    const id = (req.params as any).id;
    if (UUID.test(id)) await q("DELETE FROM student_events WHERE id=$1 AND user_id=$2", [id, u.id]);
    return { ok: true };
  });

  app.put("/api/student/homework/:lessonId", async (req) => {
    const u = await need(req, "student");
    const id = (req.params as any).lessonId;
    const b = parse(z.object({ done: z.boolean() }), req.body);
    if (!UUID.test(id)) fail(404, "Nie znaleziono lekcji.");
    const ok = await q("SELECT 1 FROM lessons l JOIN students s ON s.id=l.student_id WHERE l.id=$1 AND s.linked_user_id=$2 AND l.deleted_at IS NULL AND s.deleted_at IS NULL", [id, u.id]);
    if (!ok.length) fail(404, "Nie znaleziono lekcji.");
    if (b.done) await q("INSERT INTO homework_done(user_id,lesson_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [u.id, id]);
    else await q("DELETE FROM homework_done WHERE user_id=$1 AND lesson_id=$2", [u.id, id]);
    return { ok: true };
  });

  /* ----- admin (e-mails listed in ADMIN_EMAILS) ----- */
  async function needAdmin(req: FastifyRequest) {
    const u = await need(req);
    if (!u.isAdmin) fail(403, "Brak uprawnień administratora.");
    return u;
  }
  const logAction = (admin: User, action: string, target: string, details: object = {}) =>
    q("INSERT INTO admin_actions(admin_id, admin_email, action, target_email, details) VALUES ($1,$2,$3,$4,$5)", [admin.id, admin.email, action, target, JSON.stringify(details)]);
  async function adminTarget(admin: User, id: string) {
    if (!UUID.test(id)) fail(404, "Nie znaleziono konta.");
    const t = (await q("SELECT * FROM users WHERE id=$1", [id]))[0];
    if (!t) fail(404, "Nie znaleziono konta.");
    if (t.id === admin.id) fail(400, "Nie możesz wykonać tej operacji na własnym koncie.");
    if (isAdminEmail(t.email)) fail(400, "Nie można zmieniać kont innych administratorów.");
    return t;
  }

  app.get("/api/admin/stats", async (req) => {
    await needAdmin(req);
    const u = (await q(`SELECT
        count(*) FILTER (WHERE role='tutor')::int AS tutors,
        count(*) FILTER (WHERE role='tutor' AND plan='pro')::int AS pro,
        count(*) FILTER (WHERE role='student')::int AS student_accounts,
        count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new7,
        count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS new30,
        count(*) FILTER (WHERE last_login_at > now() - interval '7 days')::int AS active7,
        count(*) FILTER (WHERE blocked_at IS NOT NULL)::int AS blocked
      FROM users`))[0];
    const s = (await q(`SELECT count(*)::int AS records, count(*) FILTER (WHERE linked_user_id IS NOT NULL)::int AS linked
      FROM students WHERE deleted_at IS NULL`))[0];
    const l = (await q(`SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS last30
      FROM lessons WHERE deleted_at IS NULL`))[0];
    const days = await q(`SELECT to_char(d, 'YYYY-MM-DD') AS day,
        (SELECT count(*)::int FROM users WHERE role='tutor' AND created_at::date = d::date) AS tutors,
        (SELECT count(*)::int FROM users WHERE role='student' AND created_at::date = d::date) AS students
      FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`);
    return { users: u, students: s, lessons: l, days };
  });

  app.get("/api/admin/users", async (req) => {
    await needAdmin(req);
    const b = parse(z.object({ q: z.string().max(200).default(""), role: z.enum(["", "tutor", "student"]).default(""), status: z.enum(["", "blocked"]).default(""), offset: z.coerce.number().int().min(0).default(0) }), req.query);
    const term = b.q.trim() ? "%" + b.q.trim().replace(/[%_\\]/g, "\\$&") + "%" : "";
    const where = `($1 = '' OR u.name ILIKE $1 OR u.email ILIKE $1) AND ($2 = '' OR u.role = $2) AND ($3 = '' OR u.blocked_at IS NOT NULL)`;
    const total = (await q(`SELECT count(*)::int AS n FROM users u WHERE ${where}`, [term, b.role, b.status]))[0].n;
    const rows = await q(`SELECT u.id, u.name, u.brand, u.email, u.role, u.plan, u.created_at, u.last_login_at, u.blocked_at,
        (SELECT count(*)::int FROM students s WHERE s.tutor_id=u.id AND s.deleted_at IS NULL) AS students,
        (SELECT count(*)::int FROM lessons l WHERE l.tutor_id=u.id AND l.deleted_at IS NULL) AS lessons,
        (SELECT count(*)::int FROM students s WHERE s.linked_user_id=u.id AND s.deleted_at IS NULL) AS tutors
      FROM users u WHERE ${where} ORDER BY u.created_at DESC LIMIT 50 OFFSET $4`, [term, b.role, b.status, b.offset]);
    return {
      total,
      users: rows.map((r: any) => ({
        id: r.id, name: r.name, brand: r.brand, email: r.email, role: r.role, plan: r.plan,
        createdAt: new Date(r.created_at).getTime(), lastLoginAt: r.last_login_at ? new Date(r.last_login_at).getTime() : null,
        blocked: !!r.blocked_at, isAdmin: isAdminEmail(r.email), students: r.students, lessons: r.lessons, tutors: r.tutors,
      })),
    };
  });

  app.post("/api/admin/users/:id/block", async (req) => {
    const admin = await needAdmin(req);
    const t = await adminTarget(admin, (req.params as any).id);
    const b = parse(z.object({ blocked: z.boolean() }), req.body);
    await q("UPDATE users SET blocked_at=$2 WHERE id=$1", [t.id, b.blocked ? new Date() : null]);
    if (b.blocked) await q("DELETE FROM sessions WHERE user_id=$1", [t.id]);
    await logAction(admin, b.blocked ? "block" : "unblock", t.email);
    return { ok: true };
  });

  app.post("/api/admin/users/:id/plan", async (req) => {
    const admin = await needAdmin(req);
    // Changing a plan is harmless, so it is allowed on the admin's own account too (unlike block/delete).
    const id = (req.params as any).id;
    if (!UUID.test(id)) fail(404, "Nie znaleziono konta.");
    const t = (await q("SELECT * FROM users WHERE id=$1", [id]))[0] || fail(404, "Nie znaleziono konta.");
    const b = parse(z.object({ plan: z.enum(["free", "pro"]) }), req.body);
    if (t.role !== "tutor") fail(400, "Plan dotyczy tylko kont korepetytorów.");
    await q("UPDATE users SET plan=$2 WHERE id=$1", [t.id, b.plan]);
    await logAction(admin, "plan", t.email, { plan: b.plan });
    return { ok: true };
  });

  app.delete("/api/admin/users/:id", async (req) => {
    const admin = await needAdmin(req);
    const t = await adminTarget(admin, (req.params as any).id);
    const b = parse(z.object({ confirmEmail: z.string().trim().toLowerCase() }), req.body);
    if (b.confirmEmail !== t.email) fail(400, "Wpisany adres e-mail nie zgadza się z adresem konta.");
    await q("DELETE FROM users WHERE id=$1", [t.id]);
    await logAction(admin, "delete", t.email, { role: t.role });
    return { ok: true };
  });

  app.get("/api/admin/actions", async (req) => {
    await needAdmin(req);
    const rows = await q("SELECT admin_email, action, target_email, details, created_at FROM admin_actions ORDER BY created_at DESC LIMIT 200");
    return { actions: rows.map((r: any) => ({ admin: r.admin_email, action: r.action, target: r.target_email, details: r.details, at: new Date(r.created_at).getTime() })) };
  });

  app.all("/api/*", async (_req, reply) => reply.status(404).send({ error: "Nie znaleziono." }));

  /* ----- frontend (built SPA) ----- */
  if (existsSync(config.webDist)) {
    await app.register(fstatic, {
      root: config.webDist,
      wildcard: true,
      setHeaders: (res, path) => {
        if (path.includes("/assets/")) (res as any).setHeader?.("Cache-Control", "public, max-age=31536000, immutable") ?? (res as any).header?.("Cache-Control", "public, max-age=31536000, immutable");
      },
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== "GET" || req.url.startsWith("/assets/")) return reply.status(404).send({ error: "Nie znaleziono." });
      reply.header("Cache-Control", "no-cache");
      return reply.sendFile("index.html");
    });
  }

  return app;
}

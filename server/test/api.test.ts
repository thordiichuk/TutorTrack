import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { runMigrations } from "../src/migrate.js";
import { pool } from "../src/db.js";

let app: Awaited<ReturnType<typeof buildApp>>;
const uniq = Date.now();

before(async () => { await runMigrations(() => {}); app = await buildApp({ authRateLimit: 10000 }); });
after(async () => { await app.close(); await pool.end(); });

async function call(method: string, url: string, body?: unknown, cookie?: string) {
  const r = await app.inject({ method: method as any, url, payload: body as any, headers: cookie ? { cookie } : {} });
  const set = r.headers["set-cookie"];
  const c = (Array.isArray(set) ? set[0] : set)?.split(";")[0];
  return { status: r.statusCode, body: r.json(), cookie: c };
}
async function register(role: "tutor" | "student", extra: object = {}) {
  const r = await call("POST", "/api/auth/register", { role, name: "Test", email: `${role}${uniq}${Math.random()}@x.pl`, password: "haslo123", ...extra });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookie!;
}

test("rejects weak passwords and duplicate e-mails", async () => {
  const weak = await call("POST", "/api/auth/register", { role: "tutor", name: "A", email: `w${uniq}@x.pl`, password: "short" });
  assert.equal(weak.status, 400);
  const em = `dup${uniq}@x.pl`;
  assert.equal((await call("POST", "/api/auth/register", { role: "tutor", name: "A", email: em, password: "haslo123" })).status, 200);
  assert.equal((await call("POST", "/api/auth/register", { role: "tutor", name: "A", email: em, password: "haslo123" })).status, 409);
  assert.equal((await call("POST", "/api/auth/login", { email: em, password: "zle12345" })).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { email: em, password: "haslo123" })).status, 200);
});

test("tutor data is private and requires auth", async () => {
  assert.equal((await call("GET", "/api/tutor/data")).status, 401);
  const a = await register("tutor"), b = await register("tutor");
  const s = await call("POST", "/api/students", { name: "Anna", subject: "Matematyka", rate: 12000 }, a);
  assert.equal(s.status, 200);
  assert.equal((await call("PATCH", "/api/students/" + s.body.student.id, { name: "X" }, b)).status, 404);
  assert.equal((await call("GET", "/api/tutor/data", undefined, b)).body.students.length, 0);
});

test("free plan limits active students", async () => {
  const t = await register("tutor");
  for (let i = 0; i < 3; i++) assert.equal((await call("POST", "/api/students", { name: "S" + i, subject: "M", rate: 1 }, t)).status, 200);
  assert.equal((await call("POST", "/api/students", { name: "S4", subject: "M", rate: 1 }, t)).status, 402);
  await call("POST", "/api/me/plan", { plan: "pro" }, t);
  assert.equal((await call("POST", "/api/students", { name: "S4", subject: "M", rate: 1 }, t)).status, 200);
});

test("student links with a code and sees lessons without private notes", async () => {
  const t = await register("tutor");
  const sid = (await call("POST", "/api/students", { name: "Anna", subject: "Matematyka", rate: 12000 }, t)).body.student.id;
  await call("POST", "/api/lessons", { sid, date: "2026-11-02", time: "16:00", min: 60, status: "done", amount: 12000, prep: "TAJNE", notes: "OK", hw: "zad 1", hd: "2026-11-05" }, t);
  const code = (await call("POST", `/api/students/${sid}/invite`, undefined, t)).body.student.inviteCode;
  const st = await register("student", { code });
  const d = (await call("GET", "/api/student/data", undefined, st)).body;
  assert.equal(d.links.length, 1);
  assert.equal(d.links[0].lessons[0].notes, "OK");
  assert.ok(!JSON.stringify(d).includes("TAJNE"));
  // notes/homework of a lesson that has not taken place yet stay hidden from the student
  await call("POST", "/api/lessons", { sid, date: "2026-12-01", time: "16:00", min: 60, status: "planned", amount: 12000, notes: "PRZYSZLA", hw: "PRZYSZLE" }, t);
  assert.ok(!JSON.stringify((await call("GET", "/api/student/data", undefined, st)).body).includes("PRZYSZL"));
  // the code works for one student account only
  const other = await register("student");
  assert.equal((await call("POST", "/api/student/link", { code }, other)).status, 409);
  // homework toggle and revocation
  const lid = d.links[0].lessons[0].id;
  assert.equal((await call("PUT", "/api/student/homework/" + lid, { done: true }, st)).status, 200);
  assert.equal((await call("PUT", "/api/student/homework/" + lid, { done: true }, other)).status, 404);
  await call("DELETE", `/api/students/${sid}/invite`, undefined, t);
  assert.equal((await call("GET", "/api/student/data", undefined, st)).body.links.length, 0);
});

test("password reset flow invalidates sessions", async () => {
  const email = `reset${uniq}@x.pl`;
  const reg = await call("POST", "/api/auth/register", { role: "tutor", name: "R", email, password: "haslo123" });
  const f = await call("POST", "/api/auth/forgot", { email });
  const token = new URL(f.body.devLink).searchParams.get("token");
  assert.equal((await call("POST", "/api/auth/reset", { token, password: "nowehaslo1" })).status, 200);
  assert.equal((await call("GET", "/api/auth/me", undefined, reg.cookie)).body.user, null);
  assert.equal((await call("POST", "/api/auth/login", { email, password: "nowehaslo1" })).status, 200);
  assert.equal((await call("POST", "/api/auth/reset", { token, password: "inne12345" })).status, 400);
});

test("student asks to cancel, tutor accepts or rejects", async () => {
  const t = await register("tutor");
  const sid = (await call("POST", "/api/students", { name: "Ola", subject: "Matematyka", rate: 10000 }, t)).body.student.id;
  const mk = async () => (await call("POST", "/api/lessons", { sid, date: "2026-12-10", time: "16:00", min: 60, status: "planned", amount: 10000 }, t)).body.lesson.id;
  const a = await mk(), b = await mk();
  const code = (await call("POST", `/api/students/${sid}/invite`, undefined, t)).body.student.inviteCode;
  const st = await register("student", { code });
  const other = await register("student");
  // validation and ownership
  assert.equal((await call("POST", `/api/student/lessons/${a}/cancel-request`, { reason: "" }, st)).status, 400);
  assert.equal((await call("POST", `/api/student/lessons/${a}/cancel-request`, { reason: "Choroba" }, other)).status, 404);
  assert.equal((await call("POST", `/api/student/lessons/${a}/cancel-request`, { reason: "Choroba" }, st)).status, 200);
  assert.equal((await call("POST", `/api/student/lessons/${a}/cancel-request`, { reason: "Choroba" }, st)).status, 409);
  assert.equal((await call("POST", `/api/student/lessons/${b}/cancel-request`, { reason: "Wyjazd" }, st)).status, 200);
  // tutor sees pending requests
  const data = (await call("GET", "/api/tutor/data", undefined, t)).body;
  assert.equal(data.lessons.filter((l: any) => l.cr?.status === "pending").length, 2);
  // accept with fee, reject with note
  const acc = await call("POST", `/api/lessons/${a}/cancel-request/accept`, { fee: 5000 }, t);
  assert.equal(acc.body.lesson.status, "cancelled");
  assert.equal(acc.body.lesson.fee, 5000);
  assert.equal((await call("POST", `/api/lessons/${a}/cancel-request/accept`, {}, t)).status, 409);
  const rej = await call("POST", `/api/lessons/${b}/cancel-request/reject`, { note: "Za późno" }, t);
  assert.equal(rej.body.lesson.status, "planned");
  // student sees the outcome; a decided request cannot be withdrawn
  const ls = (await call("GET", "/api/student/data", undefined, st)).body.links[0].lessons;
  assert.equal(ls.find((l: any) => l.id === a).cr.status, "accepted");
  assert.equal(ls.find((l: any) => l.id === b).cr.note, "Za późno");
  assert.equal((await call("DELETE", `/api/student/lessons/${b}/cancel-request`, undefined, st)).status, 409);
});

test("recurring lessons: Pro only, edit/delete this and following, extend and end", async () => {
  const t = await register("tutor");
  const sid = (await call("POST", "/api/students", { name: "Seria", subject: "Fizyka", rate: 10000 }, t)).body.student.id;
  const base = { sid, subject: "Fizyka", time: "17:30", min: 60, status: "planned", amount: 10000, freq: 1, dates: ["2030-01-08", "2030-01-15", "2030-01-22", "2030-01-29"] };
  assert.equal((await call("POST", "/api/lessons/series", base, t)).status, 402);
  await call("POST", "/api/me/plan", { plan: "pro" }, t);
  const r = await call("POST", "/api/lessons/series", base, t);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let d = (await call("GET", "/api/tutor/data", undefined, t)).body;
  const ls = d.lessons.filter((l: any) => l.seriesId === r.body.seriesId);
  assert.equal(ls.length, 4);
  assert.equal(d.series.length, 1);
  // move the 2nd lesson one day later and to 18:00 – the following ones follow, the 1st does not
  assert.equal((await call("PATCH", `/api/lessons/${ls[1].id}?scope=future`, { date: "2030-01-16", time: "18:00" }, t)).status, 200);
  d = (await call("GET", "/api/tutor/data", undefined, t)).body;
  const by = (id: string) => d.lessons.find((l: any) => l.id === id);
  assert.equal(by(ls[0].id).time, "17:30");
  assert.deepEqual([by(ls[1].id).date, by(ls[2].id).date, by(ls[3].id).date], ["2030-01-16", "2030-01-23", "2030-01-30"]);
  assert.equal(by(ls[3].id).time, "18:00");
  // extend by two lessons, then delete the 3rd and following
  assert.equal((await call("POST", `/api/series/${r.body.seriesId}/extend`, { dates: ["2030-02-06", "2030-02-13"] }, t)).status, 200);
  assert.equal((await call("DELETE", `/api/lessons/${ls[2].id}?scope=future`, undefined, t)).status, 200);
  d = (await call("GET", "/api/tutor/data", undefined, t)).body;
  assert.equal(d.lessons.filter((l: any) => l.seriesId === r.body.seriesId).length, 2);
  // ending the series removes the remaining future planned lessons
  const end = await call("POST", `/api/series/${r.body.seriesId}/end`, {}, t);
  assert.equal(end.body.removed, 2);
});

test("parent access: code from the child, all tutors, hidden events, max two parents", async () => {
  const t1 = await register("tutor"), t2 = await register("tutor");
  const s1 = (await call("POST", "/api/students", { name: "Ola", subject: "Matematyka", rate: 10000 }, t1)).body.student;
  const s2 = (await call("POST", "/api/students", { name: "Ola K.", subject: "Angielski", rate: 8000 }, t2)).body.student;
  const l1 = (await call("POST", "/api/lessons", { sid: s1.id, date: "2026-10-02", time: "16:00", min: 60, status: "done", amount: 10000, prep: "TAJNE", notes: "Dobrze", hw: "zad 1" }, t1)).body.lesson;
  await call("POST", "/api/lessons", { sid: s2.id, date: "2026-10-03", time: "17:00", min: 60, status: "done", amount: 8000 }, t2);
  const c1 = (await call("POST", `/api/students/${s1.id}/invite`, undefined, t1)).body.student.inviteCode;
  const c2 = (await call("POST", `/api/students/${s2.id}/invite`, undefined, t2)).body.student.inviteCode;
  const kid = await register("student", { code: c1 });
  await call("POST", "/api/student/link", { code: c2 }, kid);
  await call("PUT", "/api/student/homework/" + l1.id, { done: true }, kid);
  await call("POST", "/api/student/events", { title: "Basen", cat: "extra", repeat: "w", weekday: 0, start: "15:00", end: "16:00" }, kid);
  await call("POST", "/api/student/events", { title: "Prywatne", cat: "other", repeat: "w", weekday: 1, start: "15:00", end: "16:00", hideParent: true }, kid);
  // tutors cannot create parent codes any more; the child can
  assert.equal((await call("POST", `/api/students/${s1.id}/parent-invite`, undefined, t1)).status, 404);
  const code = (await call("POST", "/api/student/parent-code", undefined, kid)).body.parentCode;
  assert.ok(code);
  // the parent code is not a student code
  assert.equal((await call("POST", "/api/student/link", { code }, kid)).status, 404);
  const p1 = await register("parent", { code });
  const d = (await call("GET", "/api/parent/data", undefined, p1)).body;
  assert.equal(d.children.length, 1);
  const c = d.children[0];
  assert.equal(c.tutors.length, 2);
  assert.equal(c.lessons.length, 2);
  const L = c.lessons.find((l: any) => l.id === l1.id);
  assert.equal(L.notes, "Dobrze"); assert.equal(L.amount, 10000); assert.equal(L.prep, undefined); assert.equal(L.hwDone, true);
  assert.deepEqual(c.events.map((e: any) => e.title), ["Basen"]);
  // parents can't use tutor or student endpoints
  assert.equal((await call("GET", "/api/tutor/data", undefined, p1)).status, 403);
  assert.equal((await call("GET", "/api/student/data", undefined, p1)).status, 403);
  const p2 = await register("parent", { code });
  assert.equal((await call("POST", "/api/auth/register", { role: "parent", name: "P3", email: `p3${uniq}@x.pl`, password: "haslo123", code })).status, 409);
  assert.equal((await call("GET", "/api/tutor/data", undefined, t1)).body.students[0].parents, 2);
  assert.equal((await call("GET", "/api/student/data", undefined, kid)).body.parents.length, 2);
  // the child disconnects one parent, then turns access off
  await call("DELETE", "/api/student/parents/" + (await call("GET", "/api/auth/me", undefined, p2)).body.user.id, undefined, kid);
  assert.equal((await call("GET", "/api/parent/data", undefined, p2)).body.children.length, 0);
  await call("DELETE", "/api/student/parent-code", undefined, kid);
  assert.equal((await call("GET", "/api/parent/data", undefined, p1)).body.children.length, 0);
});

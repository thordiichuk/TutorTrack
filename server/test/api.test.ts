import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { runMigrations } from "../src/migrate.js";
import { pool } from "../src/db.js";

let app: Awaited<ReturnType<typeof buildApp>>;
const uniq = Date.now();

before(async () => { await runMigrations(() => {}); app = await buildApp(); });
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

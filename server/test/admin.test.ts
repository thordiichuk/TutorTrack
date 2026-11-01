import { after, before, test } from "node:test";
import assert from "node:assert/strict";

const uniq = Date.now();
const ADMIN = `admin${uniq}@x.pl`;
process.env.ADMIN_EMAILS = ADMIN;

let app: any, pool: any;
before(async () => {
  const { runMigrations } = await import("../src/migrate.js");
  const { buildApp } = await import("../src/app.js");
  ({ pool } = await import("../src/db.js"));
  await runMigrations(() => {});
  app = await buildApp();
});
after(async () => { await app.close(); await pool.end(); });

async function call(method: string, url: string, body?: unknown, cookie?: string) {
  const r = await app.inject({ method, url, payload: body, headers: cookie ? { cookie } : {} });
  const set = r.headers["set-cookie"];
  return { status: r.statusCode, body: r.json(), cookie: (Array.isArray(set) ? set[0] : set)?.split(";")[0] };
}
const reg = async (email: string, role = "tutor") => {
  const r = await call("POST", "/api/auth/register", { role, name: "T", email, password: "haslo123" });
  assert.equal(r.status, 200); return r;
};

test("only configured e-mails get admin access", async () => {
  const a = await reg(ADMIN), u = await reg(`user${uniq}@x.pl`);
  assert.equal(a.body.user.isAdmin, true);
  assert.equal(u.body.user.isAdmin, false);
  assert.equal((await call("GET", "/api/admin/stats", undefined, u.cookie)).status, 403);
  assert.equal((await call("GET", "/api/admin/stats")).status, 401);
  const st = await call("GET", "/api/admin/stats", undefined, a.cookie);
  assert.equal(st.status, 200);
  assert.ok(st.body.users.tutors >= 2);
  assert.equal(st.body.days.length, 14);
});

test("admin can block, change plan and delete; actions are logged", async () => {
  const a = (await call("POST", "/api/auth/login", { email: ADMIN, password: "haslo123" })).cookie!;
  const email = `victim${uniq}@x.pl`, v = await reg(email);
  const list = await call("GET", "/api/admin/users?q=" + encodeURIComponent("victim" + uniq), undefined, a);
  assert.equal(list.body.total, 1);
  const id = list.body.users[0].id;
  // block: existing session dies and login is refused
  assert.equal((await call("POST", `/api/admin/users/${id}/block`, { blocked: true }, a)).status, 200);
  assert.equal((await call("GET", "/api/auth/me", undefined, v.cookie)).body.user, null);
  assert.equal((await call("POST", "/api/auth/login", { email, password: "haslo123" })).status, 403);
  await call("POST", `/api/admin/users/${id}/block`, { blocked: false }, a);
  assert.equal((await call("POST", "/api/auth/login", { email, password: "haslo123" })).status, 200);
  assert.equal((await call("POST", `/api/admin/users/${id}/plan`, { plan: "pro" }, a)).status, 200);
  assert.equal((await call("DELETE", `/api/admin/users/${id}`, { confirmEmail: "wrong@x.pl" }, a)).status, 400);
  assert.equal((await call("DELETE", `/api/admin/users/${id}`, { confirmEmail: email }, a)).status, 200);
  const acts = (await call("GET", "/api/admin/actions", undefined, a)).body.actions.filter((x: any) => x.target === email).map((x: any) => x.action);
  assert.deepEqual(acts.sort(), ["block", "delete", "plan", "unblock"]);
});

test("admin cannot act on own account", async () => {
  const a = (await call("POST", "/api/auth/login", { email: ADMIN, password: "haslo123" }));
  assert.equal((await call("POST", `/api/admin/users/${a.body.user.id}/block`, { blocked: true }, a.cookie)).status, 400);
  assert.equal((await call("DELETE", `/api/admin/users/${a.body.user.id}`, { confirmEmail: ADMIN }, a.cookie)).status, 400);
  // ...but can change own plan
  assert.equal((await call("POST", `/api/admin/users/${a.body.user.id}/plan`, { plan: "pro" }, a.cookie)).status, 200);
  assert.equal((await call("GET", "/api/auth/me", undefined, a.cookie)).body.user.plan, "pro");
});

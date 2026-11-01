import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));

export async function runMigrations(log: (m: string) => void = console.log) {
  // A session-level advisory lock makes concurrent starts (several instances, parallel tests) apply migrations one at a time.
  const lock = await pool.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(727274)");
    await apply(log);
  } finally {
    await lock.query("SELECT pg_advisory_unlock(727274)").catch(() => {});
    lock.release();
  }
}

async function apply(log: (m: string) => void) {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await pool.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(dir + f, "utf8");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations(name) VALUES ($1)", [f]);
      await c.query("COMMIT");
      log(`migration applied: ${f}`);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}

import { buildApp } from "./app.js";
import { config } from "./config.js";
import { runMigrations } from "./migrate.js";

await runMigrations();
const app = await buildApp({ logger: true });
await app.listen({ port: config.port, host: config.host });

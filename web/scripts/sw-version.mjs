// Stamp the service worker with the build time, so every deploy installs a new worker and shows the update notice.
import { readFileSync, writeFileSync } from "node:fs";
const f = new URL("../dist/sw.js", import.meta.url);
writeFileSync(f, readFileSync(f, "utf8").replace("__BUILD__", Date.now().toString(36)));

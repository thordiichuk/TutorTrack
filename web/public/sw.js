/* TutorTrack service worker: fast start, read-only data when offline, update notice. */
const VERSION = "__BUILD__";
const SHELL = "tt-shell-" + VERSION;   // index.html, icons, manifest
const ASSETS = "tt-assets";            // hashed /assets/* files (never change)
const DATA = "tt-data";                // last data of the logged-in user (cleared on logout)
// GET endpoints whose last answer may be shown when there is no internet
const DATA_PATHS = ["/api/auth/me", "/api/tutor/data", "/api/student/data", "/api/parent/data"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"])).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("tt-shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
  if (e.data === "clearData") e.waitUntil(caches.delete(DATA));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // admin and everything else under /api stays online-only
  if (url.pathname.startsWith("/api/")) {
    if (DATA_PATHS.includes(url.pathname)) e.respondWith(dataFirst(req));
    return;
  }
  if (url.pathname.startsWith("/assets/")) { e.respondWith(cacheFirst(req, ASSETS)); return; }
  if (req.mode === "navigate") { e.respondWith(page(req)); return; }
  if (/\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) e.respondWith(cacheFirst(req, SHELL));
});

async function cacheFirst(req, name) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(name)).put(req, res.clone());
  return res;
}

// pages: always the newest index.html, the saved one when offline
async function page(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(SHELL)).put("/", res.clone());
    return res;
  } catch {
    return (await caches.match("/")) || new Response("Offline", { status: 503 });
  }
}

// data: network first; when offline, the saved answer marked with the time it was saved
async function dataFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const body = await res.clone().arrayBuffer();
      const h = new Headers(res.headers); h.set("x-tt-saved", String(Date.now()));
      (await caches.open(DATA)).put(req, new Response(body, { status: 200, headers: h }));
    }
    return res;
  } catch {
    const hit = await (await caches.open(DATA)).match(req);
    if (!hit) throw new Error("offline");
    const h = new Headers(hit.headers); h.set("x-tt-offline", hit.headers.get("x-tt-saved") || "0");
    return new Response(await hit.arrayBuffer(), { status: 200, headers: h });
  }
}

/** Installable app (PWA): service worker, install prompt, update notice and offline state. */
type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((f) => f());
export function onPwa(f: Listener) { listeners.add(f); return () => { listeners.delete(f); }; }

export const pwa = { update: false, offlineSince: 0, canInstall: false };
let deferred: any = null;
let waiting: ServiceWorker | null = null;

export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function registerPwa() {
  // how many times the app was opened (the install banner waits for a few visits)
  try { localStorage.setItem("tt_visits", String(Number(localStorage.getItem("tt_visits") || 0) + 1)); } catch { /* ignore */ }
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; pwa.canInstall = true; emit(); });
  addEventListener("appinstalled", () => { deferred = null; pwa.canInstall = false; emit(); });
  if (!("serviceWorker" in navigator) || location.hostname === "localhost" && location.port === "5173") return;
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      const found = (w: ServiceWorker | null) => { if (w && navigator.serviceWorker.controller) { waiting = w; pwa.update = true; emit(); } };
      if (reg.waiting) found(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => { if (w.state === "installed") found(w); });
      });
      // look for a new version when the app comes back to the screen
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (pwa.update && !reloaded) { reloaded = true; location.reload(); } });
  });
}

export function applyUpdate() { if (waiting) waiting.postMessage("skipWaiting"); else location.reload(); }

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null; pwa.canInstall = false; emit();
  return r?.outcome === "accepted";
}

/** Called by the API layer: a GET answered from the saved copy (offline) or from the server. */
export function markOffline(savedAt: number) { if (pwa.offlineSince !== savedAt) { pwa.offlineSince = savedAt; emit(); } }
export function markOnline() { if (pwa.offlineSince) { pwa.offlineSince = 0; emit(); } }

/** Remove the saved data of the logged-in user (on logout). */
export function clearSavedData() { try { caches.delete("tt-data"); } catch { /* ignore */ } }

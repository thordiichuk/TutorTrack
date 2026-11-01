import { useEffect, useState } from "react";

const EVT = "tt:navigate";

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search + location.hash) return;
  history[replace ? "replaceState" : "pushState"](null, "", to);
  window.dispatchEvent(new Event(EVT));
}

export function useLocation() {
  const get = () => ({ path: location.pathname.replace(/\/+$/, "") || "/", search: location.search, hash: location.hash });
  const [loc, setLoc] = useState(get);
  useEffect(() => {
    const h = () => setLoc(get());
    window.addEventListener("popstate", h);
    window.addEventListener(EVT, h);
    return () => { window.removeEventListener("popstate", h); window.removeEventListener(EVT, h); };
  }, []);
  return loc;
}

/** Same-origin <a href="/..."> clicks become client-side navigations. */
export function useLinkInterception() {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      e.preventDefault();
      navigate(href);
      if (!href.includes("#")) window.scrollTo(0, 0);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
}

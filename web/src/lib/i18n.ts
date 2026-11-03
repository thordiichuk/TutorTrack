/* Interface language: Polish (source text), Ukrainian, English.
 * Texts in the code are written in Polish and wrapped in tr("…"); uk.json / en.json map them to translations.
 * Placeholders {0}, {1}… are filled with the extra arguments. Changing the language reloads the page. */
import uk from "./i18n/uk.json";
import en from "./i18n/en.json";

export type Lang = "pl" | "uk" | "en";
export const LANGS: [Lang, string][] = [["pl", "Polski"], ["uk", "Українська"], ["en", "English"]];
const KEY = "tt_lang";

function detect(): Lang {
  try { const s = localStorage.getItem(KEY); if (s === "pl" || s === "uk" || s === "en") return s; } catch { /* private mode */ }
  const n = (navigator.language || "pl").toLowerCase();
  // Polish market: Polish by default, Ukrainian for Ukrainian/Russian browsers; English only when chosen
  return n.startsWith("uk") || n.startsWith("ru") ? "uk" : "pl";
}
export const LANG: Lang = detect();
const D: Record<string, string> = LANG === "uk" ? uk : LANG === "en" ? en : {};
if (typeof document !== "undefined") document.documentElement.lang = LANG;

export function tr(s: string, ...a: unknown[]): string {
  // "text§context" keys tell apart words that are the same in Polish (e.g. Plan = schedule vs. subscription)
  let r = D[s] ?? (s.includes("§") ? s.slice(0, s.indexOf("§")) : s);
  if (a.length) r = r.replace(/\{(\d+)\}/g, (_, i) => String(a[+i] ?? ""));
  return r;
}
/** Remember the language and reload so every text is rebuilt. */
export function setLang(l: Lang, reload = true) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  if (reload && l !== LANG) location.reload();
}
/** Locale for numbers and currency. */
export const LOCALE = LANG === "uk" ? "uk-UA" : LANG === "en" ? "en-GB" : "pl-PL";

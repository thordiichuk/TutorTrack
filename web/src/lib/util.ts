/* Shared types and pure helpers (ported 1:1 from the original single-file app). */

export type Role = "tutor" | "student";
export type Settings = {
  theme?: "light" | "auto" | "dark" | "graphite" | "blue" | "green" | "pink" | "orange" | "purple";
  dur?: number; time?: string; rate?: number; wk?: "mon" | "sun"; late?: boolean; goal?: number;
  tpl?: { n: string; t: string }[]; onbBilling?: boolean; welcomeSkipped?: boolean;
  cEmail?: string; cPhone?: string; showEmail?: boolean; showPhone?: boolean;
};
export type User = { id: string; email: string; role: Role; name: string; brand: string; plan: "free" | "pro"; settings: Settings; isAdmin?: boolean };
export type Student = {
  id: string; name: string; subject: string; email: string; phone: string; rate: number; rates: Record<string, number>; note: string;
  cancelMode: "off" | "percent" | "fixed"; cancelPct: number; cancelFixed: number; active: boolean; inviteCode: string | null; linked: boolean;
};
export type Status = "planned" | "done" | "cancelled";
export type Lesson = {
  id: string; sid: string; subject: string; date: string; time: string; min: number; topic: string; prep: string; notes: string;
  hw: string; hd: string; status: Status; paid: boolean; amount: number; fee: number;
  /** Student's request to cancel the lesson. */
  cr?: CancelRequest | null;
};
export type CancelRequest = { status: "pending" | "accepted" | "rejected" | "moved"; kind?: "cancel" | "move"; reason: string; note: string; at: number };
export type TrashItem = { kind: "student" | "lesson"; id: string; name: string; lessons?: number; date?: string; time?: string; deletedAt: number };
export type TutorData = { students: Student[]; lessons: Lesson[]; trash: TrashItem[] };

export const FREE = 3;
export const PRO_PLN = 1900;

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const ym = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
export function addDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
export function pd(s: string) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
export const WDSHORT = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];
export const MSHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
export const MLONG = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
export const WDL = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
export function fd(s: string) { const d = pd(s); return WDSHORT[d.getDay()] + ", " + d.getDate() + " " + MSHORT[d.getMonth()] + " " + d.getFullYear(); }
export function fm(m: string) { const p = m.split("-"); return MLONG[+p[1] - 1] + " " + p[0]; }
export const pln = (g: number) => (g / 100).toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
export function toG(v: string | number) {
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "" || !/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}
export const gStr = (g: number) => (g / 100).toFixed(2).replace(".", ",");
export const calc = (rate: number, min: number) => Math.round(rate * min / 60);
export function te(time: string, min: number) { const a = +time.slice(0, 2) * 60 + +time.slice(3, 5) + min; return pad(Math.floor(a / 60) % 24) + ":" + pad(a % 60); }
export const fmtH = (min: number) => (min / 60).toLocaleString("pl-PL", { maximumFractionDigits: 1 }) + " h";
export function fdt(ts: number) { const d = new Date(ts); return fd(ymd(d)) + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
export const uid = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const subjList = (s: { subject: string }) => String(s.subject || "").split(",").map((x) => x.trim()).filter(Boolean);
export const rateFor = (s: Student | undefined, sub: string) => (s && s.rates && sub && s.rates[sub] != null ? s.rates[sub] : s ? s.rate : 0);
export function cancelFee(st: Student | undefined, amount: number) {
  if (!st) return 0;
  const m = st.cancelMode || (st.cancelPct > 0 ? "percent" : "off");
  if (m === "percent") return Math.round(amount * (st.cancelPct || 0) / 100);
  if (m === "fixed") return Math.min(st.cancelFixed || 0, amount);
  return 0;
}
export const amt = (l: Lesson) => (l.status === "cancelled" ? l.fee || 0 : l.amount);
export const billable = (l: Lesson) => l.status === "done" || (l.status === "cancelled" && l.fee > 0);
export const sumAmt = (a: Lesson[], f: (l: Lesson) => boolean) => a.reduce((t, l) => t + (f(l) ? amt(l) : 0), 0);
export const sortL = <T extends { date: string; time: string }>(a: T[], dir: number) => a.slice().sort((x, y) => dir * (x.date + x.time).localeCompare(y.date + y.time));
export function overlap(lessons: Lesson[], d: string, t: string, m: number, skip?: string) {
  const a = +t.slice(0, 2) * 60 + +t.slice(3, 5), b = a + m;
  return lessons.filter((l) => {
    if (l.id === skip || l.status === "cancelled" || l.date !== d) return false;
    const x = +l.time.slice(0, 2) * 60 + +l.time.slice(3, 5);
    return a < x + l.min && x < b;
  });
}
export function lev(a: string, b: string) {
  const m: number[][] = [];
  for (let i = 0; i <= a.length; i++) m[i] = [i];
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
export const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e);
export const pwOk = (p: string) => p.length >= 8 && /\p{L}/u.test(p) && /\d/.test(p);
export const cq = (x: unknown) => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

export function download(name: string, text: string, mime: string) {
  const b = new Blob([text], { type: mime }), a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
}
/** Polish plural for "lekcja": 1 lekcja, 2–4 lekcje, 5+ lekcji. */
export function lekcje(n: number) { const d = n % 10, h = n % 100; return n + " " + (n === 1 ? "lekcja" : d >= 2 && d <= 4 && (h < 12 || h > 14) ? "lekcje" : "lekcji"); }
/** Each subject with its own hourly rate, e.g. [["Fizyka", 13000], ["Matematyka", 12000]]. */
export const subjRates = (s: Student) => { const l = subjList(s); return (l.length ? l : [""]).map((x) => [x, rateFor(s, x)] as [string, number]); };
/** Stable colour per subject (same in tutor and student panel). */
const SUBJ_COLORS = ["#3b82c4", "#7b6fd6", "#d9783a", "#2f9e6a", "#c2862b", "#c2557a", "#4f8f9c", "#8a6bbf"];
export function subjColor(sub: string) { let h = 0; for (const c of (sub || "").toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return SUBJ_COLORS[h % SUBJ_COLORS.length]; }


/** Print a plain-text document (e.g. a monthly summary). A separate window is used, so it also works on phones
 *  where the app's overlay/scroll locking would otherwise get printed instead of the text. */
export function printText(title: string, text: string) {
  const esc = (x: string) => x.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:32px;color:#111;line-height:1.55}pre{white-space:pre-wrap;font:inherit;font-size:14px}h1{font-size:18px;margin:0 0 16px}</style></head>
<body><h1>${esc(title)}</h1><pre>${esc(text)}</pre></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.open(); w.document.write(html); w.document.close();
    const go = () => { try { w.focus(); w.print(); } catch { /* user can print from the menu */ } };
    if (w.document.readyState === "complete") setTimeout(go, 250); else w.addEventListener("load", () => setTimeout(go, 100));
    return;
  }
  // pop-ups blocked: print the current page with only the summary visible
  const box = document.createElement("div"); box.className = "printbox"; box.innerHTML = "<h1>" + esc(title) + "</h1><pre>" + esc(text) + "</pre>";
  document.body.appendChild(box); document.body.classList.add("printing2");
  const done = () => { box.remove(); document.body.classList.remove("printing2"); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done); window.print(); setTimeout(() => { if (document.body.contains(box) && !matchMedia("print").matches) done(); }, 60000);
}

import { addDays, calc, FREE, Lesson, Student, TutorData, User } from "./util";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let demo: DemoState | null = null;
export const isDemo = () => !!demo;
export function startDemo() { demo = seedDemo(); }
export function stopDemo() { demo = null; }

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  if (demo && !path.startsWith("/api/auth/")) return fakeApi(demo, method, path, body) as T;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || "Wystąpił błąd. Spróbuj ponownie.");
  return data as T;
}

/* ---------- demo mode: the same endpoints, served from memory (nothing is saved) ---------- */
type DemoState = TutorData & { user: User };

function seedDemo(): DemoState {
  const a: Student = { id: "s1", name: "Anna Kowalska", subject: "Matematyka", email: "", phone: "", rate: 12000, rates: {}, note: "Przygotowanie do matury rozszerzonej.", cancelMode: "off", cancelPct: 0, cancelFixed: 0, active: true, inviteCode: null, linked: false };
  const b: Student = { ...a, id: "s2", name: "Jan Nowak", subject: "Angielski", email: "jan.demo@example.com", rate: 9000, note: "Poziom B1, cel: egzamin FCE." };
  const c: Student = { ...a, id: "s3", name: "Maria Wiśniewska", subject: "Fizyka", phone: "500 000 000", rate: 10000, note: "" };
  const L = (i: number, s: Student, d: number, t: string, m: number, topic: string, notes: string, status: Lesson["status"], paid: boolean): Lesson =>
    ({ id: "l" + i, sid: s.id, subject: "", date: addDays(d), time: t, min: m, topic, prep: "", notes, hw: "", hd: "", status, paid, amount: calc(s.rate, m), fee: 0 });
  return {
    user: { id: "demo", email: "demo@tutortrack.app", role: "tutor", name: "Gość", brand: "", plan: "free", settings: { welcomeSkipped: true, onbBilling: true } },
    students: [a, b, c],
    lessons: [
      L(1, a, -34, "16:00", 60, "Funkcje kwadratowe", "Powtórzyć wzory Viète’a.", "done", true),
      L(2, b, -27, "18:00", 45, "Present Perfect", "", "done", true),
      L(3, c, -20, "17:00", 90, "Kinematyka", "Zadania z ruchu jednostajnie przyspieszonego.", "done", false),
      L(4, a, -9, "16:00", 60, "Trygonometria", "Dobrze poszło, brakuje ćwiczeń z wykresów.", "done", true),
      L(5, b, -6, "18:00", 60, "Czasy przeszłe", "Odwołane przez ucznia.", "cancelled", false),
      L(6, c, -3, "17:00", 60, "Dynamika", "Zasady Newtona – utrwalić.", "done", false),
      L(7, a, -1, "16:00", 60, "Ciągi", "", "done", false),
      L(8, b, 1, "18:00", 60, "Conditionals", "", "planned", false),
      L(9, a, 2, "16:00", 90, "Prawdopodobieństwo", "", "planned", false),
      L(10, c, 4, "17:00", 60, "Praca i energia", "", "planned", false),
    ],
    trash: [],
  };
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
let n = 100;
const nid = () => "d" + ++n;

function fakeApi(s: DemoState, method: string, path: string, body: any): unknown {
  const fail = (st: number, m: string) => { throw new ApiError(st, m); };
  const active = () => s.students.filter((x) => x.active).length;
  const canActivate = () => { if (s.user.plan === "free" && active() >= FREE) fail(402, `Plan Free pozwala mieć do ${FREE} aktywnych uczniów. Zarchiwizuj jednego z uczniów lub włącz Pro.`); };
  const seg = path.split("?")[0].split("/").filter(Boolean).slice(1); // drop "api"
  const key = method + " " + seg.map((x, i) => (i > 0 && /^(s\d+|l\d+|d\d+)$/.test(x) ? ":id" : x)).join("/");
  const id = seg.find((x) => /^(s\d+|l\d+|d\d+)$/.test(x)) || "";
  switch (key) {
    case "GET tutor/data": return clone({ students: s.students, lessons: s.lessons, trash: s.trash });
    case "PATCH me": s.user = { ...s.user, ...(body.name ? { name: body.name } : {}), ...(body.brand != null ? { brand: body.brand } : {}), settings: { ...s.user.settings, ...(body.settings || {}) } }; return { user: clone(s.user) };
    case "POST me/plan": s.user.plan = body.plan; return { user: clone(s.user) };
    case "POST students": { canActivate(); const st = { cancelMode: "off", cancelPct: 0, cancelFixed: 0, rates: {}, email: "", phone: "", note: "", ...body, id: nid(), active: true, inviteCode: null, linked: false }; s.students.push(st); return { student: clone(st) }; }
    case "PATCH students/:id": { const st = s.students.find((x) => x.id === id) || fail(404, "Nie znaleziono ucznia."); if (body.active && !st.active) canActivate(); Object.assign(st, body); return { student: clone(st) }; }
    case "DELETE students/:id": {
      const st = s.students.find((x) => x.id === id); if (!st) return { ok: true };
      if (s.user.plan === "pro") s.trash.unshift({ kind: "student", id, name: st.name, lessons: s.lessons.filter((l) => l.sid === id).length, deletedAt: Date.now(), ...({ _s: st, _l: s.lessons.filter((l) => l.sid === id) } as any) });
      s.students = s.students.filter((x) => x.id !== id); s.lessons = s.lessons.filter((l) => l.sid !== id); return { ok: true };
    }
    case "POST students/:id/invite": case "DELETE students/:id/invite": fail(400, "W trybie demo nie można udostępniać panelu ucznia. Załóż konto, aby korzystać z tej funkcji."); break;
    case "POST lessons": { const l = { ...body, id: nid() }; s.lessons.push(l); return { lesson: clone(l) }; }
    case "PATCH lessons/:id": { const l = s.lessons.find((x) => x.id === id) || fail(404, "Nie znaleziono lekcji."); Object.assign(l, body); return { lesson: clone(l) }; }
    case "POST lessons/batch": { const out = body.ids.map((i: string) => Object.assign(s.lessons.find((x) => x.id === i)!, body.patch)); return { lessons: clone(out) }; }
    case "DELETE lessons/:id": {
      const l = s.lessons.find((x) => x.id === id); if (!l) return { ok: true };
      if (s.user.plan === "pro") { const st = s.students.find((x) => x.id === l.sid); s.trash.unshift({ kind: "lesson", id, name: st ? st.name : "", date: l.date, time: l.time, deletedAt: Date.now(), ...({ _l: l } as any) }); }
      s.lessons = s.lessons.filter((x) => x.id !== id); return { ok: true };
    }
    case "POST trash/student/:id/restore": case "POST trash/lesson/:id/restore": {
      const it: any = s.trash.find((x) => x.id === id); if (!it) return { ok: true };
      if (it.kind === "student") { if (it._s.active) canActivate(); s.students.push(it._s); s.lessons.push(...it._l); }
      else { if (!s.students.some((x) => x.id === it._l.sid)) fail(404, "Najpierw przywróć ucznia tej lekcji."); s.lessons.push(it._l); }
      s.trash = s.trash.filter((x) => x !== it); return { ok: true };
    }
    case "DELETE trash/student/:id": case "DELETE trash/lesson/:id": s.trash = s.trash.filter((x) => x.id !== id); return { ok: true };
    case "DELETE trash": s.trash = []; return { ok: true };
    case "GET export": return { app: "tutortrack", version: 2, demo: true, students: clone(s.students), lessons: clone(s.lessons) };
    case "POST import": fail(400, "W trybie demo nie można importować danych."); break;
  }
  return fail(400, "Ta funkcja nie jest dostępna w trybie demo.");
}

export const demoUser = () => (demo ? clone(demo.user) : null);

import { createContext, Dispatch, ReactNode, SetStateAction, useContext } from "react";
import { navigate } from "../lib/router";
import { amt, billable, Lesson, MSHORT, overlap, pd, pln, PRO_PLN, FREE, Student, subjList, fd, ymd, addDays, ym } from "../lib/util";
import { useOverlay } from "../ui/overlay";
import { useTutor } from "../state";

/* ---------- per-session UI state shared by tutor views (filters, months) ---------- */
export type Ui = {
  q: string; sf: "active" | "arch" | "all"; subj: string;
  lf: { st: string; mo: string; ls: string; ps: string; q: string; o: "desc" | "asc" };
  month: string; bm: string; open: Record<string, boolean>; lv: "list" | "cal"; cm: string; cd: string; sr: string;
};
export const initialUi = (): Ui => ({
  q: "", sf: "active", subj: "", lf: { st: "", mo: "", ls: "", ps: "", q: "", o: "desc" },
  month: ym(new Date()), bm: ym(new Date()), open: {}, lv: "list", cm: ym(new Date()), cd: "", sr: "6",
});
export const UiCtx = createContext<[Ui, Dispatch<SetStateAction<Ui>>]>(null as any);
export const useUi = () => useContext(UiCtx);

export function useData() {
  const { data } = useTutor();
  const d = data!;
  const stu = (id: string) => d.students.find((s) => s.id === id);
  return { ...d, stu };
}

/* ---------- Pro / limits ---------- */
export function useUpsell() {
  const { modal, close } = useOverlay();
  const go = () => { close(); navigate("/aplikacja/plan"); };
  return {
    upsell: () => modal(<><h2>Limit planu Free został osiągnięty</h2><p>Plan Free pozwala mieć do {FREE} aktywnych uczniów. Zarchiwizuj jednego z uczniów lub przetestuj Pro, aby dodawać bez limitu.</p><div className="mf"><button className="btn" onClick={close}>Zamknij</button><button className="btn p" onClick={go}>Zobacz plan Pro</button></div></>),
    proUp: (f: string) => modal(<><h2>Funkcja planu Pro</h2><p>{f} jest dostępna w planie Pro ({pln(PRO_PLN).replace(",00", "")} miesięcznie). Możesz włączyć Pro w trybie testowym – żadna płatność nie zostanie pobrana.</p><div className="mf"><button className="btn" onClick={close}>Zamknij</button><button className="btn p" onClick={go}>Zobacz plan Pro</button></div></>),
  };
}

/* ---------- lesson row ---------- */
/** Minimal tags: only what needs attention (overlap, today/tomorrow, request, done/cancelled, payment of billable lessons). */
export function LessonTags({ l, lessons, nd }: { l: Lesson; lessons: Lesson[]; nd?: boolean }) {
  const td = ymd(new Date());
  const tags: [string, string][] = [];
  if (l.status !== "cancelled" && overlap(lessons, l.date, l.time, l.min, l.id).length > 0) tags.push(["Nakłada się", "rd"]);
  if (!nd && l.status === "planned" && l.date === td) tags.push(["Dziś", "ac"]);
  if (!nd && l.status === "planned" && l.date === addDays(1)) tags.push(["Jutro", ""]);
  if (l.cr?.status === "pending") tags.push(["Prośba o odwołanie", "am"]);
  if (l.status === "done") tags.push(["Przeprowadzona", "gr"]);
  if (l.status === "cancelled") tags.push(["Odwołana", "rd"]);
  if (billable(l)) tags.push(l.paid ? ["Opłacona", "gr"] : ["Nieopłacona", "am"]);
  else if (l.paid) tags.push(["Opłacona z góry", "gr"]);
  return <>{tags.map(([t, c]) => <span key={t} className={"tag " + c} style={{ marginRight: 4 }}>{t}</span>)}</>;
}

/** Compact, tappable lesson row. Tapping opens the lesson window with all actions. */
export function LessonItem({ l, nd, quick = true }: { l: Lesson; nd?: boolean; quick?: boolean }) {
  const { lessons, stu } = useData();
  const { modal } = useOverlay();
  const s = stu(l.sid);
  const sub = l.subject || (s ? subjList(s)[0] : "");
  const ov = l.status !== "cancelled" && overlap(lessons, l.date, l.time, l.min, l.id).length > 0;
  const open = () => modal(<LessonSheetLazy id={l.id} />);
  const d = pd(l.date);
  return (
    <div role="button" tabIndex={0} className={"srow lrow" + (ov ? " clash" : "") + (l.status === "cancelled" ? " cx" : "")} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <span className="tm">{nd ? <>{l.time}<small>{l.min} min</small></> : <>{d.getDate()} {MSHORT[d.getMonth()]}<small>{l.time}</small></>}</span>
      <span className={"sb" + (l.status === "done" ? " ok" : "")} />
      <span className="m"><b>{s ? s.name : "?"}{sub ? " · " + sub : ""}</b><span>{l.topic || (l.status === "cancelled" ? "Lekcja odwołana" : "Bez tematu")}{l.cr?.status === "pending" ? " · prośba: " + l.cr.reason : ""}</span></span>
      <span className="ltags"><LessonTags l={l} lessons={lessons} nd={nd} /></span>
      {quick && <QuickDone l={l} />}
    </div>
  );
}
/* set by Forms.tsx to avoid a circular import at module load */
export let LessonSheetLazy: (p: { id: string }) => ReactNode = () => null;
export let QuickDone: (p: { l: Lesson }) => ReactNode = () => null;
export function registerLessonUi(sheet: typeof LessonSheetLazy, quick: typeof QuickDone) { LessonSheetLazy = sheet; QuickDone = quick; }

export function LessonRow({ l, full, nd, actions }: { l: Lesson; full?: boolean; nd?: boolean; actions?: ReactNode }) {
  const { lessons, stu } = useData();
  const s = stu(l.sid);
  const sub = l.subject || (s ? subjList(s)[0] : "");
  const ov = l.status !== "cancelled" && overlap(lessons, l.date, l.time, l.min, l.id).length > 0;
  return (
    <div className="row" style={ov ? { background: "var(--rdl)", borderLeft: "4px solid var(--rd)", paddingLeft: 10, borderRadius: 8 } : undefined}>
      <div className="m">
        <b>{nd ? "" : fd(l.date) + ", "}{l.time}</b>
        <span style={{ display: "block", color: "var(--tx)" }}>{s ? s.name : "?"}{sub ? " · " + sub : ""}</span>
        <span style={{ display: "block", color: "var(--tx)" }}>{l.min} min · {l.status === "cancelled" ? (l.fee > 0 ? pln(l.fee) + " (opłata)" : "bez opłaty") : pln(l.amount)}</span>
        <span style={{ display: "block" }}>Temat: {l.topic || "Bez tematu"}</span>
        {l.prep && <span style={{ display: "block" }}>Przed zajęciami: {l.prep}</span>}
        {l.notes && <span style={{ display: "block" }}>Po zajęciach: {l.notes}</span>}
        {l.hw && <span style={{ display: "block" }}>Praca domowa: {l.hw}{l.hd ? " (termin: " + fd(l.hd) + ")" : ""}</span>}
        {l.cr?.status === "pending" && <span style={{ display: "block", color: "var(--am)" }}>Uczeń prosi o odwołanie: {l.cr.reason}</span>}
        {l.cr?.status === "accepted" && l.status === "cancelled" && <span style={{ display: "block" }}>Odwołana na prośbę ucznia: {l.cr.reason}</span>}
      </div>
      <div><LessonTags l={l} lessons={lessons} nd={nd} /></div>
      {full && actions}
    </div>
  );
}

export const studentOf = (students: Student[], id: string) => students.find((s) => s.id === id);
export const lessonAmount = amt;

import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect } from "react";
import { navigate } from "../lib/router";
import { amt, billable, Lesson, MSHORT, overlap, pd, pln, PRO_PLN, FREE, Student, subjList, fd, ymd, addDays, ym, te, subjColor } from "../lib/util";
import { useOverlay } from "../ui/overlay";
import { useTutor } from "../state";
import { tr } from "../lib/i18n";

/* ---------- per-session UI state shared by tutor views (filters, months) ---------- */
export type Ui = {
  q: string; sf: "active" | "arch" | "all"; so: "az" | "za" | "ln" | "new"; subj: string;
  lf: { m: "week" | "pay" | "up" | "past" | "all"; w: number; sv: "up" | "past" | "all"; st: string; sb: string; mo: string; ls: string; ps: string; q: string; o: "desc" | "asc" };
  sel: string; month: string; bm: string; open: Record<string, boolean>; lv: "list" | "cal"; cm: string; cd: string; sr: string;
};
export const initialUi = (): Ui => ({
  q: "", sf: "active", so: "ln", subj: "", lf: { m: "week", w: 0, sv: "up", st: "", sb: "", mo: "", ls: "", ps: "", q: "", o: "desc" },
  sel: "", month: ym(new Date()), bm: ym(new Date()), open: {}, lv: "list", cm: ym(new Date()), cd: "", sr: "6",
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
    upsell: () => modal(<><h2>{tr("Limit planu Free został osiągnięty")}</h2><p>{tr("Plan Free pozwala mieć do")}{" "}{FREE}{" "}{tr("aktywnych uczniów. Zarchiwizuj jednego z uczniów lub przetestuj Pro, aby dodawać bez limitu.")}</p><div className="mf"><button className="btn" onClick={close}>{tr("Zamknij")}</button><button className="btn p" onClick={go}>{tr("Zobacz plan Pro")}</button></div></>),
    proUp: (f: string) => modal(<><h2>{tr("Funkcja planu Pro")}</h2><p>{f}{" "}{tr("jest dostępna w planie Pro (")}{pln(PRO_PLN).replace(",00", "")}{" "}{tr("miesięcznie). Możesz włączyć Pro w trybie testowym – żadna płatność nie zostanie pobrana.")}</p><div className="mf"><button className="btn" onClick={close}>{tr("Zamknij")}</button><button className="btn p" onClick={go}>{tr("Zobacz plan Pro")}</button></div></>),
  };
}

/* ---------- lesson row ---------- */
/** Minimal tags: only what needs attention (overlap, today/tomorrow, request, done/cancelled, payment of billable lessons). */
export function LessonTags({ l, lessons, nd }: { l: Lesson; lessons: Lesson[]; nd?: boolean }) {
  const td = ymd(new Date());
  const tags: [string, string][] = [];
  if (l.status !== "cancelled" && overlap(lessons, l.date, l.time, l.min, l.id).length > 0) tags.push([tr("Nakłada się"), "rd"]);
  if (!nd && l.status === "planned" && l.date === td) tags.push([tr("Dziś"), "ac"]);
  if (!nd && l.status === "planned" && l.date === addDays(1)) tags.push([tr("Jutro"), ""]);
  if (l.cr?.status === "pending") tags.push([l.cr.kind === "move" ? tr("Prośba o przeniesienie") : tr("Prośba o odwołanie"), "am"]);
  if (l.status === "done") tags.push([tr("Przeprowadzona"), "gr"]);
  if (l.status === "cancelled") tags.push([tr("Odwołana"), "rd"]);
  if (billable(l)) tags.push(l.paid ? [tr("Opłacona"), "gr"] : [tr("Nieopłacona"), "am"]);
  else if (l.paid) tags.push([tr("Opłacona z góry"), "gr"]);
  return <>{tags.map(([t, c]) => <span key={t} className={"tag " + c} style={{ marginRight: 4 }}>{t}</span>)}</>;
}

/** The single most important status of a lesson, shown under the amount. */
function lessonChip(l: Lesson, ov: boolean): [string, string] | null {
  if (l.cr?.status === "pending") return [l.cr.kind === "move" ? tr("prośba o przeniesienie") : tr("prośba o odwołanie"), "am"];
  if (ov) return [tr("nakłada się"), "rd"];
  if (l.status === "cancelled") return [l.fee > 0 ? (l.paid ? tr("opłata · opłacona") : tr("opłata za odwołanie")) : tr("odwołana"), l.fee > 0 && !l.paid ? "am" : ""];
  if (l.status === "done") return l.paid ? [tr("opłacona"), "gr"] : [tr("nieopłacona"), "am"];
  if (l.paid) return [tr("z góry"), "gr"];
  if (l.date < ymd(new Date())) return [tr("do potwierdzenia"), "am"];
  return null;
}

/** Compact, tappable lesson row. Tapping opens the lesson window with all actions. */
export function LessonItem({ l, nd, quick = true, noName }: { l: Lesson; nd?: boolean; quick?: boolean; noName?: boolean }) {
  const { lessons, stu } = useData();
  const { modal, current } = useOverlay();
  const [ui, setUi] = useUi();
  const s = stu(l.sid);
  const sub = l.subject || (s ? subjList(s)[0] : "");
  const ov = l.status !== "cancelled" && overlap(lessons, l.date, l.time, l.min, l.id).length > 0;
  const sel = ui.sel === l.id;
  // the highlight lasts while the lesson window is open
  useEffect(() => { if (sel && !current) { const t = setTimeout(() => setUi((u) => (u.sel === l.id ? { ...u, sel: "" } : u)), 600); return () => clearTimeout(t); } }, [sel, current]);
  const open = (e?: { currentTarget: HTMLElement }) => {
    setUi((u) => ({ ...u, sel: l.id }));
    // on phones the window slides up from the bottom – move the chosen row above it
    const el = e?.currentTarget;
    if (el && innerWidth <= 600 && !el.closest(".modal")) { const top = el.getBoundingClientRect().top; if (top > 140) scrollBy({ top: top - 90, behavior: "smooth" }); }
    modal(<LessonSheetLazy id={l.id} />);
  };
  const d = pd(l.date);
  const chip = lessonChip(l, ov);
  const money = l.status === "cancelled" ? (l.fee > 0 ? pln(l.fee) : "–") : pln(l.amount);
  return (
    <div role="button" tabIndex={0} aria-current={sel ? "true" : undefined} className={"lrow2" + (ov ? " clash" : "") + (l.status === "cancelled" ? " cx" : "") + (sel ? " sel" : "")} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); } }}>
      <span className="lbar" style={{ background: l.status === "cancelled" ? "var(--bd)" : subjColor(sub) }} />
      <span className="ltm">{nd ? <>{l.time}<small>{te(l.time, l.min)}</small></> : <>{d.getDate()} {MSHORT[d.getMonth()]}<small>{l.time}</small></>}</span>
      <span className="lwho"><b>{noName ? sub || tr("Lekcja") : s ? s.name : "?"}{l.seriesId && <i className="sico2" title={tr("Lekcja z serii")}>↻</i>}</b><span>{(noName ? [l.topic || (l.status === "cancelled" ? "" : tr("bez tematu"))] : [sub, l.topic || (l.status === "cancelled" ? "" : tr("bez tematu"))]).filter(Boolean).join(" · ")}{l.cr?.status === "pending" ? " · „" + l.cr.reason + "”" : ""}</span></span>
      <span className="lrt"><b>{money.replace(",00", "")}</b>{chip && <span className={"lchip " + chip[1]}>{chip[0]}</span>}</span>
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
        <span style={{ display: "block", color: "var(--tx)" }}>{l.min}{" "}{tr("min ·")}{" "}{l.status === "cancelled" ? (l.fee > 0 ? pln(l.fee) + tr(" (opłata)") : tr("bez opłaty")) : pln(l.amount)}</span>
        <span style={{ display: "block" }}>{tr("Temat:")}{" "}{l.topic || tr("Bez tematu")}</span>
        {l.prep && <span style={{ display: "block" }}>{tr("Przed zajęciami:")}{" "}{l.prep}</span>}
        {l.notes && <span style={{ display: "block" }}>{tr("Po zajęciach:")}{" "}{l.notes}</span>}
        {l.hw && <span style={{ display: "block" }}>{tr("Praca domowa:")}{" "}{l.hw}{l.hd ? tr(" (termin: ") + fd(l.hd) + ")" : ""}</span>}
        {l.cr?.status === "pending" && <span style={{ display: "block", color: "var(--am)" }}>{l.cr.kind === "move" ? tr("Uczeń prosi o przeniesienie") : tr("Uczeń prosi o odwołanie")}: {l.cr.reason}</span>}
        {l.cr?.status === "accepted" && l.status === "cancelled" && <span style={{ display: "block" }}>{tr("Odwołana na prośbę ucznia:")}{" "}{l.cr.reason}</span>}
      </div>
      <div><LessonTags l={l} lessons={lessons} nd={nd} /></div>
      {full && actions}
    </div>
  );
}

export const studentOf = (students: Student[], id: string) => students.find((s) => s.id === id);
export const lessonAmount = amt;

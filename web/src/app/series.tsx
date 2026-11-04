/* Recurring lessons (Pro): date maths, the "Powtarzaj" box in the lesson form, the scope question and the series list. */
import { useState } from "react";
import { api } from "../lib/api";
import { tr } from "../lib/i18n";
import { fd, Lesson, MSHORT, overlap, pd, subjList, WDL, ymd } from "../lib/util";
import { useTutor } from "../state";
import { useOverlay } from "../ui/overlay";
import { useData } from "./common";

export type Rep = { freq: 0 | 1 | 2; mode: "date" | "count"; until: string; count: string; skips: { from: string; to: string }[]; conflicts: "skip" | "add" };
export const MAX_SERIES = 60;

const lastFriday = (y: number, m: number) => { const d = new Date(y, m + 1, 0); while (d.getDay() !== 5) d.setDate(d.getDate() - 1); return ymd(d); };
/** Polish school year ends on the last Friday of June. */
export function schoolYearEnd(from: string) { const d = pd(from); const y = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear(); const e = lastFriday(y, 5); return e >= from ? e : lastFriday(y + 1, 5); }
/** First term: until the last Friday of January (Aug–Jan), otherwise the end of the school year. */
export function semesterEnd(from: string) { const d = pd(from), m = d.getMonth(); if (m >= 7) return lastFriday(d.getFullYear() + 1, 0); if (m === 0) { const e = lastFriday(d.getFullYear(), 0); if (e >= from) return e; } return schoolYearEnd(from); }
export const newRep = (start: string): Rep => ({ freq: 0, mode: "date", until: schoolYearEnd(start), count: "10", skips: [], conflicts: "skip" });

const addD = (s: string, n: number) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
/** Every 1 or 2 weeks from `start`, without the skipped periods; capped at MAX_SERIES. */
export function seriesDates(start: string, r: Pick<Rep, "freq" | "mode" | "until" | "count" | "skips">, max = MAX_SERIES) {
  const out: string[] = []; if (!start || !r.freq) return out;
  const n = r.mode === "count" ? Math.max(0, Math.min(max, parseInt(r.count) || 0)) : max;
  const skip = (d: string) => r.skips.some((s) => s.from && d >= s.from && d <= (s.to || s.from));
  for (let d = start, guard = 0; out.length < n && guard < 400; d = addD(d, 7 * r.freq), guard++) {
    if (r.mode === "date" && (!r.until || d > r.until)) break;
    if (!skip(d)) out.push(d);
  }
  return out;
}
const short = (s: string) => { const d = pd(s); return d.getDate() + " " + MSHORT[d.getMonth()]; };

/** The "Powtarzaj" section of the new-lesson form. */
export function RepeatBox({ start, time, min, rep, set, pro, onPro, fixed }: { start: string; time: string; min: number; rep: Rep; set: (r: Rep) => void; pro: boolean; onPro: () => void; fixed?: boolean }) {
  const { lessons } = useData();
  const all = seriesDates(start, rep, 400);
  const dates = all.slice(0, MAX_SERIES);
  const clash = dates.filter((d) => overlap(lessons, d, time, min || 60).length > 0);
  const p = (x: Partial<Rep>) => set({ ...rep, ...x });
  return <div className="repbox">
    {!fixed && <div className="f"><label htmlFor="lrp">{tr("Powtarzaj")}{!pro && <> <span className="tag ac">Pro</span></>}</label>
      <select id="lrp" value={rep.freq} onChange={(e) => { const v = +e.target.value as Rep["freq"]; if (v && !pro) { onPro(); return; } p({ freq: v }); }}>
        <option value={0}>{tr("Nie powtarzaj")}</option><option value={1}>{tr("Co tydzień")}</option><option value={2}>{tr("Co 2 tygodnie")}</option></select></div>}
    {rep.freq > 0 && <>
      <div className="seg" role="group" aria-label={tr("Do kiedy")} style={{ marginBottom: 10 }}>
        <button type="button" aria-pressed={rep.mode === "date"} onClick={() => p({ mode: "date" })}>{tr("Do daty")}</button>
        <button type="button" aria-pressed={rep.mode === "count"} onClick={() => p({ mode: "count" })}>{tr("Liczba lekcji")}</button></div>
      {rep.mode === "date" ? <>
        <div className="f"><label htmlFor="lru">{tr("Ostatnia lekcja najpóźniej")}</label><input id="lru" type="date" min={start} value={rep.until} onChange={(e) => p({ until: e.target.value })} /></div>
        <div className="acts" style={{ marginTop: -4, marginBottom: 10 }}>
          <button type="button" className="btn s" onClick={() => p({ until: semesterEnd(start) })}>{tr("Do końca semestru")}</button>
          <button type="button" className="btn s" onClick={() => p({ until: schoolYearEnd(start) })}>{tr("Do końca roku szkolnego")}</button></div>
      </> : <div className="f"><label htmlFor="lrc">{tr("Liczba lekcji (maks. {0})", MAX_SERIES)}</label><input id="lrc" type="number" min={1} max={MAX_SERIES} value={rep.count} onChange={(e) => p({ count: e.target.value })} /></div>}
      <div className="f"><label>{tr("Pomiń daty (ferie, święta, wyjazdy)")}</label>
        {rep.skips.map((s, i) => <div className="skiprow" key={i}>
          <input type="date" aria-label={tr("Od")} value={s.from} onChange={(e) => p({ skips: rep.skips.map((x, j) => j === i ? { ...x, from: e.target.value } : x) })} />
          <span aria-hidden="true">–</span>
          <input type="date" aria-label={tr("Do (opcjonalnie)")} value={s.to} min={s.from} onChange={(e) => p({ skips: rep.skips.map((x, j) => j === i ? { ...x, to: e.target.value } : x) })} />
          <button type="button" className="mx2" aria-label={tr("Usuń przerwę")} onClick={() => p({ skips: rep.skips.filter((_, j) => j !== i) })}>×</button></div>)}
        <button type="button" className="btn s" onClick={() => p({ skips: [...rep.skips, { from: "", to: "" }] })}>{tr("+ Dodaj przerwę")}</button>
        <p className="hint" style={{ margin: "6px 0 0" }}>{tr("Jeden dzień: wpisz tylko pierwszą datę. Ferie: wpisz od – do.")}</p></div>
      <div className={"reppre" + (dates.length ? "" : " bad")}>
        {dates.length ? <><b>{tr("Zostanie dodanych lekcji: {0}", dates.length - (rep.conflicts === "skip" ? clash.length : 0))}</b><span>{tr("od {0} do {1}", fd(dates[0]), fd(dates[dates.length - 1]))}</span>
          {all.length > MAX_SERIES && <span>{tr("Seria może mieć najwyżej {0} lekcji – dalsze terminy dodasz przyciskiem „Przedłuż”.", MAX_SERIES)}</span>}</>
          : <b>{tr("Brak terminów – sprawdź datę początku i końca.")}</b>}
        {clash.length > 0 && <div className="repclash"><span>{tr("Terminy nakładające się na inne lekcje: {0} ({1})", clash.length, clash.slice(0, 4).map(short).join(", ") + (clash.length > 4 ? "…" : ""))}</span>
          <div className="seg" role="group" aria-label={tr("Co zrobić z nakładającymi się terminami")}>
            <button type="button" aria-pressed={rep.conflicts === "skip"} onClick={() => p({ conflicts: "skip" })}>{tr("Pomiń te daty")}</button>
            <button type="button" aria-pressed={rep.conflicts === "add"} onClick={() => p({ conflicts: "add" })}>{tr("Dodaj mimo to")}</button></div></div>}
      </div>
    </>}
  </div>;
}
/** Final list of dates to send, after the conflict choice. */
export function repDates(start: string, time: string, min: number, rep: Rep, lessons: Lesson[]) {
  const d = seriesDates(start, rep);
  return rep.conflicts === "skip" ? d.filter((x) => !overlap(lessons, x, time, min).length) : d;
}

/** Later planned lessons of the same series (the ones "this and following" would change). */
export const laterInSeries = (l: Lesson, lessons: Lesson[]) => l.seriesId ? lessons.filter((x) => x.seriesId === l.seriesId && x.id !== l.id && x.date > l.date && x.status === "planned") : [];

/** Ask whether a change applies to this lesson only or also to the following ones. */
export function ScopeAsk({ title, text, n, onPick, danger }: { title: string; text: string; n: number; onPick: (s: "one" | "future") => void; danger?: boolean }) {
  const { close } = useOverlay();
  return <><h2>{title}</h2><p>{text}</p><p className="hint">{tr("Ta lekcja należy do serii. Kolejnych zaplanowanych lekcji w serii: {0}.", n)}</p>
    <div className="scopeb"><button className={"btn" + (danger ? " d" : "")} onClick={() => onPick("one")}>{tr("Tylko tę lekcję")}</button>
      <button className={"btn p" + (danger ? " dp" : "")} onClick={() => onPick("future")}>{tr("Tę i wszystkie następne")}</button>
      <button className="btn" onClick={close}>{tr("Anuluj")}</button></div></>;
}

/** Series of one student, shown in the student window. */
export function SeriesList({ sid }: { sid: string }) {
  const { lessons, series, stu } = useData();
  const { modal, confirm } = useOverlay();
  const { run } = useTutor();
  const td = ymd(new Date());
  const list = (series || []).filter((s) => s.sid === sid).map((s) => {
    const ls = lessons.filter((l) => l.seriesId === s.id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const left = ls.filter((l) => l.status === "planned" && l.date >= td);
    return { ...s, ls, left, last: ls[ls.length - 1] };
  }).filter((s) => s.ls.length && s.left.length);
  if (!list.length) return null;
  return <div className="serlist"><h2>{tr("Serie lekcji")}</h2>
    {list.map((s) => { const l = s.last!; const wd = WDL[(pd(l.date).getDay() + 6) % 7].toLowerCase();
      return <div className="serrow" key={s.id}><span className="sico" aria-hidden="true">↻</span>
        <div className="lwho"><b>{(l.subject || subjList(stu(sid) || { subject: "" })[0] || tr("Lekcja")) + " · " + (s.freq === 2 ? tr("co 2 tygodnie") : tr("co tydzień")) + " · " + wd + " " + l.time}</b>
          <span>{tr("do {0} · zostało lekcji: {1}", fd(l.date), s.left.length)}</span></div>
        <div className="acts">
          <button className="btn s" onClick={() => modal(<ExtendSeries id={s.id} freq={s.freq as 1 | 2} last={l} />)}>{tr("Przedłuż")}</button>
          <button className="btn s d" onClick={() => confirm({ title: tr("Zakończyć serię?"), text: tr("Zaplanowane lekcje od dziś ({0}) zostaną usunięte. Przeprowadzone lekcje zostają.", s.left.length), ok: tr("Zakończ serię"), danger: true,
            onOk: () => { run(() => api("POST", `/api/series/${s.id}/end`, {}), tr("Seria zakończona.")); } })}>{tr("Zakończ")}</button></div></div>; })}
  </div>;
}

function ExtendSeries({ id, freq, last }: { id: string; freq: 1 | 2; last: Lesson }) {
  const { lessons } = useData();
  const { run } = useTutor();
  const { close } = useOverlay();
  const start = (() => { const d = pd(last.date); d.setDate(d.getDate() + 7 * freq); return ymd(d); })();
  const [rep, setRep] = useState<Rep>({ ...newRep(start), freq });
  const dates = repDates(start, last.time, last.min, rep, lessons);
  return <><h2>{tr("Przedłuż serię")}</h2><p className="hint">{tr("Kolejne lekcje od {0}, {1}, ta sama godzina i kwota.", fd(start), freq === 2 ? tr("co 2 tygodnie") : tr("co tydzień"))}</p>
    <RepeatBox start={start} time={last.time} min={last.min} rep={rep} set={setRep} pro onPro={() => {}} fixed />
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button>
      <button className="btn p" disabled={!dates.length} onClick={async () => { if (await run(() => api("POST", `/api/series/${id}/extend`, { dates }), tr("Dodano lekcji: {0}", dates.length))) close(); }}>{tr("Przedłuż")}</button></div></>;
}

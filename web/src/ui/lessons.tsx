import { ReactNode } from "react";
import { tr } from "../lib/i18n";
import { fd, fm, lekcje, MGEN as MLONG_G, MSHORT, pd, pln, subjColor, te, WDL, ymd } from "../lib/util";

/**
 * Lesson list pieces shared by the student and parent panels.
 * They reuse the tutor's markup (lrow2, dgrp/dgh/dgl, lsheet/kv, wkbar ltw) so lessons look the same everywhere.
 */
export type VLesson = {
  id: string; date: string; time: string; min: number; subject: string; topic: string; status: "planned" | "done" | "cancelled";
  notes: string; hw: string; hd: string; amount: number; paid: boolean; tutor: string;
  hwDone?: boolean; cr?: { status: string; kind?: string; reason?: string; note?: string } | null;
};
export type VEvent = { id: string; title: string; cat: string; repeat: "w" | "o"; weekday: number; date: string; start: string; end: string; hideParent?: boolean };

export const CATS = (): Record<string, string> => ({ school: tr("Szkoła"), tutor: tr("Korepetycje spoza TutorTrack"), extra: tr("Zajęcia dodatkowe"), other: tr("Inne") });
const CAT_COLOR: Record<string, string> = { school: "#3b82f6", extra: "#16a34a", tutor: "#d97706", other: "#8b8fa8" };

/** Lessons the tutor bills: done ones and cancellations with a fee. */
export const vBillable = (l: VLesson) => l.status === "done" || (l.status === "cancelled" && l.amount > 0);
export const vUnpaid = (l: VLesson) => vBillable(l) && !l.paid && l.amount > 0;
export const vKey = (l: VLesson) => l.date + " " + l.time;

/** One short status, most important first (same idea as the tutor's chip). */
export function vChip(l: VLesson, clash = false): [string, string] | null {
  if (clash) return [tr("nakłada się"), "rd"];
  if (l.status === "cancelled") return l.amount > 0 ? [l.paid ? tr("opłata · opłacona") : tr("opłata"), l.paid ? "gr" : "am"] : [tr("odwołana"), "rd"];
  if (l.cr?.status === "pending") return [l.cr.kind === "move" ? tr("prośba o przeniesienie") : tr("prośba o odwołanie"), "am"];
  if (l.cr?.status === "moved" && l.status === "planned") return [tr("przeniesiona"), ""];
  if (l.status === "done") {
    if (l.hw && !l.hwDone) return [tr("zadanie"), "am"];
    return l.paid ? [tr("opłacona"), "gr"] : l.amount > 0 ? [tr("nieopłacona"), "am"] : null;
  }
  return l.paid && l.amount > 0 ? [tr("z góry"), "gr"] : null;
}

/** A lesson row: subject colour bar, time (or date), subject · topic, tutor, amount and one status. */
export function VRow({ l, nd, clash, onClick, sel }: { l: VLesson; nd?: boolean; clash?: boolean; onClick: () => void; sel?: boolean }) {
  const d = pd(l.date), chip = vChip(l, clash), today = l.date === ymd(new Date());
  const money = l.status === "cancelled" ? (l.amount > 0 ? pln(l.amount) : "–") : pln(l.amount);
  return <div role="button" tabIndex={0} className={"lrow2" + (l.status === "cancelled" ? " cx" : "") + (clash ? " clash" : "") + (sel ? " sel" : "") + (!nd && today ? " tday" : "")} onClick={onClick}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>
    <span className="lbar" style={{ background: l.status === "cancelled" ? "var(--bd)" : subjColor(l.subject) }} />
    <span className="ltm">{nd ? <>{l.time}<small>{te(l.time, l.min)}</small></> : <>{d.getDate()} {MSHORT[d.getMonth()]}<small>{l.time}</small></>}</span>
    <span className="lwho"><b>{l.subject || tr("Lekcja")}</b><span>{[l.tutor, l.topic || (l.status === "cancelled" ? "" : tr("bez tematu"))].filter(Boolean).join(" · ")}</span></span>
    <span className="lrt"><b>{money.replace(",00", "")}</b>{chip && <span className={"lchip " + chip[1]}>{chip[0]}</span>}</span>
  </div>;
}

/** A row for the child's own activity (school, pool…), styled like a lesson row with a dashed look. */
export function ERow({ e, s, en, host, clash, onClick }: { e: VEvent; s: string; en: string; host?: string; clash?: boolean; onClick?: () => void }) {
  return <div role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} className={"lrow2 erow" + (host ? " esub" : "") + (clash ? " clash" : "") + (onClick ? "" : " ro")} onClick={onClick}
    onKeyDown={(x) => { if (onClick && (x.key === "Enter" || x.key === " ")) { x.preventDefault(); onClick(); } }}>
    <span className="lbar ebar" style={{ ["--ec" as any]: CAT_COLOR[e.cat] || CAT_COLOR.other }} />
    <span className="ltm">{s}<small>{en}</small></span>
    <span className="lwho"><b>{e.title}</b><span>{host ? tr("w trakcie: {0}", host) : CATS()[e.cat] || tr("Inne")}{e.hideParent ? " · " + tr("ukryte przed rodzicem") : ""}</span></span>
    {clash && <span className="lrt"><span className="lchip rd">{tr("nakłada się")}</span></span>}
  </div>;
}

/** Week switcher – the same bar as in the tutor's lesson list. */
export function WeekBar({ w, setW, from, to, count }: { w: number; setW: (n: number) => void; from: string; to: string; count: number }) {
  const f = (x: string) => pd(x).getDate() + " " + MSHORT[pd(x).getMonth()];
  return <div className="wkbar ltw">
    <button className="btn s" aria-label={tr("Poprzedni tydzień")} onClick={() => setW(w - 1)}>‹</button>
    <b>{f(from)} – {f(to)}<small>{lekcje(count)}</small></b>
    <button className="btn s" aria-label={tr("Następny tydzień")} onClick={() => setW(w + 1)}>›</button>
    {w !== 0 && <button className="btn s" onClick={() => setW(0)}>{tr("Dziś")}</button>}
  </div>;
}

/** Monday..Sunday of the week `w` weeks from now. */
export function weekDays(w: number) {
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + 7 * w);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return ymd(d); });
}

/** A day block: header (Dziś · dzisiaj · date · n lessons) and a card with rows. */
export function DayBlock({ ds, n, children }: { ds: string; n: number; children: ReactNode }) {
  const td = ymd(new Date()), x = pd(ds), wd = (x.getDay() + 6) % 7;
  const title = ds === td ? tr("Dziś") : ds === ymd(new Date(Date.now() + 864e5)) ? tr("Jutro") : ds === ymd(new Date(Date.now() - 864e5)) ? tr("Wczoraj") : WDL[wd];
  return <section className={"dgrp" + (ds === td ? " today" : "")} data-day={ds}>
    <div className={"dgh" + (ds === td ? " td" : "")}><b>{title}</b>{ds === td && <i className="tdtag">{tr("dzisiaj")}</i>}<span>{x.getDate()} {MLONG_G[x.getMonth()]}{n ? " · " + lekcje(n) : ""}</span></div>
    <div className="dgl">{children || <div className="dfreerow">{tr("Dzień wolny – brak zajęć.")}</div>}</div>
  </section>;
}

/** Lessons grouped by month with a total, like the tutor's lessons of one student. */
export function MonthGroups({ list, row }: { list: VLesson[]; row: (l: VLesson) => ReactNode }) {
  const months: [string, VLesson[]][] = [];
  list.forEach((l) => { const k = l.date.slice(0, 7); const g = months.find((x) => x[0] === k); if (g) g[1].push(l); else months.push([k, [l]]); });
  return <div className="days">{months.map(([k, ls]) => { const sum = ls.filter(vBillable).reduce((t, l) => t + l.amount, 0), t = fm(k);
    return <section className="dgrp" key={k}><div className="dgh"><b>{t.charAt(0).toUpperCase() + t.slice(1)}</b><span>{lekcje(ls.length)}{sum ? " · " + pln(sum).replace(",00", "") : ""}</span></div>
      <div className="dgl">{ls.map(row)}</div></section>; })}</div>;
}

export type LView = "up" | "past" | "all";
/** Upcoming / past / all tabs; in "all" also order and "unpaid only". Returns the list to show. */
export function useLessonTabs(list: VLesson[], view: LView, ord: 1 | -1, onlyUnpaid: boolean) {
  const nowKey = ymd(new Date()) + " " + new Date().toTimeString().slice(0, 5);
  const isUp = (l: VLesson) => l.status === "planned" && vKey(l) >= nowKey;
  const asc = (a: VLesson, b: VLesson) => vKey(a).localeCompare(vKey(b));
  const up = list.filter(isUp).sort(asc), past = list.filter((l) => !isUp(l)).sort((a, b) => asc(b, a));
  const all = [...list].sort((a, b) => asc(a, b) * ord).filter((l) => !onlyUnpaid || vUnpaid(l));
  return { up, past, shown: view === "up" ? up : view === "past" ? past : all, nUnpaid: list.filter(vUnpaid).length };
}
export function LessonTabs({ view, setView, n, ord, setOrd, onlyUnpaid, setOnlyUnpaid, nUnpaid }: {
  view: LView; setView: (v: LView) => void; n: [number, number, number]; ord: 1 | -1; setOrd: (o: 1 | -1) => void; onlyUnpaid: boolean; setOnlyUnpaid: (b: boolean) => void; nUnpaid: number;
}) {
  const V: [LView, string, number][] = [["up", tr("Nadchodzące"), n[0]], ["past", tr("Minione"), n[1]], ["all", tr("Wszystkie"), n[2]]];
  return <>
    <div className="seg stseg" role="group" aria-label={tr("Pokaż lekcje")}>{V.map(([k, t, c]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>{t} <span className="segn">{c}</span></button>)}</div>
    {view === "all" && <div className="chips ordsw">
      <button type="button" className={"chip" + (onlyUnpaid ? " on am" : "")} aria-pressed={onlyUnpaid} onClick={() => setOnlyUnpaid(!onlyUnpaid)}>{tr("Tylko nieopłacone")} · {nUnpaid}</button>
      {n[2] > 1 && ([[-1, tr("Od najnowszych")], [1, tr("Od najstarszych")]] as const).map(([o, t]) => <button key={o} type="button" className={"chip" + (ord === o ? " on" : "")} aria-pressed={ord === o} onClick={() => setOrd(o)}>{o === -1 ? "↓ " : "↑ "}{t}</button>)}</div>}
  </>;
}

/** Lesson window – the same sheet as the tutor's, with role-specific buttons below. */
export function VSheet({ l, title, contact, hwDone, actions, noCr }: { l: VLesson; title: string; contact?: { email: string; phone: string }; hwDone?: boolean; actions?: ReactNode; noCr?: boolean }) {
  const st = l.status === "done" ? tr("przeprowadzona") : l.status === "cancelled" ? tr("odwołana") : tr("zaplanowana");
  const pay = l.status === "cancelled" ? (l.amount > 0 ? pln(l.amount) + tr(" (opłata) · ") + (l.paid ? tr("opłacona") : tr("nieopłacona")) : tr("bez opłaty"))
    : pln(l.amount) + (l.status === "planned" && !l.paid ? "" : " · " + (l.paid ? tr("opłacona") : tr("nieopłacona")));
  return <div className="lsheet">
    <div className="lsh"><div><h2>{title}</h2><div className="hint">{fd(l.date)} · {st}</div></div></div>
    <div className="kv"><span>{tr("Godzina")}</span><b>{l.time}–{te(l.time, l.min)} ({l.min}{" "}{tr("min)")}</b></div>
    {l.topic && <div className="kv"><span>{tr("Temat")}</span><b>{l.topic}</b></div>}
    <div className="kv"><span>{tr("Korepetytor")}</span><b>{l.tutor}</b></div>
    <div className="kv"><span>{tr("Kwota")}</span><b>{pay}</b></div>
    {l.status === "done" && <div className="kvb"><span>{tr("Po zajęciach")}</span><p className="pre">{l.notes || <span className="hint">{tr("Brak notatki.")}</span>}</p></div>}
    {l.hw && <div className="kvb"><span>{tr("Praca domowa")}{l.hd ? tr(" · termin ") + fd(l.hd) : ""}</span><p className="pre">{l.hw}</p>
      {hwDone !== undefined && <span className={"lchip " + (hwDone ? "gr" : "am")} style={{ display: "inline-block", marginTop: 6 }}>{hwDone ? tr("Zadanie zrobione") : tr("Zadanie niezrobione")}</span>}</div>}
    {!noCr && l.cr?.status === "pending" && <div className="rqbox"><b>{l.cr.kind === "move" ? tr("Prośba o przeniesienie na następny tydzień") : tr("Prośba o odwołanie")}</b><span>{tr("Przyczyna: „")}{l.cr.reason}”</span></div>}
    {!noCr && l.cr?.status === "rejected" && l.status === "planned" && <p className="hint">{tr("Korepetytor odrzucił prośbę.")}{l.cr.note ? " " + l.cr.note : ""}</p>}
    {!noCr && l.cr?.status === "accepted" && l.status === "cancelled" && l.cr.note && <p className="hint">{tr("Komentarz korepetytora:")}{" "}{l.cr.note}</p>}
    {contact && (contact.email || contact.phone) && <p className="ktc" style={{ marginTop: 10 }}>{contact.email && <a href={"mailto:" + contact.email}>✉️ {contact.email}</a>}{contact.phone && <a href={"tel:" + contact.phone.replace(/\s/g, "")}>📞 {contact.phone}</a>}</p>}
    {actions}
  </div>;
}

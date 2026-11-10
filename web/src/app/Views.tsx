import { ReactNode, useEffect, useState } from "react";
import { api, isDemo } from "../lib/api";
import { Empty, Ic } from "../lib/icons";
import { navigate } from "../lib/router";
import {
  amt, billable, cq, download, fd, fm, FREE, gStr, Lesson, MSHORT, pad, pd, pln, PRO_PLN, sortL, subjList, sumAmt, te, toG, ym, ymd, pwOk, copyText, subjRates,
  lekcje, addDays, WDL, subjColor, WDSHORT, MGEN,
  bySurname,
} from "../lib/util";
import { useAuth, useTutor } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { LessonItem, useData, useUi, useUpsell } from "./common";
import { ThemePicker } from "../ui/themes";
import { LangPicker, langName } from "../ui/lang";
import { CancelRequestActions, LessonForm, LessonSheet, ShareModal, StudentDetail, StudentForm, SummaryModal, summaryText } from "./Forms";
import { tr } from "../lib/i18n";

/* ---------- small pieces ---------- */
/** Month switcher: ‹ Listopad 2026 › – always in Polish, independent of the browser language. */
function MonthInput({ v, on }: { v: string; on: (m: string) => void }) {
  const shift = (k: number) => { const [y, mo] = v.split("-").map(Number); on(ym(new Date(y, mo - 1 + k, 1))); };
  const t = fm(v);
  return <div className="mpick" role="group" aria-label={tr("Miesiąc")}>
    <button type="button" aria-label={tr("Poprzedni miesiąc")} onClick={() => shift(-1)}>‹</button>
    <span aria-live="polite">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
    <button type="button" aria-label={tr("Następny miesiąc")} onClick={() => shift(1)}>›</button>
  </div>;
}
const monthDone = (ls: Lesson[], m: string) => ls.filter((l) => billable(l) && l.date.slice(0, 7) === m);
function BarList({ o, ff, byKey }: { o: Record<string, number>; ff: (n: number) => string; byKey?: boolean }) {
  const e = byKey ? Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])) : Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = e.length ? Math.max(...e.map((x) => x[1])) : 1;
  if (!e.length) return <p className="hint">{tr("Brak danych w wybranym okresie.")}</p>;
  return <>{e.map((x) => <div className="bl" key={x[0]}><span>{x[0]}</span><b>{ff(x[1])}</b><div className="bb"><i style={{ width: Math.round(x[1] / mx * 100) + "%" }} /></div></div>)}</>;
}

export function useAdd() {
  const { students } = useData();
  const { user } = useAuth();
  const { modal, toast } = useOverlay();
  const { upsell } = useUpsell();
  return {
    addStudent: () => { if (user?.plan === "free" && students.filter((s) => s.active).length >= FREE) upsell(); else modal(<StudentForm />); },
    addLesson: (pre?: string) => {
      if (!students.some((s) => s.active)) { toast(tr("Najpierw dodaj ucznia.")); modal(<StudentForm />); return; }
      modal(<LessonForm pre={pre} />);
    },
  };
}

/* ---------- dashboard ---------- */
function SetupBar() {
  const { user } = useAuth();
  const { students, lessons } = useData();
  if (!user || user.settings.welcomeSkipped) return null;
  const n = (students.length > 0 ? 1 : 0) + (lessons.length > 0 ? 1 : 0) + (user.settings.onbBilling ? 1 : 0);
  if (n >= 3) return null;
  return <div className="nt" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>{tr("Dokończ konfigurację:")}{" "}{n}{" "}{tr("z 3 kroków.")}{" "}<a href="/aplikacja/welcome">{tr("Wróć do powitania")}</a></div>;
}

export function Dashboard() {
  const { user } = useAuth();
  const { students, lessons, stu } = useData();
  const { modal, confirm } = useOverlay();
  const { run } = useTutor();
  const [allLate, setAllLate] = useState(false);
  const [ui, setUi] = useUi();
  const m = ui.month, done = monthDone(lessons, m), now = ymd(new Date()) + " " + new Date().toTimeString().slice(0, 5);
  const up = sortL(lessons.filter((l) => l.status === "planned" && l.date + " " + l.time >= now), 1).slice(0, 5);
  const un = sortL(lessons.filter((l) => billable(l) && !l.paid && l.date.slice(0, 7) === m), 1).slice(0, 5);
  const reqs = sortL(lessons.filter((l) => l.cr?.status === "pending"), 1);
  const late = user?.settings.late === false ? [] : sortL(lessons.filter((l) => l.status === "planned" && l.date + " " + l.time < now && l.cr?.status !== "pending"), 1);
  const goal = user?.plan === "pro" ? user.settings.goal || 0 : 0;
  const tot = sumAmt(done, () => true), pc = goal ? Math.min(100, Math.round(tot / goal * 100)) : 0;
  const td = ymd(new Date()), nowD = new Date();
  const today = lessons.filter((l) => l.date === td && l.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
  const nx = up[0];
  const inLabel = (l: Lesson) => {
    if (l.date === td) { const [h, mi] = l.time.split(":").map(Number); const diff = h * 60 + mi - (nowD.getHours() * 60 + nowD.getMinutes()); return diff < 60 ? tr("za ") + Math.max(diff, 0) + tr(" min") : tr("za ") + Math.round(diff / 60) + tr(" h"); }
    if (l.date === addDays(1)) return tr("jutro");
    return WDSHORT_L[pd(l.date).getDay()] + " " + pd(l.date).getDate() + " " + MSHORT[pd(l.date).getMonth()];
  };
  const unM = done.filter((l) => !l.paid);
  const mName = fm(m).split(" ")[0];
  return <>
    <SetupBar />
    <div className="bento kb">
      {nx ? <button type="button" className="khero w2" onClick={() => modal(<LessonSheet id={nx.id} />)}>
          <span className="hl"><span>{tr("Następna lekcja ·")}{" "}{inLabel(nx)}</span><span>{nx.subject || subjList(stu(nx.sid) || { subject: "" })[0] || ""}</span></span>
          <span className="hv">{stu(nx.sid)?.name || "?"}</span>
          <span className="hp"><span>{nx.time}–{te(nx.time, nx.min)}</span>{nx.topic && <span>{nx.topic}</span>}</span></button>
        : <div className="khero w2"><span className="hl"><span>{tr("Następna lekcja")}</span></span><span className="hv">{tr("Brak zaplanowanych")}</span><span className="hp"><span>{tr("Dodaj lekcję przyciskiem „+”")}</span></span></div>}
      <div className="tile tl3"><div className="l">{tr("Do zapłaty")}</div><div className="v">{pln(sumAmt(unM, () => true)).replace(",00", "")}</div><small>{lekcje(unM.length)}</small></div>
      <div className="tile tl2"><div className="l">{tr("Opłacone")}</div><div className="v">{pln(sumAmt(done, (l) => l.paid)).replace(",00", "")}</div><small>{mName}</small></div>
      {reqs.length > 0 && <div className="kreq w4">{reqs.map((l) => { const st = stu(l.sid); return <div className="kreqr" key={l.id}>
        <div className="rqm"><b>{reqs.length === 1 ? tr("1 prośba ucznia") : st?.name}</b><span>{st ? st.name.split(" ")[0] : ""}{" "}{tr("prosi o")}{" "}{l.cr!.kind === "move" ? tr("przeniesienie na ") + (() => { const d = pd(l.date); d.setDate(d.getDate() + 7); return d.getDate() + " " + MSHORT[d.getMonth()]; })() : tr("odwołanie lekcji ") + pd(l.date).getDate() + " " + MSHORT[pd(l.date).getMonth()]}</span></div>
        <button className="lnk" onClick={() => modal(<LessonSheet id={l.id} />)}>{tr("Rozpatrz")}</button></div>; })}</div>}
      <div className="kplan w2"><div className="dch"><h2>{tr("Plan na dziś")}</h2><a href="/aplikacja/lessons">{tr("Wszystkie")}</a></div>
        {today.length ? today.map((l) => { const st = stu(l.sid), sub = l.subject || (st ? subjList(st)[0] : ""); return <button key={l.id} className="kpr" onClick={() => modal(<LessonSheet id={l.id} />)}>
          <span className="kpb" style={{ background: subjColor(sub) }} /><span className="lwho"><b>{st?.name || "?"}</b><span>{sub}</span></span><b className="kpt">{l.time}</b></button>; })
          : <p className="hint" style={{ margin: "4px 0 6px" }}>{tr("Dziś nie masz lekcji.")}{nx ? tr(" Następna: ") + inLabel(nx) + ", " + nx.time + "." : ""}</p>}</div>
      <div className="tile kg"><div className="l">{tr("Uczniowie")}</div><div className="v">{students.filter((s) => s.active).length}</div></div>
      <div className="tile kg"><div className="l">{tr("Lekcje w mies.")}</div><div className="v">{done.filter((l) => l.status === "done").length}</div></div>
    </div>
    {goal > 0 && <div className="card" style={{ marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{tr("Cel miesięczny")}</b><span>{pln(tot)}{" "}{tr("z")}{" "}{pln(goal)} ({Math.round(tot / goal * 100)}%)</span></div><div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pc} aria-label={tr("Postęp celu miesięcznego")} style={{ margin: "8px 0 0" }}><i style={{ width: pc + "%" }} /></div></div>}
    {late.length > 0 && <div className="card dcard" style={{ marginTop: 12 }}><h2>{tr("Do potwierdzenia (")}{late.length})</h2><p className="hint" style={{ margin: "-6px 0 4px" }}>{tr("Te lekcje miały już się odbyć – oznacz je jako przeprowadzone.")}</p>{(allLate ? late : late.slice(-3)).map((l) => <LessonItem key={l.id} l={l} />)}
      {late.length > 3 && <button className="more" style={{ margin: "8px 0" }} onClick={() => setAllLate(!allLate)}>{allLate ? tr("Pokaż mniej") : tr("Pokaż wszystkie (") + late.length + ")"}</button>}</div>}
  </>;
}
const WDSHORT_L = WDSHORT;

/* ---------- students ---------- */
export function Students() {
  const { user } = useAuth();
  const { students, lessons } = useData();
  const { run } = useTutor();
  const [ui, setUi] = useUi();
  const { modal, confirm } = useOverlay();
  const { upsell } = useUpsell();
  const q = ui.q.toLowerCase();
  const m: Record<string, string> = {};
  students.forEach((s) => subjList(s).forEach((x) => { const k = x.toLowerCase(); if (!m[k]) m[k] = x; }));
  const subjects = Object.values(m).sort((a, b) => a.localeCompare(b, "pl"));
  const subj = ui.subj && m[ui.subj.toLowerCase()] ? ui.subj : "";
  const list = students.filter((s) => {
    if (ui.sf === "active" && !s.active) return false;
    if (ui.sf === "arch" && s.active) return false;
    if (subj && !subjList(s).map((x) => x.toLowerCase()).includes(subj.toLowerCase())) return false;
    return !q || (s.name + " " + s.subject).toLowerCase().includes(q);
  });
  const last = (n: string) => { const p = n.trim().split(/\s+/); return p[p.length - 1]; };
  const cmp = (a: string, b: string) => a.localeCompare(b, "pl", { sensitivity: "base" });
  if (ui.so === "az") list.sort((a, b) => cmp(a.name, b.name));
  else if (ui.so === "za") list.sort((a, b) => cmp(b.name, a.name));
  else if (ui.so === "ln") list.sort(bySurname);
  const pro = user?.plan === "pro";
  return <>
    <div className="bar sbar"><input type="search" placeholder={tr("Szukaj: imię, nazwisko, przedmiot")} value={ui.q} aria-label={tr("Szukaj ucznia")} onChange={(e) => setUi((u) => ({ ...u, q: e.target.value }))} />
      <select aria-label={tr("Status ucznia")} value={ui.sf} onChange={(e) => setUi((u) => ({ ...u, sf: e.target.value as any }))}><option value="active">{tr("Aktywni")}</option><option value="arch">{tr("Zarchiwizowani")}</option><option value="all">{tr("Wszyscy")}</option></select>
      <select aria-label={tr("Sortowanie uczniów")} value={ui.so} onChange={(e) => setUi((u) => ({ ...u, so: e.target.value as any }))}><option value="az">{tr("Imię A–Z")}</option><option value="za">{tr("Imię Z–A")}</option><option value="ln">{tr("Nazwisko A–Z")}</option><option value="new">{tr("Kolejność dodania")}</option></select></div>
    {subjects.length > 0 && <div className="chips" role="group" aria-label={tr("Filtr po przedmiotach")} style={{ marginBottom: 12 }}>
      <button className={"chip" + (!subj ? " on" : "")} aria-pressed={!subj} onClick={() => setUi((u) => ({ ...u, subj: "" }))}>{tr("Wszyscy ·")}{" "}{list.length}</button>
      {subjects.map((x) => <button key={x} className={"chip" + (subj === x ? " on" : "")} aria-pressed={subj === x} onClick={() => setUi((u) => ({ ...u, subj: x }))}>{x}</button>)}</div>}
    {!list.length ? <div className="card"><Empty icon="users" title={tr("Brak uczniów")} sub={tr("Zmień filtry lub dodaj pierwszego ucznia.")} /></div> : <>
      <div className="slhd"><span>{({ az: tr("Imię A–Z"), za: tr("Imię Z–A"), ln: tr("Nazwisko A–Z"), new: tr("Kolejność dodania") } as Record<string, string>)[ui.so]}</span><span>{tr("Do zapłaty")}</span></div>
      <div className="dgl">{list.map((s) => {
        const due = sumAmt(lessons.filter((l) => l.sid === s.id && billable(l)), (l) => !l.paid);
        const rates = subjRates(s);
        return <button key={s.id} className={"strow" + (s.active ? "" : " cx")} onClick={() => modal(<StudentDetail id={s.id} />, true)}>
          <span className="sav2">{s.name.charAt(0).toUpperCase()}</span>
          <span className="lwho"><b>{s.name}{s.linked && <i className="ptag">{tr("panel")}</i>}{!s.active && <i className="ptag gray">{tr("archiwum")}</i>}</b>
            <span>{rates.length > 1 ? rates.map(([x, r]) => x + " " + pln(r).replace(",00", "")).join(" · ") : (rates[0][0] ? rates[0][0] + " · " : "") + pln(rates[0][1]).replace(",00", "") + "/h"}</span></span>
          {due > 0 ? <b className="sdue">{pln(due).replace(",00", "")}</b> : <span className="sok">{tr("rozliczony")}</span>}
        </button>;
      })}</div></>}
  </>;
}

/* ---------- lessons ---------- */
function dayTitle(d: string) {
  const td = ymd(new Date());
  if (d === td) return tr("Dziś");
  if (d === addDays(1)) return tr("Jutro");
  if (d === addDays(-1)) return tr("Wczoraj");
  const n = WDL[(pd(d).getDay() + 6) % 7]; return n;
}
function DayGroups({ list, dir, jump = true }: { list: Lesson[]; dir: number; jump?: boolean }) {
  const m: Record<string, Lesson[]> = {};
  list.forEach((l) => { (m[l.date] = m[l.date] || []).push(l); });
  const ds = Object.keys(m).sort((a, b) => dir * a.localeCompare(b)), td = ymd(new Date());
  // the day closest to today (today itself if it has lessons)
  const target = ds.reduce((b, d) => (b === "" || Math.abs(pd(d).getTime() - pd(td).getTime()) < Math.abs(pd(b).getTime() - pd(td).getTime()) ? d : b), "");
  return <><div className="days">{ds.map((d) => { const x = pd(d); const n = m[d].length; return <section className={"dgrp" + (d === td ? " today" : "")} key={d} data-day={d}>
    <div className={"dgh" + (d === td ? " td" : "")}><b>{dayTitle(d)}</b>{d === td && <i className="tdtag">{tr("dzisiaj")}</i>}<span>{x.getDate()} {MLONG_G[x.getMonth()]}{x.getFullYear() !== new Date().getFullYear() ? " " + x.getFullYear() : ""} · {lekcje(n)}</span></div>
    <div className="dgl">{m[d].sort((a, b) => a.time.localeCompare(b.time)).map((l) => <LessonItem key={l.id} l={l} nd />)}</div></section>; })}</div>
    {jump && target && <TodayJump key={ds[0] + "|" + ds.length} day={target} has={target === td} />}</>;
}
const MLONG_G = MGEN;

/** Floating "Przejdź do dzisiaj" arrow – shown only when today's (or the nearest) day is off screen. */
function TodayJump({ day, has }: { day: string; has: boolean }) {
  const { toast } = useOverlay();
  const [dir, setDir] = useState<"" | "up" | "down">("");
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-day="${day}"]`);
    if (!el) return;
    const upd = () => { const r = el.getBoundingClientRect(); setDir(r.bottom < 70 ? "up" : r.top > innerHeight - 90 ? "down" : has ? "" : "down"); };
    upd(); addEventListener("scroll", upd, { passive: true }); addEventListener("resize", upd);
    return () => { removeEventListener("scroll", upd); removeEventListener("resize", upd); };
  }, [day, has]);
  if (!dir) return null;
  const go = () => {
    if (!has) { toast(tr("Dziś nie ma zaplanowanych lekcji.")); return; }
    const el = document.querySelector<HTMLElement>(`[data-day="${day}"]`); if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); };
  return <button className="tjump" onClick={go} aria-label={tr("Przejdź do dzisiaj")}><span aria-hidden="true">{dir === "up" ? "↑" : "↓"}</span>{tr("Dziś")}</button>;
}

function LessonsList() {
  const { user } = useAuth();
  const { students, lessons, stu } = useData();
  const [ui, setUi] = useUi();
  const f = ui.lf;
  const td = ymd(new Date());
  const subOf = (l: Lesson) => l.subject || subjList(stu(l.sid) || { subject: "" })[0] || "";
  const subs = [...new Set(students.flatMap((s) => subjList(s)).concat(lessons.map(subOf)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl"));
  const setF = (p: Partial<typeof f>) => setUi((u) => ({ ...u, lf: { ...u.lf, ...p } }));
  const [open, setOpen] = useState(false);
  const nf = [f.st, f.sb, f.q].filter(Boolean).length;
  const unpaid = (l: Lesson) => billable(l) && !l.paid;
  const nPay = lessons.filter(unpaid).length;
  const mode = f.m === "pay" ? "pay" : "week";
  const match = (l: Lesson) => (!f.st || l.sid === f.st) && (!f.sb || subOf(l) === f.sb) && (!f.q || (l.topic + " " + l.notes).toLowerCase().includes(f.q.toLowerCase()));
  // the shown week (Monday or Sunday first, as in the settings)
  const sunFirst = user?.settings.wk === "sun";
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (sunFirst ? start.getDay() : (start.getDay() + 6) % 7) + 7 * (f.w || 0));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return ymd(d); });
  const end = days[6];
  const fm2 = (x: string) => { const d = pd(x); return d.getDate() + " " + MSHORT[d.getMonth()]; };
  const searching = !!f.q.trim();
  const weekList = lessons.filter((l) => l.date >= days[0] && l.date <= end && match(l));
  const pay = sortL(lessons.filter((l) => unpaid(l) && match(l)), -1);
  const found = sortL(lessons.filter(match), -1);
  return <>
    <div className="lbar2">
      <div className="chips" role="group" aria-label={tr("Pokaż lekcje")}>
        <button className={"chip" + (mode === "week" ? " on" : "")} aria-pressed={mode === "week"} onClick={() => setF({ m: "week" })}>{tr("Tydzień")}</button>
        <button className={"chip" + (mode === "pay" ? " on" : "")} aria-pressed={mode === "pay"} onClick={() => setF({ m: "pay" })}>{tr("Do opłacenia") + (nPay ? " · " + nPay : "")}</button></div>
    </div>
    <div className="lbar3">
      <label className="stpick"><Ic n="users" s={16} /><select aria-label={tr("Uczeń")} value={f.st} onChange={(e) => setF({ st: e.target.value, sv: "up" })}><option value="">{tr("Wszyscy uczniowie")}</option>{[...students].sort(bySurname).map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? "" : tr(" (zarchiwizowany)")}</option>)}</select></label>
      <button className={"btn s" + (nf - (f.st ? 1 : 0) ? " p" : "")} aria-expanded={open} onClick={() => setOpen(!open)}>{tr("Filtry")}{nf - (f.st ? 1 : 0) ? ` · ${nf - (f.st ? 1 : 0)}` : ""}</button>
    </div>
    {open && <div className="fpanel">
      <input type="search" placeholder={tr("Szukaj w temacie i notatkach")} value={f.q} aria-label={tr("Szukaj w lekcjach")} onChange={(e) => setF({ q: e.target.value })} />
      {subs.length > 1 && <select aria-label={tr("Przedmiot")} value={f.sb} onChange={(e) => setF({ sb: e.target.value })}><option value="">{tr("Wszystkie przedmioty")}</option>{subs.map((x) => <option key={x} value={x}>{x}</option>)}</select>}
      {nf > 0 && <button className="btn" onClick={() => setUi((u) => ({ ...u, lf: { ...u.lf, st: "", sb: "", q: "" } }))}>{tr("Wyczyść filtry")}</button>}
    </div>}
    {f.st && !searching && mode === "week" ? <StudentLessons sid={f.st} list={lessons.filter(match)} view={f.sv || "up"} setView={(v) => setF({ sv: v })} clear={() => setF({ st: "" })} /> : searching ? <>
      <p className="hint" style={{ margin: "0 2px 10px" }}>{tr("Wyniki wyszukiwania we wszystkich tygodniach: {0}", found.length)}</p>
      {found.length ? <DayGroups list={found} dir={-1} jump={false} /> : <div className="card"><Empty icon="book" title={tr("Brak lekcji")} sub={tr("Żadna lekcja nie pasuje do filtrów.")} /></div>}
    </> : mode === "pay" ? (pay.length ? <DayGroups list={pay} dir={-1} jump={false} /> : <div className="card"><Empty icon="wallet" title={tr("Wszystko opłacone")} sub={tr("Nie ma lekcji czekających na płatność.")} /></div>) : <>
      <div className="wkbar ltw">
        <button className="btn s" aria-label={tr("Poprzedni tydzień")} onClick={() => setF({ w: (f.w || 0) - 1 })}>‹</button>
        <b>{fm2(days[0])} – {fm2(end)}{pd(end).getFullYear() !== new Date().getFullYear() ? " " + pd(end).getFullYear() : ""}<small>{lekcje(weekList.filter((l) => l.status !== "cancelled").length)}</small></b>
        <button className="btn s" aria-label={tr("Następny tydzień")} onClick={() => setF({ w: (f.w || 0) + 1 })}>›</button>
        {(f.w || 0) !== 0 && <button className="btn s" onClick={() => setF({ w: 0 })}>{tr("Dziś")}</button>}
      </div>
      <div className="days">{days.map((d) => { const ls = weekList.filter((l) => l.date === d).sort((a, b) => a.time.localeCompare(b.time)); const x = pd(d);
        return <section className={"dgrp" + (d === td ? " today" : "")} key={d} data-day={d}>
          <div className={"dgh" + (d === td ? " td" : "")}><b>{dayTitle(d)}</b>{d === td && <i className="tdtag">{tr("dzisiaj")}</i>}<span>{x.getDate()} {MLONG_G[x.getMonth()]}{ls.length ? " · " + lekcje(ls.length) : ""}</span></div>
          <div className="dgl">{ls.length ? ls.map((l) => <LessonItem key={l.id} l={l} nd />) : <div className="dfreerow">{tr("Dzień wolny – brak lekcji.")}</div>}</div></section>; })}</div>
    </>}
  </>;
}

/** All lessons of one student: summary card, upcoming / past / all, grouped by month. */
function StudentLessons({ sid, list, view, setView, clear }: { sid: string; list: Lesson[]; view: "up" | "past" | "all"; setView: (v: "up" | "past" | "all") => void; clear: () => void }) {
  const { stu } = useData();
  const { modal } = useOverlay();
  const [ord, setOrd] = useState<1 | -1>(-1);
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const s = stu(sid);
  const td = ymd(new Date());
  const up = sortL(list.filter((l) => l.date >= td && l.status === "planned"), 1);
  const past = sortL(list.filter((l) => !(l.date >= td && l.status === "planned")), -1);
  const unpaid = (l: Lesson) => billable(l) && !l.paid && amt(l) > 0;
  const nUnpaid = list.filter(unpaid).length;
  const shown = (view === "up" ? up : view === "past" ? past : sortL(list, ord)).filter((l) => !onlyUnpaid || unpaid(l));
  const due = sumAmt(list.filter((l) => billable(l)), (l) => !l.paid);
  const done = list.filter((l) => l.status === "done").length;
  const months: [string, Lesson[]][] = [];
  shown.forEach((l) => { const k = l.date.slice(0, 7); const g = months.find((x) => x[0] === k); if (g) g[1].push(l); else months.push([k, [l]]); });
  if (!s) return null;
  const V: ["up" | "past" | "all", string, number][] = [["up", tr("Nadchodzące"), up.length], ["past", tr("Minione"), past.length], ["all", tr("Wszystkie"), list.length]];
  return <>
    <div className="card sthead">
      <div className="sth1"><span className="sav2">{s.name.charAt(0).toUpperCase()}</span><div className="lwho"><b>{s.name}</b><span>{subjRates(s).map(([x, r]) => (x ? x + " · " : "") + pln(r).replace(",00", "") + "/h").join("  ·  ")}</span></div>
        <button className="xbtn" aria-label={tr("Pokaż wszystkich uczniów")} onClick={clear}><Ic n="x" s={16} /></button></div>
      <div className="sthst">
        <div><span>{tr("Zaplanowane")}</span><b>{up.length}</b></div>
        <div><span>{tr("Przeprowadzone")}</span><b>{done}</b></div>
        <div><span>{tr("Do zapłaty")}</span><b className={due ? "am" : "gr"}>{pln(due).replace(",00", "")}</b></div>
      </div>
      <button className="btn s" onClick={() => modal(<StudentDetail id={sid} noHistory />, true)}>{tr("Szczegóły ucznia")}</button>
    </div>
    <div className="seg stseg" role="group" aria-label={tr("Pokaż lekcje")}>{V.map(([k, t, n]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>{t} <span className="segn">{n}</span></button>)}</div>
    <div className="chips ordsw">
      <button type="button" className={"chip" + (onlyUnpaid ? " on am" : "")} aria-pressed={onlyUnpaid} onClick={() => setOnlyUnpaid(!onlyUnpaid)}>{tr("Tylko nieopłacone")} · {nUnpaid}</button>
      {view === "all" && list.length > 1 && ([[-1, tr("Od najnowszych")], [1, tr("Od najstarszych")]] as const).map(([o, t]) => <button key={o} type="button" className={"chip" + (ord === o ? " on" : "")} aria-pressed={ord === o} onClick={() => setOrd(o)}>{o === -1 ? "↓ " : "↑ "}{t}</button>)}</div>
    {!months.length ? <div className="card"><Empty icon="book" title={onlyUnpaid ? tr("Brak nieopłaconych lekcji") : view === "up" ? tr("Brak zaplanowanych lekcji") : tr("Brak lekcji")} sub={onlyUnpaid ? tr("Wszystkie lekcje w tym widoku są rozliczone.") : view === "up" ? tr("Dodaj lekcję przyciskiem „+”.") : tr("Żadna lekcja nie pasuje do filtrów.")} /></div>
      : <div className="days">{months.map(([k, ls]) => { const sum = sumAmt(ls.filter(billable), () => true); const t = fm(k);
        return <section className="dgrp" key={k}><div className="dgh"><b>{t.charAt(0).toUpperCase() + t.slice(1)}</b><span>{lekcje(ls.length)}{sum ? " · " + pln(sum).replace(",00", "") : ""}</span></div>
          <div className="dgl">{ls.map((l) => <LessonItem key={l.id} l={l} noName />)}</div></section>; })}</div>}
  </>;
}

function Calendar() {
  const { user } = useAuth();
  const { lessons, stu } = useData();
  const [ui, setUi] = useUi();
  const m = ui.cm, [y, mo] = m.split("-").map(Number), dim = new Date(y, mo, 0).getDate(), sun = user?.settings.wk === "sun";
  const off = (new Date(y, mo - 1, 1).getDay() + (sun ? 0 : 6)) % 7, td = ymd(new Date());
  const by: Record<string, Lesson[]> = {};
  lessons.forEach((l) => { if (l.status !== "cancelled" && l.date.slice(0, 7) === m) (by[l.date] = by[l.date] || []).push(l); });
  const shift = (d: number) => { const dd = new Date(y, mo - 1 + d, 1); setUi((u) => ({ ...u, cm: ym(dd), cd: "" })); };
  const L = ui.cd && ui.cd.slice(0, 7) === m ? (by[ui.cd] || []).slice().sort((a, b) => a.time.localeCompare(b.time)) : null;
  return <div className="card">
    <div className="bar" style={{ justifyContent: "center", marginBottom: 8 }}><button className="btn s" onClick={() => shift(-1)} aria-label={tr("Poprzedni miesiąc")}>‹</button><b style={{ minWidth: 150, textAlign: "center", textTransform: "capitalize" }}>{fm(m)}</b><button className="btn s" onClick={() => shift(1)} aria-label={tr("Następny miesiąc")}>›</button></div>
    <div className="cal">
      {(sun ? [tr("Nd"), tr("Pn"), tr("Wt"), tr("Śr"), tr("Cz"), tr("Pt"), tr("So")] : [tr("Pn"), tr("Wt"), tr("Śr"), tr("Cz"), tr("Pt"), tr("So"), tr("Nd")]).map((x) => <div className="ch" key={x}>{x}</div>)}
      {Array.from({ length: off }, (_, i) => <div key={"o" + i} />)}
      {Array.from({ length: dim }, (_, i) => { const d = i + 1, ds = m + "-" + pad(d), n = (by[ds] || []).length;
        return <button key={ds} className={"cd" + (n ? " busy" : "") + (ds === td ? " td" : "") + (ui.cd === ds ? " sel" : "")} aria-pressed={ui.cd === ds} aria-label={d + (n ? tr(", lekcji: ") + n : tr(", wolne"))} onClick={() => setUi((u) => ({ ...u, cd: u.cd === ds ? "" : ds }))}><span>{d}</span>{n > 0 && <i>{n}</i>}</button>; })}
    </div>
    <p className="hint" style={{ margin: "10px 0 0" }}>{tr("Zaznaczone dni mają lekcje. Kliknij dzień, aby zobaczyć uczniów i godziny.")}</p>
    {L && <><h3 style={{ margin: "16px 0 4px" }}>{fd(ui.cd)}</h3>{L.length ? L.map((l) => <LessonItem key={l.id} l={l} nd />)
      : <div className="empty">{tr("Dzień wolny – brak lekcji.")}</div>}</>}
  </div>;
}

export function Lessons() {
  const [ui, setUi] = useUi();
  return <>
    <div className="bar"><div className="seg" role="group" aria-label={tr("Widok lekcji")}><button aria-pressed={ui.lv !== "cal"} onClick={() => setUi((u) => ({ ...u, lv: "list" }))}>{tr("Lista")}</button><button aria-pressed={ui.lv === "cal"} onClick={() => setUi((u) => ({ ...u, lv: "cal" }))}>{tr("Kalendarz")}</button></div></div>
    {ui.lv === "cal" ? <Calendar /> : <LessonsList />}
  </>;
}

/* ---------- billing ---------- */
const csvRows = (list: Lesson[], name: (id: string) => string) =>
  "﻿" + [[tr("Uczeń"), tr("Data"), tr("Godzina"), tr("Minuty"), tr("Temat"), tr("Status"), tr("Kwota (PLN)"), tr("Płatność")].map(cq).join(";"),
    ...sortL(list, 1).map((l) => [name(l.sid), l.date, l.time, l.min, l.topic, l.status === "cancelled" ? tr("odwołana (opłata)") : tr("przeprowadzona"), gStr(amt(l)), l.paid ? tr("opłacona") : tr("nieopłacona")].map(cq).join(";"))].join("\r\n");

export function Billing() {
  const [stOpen, setStOpen] = useState(false);
  const { user } = useAuth();
  const { lessons, stu } = useData();
  const { run } = useTutor();
  const [ui, setUi] = useUi();
  const { modal, confirm, close, toast } = useOverlay();
  const { proUp } = useUpsell();
  const m = ui.bm, done = monthDone(lessons, m), tot = sumAmt(done, () => true), paid = sumAmt(done, (l) => l.paid);
  const pro = user?.plan === "pro";
  const name = (id: string) => stu(id)?.name || "";
  const ids = [...new Set(done.map((l) => l.sid))];
  const noFee = lessons.filter((l) => l.status === "cancelled" && !l.fee && l.date.slice(0, 7) === m).length;
  const sumAll = () => {
    if (!pro) { proUp(tr("Podsumowania dla wszystkich uczniów")); return; }
    const sids = [...new Set(lessons.filter((l) => (l.status === "done" || l.status === "cancelled") && l.date.slice(0, 7) === m && stu(l.sid)).map((l) => l.sid))];
    if (!sids.length) { toast(tr("Brak lekcji do podsumowania w tym miesiącu.")); return; }
    modal(<><h2>{tr("Podsumowania –")}{" "}{fm(m)}</h2><p className="hint">{tr("Gotowe wiadomości dla każdego ucznia.")}</p>
      {sids.map((sid) => { const t = summaryText(stu(sid)!, lessons, m, user?.brand || ""); return <div className="f" key={sid}><label>{name(sid)}</label><textarea rows={7} readOnly value={t} /><button className="btn s" style={{ marginTop: 6 }} onClick={async () => toast((await copyText(t)) ? tr("Skopiowano.") : tr("Zaznacz tekst i skopiuj go ręcznie."))}>{tr("Kopiuj")}</button></div>; })}
      <div className="mf"><button className="btn p" onClick={close}>{tr("Zamknij")}</button></div></>, true);
  };
  return <>
    <div className="bar"><MonthInput v={m} on={(v) => setUi((u) => ({ ...u, bm: v }))} /><span className="sp" />
      <button className="btn" onClick={() => modal(<><h2>{tr("Eksport i podsumowania")}</h2><div className="mnu">
        <button className="btn" onClick={() => { close(); download("rozliczenie-" + m + ".csv", csvRows(done, name), "text/csv"); }}>{tr("Rozliczenie miesiąca – CSV (")}{fm(m)})</button>
        <button className="btn" onClick={() => { close(); if (!pro) { proUp(tr("Eksport roku do CSV")); return; } const y = m.slice(0, 4); download("rozliczenie-" + y + ".csv", csvRows(lessons.filter((l) => billable(l) && l.date.slice(0, 4) === y), name), "text/csv"); }}>{tr("Rozliczenie całego roku – CSV")}{" "}{!pro && <span className="tag ac">{tr("Pro")}</span>}</button>
        <button className="btn" onClick={() => { close(); sumAll(); }}>{tr("Podsumowania dla wszystkich uczniów")}{" "}{!pro && <span className="tag ac">{tr("Pro")}</span>}</button>
      </div><div className="mf"><button className="btn" onClick={close}>{tr("Zamknij")}</button></div></>)}>{tr("Eksport")}</button></div>
    <div className="card bsum">
      <div className="l">{tr("Należności ·")}{" "}{fm(m)}</div><div className="bv">{pln(tot).replace(",00", "")}</div>
      <div className="pbar" aria-hidden="true" style={{ margin: "10px 0 12px" }}><i style={{ width: (tot ? Math.round(paid / tot * 100) : 0) + "%", background: "var(--gr)" }} /></div>
      <div className="bsr"><div><div className="l">{tr("Opłacone")}</div><b className="gr">{pln(paid).replace(",00", "")}</b></div><div><div className="l">{tr("Do zapłaty")}</div><b className="am">{pln(tot - paid).replace(",00", "")}</b></div><div><div className="l">{tr("Lekcje")}</div><b>{done.length}</b></div></div>
    </div>
    {noFee > 0 && <p className="hint" style={{ margin: "10px 2px 0" }}>{tr("Odwołane lekcje bez opłaty w tym miesiącu:")}{" "}{noFee}{tr(". Opłatę za odwołanie ustawisz w danych ucznia.")}</p>}
    {!ids.length ? <div className="card" style={{ marginTop: 12 }}><Empty icon="wallet" title={tr("Brak przeprowadzonych lekcji")} sub={tr("W tym miesiącu nie ma lekcji do rozliczenia.")} /></div> : <>
      <div className="slhd" style={{ marginTop: 16 }}><span>{tr("Uczniowie")}</span><span>{tr("Do zapłaty")}</span></div>
      <div className="dgl">{ids.map((id) => {
      const ls = done.filter((l) => l.sid === id), t = sumAmt(ls, () => true), p = sumAmt(ls, (l) => l.paid), un = ls.filter((l) => !l.paid), o = ui.open[id], due = t - p;
      return <div key={id} className="brow">
        <button className="strow" aria-expanded={!!o} onClick={() => setUi((u) => ({ ...u, open: { ...u.open, [id]: !u.open[id] } }))}>
          <span className="lwho"><b>{name(id) || "?"}</b><span>{lekcje(ls.length)} · {pln(t).replace(",00", "")}</span></span>
          {due > 0 ? <b className="sdue">{pln(due).replace(",00", "")}</b> : <span className="sok">{tr("rozliczony")}</span>}<Ic n={o ? "chevd" : "chev"} s={16} /></button>
        {o && <div className="bexp">
          <div className="acts" style={{ marginBottom: 6 }}>{un.length > 0 && <button className="btn s p" onClick={() => confirm({ title: tr("Oznaczyć wszystkie jako opłacone?"), text: <>{lekcje(un.length)}{" "}{tr("na łączną kwotę")}{" "}<b>{pln(sumAmt(un, () => true))}</b> ({fm(m)}{tr("). Każdą możesz później cofnąć.")}</>, ok: tr("Tak, opłacone"), onOk: () => { run(() => api("POST", "/api/lessons/batch", { ids: un.map((l) => l.id), patch: { paid: true } }), tr("Oznaczono jako opłacone: ") + un.length + "."); } })}>{tr("Oznacz wszystkie jako opłacone")}</button>}<button className="btn s" onClick={() => modal(<SummaryModal id={id} />)}>{tr("Podsumowanie dla ucznia")}</button></div>
          {un.map((l) => <div className="unr" key={l.id}><div className="lwho"><b>{l.topic || tr("Bez tematu")}</b><span>{fd(l.date)} · {l.min}{" "}{tr("min")}</span></div><b>{pln(amt(l)).replace(",00", "")}</b><button className="btn s" onClick={() => run(() => api("PATCH", "/api/lessons/" + l.id, { paid: true }), tr("Lekcja oznaczona jako opłacona."))}>{tr("Opłacona")}</button></div>)}
        </div>}
      </div>; })}</div></>}
    <RevenueChart />
    <button type="button" className="sttoggle" id="stats" aria-expanded={stOpen} onClick={() => setStOpen(!stOpen)}><span>{tr("Statystyki")}</span><span className="hint">{stOpen ? tr("Ukryj") : tr("Pokaż")}</span><Ic n={stOpen ? "chevd" : "chev"} s={18} /></button>
    {stOpen && <Stats />}
  </>;
}

function RevenueChart() {
  const { user } = useAuth();
  const { lessons } = useData();
  const [ui] = useUi();
  const { proUp } = useUpsell();
  if (user?.plan !== "pro") return <div className="card" style={{ marginTop: 16 }}><h2>{tr("Przychód z 6 miesięcy")}{" "}<span className="tag ac">{tr("Pro")}</span></h2><p className="hint">{tr("Zobacz opłacone i zaległe kwoty miesiąc po miesiącu.")}</p><button className="btn p s" onClick={() => proUp(tr("Wykres przychodu"))}>{tr("Odblokuj w Pro")}</button></div>;
  const [y, mo] = ui.bm.split("-").map(Number); let mx = 1;
  const M = Array.from({ length: 6 }, (_, k) => { const d = new Date(y, mo - 1 - (5 - k), 1), key = ym(d), ls = lessons.filter((l) => billable(l) && l.date.slice(0, 7) === key), p = sumAmt(ls, (l) => l.paid), du = sumAmt(ls, (l) => !l.paid); mx = Math.max(mx, p + du); return { l: MSHORT[d.getMonth()], p, d: du }; });
  return <div className="card" style={{ marginTop: 16 }}><h2>{tr("Przychód z 6 miesięcy")}{" "}<span className="hint" style={{ fontWeight: 400, fontSize: 13 }}>{tr("(zł)")}</span></h2><div className="rchart">
    {M.map((x, i) => <div key={i} className={"rc" + (i === 5 ? " cur" : "")}><div className="rcb"><div className="rcs">{x.d > 0 && <i style={{ background: "var(--am)", height: Math.max(3, Math.round(x.d / mx * 110)) }} />}{x.p > 0 && <i style={{ background: "var(--gr)", height: Math.max(3, Math.round(x.p / mx * 110)) }} />}</div></div><span>{x.l}</span><b>{x.p + x.d ? Math.round((x.p + x.d) / 100).toLocaleString("pl-PL") : "–"}</b></div>)}
  </div><p className="hint">{tr("Zielony: opłacone, bursztynowy: zaległe. Dane według dat lekcji.")}</p></div>;
}

/* ---------- stats ---------- */
export function Stats() {
  const { user } = useAuth();
  const { lessons, stu } = useData();
  const [ui, setUi] = useUi();
  const { proUp } = useUpsell();
  if (user?.plan !== "pro") return <div className="card"><h2 style={{ marginBottom: 8 }}>{tr("Rozszerzone statystyki")}{" "}<span className="tag ac">{tr("Pro")}</span></h2><p className="hint" style={{ margin: "0 0 16px" }}>{tr("Przychód według przedmiotu i ucznia, średnia kwota za lekcję, odsetek odwołań oraz najbardziej obłożone dni i godziny – liczone z Twoich danych.")}</p><button className="btn p s" onClick={() => proUp(tr("Rozszerzone statystyki"))}>{tr("Odblokuj w Pro")}</button></div>;
  const R = ui.sr, nw = new Date(), from = R === "all" ? "" : ym(new Date(nw.getFullYear(), nw.getMonth() - (+R - 1), 1));
  const L = lessons.filter((l) => !from || l.date.slice(0, 7) >= from), bil = L.filter(billable), dn = L.filter((l) => l.status === "done"), cn = L.filter((l) => l.status === "cancelled"), rev = sumAmt(bil, () => true);
  const bs: Record<string, number> = {}, bt: Record<string, number> = {}, wd: Record<string, number> = {}, hr: Record<string, number> = {}, WD = [tr("Poniedziałek"), tr("Wtorek"), tr("Środa"), tr("Czwartek"), tr("Piątek"), tr("Sobota"), tr("Niedziela")];
  bil.forEach((l) => { const s = stu(l.sid), k = l.subject || (s ? subjList(s)[0] : "") || "—"; bs[k] = (bs[k] || 0) + amt(l); const nm = s ? s.name : "?"; bt[nm] = (bt[nm] || 0) + amt(l); });
  L.forEach((l) => { if (l.status === "cancelled") return; const d = WD[(pd(l.date).getDay() + 6) % 7]; wd[d] = (wd[d] || 0) + 1; const h = l.time.slice(0, 2) + ":00"; hr[h] = (hr[h] || 0) + 1; });
  return <>
    <div className="bar"><select aria-label={tr("Zakres")} value={R} onChange={(e) => setUi((u) => ({ ...u, sr: e.target.value }))}><option value="3">{tr("Ostatnie 3 miesiące")}</option><option value="6">{tr("Ostatnie 6 miesięcy")}</option><option value="12">{tr("Ostatnie 12 miesięcy")}</option><option value="all">{tr("Cały okres")}</option></select></div>
    <div className="grid g4">
      <div className="card stat"><div className="l">{tr("Przychód łącznie")}</div><div className="v">{pln(rev)}</div></div>
      <div className="card stat"><div className="l">{tr("Średnio na lekcję")}</div><div className="v">{dn.length ? pln(Math.round(rev / dn.length)) : "—"}</div></div>
      <div className="card stat"><div className="l">{tr("Odsetek odwołań")}</div><div className="v am">{dn.length + cn.length ? Math.round(cn.length / (dn.length + cn.length) * 100) + "%" : "—"}</div></div>
      <div className="card stat"><div className="l">{tr("Lekcje przeprowadzone")}</div><div className="v">{dn.length}</div></div>
    </div>
    <div className="grid g2" style={{ marginTop: 16 }}>
      <div className="card"><h2>{tr("Przychód według przedmiotu")}</h2><BarList o={bs} ff={pln} /></div>
      <div className="card"><h2>{tr("Przychód według ucznia")}</h2><BarList o={bt} ff={pln} /></div>
      <div className="card"><h2>{tr("Dni tygodnia")}</h2><BarList o={wd} ff={String} /></div>
      <div className="card"><h2>{tr("Godziny rozpoczęcia")}</h2><BarList o={hr} ff={String} byKey /></div>
    </div>
    <p className="hint">{tr("Przychód według dat lekcji, razem z opłatami za odwołanie. Obłożenie liczone z lekcji zaplanowanych i przeprowadzonych (liczba lekcji).")}</p>
  </>;
}

/* ---------- plan ---------- */
export function usePlanActions() {
  const { setUser } = useAuth();
  const { reload } = useTutor();
  const { modal, close, confirm, toast } = useOverlay();
  const setPlan = async (plan: "free" | "pro") => { try { const r = await api("POST", "/api/me/plan", { plan }); setUser(r.user); await reload(); toast(plan === "pro" ? tr("Pro odblokowane (symulacja).") : tr("Plan zmieniony na Free.")); } catch (e) { toast(errMsg(e)); } };
  return {
    tryPro: () => modal(<><h2>{tr("Przetestuj Pro")}</h2><div className="demo">{tr("Tryb testowy – żadna płatność nie zostanie pobrana")}</div><p>{tr("Pro kosztuje")}{" "}{pln(PRO_PLN).replace(",00", "")}{" "}{tr("miesięcznie i znosi limit aktywnych uczniów. Płatności nie są jeszcze podłączone – ten ekran tylko symuluje zakup.")}</p>
      <div className="mf"><button className="btn" onClick={() => { close(); toast(tr("Zakup anulowany. Zostajesz na planie Free.")); }}>{tr("Anuluj zakup")}</button><button className="btn p" onClick={() => { close(); setPlan("pro"); }}>{tr("Zasymuluj udany zakup")}</button></div></>),
    toFree: () => confirm({ title: tr("Wrócić do planu Free?"), text: tr("Wszystkie dane zostaną zachowane. Jeśli masz więcej niż {0} aktywnych uczniów, dodawanie i przywracanie uczniów zostanie zablokowane.", FREE), ok: tr("Wróć do Free"), onOk: () => setPlan("free") }),
  };
}

export function Plan() {
  const { user } = useAuth();
  const { students } = useData();
  const { tryPro, toFree } = usePlanActions();
  const pro = user?.plan === "pro", n = students.filter((s) => s.active).length;
  const proList = [tr("Bez limitu aktywnych uczniów"), tr("Wszystko z planu Free"), tr("Rozszerzone statystyki: przychód według przedmiotu i ucznia, odwołania, obłożenie"), tr("Wykres przychodu z 6 miesięcy i eksport roku"), tr("Podsumowania dla wszystkich uczniów naraz i wydruk PDF"), tr("Cel miesięczny z paskiem postępu"), tr("Szablony notatek"), tr("Kosz z przywracaniem przez 30 dni")];
  return <>
    {!pro && n > FREE && <div className="card" style={{ borderColor: "#f3dca8", background: "var(--aml)", marginBottom: 16 }}><b>{tr("Masz")}{" "}{n}{" "}{tr("aktywnych uczniów, a limit Free to")}{" "}{FREE}.</b><div>{tr("Wszystkie dane są zachowane i widoczne. Dodawanie i przywracanie uczniów jest zablokowane, dopóki nie zarchiwizujesz części uczniów lub nie włączysz Pro.")}</div></div>}
    <div className="plans">
      <div className={"card plan" + (pro ? "" : " cur")}><h2>{tr("Free")}{" "}{!pro && <span className="tag ac">{tr("Twój plan")}</span>}</h2><div className="pr">{tr("0 zł")}</div><ul><li>{tr("Do")}{" "}{FREE}{" "}{tr("aktywnych uczniów")}</li><li>{tr("Lekcje, notatki i rozliczenia")}</li><li>{tr("Archiwum bez limitu")}</li><li>{tr("Przypomnienie o niepotwierdzonych lekcjach, szybkie odwoływanie i powtarzanie lekcji")}</li><li>{tr("Opłata za odwołanie, kopie danych, eksport CSV i zbiorcze oznaczanie płatności")}</li><li>{tr("Panel ucznia: udostępnianie lekcji, notatek i prac domowych")}</li><li>{tr("Motywy kolorystyczne")}</li></ul>{pro && <button className="btn" onClick={toFree}>{tr("Wróć do Free")}</button>}</div>
      <div className={"card plan" + (pro ? " cur" : "")}><h2>{tr("Pro")}{" "}{pro && <span className="tag ac">{tr("Twój plan")}</span>}</h2><div className="pr">{tr("19 zł")}{" "}<span className="hint" style={{ fontSize: 14, fontWeight: 400 }}>{tr("/ miesiąc")}</span></div><ul>{proList.map((x) => <li key={x}>{x}</li>)}</ul>{pro ? <span className="hint">{tr("Pro aktywne (tryb testowy).")}</span> : <button className="btn p" onClick={tryPro}>{tr("Przetestuj Pro")}</button>}</div>
    </div>
    <p className="hint">{tr("Płatności nie są jeszcze podłączone – zakup Pro jest symulowany i nic nie jest pobierane.")}</p>
  </>;
}

function PlanCard() {
  const { user } = useAuth();
  const { students } = useData();
  const { tryPro, toFree } = usePlanActions();
  const [open, setOpen] = useState(false);
  const pro = user?.plan === "pro", n = students.filter((s) => s.active).length;
  return <div className="card" id="plan"><h2><span className="emo" aria-hidden="true">⭐</span>{tr("Plan:")}{" "}{pro ? tr("Pro") : tr("Free")} {pro && <span className="tag ac">{tr("tryb testowy")}</span>}</h2>
    <p className="hint" style={{ margin: "-6px 0 12px" }}>{pro ? tr("Bez limitu uczniów, statystyki, kosz, szablony i cel miesięczny.") : tr("Aktywni uczniowie: {0} z {1}. Pro znosi limit i dodaje statystyki, kosz, szablony i cel miesięczny.", n, FREE)}</p>
    <div className="acts">{pro ? <button className="btn" onClick={toFree}>{tr("Wróć do Free")}</button> : <button className="btn p" onClick={tryPro}>{tr("Przetestuj Pro")}</button>}<button className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? tr("Ukryj porównanie") : tr("Porównaj plany")}</button></div>
    {open && <div style={{ marginTop: 16 }}><Plan /></div>}
  </div>;
}

/* ---------- settings ---------- */
export function Settings({ group = "" }: { group?: string }) {
  const [sec, setSec] = useState(group);
  const { user, setUser, updateMe, demo, logout } = useAuth();
  const { data, run, reload } = useTutor();
  const { modal, close, confirm, toast } = useOverlay();
  const { proUp } = useUpsell();
  const [pf, setPf] = useState({ name: user!.name, brand: user!.brand, err: "" });
  const [tpl, setTpl] = useState({ n: "", t: "" });
  const [goal, setGoal] = useState(user!.settings.goal ? gStr(user!.settings.goal) : "");
  const pr = user!.plan === "pro", c = user!.settings, th = pr ? c.theme || "light" : "light";
  const save = async (settings: any, ok = tr("Zapisano ustawienie.")) => { try { await updateMe({ settings }); toast(ok); } catch (e) { toast(errMsg(e)); } };
  const T: [string, string, string[]][] = [["light", tr("Jasny"), ["#f6f7fb", "#4f46e5", "#ffffff"]], ["dark", tr("Ciemny"), ["#12131a", "#8b85ff", "#1b1d2a"]], ["pink", tr("Różowy"), ["#fff6fa", "#db2777", "#ffffff"]], ["green", tr("Zielony"), ["#f2faf5", "#15803d", "#ffffff"]]];
  const up = (f: string) => pr ? null : <button className="btn p s" onClick={() => proUp(f)}>{tr("Odblokuj w Pro")}</button>;
  const tag = pr ? null : <> <span className="tag ac">{tr("Pro")}</span></>;

  const importFile = () => {
    const f = document.createElement("input"); f.type = "file"; f.accept = ".json,application/json";
    f.onchange = () => {
      const file = f.files?.[0]; if (!file) return;
      file.text().then((txt) => {
        let o: any = null; try { o = JSON.parse(txt); } catch { /* invalid */ }
        if (!o || !Array.isArray(o.students) || !Array.isArray(o.lessons)) { toast(tr("Nieprawidłowy plik kopii danych.")); return; }
        confirm({ title: tr("Zaimportować dane?"), text: tr("Obecni uczniowie i lekcje zostaną zastąpione ({0} uczniów, {1} lekcji).", o.students.length, o.lessons.length), ok: tr("Importuj"), danger: true,
          onOk: () => { run(() => api("POST", "/api/import", { students: o.students, lessons: o.lessons }), tr("Dane zaimportowane.")); } });
      });
    };
    f.click();
  };

  const PROFIL = <div className="card"><h2>{tr("Profil")}</h2>
      <Field id="pfn" label={tr("Imię lub imię i nazwisko")} value={pf.name} onChange={(v) => setPf({ ...pf, name: v })} error={pf.err} />
      <Field id="pfb" label={tr("Nazwa lub marka korepetytora")} value={pf.brand} onChange={(v) => setPf({ ...pf, brand: v })} />
      <p className="hint" style={{ margin: "4px 0 16px" }}>{tr("E-mail:")}{" "}{user!.email}{tr(". Nazwa lub marka jest widoczna dla Twoich uczniów w panelu ucznia.")}</p>
      <button className="btn p" disabled={demo} onClick={async () => { if (!pf.name.trim()) { setPf({ ...pf, err: tr("Podaj imię.") }); return; } try { await updateMe({ name: pf.name.trim(), brand: pf.brand.trim() }); setPf({ ...pf, err: "" }); toast(tr("Profil zapisany.")); } catch (e) { toast(errMsg(e)); } }}>{tr("Zapisz profil")}</button></div>;
  const HASLO = <div className="card"><h2>{tr("Konto i bezpieczeństwo")}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Hasło jest przechowywane wyłącznie jako zaszyfrowany skrót.")}</p><div className="acts"><button className="btn" disabled={demo} onClick={() => modal(<ChangePassword />)}>{tr("Zmień hasło")}</button>{user!.isAdmin && !demo && <button className="btn" onClick={() => navigate("/admin")}>{tr("Panel administratora")}</button>}<button className="btn" onClick={() => confirm({ title: demo ? tr("Wyjść z trybu demo?") : tr("Wylogować się?"), text: demo ? tr("Dane przykładowe nie są zapisywane.") : tr("Twoje dane są bezpiecznie zapisane na koncie."), ok: demo ? tr("Wyjdź") : tr("Wyloguj się"), onOk: logout })}>{demo ? tr("Wyjdź z dema") : tr("Wyloguj się")}</button></div></div>;
  const DOMYSLNE = <div className="card"><h2>{tr("Domyślne wartości")}</h2>
      <div className="f2">
        <div className="f"><label htmlFor="sd">{tr("Domyślny czas lekcji (min)")}</label><input id="sd" type="number" min={5} step={5} defaultValue={c.dur || 60} onBlur={(e) => { const v = Number(e.target.value); if (!(v > 0) || Math.round(v) !== v) { toast(tr("Podaj dodatnią liczbę minut.")); e.target.value = String(c.dur || 60); return; } if (v !== (c.dur || 60)) save({ dur: v }); }} /></div>
        <div className="f"><label htmlFor="st">{tr("Godzina nowej lekcji")}</label><input id="st" type="time" defaultValue={c.time || "16:00"} onBlur={(e) => { if (e.target.value && e.target.value !== (c.time || "16:00")) save({ time: e.target.value }); }} /></div>
      </div>
      <div className="f2">
        <div className="f"><label htmlFor="sr2">{tr("Stawka nowego ucznia (zł / 60 min)")}</label><input id="sr2" inputMode="decimal" defaultValue={gStr(c.rate || 10000)} onBlur={(e) => { const v = toG(e.target.value); if (isNaN(v) || v < 0) { toast(tr("Podaj poprawną, nieujemną stawkę.")); e.target.value = gStr(c.rate || 10000); return; } if (v !== (c.rate || 10000)) save({ rate: v }); }} /></div>
        <div className="f"><label htmlFor="sw">{tr("Początek tygodnia w kalendarzu")}</label><select id="sw" value={c.wk === "sun" ? "sun" : "mon"} onChange={(e) => save({ wk: e.target.value })}><option value="mon">{tr("Poniedziałek")}</option><option value="sun">{tr("Niedziela")}</option></select></div>
      </div>
      <div className="chk" style={{ marginTop: 8 }}><input type="checkbox" id="sl" checked={c.late !== false} onChange={(e) => save({ late: e.target.checked })} /><label htmlFor="sl">{tr("Pokazuj na pulpicie lekcje do potwierdzenia")}</label></div></div>;
  const CEL = <div className="card"><h2>{tr("Cel miesięczny")}{tag}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Pasek postępu na pulpicie pokazuje, ile z celu osiągnąłeś w wybranym miesiącu. Zostaw puste, aby wyłączyć.")}</p>
      <div className="f"><label htmlFor="sg">{tr("Cel (zł)")}</label><input id="sg" inputMode="decimal" value={goal} disabled={!pr} onChange={(e) => setGoal(e.target.value)} onBlur={() => { const v = goal.trim() === "" ? 0 : toG(goal); if (isNaN(v) || v < 0) { toast(tr("Podaj poprawną, nieujemną kwotę.")); return; } if (v !== (c.goal || 0)) save({ goal: v }); }} /></div>{up(tr("Cel miesięczny"))}</div>;
  const SZABLONY = <div className="card"><h2>{tr("Szablony notatek")}{tag}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Wstawiasz je w formularzu lekcji. Dostępne są 4 gotowe szablony i Twoje własne.")}</p>
      {(c.tpl || []).map((x, i) => <div className="row" key={i}><div className="m"><b>{x.n}</b><span>{x.t}</span></div><button className="btn s d" disabled={!pr} onClick={() => save({ tpl: (c.tpl || []).filter((_, j) => j !== i) }, tr("Usunięto szablon."))}>{tr("Usuń")}</button></div>)}
      <div className="f" style={{ marginTop: 12 }}><label htmlFor="tn">{tr("Nazwa szablonu")}</label><input id="tn" disabled={!pr} value={tpl.n} onChange={(e) => setTpl({ ...tpl, n: e.target.value })} /></div>
      <div className="f"><label htmlFor="tt">{tr("Treść")}</label><textarea id="tt" rows={3} disabled={!pr} value={tpl.t} onChange={(e) => setTpl({ ...tpl, t: e.target.value })} /></div>
      {pr ? <button className="btn" onClick={async () => { if (!tpl.n.trim() || !tpl.t.trim()) { toast(tr("Podaj nazwę i treść szablonu.")); return; } await save({ tpl: [...(c.tpl || []), { n: tpl.n.trim(), t: tpl.t.trim() }] }, tr("Dodano szablon.")); setTpl({ n: "", t: "" }); }}>{tr("Dodaj szablon")}</button> : up(tr("Szablony notatek"))}</div>;
  const DANE = <div className="card"><h2>{tr("Dane")}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Kopia danych zawiera dane uczniów – przechowuj ją bezpiecznie.")}</p>
      <div className="acts">
        <button className="btn" onClick={async () => { try { const d = await api("GET", "/api/export"); download("tutortrack-kopia-" + ymd(new Date()) + ".json", JSON.stringify(d, null, 1), "application/json"); toast(tr("Kopia zapisana.")); } catch (e) { toast(errMsg(e)); } }}>{tr("Eksportuj kopię danych")}</button>
        <button className="btn" disabled={demo} onClick={importFile}>{tr("Importuj kopię danych")}</button>
        <button className="btn d" disabled={demo} onClick={() => modal(<DeleteAccount onDone={() => { setUser(null); logout(); }} />)}>{tr("Usuń konto i dane")}</button>
      </div></div>;
  const KOSZ = <div className="card"><h2>{tr("Kosz")}{tag}</h2>
      {!pr ? <><p className="hint">{tr("W planie Pro usunięte lekcje i uczniowie trafiają do kosza na 30 dni i można je przywrócić.")}</p>{up(tr("Kosz z przywracaniem"))}</> : <>
        <p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Usunięte lekcje i uczniowie trafiają tu na 30 dni.")}</p>
        {data!.trash.length ? <>{data!.trash.map((x) => { const d = Math.max(0, 30 - Math.floor((Date.now() - x.deletedAt) / 864e5)); const nm = x.kind === "student" ? tr("Uczeń: {0} ({1} lekcji)", x.name, x.lessons) : tr("Lekcja: {0} · {1}, {2}", x.name || "usunięty uczeń", fd(x.date!), x.time);
          return <div className="row" key={x.id}><div className="m"><b>{nm}</b><span>{tr("Pozostało dni:")}{" "}{d}</span></div><div className="acts">
            <button className="btn s" onClick={() => run(() => api("POST", `/api/trash/${x.kind}/${x.id}/restore`), tr("Przywrócono."))}>{tr("Przywróć")}</button>
            <button className="btn s d" onClick={() => confirm({ title: tr("Usunąć na stałe?"), text: tr("Tej operacji nie można cofnąć."), ok: tr("Usuń na stałe"), danger: true, onOk: () => { run(() => api("DELETE", `/api/trash/${x.kind}/${x.id}`)); } })}>{tr("Usuń na stałe")}</button></div></div>; })}
          <div style={{ marginTop: 12 }}><button className="btn d" onClick={() => confirm({ title: tr("Opróżnić kosz?"), text: tr("Wszystkie elementy zostaną trwale usunięte."), ok: tr("Opróżnij"), danger: true, onOk: () => { run(() => api("DELETE", "/api/trash"), tr("Kosz opróżniony.")); } })}>{tr("Opróżnij kosz")}</button></div></>
          : <p className="hint">{tr("Kosz jest pusty.")}</p>}</>}</div>;

  const I = (k: string, t: string, ic: string, v?: ReactNode) => <button key={k} className="sitem" onClick={() => { setSec(k); window.scrollTo(0, 0); }}><span className="sic"><Ic n={ic} s={16} /></span><b>{t}</b>{v != null && <span className="sv">{v}</span>}<Ic n="chev" s={16} /></button>;
  const SEC: Record<string, [string, ReactNode]> = {
    profil: [tr("Profil"), PROFIL],
    kontakt: [tr("Kontakt dla uczniów"), <ContactCard />],
    haslo: [tr("Hasło i bezpieczeństwo"), HASLO],
    plan: [tr("Plan"), <PlanCard />],
    domyslne: [tr("Domyślne wartości lekcji"), DOMYSLNE],
    szablony: [tr("Szablony notatek"), SZABLONY],
    cel: [tr("Cel miesięczny"), CEL],
    wyglad: [tr("Wygląd"), <ThemePicker />],
    jezyk: [tr("Język"), <LangPicker />],
    dane: [tr("Kopia danych"), DANE],
    kosz: [tr("Kosz"), KOSZ],
  };
  if (sec && SEC[sec]) return <div className="ssec">
    <button className="sback" onClick={() => { setSec(""); window.scrollTo(0, 0); }}><Ic n="chevl" s={16} />{tr("Ustawienia")}</button>
    {SEC[sec][1]}</div>;
  const thName: Record<string, string> = { light: tr("Jasny"), auto: tr("Systemowy"), dark: tr("Ciemny"), graphite: tr("Grafit"), blue: tr("Ocean"), green: tr("Mięta"), pink: tr("Róż"), orange: tr("Zachód słońca"), purple: tr("Lawenda") };
  return <div className="slist">
    <div className="sgrp"><button className="sitem sme" onClick={() => setSec("profil")}><span className="sav">{(user!.name || "?").charAt(0).toUpperCase()}</span><b>{user!.name}<small>{pr ? tr("Plan Pro") : tr("Plan Free")} · {user!.email}</small></b><Ic n="chev" s={16} /></button></div>
    <div className="sgt">{tr("Konto")}</div>
    <div className="sgrp">{I("kontakt", tr("Kontakt dla uczniów"), "mail", c.showEmail || c.showPhone ? tr("widoczny") : tr("ukryty"))}{I("haslo", tr("Hasło i bezpieczeństwo"), "lock")}{I("plan", tr("Plan"), "star", pr ? tr("Pro") : tr("Free"))}</div>
    <div className="sgt">{tr("Praca")}</div>
    <div className="sgrp">{I("domyslne", tr("Domyślne wartości lekcji"), "clock", (c.dur || 60) + tr(" min · ") + (c.time || "16:00"))}{I("szablony", tr("Szablony notatek"), "note", pr ? String(4 + (c.tpl || []).length) : tr("Pro"))}{I("cel", tr("Cel miesięczny"), "target", pr ? (c.goal ? pln(c.goal).replace(",00", "") : tr("wyłączony")) : tr("Pro"))}</div>
    <div className="sgt">{tr("Aplikacja")}</div>
    <div className="sgrp">{I("wyglad", tr("Wygląd"), "palette", thName[th] || tr("Jasny"))}{I("jezyk", tr("Język"), "globe", langName())}{I("dane", tr("Kopia danych"), "download")}{I("kosz", tr("Kosz"), "trash", pr ? (data!.trash.length ? String(data!.trash.length) : tr("pusty")) : tr("Pro"))}</div>
    {user!.isAdmin && !demo && <div className="sgrp" style={{ marginTop: 16 }}><button className="sitem" onClick={() => navigate("/admin")}><span className="sic"><Ic n="alert" s={16} /></span><b>{tr("Panel administratora")}</b><Ic n="chev" s={16} /></button></div>}
    <button className="slogout" onClick={() => confirm({ title: demo ? tr("Wyjść z trybu demo?") : tr("Wylogować się?"), text: demo ? tr("Dane przykładowe nie są zapisywane.") : tr("Twoje dane są bezpiecznie zapisane na koncie."), ok: demo ? tr("Wyjdź") : tr("Wyloguj się"), onOk: logout })}><Ic n="out" s={18} />{demo ? tr("Wyjdź z dema") : tr("Wyloguj się")}</button>
  </div>;
}

/** Contact details visible to linked students – the tutor decides what is shown. */
function ContactCard() {
  const { user, demo, updateMe } = useAuth();
  const { toast } = useOverlay();
  const c = user!.settings;
  const [f, setF] = useState({ showEmail: !!c.showEmail, cEmail: c.cEmail || user!.email, showPhone: !!c.showPhone, cPhone: c.cPhone || "" });
  const [e, setE] = useState<Record<string, string>>({});
  const save = async () => {
    const er = { cEmail: f.showEmail && !/^\S+@\S+\.\S+$/.test(f.cEmail.trim()) ? tr("Podaj poprawny e-mail.") : "", cPhone: f.showPhone && f.cPhone.trim().length < 5 ? tr("Podaj numer telefonu.") : "" };
    setE(er); if (er.cEmail || er.cPhone) return;
    try { await updateMe({ settings: { showEmail: f.showEmail, cEmail: f.cEmail.trim(), showPhone: f.showPhone, cPhone: f.cPhone.trim() } }); toast(tr("Zapisano dane kontaktowe.")); } catch (x) { toast(errMsg(x)); }
  };
  return <div className="card"><h2><span className="emo" aria-hidden="true">📇</span>{tr("Kontakt dla uczniów")}</h2>
    <p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Zaznacz, co uczniowie połączeni z Tobą kodem mają widzieć w zakładce „Korepetytorzy”. Domyślnie nic nie jest widoczne.")}</p>
    <label className="chk"><input type="checkbox" checked={f.showEmail} onChange={(x) => setF({ ...f, showEmail: x.target.checked })} />{tr("Pokazuj e-mail")}</label>
    {f.showEmail && <Field id="cem" label={tr("E-mail dla uczniów")} type="email" value={f.cEmail} onChange={(v) => setF({ ...f, cEmail: v })} error={e.cEmail} />}
    <label className="chk"><input type="checkbox" checked={f.showPhone} onChange={(x) => setF({ ...f, showPhone: x.target.checked })} />{tr("Pokazuj numer telefonu")}</label>
    {f.showPhone && <Field id="cph" label={tr("Telefon dla uczniów")} type="tel" value={f.cPhone} onChange={(v) => setF({ ...f, cPhone: v })} error={e.cPhone} />}
    <button className="btn p" style={{ marginTop: 8 }} disabled={demo} onClick={save}>{tr("Zapisz kontakt")}</button>
  </div>;
}

export function ChangePassword() {
  const { close, toast } = useOverlay();
  const [f, setF] = useState({ c: "", n1: "", n2: "" });
  const [e, setE] = useState<Record<string, string>>({});
  return <><h2>{tr("Zmień hasło")}</h2>
    <Field id="pc" label={tr("Obecne hasło")} type="password" value={f.c} onChange={(v) => setF({ ...f, c: v })} error={e.c} autoComplete="current-password" />
    <Field id="pn1" label={tr("Nowe hasło (min. 8 znaków, litera i cyfra)")} type="password" value={f.n1} onChange={(v) => setF({ ...f, n1: v })} error={e.n1} autoComplete="new-password" />
    <Field id="pn2" label={tr("Powtórz nowe hasło")} type="password" value={f.n2} onChange={(v) => setF({ ...f, n2: v })} error={e.n2} autoComplete="new-password" />
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" onClick={async () => {
      const er = { c: f.c ? "" : tr("Podaj obecne hasło."), n1: pwOk(f.n1) ? "" : tr("Hasło musi mieć co najmniej 8 znaków oraz literę i cyfrę."), n2: f.n1 === f.n2 ? "" : tr("Hasła muszą być identyczne.") };
      setE(er); if (er.c || er.n1 || er.n2) return;
      try { await api("POST", "/api/me/password", { current: f.c, next: f.n1 }); close(); toast(tr("Hasło zmienione. Inne urządzenia zostały wylogowane.")); } catch (x) { setE({ c: errMsg(x) }); }
    }}>{tr("Zapisz hasło")}</button></div></>;
}

export function DeleteAccount({ onDone }: { onDone: () => void }) {
  const { close, toast } = useOverlay();
  const [pw, setPw] = useState(""), [err, setErr] = useState("");
  return <><h2>{tr("Usunąć konto i wszystkie dane?")}</h2><p>{tr("Zostaną trwale usunięte profil i wszystkie powiązane dane. Tej operacji nie można cofnąć.")}</p>
    <Field id="dpw" label={tr("Potwierdź hasłem")} type="password" value={pw} onChange={setPw} error={err} autoComplete="current-password" />
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" style={{ background: "var(--rd)", borderColor: "var(--rd)" }} onClick={async () => {
      try { await api("DELETE", "/api/me", { password: pw }); close(); toast(tr("Konto usunięte.")); onDone(); } catch (x) { setErr(errMsg(x)); }
    }}>{tr("Usuń konto")}</button></div></>;
}

/* ---------- welcome ---------- */
export function Welcome() {
  const { user, updateMe } = useAuth();
  const { students, lessons } = useData();
  const { addStudent, addLesson } = useAdd();
  const a = students.length > 0, b = lessons.length > 0, c = !!user?.settings.onbBilling, n = +a + +b + +c;
  const cd = (i: ReactNode, t: string, d: string, done: boolean, dis: boolean, on: () => void, btn: string) =>
    <div className="card" style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}><div className="av" style={done ? { background: "var(--grl)", color: "var(--gr)" } : undefined}>{done ? <Ic n="check" /> : i}</div><div style={{ flex: 1, minWidth: 200 }}><b>{t}</b><div className="hint">{d}</div></div><button className={"btn s" + (done ? "" : " p")} disabled={dis} onClick={on}>{btn}</button></div>;
  const finish = async () => { try { await updateMe({ settings: { welcomeSkipped: true } }); } catch { /* ignore */ } navigate("/aplikacja/dash"); };
  return <>
    <h2 style={{ fontSize: 22, margin: "0 0 4px" }}>{tr("Cześć,")}{" "}{(user?.name || "").split(" ")[0]}{" "}{tr("- dobrze Cię widzieć")}</h2><p className="hint" style={{ margin: 0 }}>{tr("Trzy kroki dzielą Cię od działającego dziennika.")}</p>
    <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={n} aria-label={tr("Postęp wdrożenia")}><i style={{ width: Math.round(n / 3 * 100) + "%" }} /></div><p><b>{n}{" "}{tr("z 3 kroków")}</b></p>
    <div className="grid">
      {cd(1, tr("Dodaj pierwszego ucznia"), a ? tr("Masz już uczniów: ") + students.length + "." : tr("Imię, przedmiot i stawka za 60 minut."), a, false, addStudent, a ? tr("Dodaj kolejnego") : tr("Dodaj ucznia"))}
      {cd(2, tr("Dodaj pierwszą lekcję"), !students.length ? tr("Najpierw dodaj ucznia – lekcja musi być przypisana do ucznia.") : b ? tr("Masz już lekcje: ") + lessons.length + "." : tr("Kwota policzy się ze stawki ucznia."), b, !students.length, () => addLesson(), b ? tr("Dodaj kolejną") : tr("Dodaj lekcję"))}
      {cd(3, tr("Sprawdź rozliczenia miesiąca"), c ? tr("Rozliczenia zostały już sprawdzone.") : !lessons.length ? tr("Najpierw dodaj lekcję – rozliczenia pojawią się po pierwszej przeprowadzonej lekcji.") : tr("Zobacz należności i kwoty do zapłaty."), c, !lessons.length, () => navigate("/aplikacja/billing"), tr("Otwórz rozliczenia"))}
    </div>
    {n === 3 ? <div className="card" style={{ marginTop: 16, borderColor: "#b9e3c8", background: "var(--grl)" }}><b>{tr("Wszystko gotowe!")}</b><div className="hint" style={{ marginBottom: 10 }}>{tr("Masz uczniów, lekcje i sprawdzone rozliczenia.")}</div><button className="btn p" onClick={finish}>{tr("Przejdź do pulpitu")}</button></div>
      : <p style={{ marginTop: 16 }}><button className="btn" onClick={finish}>{tr("Pomiń powitanie i przejdź do pulpitu")}</button></p>}
  </>;
}

export { isDemo };

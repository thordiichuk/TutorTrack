import { ReactNode, useEffect, useState } from "react";
import { api, isDemo } from "../lib/api";
import { Empty, Ic } from "../lib/icons";
import { navigate } from "../lib/router";
import {
  amt, billable, cq, download, fd, fm, FREE, gStr, Lesson, MSHORT, pad, pd, pln, PRO_PLN, sortL, subjList, sumAmt, te, toG, ym, ymd, pwOk, copyText, subjRates,
  lekcje, addDays, WDL, subjColor,
} from "../lib/util";
import { useAuth, useTutor } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { LessonItem, useData, useUi, useUpsell } from "./common";
import { ThemePicker } from "../ui/themes";
import { CancelRequestActions, LessonForm, LessonSheet, ShareModal, StudentDetail, StudentForm, SummaryModal, summaryText } from "./Forms";

/* ---------- small pieces ---------- */
/** Month switcher: ‹ Listopad 2026 › – always in Polish, independent of the browser language. */
function MonthInput({ v, on }: { v: string; on: (m: string) => void }) {
  const shift = (k: number) => { const [y, mo] = v.split("-").map(Number); on(ym(new Date(y, mo - 1 + k, 1))); };
  const t = fm(v);
  return <div className="mpick" role="group" aria-label="Miesiąc">
    <button type="button" aria-label="Poprzedni miesiąc" onClick={() => shift(-1)}>‹</button>
    <span aria-live="polite">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
    <button type="button" aria-label="Następny miesiąc" onClick={() => shift(1)}>›</button>
  </div>;
}
const monthDone = (ls: Lesson[], m: string) => ls.filter((l) => billable(l) && l.date.slice(0, 7) === m);
function BarList({ o, ff }: { o: Record<string, number>; ff: (n: number) => string }) {
  const e = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = e.length ? e[0][1] : 1;
  if (!e.length) return <p className="hint">Brak danych w wybranym okresie.</p>;
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
      if (!students.some((s) => s.active)) { toast("Najpierw dodaj ucznia."); modal(<StudentForm />); return; }
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
  return <div className="nt" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>Dokończ konfigurację: {n} z 3 kroków. <a href="/aplikacja/welcome">Wróć do powitania</a></div>;
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
    if (l.date === td) { const [h, mi] = l.time.split(":").map(Number); const diff = h * 60 + mi - (nowD.getHours() * 60 + nowD.getMinutes()); return diff < 60 ? "za " + Math.max(diff, 0) + " min" : "za " + Math.round(diff / 60) + " h"; }
    if (l.date === addDays(1)) return "jutro";
    return WDSHORT_L[pd(l.date).getDay()] + " " + pd(l.date).getDate() + " " + MSHORT[pd(l.date).getMonth()];
  };
  const unM = done.filter((l) => !l.paid);
  const mName = fm(m).split(" ")[0];
  return <>
    <SetupBar />
    <div className="bento kb">
      {nx ? <button type="button" className="khero w2" onClick={() => modal(<LessonSheet id={nx.id} />)}>
          <span className="hl"><span>Następna lekcja · {inLabel(nx)}</span><span>{nx.subject || subjList(stu(nx.sid) || { subject: "" })[0] || ""}</span></span>
          <span className="hv">{stu(nx.sid)?.name || "?"}</span>
          <span className="hp"><span>{nx.time}–{te(nx.time, nx.min)}</span>{nx.topic && <span>{nx.topic}</span>}</span></button>
        : <div className="khero w2"><span className="hl"><span>Następna lekcja</span></span><span className="hv">Brak zaplanowanych</span><span className="hp"><span>Dodaj lekcję przyciskiem „+”</span></span></div>}
      <div className="tile tl3"><div className="l">Do zapłaty</div><div className="v">{pln(sumAmt(unM, () => true)).replace(",00", "")}</div><small>{lekcje(unM.length)}</small></div>
      <div className="tile tl2"><div className="l">Opłacone</div><div className="v">{pln(sumAmt(done, (l) => l.paid)).replace(",00", "")}</div><small>{mName}</small></div>
      {reqs.length > 0 && <div className="kreq w4">{reqs.map((l) => { const st = stu(l.sid); return <div className="kreqr" key={l.id}>
        <div className="rqm"><b>{reqs.length === 1 ? "1 prośba ucznia" : st?.name}</b><span>{st ? st.name.split(" ")[0] : ""} prosi o {l.cr!.kind === "move" ? "przeniesienie na " + (() => { const d = pd(l.date); d.setDate(d.getDate() + 7); return d.getDate() + " " + MSHORT[d.getMonth()]; })() : "odwołanie lekcji " + pd(l.date).getDate() + " " + MSHORT[pd(l.date).getMonth()]}</span></div>
        <button className="lnk" onClick={() => modal(<LessonSheet id={l.id} />)}>Rozpatrz</button></div>; })}</div>}
      <div className="kplan w2"><div className="dch"><h2>Plan na dziś</h2><a href="/aplikacja/lessons">Wszystkie</a></div>
        {today.length ? today.map((l) => { const st = stu(l.sid), sub = l.subject || (st ? subjList(st)[0] : ""); return <button key={l.id} className="kpr" onClick={() => modal(<LessonSheet id={l.id} />)}>
          <span className="kpb" style={{ background: subjColor(sub) }} /><span className="lwho"><b>{st?.name || "?"}</b><span>{sub}</span></span><b className="kpt">{l.time}</b></button>; })
          : <p className="hint" style={{ margin: "4px 0 6px" }}>Dziś nie masz lekcji.{nx ? " Następna: " + inLabel(nx) + ", " + nx.time + "." : ""}</p>}</div>
      <div className="tile kg"><div className="l">Uczniowie</div><div className="v">{students.filter((s) => s.active).length}</div></div>
      <div className="tile kg"><div className="l">Lekcje w mies.</div><div className="v">{done.filter((l) => l.status === "done").length}</div></div>
    </div>
    {goal > 0 && <div className="card" style={{ marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>Cel miesięczny</b><span>{pln(tot)} z {pln(goal)} ({Math.round(tot / goal * 100)}%)</span></div><div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pc} aria-label="Postęp celu miesięcznego" style={{ margin: "8px 0 0" }}><i style={{ width: pc + "%" }} /></div></div>}
    {late.length > 0 && <div className="card dcard" style={{ marginTop: 12 }}><h2>Do potwierdzenia ({late.length})</h2><p className="hint" style={{ margin: "-6px 0 4px" }}>Te lekcje miały już się odbyć – oznacz je jako przeprowadzone.</p>{(allLate ? late : late.slice(-3)).map((l) => <LessonItem key={l.id} l={l} />)}
      {late.length > 3 && <button className="more" style={{ margin: "8px 0" }} onClick={() => setAllLate(!allLate)}>{allLate ? "Pokaż mniej" : "Pokaż wszystkie (" + late.length + ")"}</button>}</div>}
  </>;
}
const WDSHORT_L = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];

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
  else if (ui.so === "ln") list.sort((a, b) => cmp(last(a.name), last(b.name)) || cmp(a.name, b.name));
  const pro = user?.plan === "pro";
  return <>
    <div className="bar sbar"><input type="search" placeholder="Szukaj: imię, nazwisko, przedmiot" value={ui.q} aria-label="Szukaj ucznia" onChange={(e) => setUi((u) => ({ ...u, q: e.target.value }))} />
      <select aria-label="Status ucznia" value={ui.sf} onChange={(e) => setUi((u) => ({ ...u, sf: e.target.value as any }))}><option value="active">Aktywni</option><option value="arch">Zarchiwizowani</option><option value="all">Wszyscy</option></select>
      <select aria-label="Sortowanie uczniów" value={ui.so} onChange={(e) => setUi((u) => ({ ...u, so: e.target.value as any }))}><option value="az">Imię A–Z</option><option value="za">Imię Z–A</option><option value="ln">Nazwisko A–Z</option><option value="new">Kolejność dodania</option></select></div>
    {subjects.length > 0 && <div className="chips" role="group" aria-label="Filtr po przedmiotach" style={{ marginBottom: 12 }}>
      <button className={"chip" + (!subj ? " on" : "")} aria-pressed={!subj} onClick={() => setUi((u) => ({ ...u, subj: "" }))}>Wszyscy · {list.length}</button>
      {subjects.map((x) => <button key={x} className={"chip" + (subj === x ? " on" : "")} aria-pressed={subj === x} onClick={() => setUi((u) => ({ ...u, subj: x }))}>{x}</button>)}</div>}
    {!list.length ? <div className="card"><Empty icon="users" title="Brak uczniów" sub="Zmień filtry lub dodaj pierwszego ucznia." /></div> : <>
      <div className="slhd"><span>{({ az: "Imię A–Z", za: "Imię Z–A", ln: "Nazwisko A–Z", new: "Kolejność dodania" } as Record<string, string>)[ui.so]}</span><span>Do zapłaty</span></div>
      <div className="dgl">{list.map((s) => {
        const due = sumAmt(lessons.filter((l) => l.sid === s.id && billable(l)), (l) => !l.paid);
        const rates = subjRates(s);
        return <button key={s.id} className={"strow" + (s.active ? "" : " cx")} onClick={() => modal(<StudentDetail id={s.id} />, true)}>
          <span className="sav2">{s.name.charAt(0).toUpperCase()}</span>
          <span className="lwho"><b>{s.name}{s.linked && <i className="ptag">panel</i>}{!s.active && <i className="ptag gray">archiwum</i>}</b>
            <span>{rates.length > 1 ? rates.map(([x, r]) => x + " " + pln(r).replace(",00", "")).join(" · ") : (rates[0][0] ? rates[0][0] + " · " : "") + pln(rates[0][1]).replace(",00", "") + "/h"}</span></span>
          {due > 0 ? <b className="sdue">{pln(due).replace(",00", "")}</b> : <span className="sok">rozliczony</span>}
        </button>;
      })}</div></>}
  </>;
}

/* ---------- lessons ---------- */
function dayTitle(d: string) {
  const td = ymd(new Date());
  if (d === td) return "Dziś";
  if (d === addDays(1)) return "Jutro";
  if (d === addDays(-1)) return "Wczoraj";
  const n = WDL[(pd(d).getDay() + 6) % 7]; return n;
}
function DayGroups({ list, dir }: { list: Lesson[]; dir: number }) {
  const m: Record<string, Lesson[]> = {};
  list.forEach((l) => { (m[l.date] = m[l.date] || []).push(l); });
  const ds = Object.keys(m).sort((a, b) => dir * a.localeCompare(b)), td = ymd(new Date());
  // the day closest to today (today itself if it has lessons)
  const target = ds.reduce((b, d) => (b === "" || Math.abs(pd(d).getTime() - pd(td).getTime()) < Math.abs(pd(b).getTime() - pd(td).getTime()) ? d : b), "");
  return <><div className="days">{ds.map((d) => { const x = pd(d); const n = m[d].length; return <section className={"dgrp" + (d === td ? " today" : "")} key={d} data-day={d}>
    <div className={"dgh" + (d === td ? " td" : "")}><b>{dayTitle(d)}</b>{d === td && <i className="tdtag">dzisiaj</i>}<span>{x.getDate()} {MLONG_G[x.getMonth()]}{x.getFullYear() !== new Date().getFullYear() ? " " + x.getFullYear() : ""} · {n} {n === 1 ? "lekcja" : n < 5 ? "lekcje" : "lekcji"}</span></div>
    <div className="dgl">{m[d].sort((a, b) => a.time.localeCompare(b.time)).map((l) => <LessonItem key={l.id} l={l} nd />)}</div></section>; })}</div>
    {target && <TodayJump key={ds[0] + "|" + ds.length} day={target} has={target === td} />}</>;
}
const MLONG_G = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

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
    if (!has) { toast("Dziś nie ma zaplanowanych lekcji."); return; }
    const el = document.querySelector<HTMLElement>(`[data-day="${day}"]`); if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); };
  return <button className="tjump" onClick={go} aria-label="Przejdź do dzisiaj"><span aria-hidden="true">{dir === "up" ? "↑" : "↓"}</span>Dziś</button>;
}

function LessonsList() {
  const { students, lessons, stu } = useData();
  const [ui, setUi] = useUi();
  const f = ui.lf;
  const td = ymd(new Date());
  const subOf = (l: Lesson) => l.subject || subjList(stu(l.sid) || { subject: "" })[0] || "";
  const subs = [...new Set(students.flatMap((s) => subjList(s)).concat(lessons.map(subOf)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl"));
  const months = [...new Set(lessons.map((l) => l.date.slice(0, 7)))].sort().reverse();
  const setF = (p: Partial<typeof f>) => setUi((u) => ({ ...u, lf: { ...u.lf, ...p } }));
  const [open, setOpen] = useState(false);
  const nf = [f.st, f.sb, f.mo, f.q].filter(Boolean).length;
  const unpaid = (l: Lesson) => billable(l) && !l.paid;
  const nPay = lessons.filter(unpaid).length;
  const MODES: [typeof f.m, string][] = [["up", "Nadchodzące"], ["pay", "Do opłacenia" + (nPay ? " · " + nPay : "")], ["past", "Minione"], ["all", "Wszystkie"]];
  const inMode = (l: Lesson) => f.m === "up" ? l.status === "planned" && l.date >= td : f.m === "pay" ? unpaid(l) : f.m === "past" ? l.date < td : true;
  const dir = f.m === "up" ? 1 : -1;
  const list = sortL(lessons.filter((l) => inMode(l) && (!f.st || l.sid === f.st) && (!f.sb || subOf(l) === f.sb) && (!f.mo || l.date.slice(0, 7) === f.mo)
    && (!f.q || (l.topic + " " + l.notes).toLowerCase().includes(f.q.toLowerCase()))), dir);
  const empty: Record<string, [string, string]> = { up: ["Brak zaplanowanych lekcji", "Dodaj lekcję przyciskiem „+”."], pay: ["Wszystko opłacone", "Nie ma lekcji czekających na płatność."], past: ["Brak minionych lekcji", "Tu pojawią się lekcje, które już się odbyły."], all: ["Brak lekcji", "Żadna lekcja nie pasuje do filtrów."] };
  return <>
    <div className="lbar2">
      <div className="chips" role="group" aria-label="Pokaż lekcje">{MODES.map(([k, t]) => <button key={k} className={"chip" + (f.m === k ? " on" : "")} aria-pressed={f.m === k} onClick={() => setF({ m: k })}>{t}</button>)}</div>
      <button className={"btn s" + (nf ? " p" : "")} aria-expanded={open} onClick={() => setOpen(!open)}>Filtry{nf ? ` · ${nf}` : ""}</button>
    </div>
    {open && <div className="fpanel">
      <input type="search" placeholder="Szukaj w temacie i notatkach" value={f.q} aria-label="Szukaj w lekcjach" onChange={(e) => setF({ q: e.target.value })} />
      <select aria-label="Uczeń" value={f.st} onChange={(e) => setF({ st: e.target.value })}><option value="">Wszyscy uczniowie</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      {subs.length > 1 && <select aria-label="Przedmiot" value={f.sb} onChange={(e) => setF({ sb: e.target.value })}><option value="">Wszystkie przedmioty</option>{subs.map((x) => <option key={x} value={x}>{x}</option>)}</select>}
      <select aria-label="Miesiąc" value={f.mo} onChange={(e) => setF({ mo: e.target.value })}><option value="">Każdy miesiąc</option>{months.map((x) => { const t = fm(x); return <option key={x} value={x}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>; })}</select>
      {nf > 0 && <button className="btn" onClick={() => setUi((u) => ({ ...u, lf: { ...u.lf, st: "", sb: "", mo: "", q: "" } }))}>Wyczyść filtry</button>}
    </div>}
    {list.length ? <DayGroups list={list} dir={dir} /> : <div className="card"><Empty icon="book" title={empty[f.m][0]} sub={empty[f.m][1]} /></div>}
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
    <div className="bar" style={{ justifyContent: "center", marginBottom: 8 }}><button className="btn s" onClick={() => shift(-1)} aria-label="Poprzedni miesiąc">‹</button><b style={{ minWidth: 150, textAlign: "center", textTransform: "capitalize" }}>{fm(m)}</b><button className="btn s" onClick={() => shift(1)} aria-label="Następny miesiąc">›</button></div>
    <div className="cal">
      {(sun ? ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"] : ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]).map((x) => <div className="ch" key={x}>{x}</div>)}
      {Array.from({ length: off }, (_, i) => <div key={"o" + i} />)}
      {Array.from({ length: dim }, (_, i) => { const d = i + 1, ds = m + "-" + pad(d), n = (by[ds] || []).length;
        return <button key={ds} className={"cd" + (n ? " busy" : "") + (ds === td ? " td" : "") + (ui.cd === ds ? " sel" : "")} aria-pressed={ui.cd === ds} aria-label={d + (n ? ", lekcji: " + n : ", wolne")} onClick={() => setUi((u) => ({ ...u, cd: u.cd === ds ? "" : ds }))}><span>{d}</span>{n > 0 && <i>{n}</i>}</button>; })}
    </div>
    <p className="hint" style={{ margin: "10px 0 0" }}>Zaznaczone dni mają lekcje. Kliknij dzień, aby zobaczyć uczniów i godziny.</p>
    {L && <><h3 style={{ margin: "16px 0 4px" }}>{fd(ui.cd)}</h3>{L.length ? L.map((l) => <LessonItem key={l.id} l={l} nd />)
      : <div className="empty">Dzień wolny – brak lekcji.</div>}</>}
  </div>;
}

export function Lessons() {
  const [ui, setUi] = useUi();
  return <>
    <div className="bar"><div className="seg" role="group" aria-label="Widok lekcji"><button aria-pressed={ui.lv !== "cal"} onClick={() => setUi((u) => ({ ...u, lv: "list" }))}>Lista</button><button aria-pressed={ui.lv === "cal"} onClick={() => setUi((u) => ({ ...u, lv: "cal" }))}>Kalendarz</button></div></div>
    {ui.lv === "cal" ? <Calendar /> : <LessonsList />}
  </>;
}

/* ---------- billing ---------- */
const csvRows = (list: Lesson[], name: (id: string) => string) =>
  "﻿" + [["Uczeń", "Data", "Godzina", "Minuty", "Temat", "Status", "Kwota (PLN)", "Płatność"].map(cq).join(";"),
    ...sortL(list, 1).map((l) => [name(l.sid), l.date, l.time, l.min, l.topic, l.status === "cancelled" ? "odwołana (opłata)" : "przeprowadzona", gStr(amt(l)), l.paid ? "opłacona" : "nieopłacona"].map(cq).join(";"))].join("\r\n");

export function Billing() {
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
    if (!pro) { proUp("Podsumowania dla wszystkich uczniów"); return; }
    const sids = [...new Set(lessons.filter((l) => (l.status === "done" || l.status === "cancelled") && l.date.slice(0, 7) === m && stu(l.sid)).map((l) => l.sid))];
    if (!sids.length) { toast("Brak lekcji do podsumowania w tym miesiącu."); return; }
    modal(<><h2>Podsumowania – {fm(m)}</h2><p className="hint">Gotowe wiadomości dla każdego ucznia.</p>
      {sids.map((sid) => { const t = summaryText(stu(sid)!, lessons, m, user?.brand || ""); return <div className="f" key={sid}><label>{name(sid)}</label><textarea rows={7} readOnly value={t} /><button className="btn s" style={{ marginTop: 6 }} onClick={async () => toast((await copyText(t)) ? "Skopiowano." : "Zaznacz tekst i skopiuj go ręcznie.")}>Kopiuj</button></div>; })}
      <div className="mf"><button className="btn p" onClick={close}>Zamknij</button></div></>, true);
  };
  return <>
    <div className="bar"><MonthInput v={m} on={(v) => setUi((u) => ({ ...u, bm: v }))} /><span className="sp" />
      <button className="btn" onClick={() => modal(<><h2>Eksport i podsumowania</h2><div className="mnu">
        <button className="btn" onClick={() => { close(); download("rozliczenie-" + m + ".csv", csvRows(done, name), "text/csv"); }}>Rozliczenie miesiąca – CSV ({fm(m)})</button>
        <button className="btn" onClick={() => { close(); if (!pro) { proUp("Eksport roku do CSV"); return; } const y = m.slice(0, 4); download("rozliczenie-" + y + ".csv", csvRows(lessons.filter((l) => billable(l) && l.date.slice(0, 4) === y), name), "text/csv"); }}>Rozliczenie całego roku – CSV {!pro && <span className="tag ac">Pro</span>}</button>
        <button className="btn" onClick={() => { close(); sumAll(); }}>Podsumowania dla wszystkich uczniów {!pro && <span className="tag ac">Pro</span>}</button>
      </div><div className="mf"><button className="btn" onClick={close}>Zamknij</button></div></>)}>Eksport</button></div>
    <div className="card bsum">
      <div className="l">Należności · {fm(m)}</div><div className="bv">{pln(tot).replace(",00", "")}</div>
      <div className="pbar" aria-hidden="true" style={{ margin: "10px 0 12px" }}><i style={{ width: (tot ? Math.round(paid / tot * 100) : 0) + "%", background: "var(--gr)" }} /></div>
      <div className="bsr"><div><div className="l">Opłacone</div><b className="gr">{pln(paid).replace(",00", "")}</b></div><div><div className="l">Do zapłaty</div><b className="am">{pln(tot - paid).replace(",00", "")}</b></div><div><div className="l">Lekcje</div><b>{done.length}</b></div></div>
    </div>
    {noFee > 0 && <p className="hint" style={{ margin: "10px 2px 0" }}>Odwołane lekcje bez opłaty w tym miesiącu: {noFee}. Opłatę za odwołanie ustawisz w danych ucznia.</p>}
    {!ids.length ? <div className="card" style={{ marginTop: 12 }}><Empty icon="wallet" title="Brak przeprowadzonych lekcji" sub="W tym miesiącu nie ma lekcji do rozliczenia." /></div> : <>
      <div className="slhd" style={{ marginTop: 16 }}><span>Uczniowie</span><span>Do zapłaty</span></div>
      <div className="dgl">{ids.map((id) => {
      const ls = done.filter((l) => l.sid === id), t = sumAmt(ls, () => true), p = sumAmt(ls, (l) => l.paid), un = ls.filter((l) => !l.paid), o = ui.open[id], due = t - p;
      return <div key={id} className="brow">
        <button className="strow" aria-expanded={!!o} onClick={() => setUi((u) => ({ ...u, open: { ...u.open, [id]: !u.open[id] } }))}>
          <span className="lwho"><b>{name(id) || "?"}</b><span>{lekcje(ls.length)} · {pln(t).replace(",00", "")}</span></span>
          {due > 0 ? <b className="sdue">{pln(due).replace(",00", "")}</b> : <span className="sok">rozliczony</span>}<Ic n={o ? "chevd" : "chev"} s={16} /></button>
        {o && <div className="bexp">
          <div className="acts" style={{ marginBottom: 6 }}>{un.length > 0 && <button className="btn s p" onClick={() => confirm({ title: "Oznaczyć wszystkie jako opłacone?", text: <>{lekcje(un.length)} na łączną kwotę <b>{pln(sumAmt(un, () => true))}</b> ({fm(m)}). Każdą możesz później cofnąć.</>, ok: "Tak, opłacone", onOk: () => { run(() => api("POST", "/api/lessons/batch", { ids: un.map((l) => l.id), patch: { paid: true } }), "Oznaczono jako opłacone: " + un.length + "."); } })}>Oznacz wszystkie jako opłacone</button>}<button className="btn s" onClick={() => modal(<SummaryModal id={id} />)}>Podsumowanie dla ucznia</button></div>
          {un.map((l) => <div className="unr" key={l.id}><div className="lwho"><b>{l.topic || "Bez tematu"}</b><span>{fd(l.date)} · {l.min} min</span></div><b>{pln(amt(l)).replace(",00", "")}</b><button className="btn s" onClick={() => run(() => api("PATCH", "/api/lessons/" + l.id, { paid: true }), "Lekcja oznaczona jako opłacona.")}>Opłacona</button></div>)}
        </div>}
      </div>; })}</div></>}
    <RevenueChart />
    <h2 className="sect" id="stats">Statystyki</h2>
    <Stats />
  </>;
}

function RevenueChart() {
  const { user } = useAuth();
  const { lessons } = useData();
  const [ui] = useUi();
  const { proUp } = useUpsell();
  if (user?.plan !== "pro") return <div className="card" style={{ marginTop: 16 }}><h2>Przychód z 6 miesięcy <span className="tag ac">Pro</span></h2><p className="hint">Zobacz opłacone i zaległe kwoty miesiąc po miesiącu.</p><button className="btn p s" onClick={() => proUp("Wykres przychodu")}>Odblokuj w Pro</button></div>;
  const [y, mo] = ui.bm.split("-").map(Number); let mx = 1;
  const M = Array.from({ length: 6 }, (_, k) => { const d = new Date(y, mo - 1 - (5 - k), 1), key = ym(d), ls = lessons.filter((l) => billable(l) && l.date.slice(0, 7) === key), p = sumAmt(ls, (l) => l.paid), du = sumAmt(ls, (l) => !l.paid); mx = Math.max(mx, p + du); return { l: MSHORT[d.getMonth()], p, d: du }; });
  return <div className="card" style={{ marginTop: 16 }}><h2>Przychód z 6 miesięcy <span className="hint" style={{ fontWeight: 400, fontSize: 13 }}>(zł)</span></h2><div className="rchart">
    {M.map((x, i) => <div key={i} className={"rc" + (i === 5 ? " cur" : "")}><div className="rcb"><div className="rcs">{x.d > 0 && <i style={{ background: "var(--am)", height: Math.max(3, Math.round(x.d / mx * 110)) }} />}{x.p > 0 && <i style={{ background: "var(--gr)", height: Math.max(3, Math.round(x.p / mx * 110)) }} />}</div></div><span>{x.l}</span><b>{x.p + x.d ? Math.round((x.p + x.d) / 100).toLocaleString("pl-PL") : "–"}</b></div>)}
  </div><p className="hint">Zielony: opłacone, bursztynowy: zaległe. Dane według dat lekcji.</p></div>;
}

/* ---------- stats ---------- */
export function Stats() {
  const { user } = useAuth();
  const { lessons, stu } = useData();
  const [ui, setUi] = useUi();
  const { proUp } = useUpsell();
  if (user?.plan !== "pro") return <div className="card"><h2 style={{ marginBottom: 8 }}>Rozszerzone statystyki <span className="tag ac">Pro</span></h2><p className="hint" style={{ margin: "0 0 16px" }}>Przychód według przedmiotu i ucznia, średnia kwota za lekcję, odsetek odwołań oraz najbardziej obłożone dni i godziny – liczone z Twoich danych.</p><button className="btn p s" onClick={() => proUp("Rozszerzone statystyki")}>Odblokuj w Pro</button></div>;
  const R = ui.sr, nw = new Date(), from = R === "all" ? "" : ym(new Date(nw.getFullYear(), nw.getMonth() - (+R - 1), 1));
  const L = lessons.filter((l) => !from || l.date.slice(0, 7) >= from), bil = L.filter(billable), dn = L.filter((l) => l.status === "done"), cn = L.filter((l) => l.status === "cancelled"), rev = sumAmt(bil, () => true);
  const bs: Record<string, number> = {}, bt: Record<string, number> = {}, wd: Record<string, number> = {}, hr: Record<string, number> = {}, WD = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
  bil.forEach((l) => { const s = stu(l.sid), k = l.subject || (s ? subjList(s)[0] : "") || "—"; bs[k] = (bs[k] || 0) + amt(l); const nm = s ? s.name : "?"; bt[nm] = (bt[nm] || 0) + amt(l); });
  L.forEach((l) => { if (l.status === "cancelled") return; const d = WD[(pd(l.date).getDay() + 6) % 7]; wd[d] = (wd[d] || 0) + 1; const h = l.time.slice(0, 2) + ":00"; hr[h] = (hr[h] || 0) + 1; });
  return <>
    <div className="bar"><select aria-label="Zakres" value={R} onChange={(e) => setUi((u) => ({ ...u, sr: e.target.value }))}><option value="3">Ostatnie 3 miesiące</option><option value="6">Ostatnie 6 miesięcy</option><option value="12">Ostatnie 12 miesięcy</option><option value="all">Cały okres</option></select></div>
    <div className="grid g4">
      <div className="card stat"><div className="l">Przychód łącznie</div><div className="v">{pln(rev)}</div></div>
      <div className="card stat"><div className="l">Średnio na lekcję</div><div className="v">{dn.length ? pln(Math.round(rev / dn.length)) : "—"}</div></div>
      <div className="card stat"><div className="l">Odsetek odwołań</div><div className="v am">{dn.length + cn.length ? Math.round(cn.length / (dn.length + cn.length) * 100) + "%" : "—"}</div></div>
      <div className="card stat"><div className="l">Lekcje przeprowadzone</div><div className="v">{dn.length}</div></div>
    </div>
    <div className="grid g2" style={{ marginTop: 16 }}>
      <div className="card"><h2>Przychód według przedmiotu</h2><BarList o={bs} ff={pln} /></div>
      <div className="card"><h2>Przychód według ucznia</h2><BarList o={bt} ff={pln} /></div>
      <div className="card"><h2>Dni tygodnia</h2><BarList o={wd} ff={String} /></div>
      <div className="card"><h2>Godziny rozpoczęcia</h2><BarList o={hr} ff={String} /></div>
    </div>
    <p className="hint">Przychód według dat lekcji, razem z opłatami za odwołanie. Obłożenie liczone z lekcji zaplanowanych i przeprowadzonych (liczba lekcji).</p>
  </>;
}

/* ---------- plan ---------- */
export function usePlanActions() {
  const { setUser } = useAuth();
  const { reload } = useTutor();
  const { modal, close, confirm, toast } = useOverlay();
  const setPlan = async (plan: "free" | "pro") => { try { const r = await api("POST", "/api/me/plan", { plan }); setUser(r.user); await reload(); toast(plan === "pro" ? "Pro odblokowane (symulacja)." : "Plan zmieniony na Free."); } catch (e) { toast(errMsg(e)); } };
  return {
    tryPro: () => modal(<><h2>Przetestuj Pro</h2><div className="demo">Tryb testowy – żadna płatność nie zostanie pobrana</div><p>Pro kosztuje {pln(PRO_PLN).replace(",00", "")} miesięcznie i znosi limit aktywnych uczniów. Płatności nie są jeszcze podłączone – ten ekran tylko symuluje zakup.</p>
      <div className="mf"><button className="btn" onClick={() => { close(); toast("Zakup anulowany. Zostajesz na planie Free."); }}>Anuluj zakup</button><button className="btn p" onClick={() => { close(); setPlan("pro"); }}>Zasymuluj udany zakup</button></div></>),
    toFree: () => confirm({ title: "Wrócić do planu Free?", text: `Wszystkie dane zostaną zachowane. Jeśli masz więcej niż ${FREE} aktywnych uczniów, dodawanie i przywracanie uczniów zostanie zablokowane.`, ok: "Wróć do Free", onOk: () => setPlan("free") }),
  };
}

export function Plan() {
  const { user } = useAuth();
  const { students } = useData();
  const { tryPro, toFree } = usePlanActions();
  const pro = user?.plan === "pro", n = students.filter((s) => s.active).length;
  const proList = ["Bez limitu aktywnych uczniów", "Wszystko z planu Free", "Rozszerzone statystyki: przychód według przedmiotu i ucznia, odwołania, obłożenie", "Wykres przychodu z 6 miesięcy i eksport roku", "Podsumowania dla wszystkich uczniów naraz i wydruk PDF", "Cel miesięczny z paskiem postępu", "Szablony notatek", "Kosz z przywracaniem przez 30 dni"];
  return <>
    {!pro && n > FREE && <div className="card" style={{ borderColor: "#f3dca8", background: "var(--aml)", marginBottom: 16 }}><b>Masz {n} aktywnych uczniów, a limit Free to {FREE}.</b><div>Wszystkie dane są zachowane i widoczne. Dodawanie i przywracanie uczniów jest zablokowane, dopóki nie zarchiwizujesz części uczniów lub nie włączysz Pro.</div></div>}
    <div className="plans">
      <div className={"card plan" + (pro ? "" : " cur")}><h2>Free {!pro && <span className="tag ac">Twój plan</span>}</h2><div className="pr">0 zł</div><ul><li>Do {FREE} aktywnych uczniów</li><li>Lekcje, notatki i rozliczenia</li><li>Archiwum bez limitu</li><li>Przypomnienie o niepotwierdzonych lekcjach, szybkie odwoływanie i powtarzanie lekcji</li><li>Opłata za odwołanie, kopie danych, eksport CSV i zbiorcze oznaczanie płatności</li><li>Panel ucznia: udostępnianie lekcji, notatek i prac domowych</li><li>Motywy kolorystyczne</li></ul>{pro && <button className="btn" onClick={toFree}>Wróć do Free</button>}</div>
      <div className={"card plan" + (pro ? " cur" : "")}><h2>Pro {pro && <span className="tag ac">Twój plan</span>}</h2><div className="pr">19 zł <span className="hint" style={{ fontSize: 14, fontWeight: 400 }}>/ miesiąc</span></div><ul>{proList.map((x) => <li key={x}>{x}</li>)}</ul>{pro ? <span className="hint">Pro aktywne (tryb testowy).</span> : <button className="btn p" onClick={tryPro}>Przetestuj Pro</button>}</div>
    </div>
    <p className="hint">Płatności nie są jeszcze podłączone – zakup Pro jest symulowany i nic nie jest pobierane.</p>
  </>;
}

function PlanCard() {
  const { user } = useAuth();
  const { students } = useData();
  const { tryPro, toFree } = usePlanActions();
  const [open, setOpen] = useState(false);
  const pro = user?.plan === "pro", n = students.filter((s) => s.active).length;
  return <div className="card" id="plan"><h2><span className="emo" aria-hidden="true">⭐</span>Plan: {pro ? "Pro" : "Free"} {pro && <span className="tag ac">tryb testowy</span>}</h2>
    <p className="hint" style={{ margin: "-6px 0 12px" }}>{pro ? "Bez limitu uczniów, statystyki, kosz, szablony i cel miesięczny." : `Aktywni uczniowie: ${n} z ${FREE}. Pro znosi limit i dodaje statystyki, kosz, szablony i cel miesięczny.`}</p>
    <div className="acts">{pro ? <button className="btn" onClick={toFree}>Wróć do Free</button> : <button className="btn p" onClick={tryPro}>Przetestuj Pro</button>}<button className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Ukryj porównanie" : "Porównaj plany"}</button></div>
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
  const save = async (settings: any, ok = "Zapisano ustawienie.") => { try { await updateMe({ settings }); toast(ok); } catch (e) { toast(errMsg(e)); } };
  const T: [string, string, string[]][] = [["light", "Jasny", ["#f6f7fb", "#4f46e5", "#ffffff"]], ["dark", "Ciemny", ["#12131a", "#8b85ff", "#1b1d2a"]], ["pink", "Różowy", ["#fff6fa", "#db2777", "#ffffff"]], ["green", "Zielony", ["#f2faf5", "#15803d", "#ffffff"]]];
  const up = (f: string) => pr ? null : <button className="btn p s" onClick={() => proUp(f)}>Odblokuj w Pro</button>;
  const tag = pr ? null : <> <span className="tag ac">Pro</span></>;

  const importFile = () => {
    const f = document.createElement("input"); f.type = "file"; f.accept = ".json,application/json";
    f.onchange = () => {
      const file = f.files?.[0]; if (!file) return;
      file.text().then((txt) => {
        let o: any = null; try { o = JSON.parse(txt); } catch { /* invalid */ }
        if (!o || !Array.isArray(o.students) || !Array.isArray(o.lessons)) { toast("Nieprawidłowy plik kopii danych."); return; }
        confirm({ title: "Zaimportować dane?", text: `Obecni uczniowie i lekcje zostaną zastąpione (${o.students.length} uczniów, ${o.lessons.length} lekcji).`, ok: "Importuj", danger: true,
          onOk: () => { run(() => api("POST", "/api/import", { students: o.students, lessons: o.lessons }), "Dane zaimportowane."); } });
      });
    };
    f.click();
  };

  const PROFIL = <div className="card"><h2>Profil</h2>
      <Field id="pfn" label="Imię lub imię i nazwisko" value={pf.name} onChange={(v) => setPf({ ...pf, name: v })} error={pf.err} />
      <Field id="pfb" label="Nazwa lub marka korepetytora" value={pf.brand} onChange={(v) => setPf({ ...pf, brand: v })} />
      <p className="hint" style={{ margin: "4px 0 16px" }}>E-mail: {user!.email}. Nazwa lub marka jest widoczna dla Twoich uczniów w panelu ucznia.</p>
      <button className="btn p" disabled={demo} onClick={async () => { if (!pf.name.trim()) { setPf({ ...pf, err: "Podaj imię." }); return; } try { await updateMe({ name: pf.name.trim(), brand: pf.brand.trim() }); setPf({ ...pf, err: "" }); toast("Profil zapisany."); } catch (e) { toast(errMsg(e)); } }}>Zapisz profil</button></div>;
  const HASLO = <div className="card"><h2>Konto i bezpieczeństwo</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>Hasło jest przechowywane wyłącznie jako zaszyfrowany skrót.</p><div className="acts"><button className="btn" disabled={demo} onClick={() => modal(<ChangePassword />)}>Zmień hasło</button>{user!.isAdmin && !demo && <button className="btn" onClick={() => navigate("/admin")}>Panel administratora</button>}<button className="btn" onClick={() => confirm({ title: demo ? "Wyjść z trybu demo?" : "Wylogować się?", text: demo ? "Dane przykładowe nie są zapisywane." : "Twoje dane są bezpiecznie zapisane na koncie.", ok: demo ? "Wyjdź" : "Wyloguj się", onOk: logout })}>{demo ? "Wyjdź z dema" : "Wyloguj się"}</button></div></div>;
  const DOMYSLNE = <div className="card"><h2>Domyślne wartości</h2>
      <div className="f2">
        <div className="f"><label htmlFor="sd">Domyślny czas lekcji (min)</label><input id="sd" type="number" min={5} step={5} defaultValue={c.dur || 60} onBlur={(e) => { const v = Number(e.target.value); if (!(v > 0) || Math.round(v) !== v) { toast("Podaj dodatnią liczbę minut."); e.target.value = String(c.dur || 60); return; } if (v !== (c.dur || 60)) save({ dur: v }); }} /></div>
        <div className="f"><label htmlFor="st">Godzina nowej lekcji</label><input id="st" type="time" defaultValue={c.time || "16:00"} onBlur={(e) => { if (e.target.value && e.target.value !== (c.time || "16:00")) save({ time: e.target.value }); }} /></div>
      </div>
      <div className="f2">
        <div className="f"><label htmlFor="sr2">Stawka nowego ucznia (zł / 60 min)</label><input id="sr2" inputMode="decimal" defaultValue={gStr(c.rate || 10000)} onBlur={(e) => { const v = toG(e.target.value); if (isNaN(v) || v < 0) { toast("Podaj poprawną, nieujemną stawkę."); e.target.value = gStr(c.rate || 10000); return; } if (v !== (c.rate || 10000)) save({ rate: v }); }} /></div>
        <div className="f"><label htmlFor="sw">Początek tygodnia w kalendarzu</label><select id="sw" value={c.wk === "sun" ? "sun" : "mon"} onChange={(e) => save({ wk: e.target.value })}><option value="mon">Poniedziałek</option><option value="sun">Niedziela</option></select></div>
      </div>
      <div className="chk" style={{ marginTop: 8 }}><input type="checkbox" id="sl" checked={c.late !== false} onChange={(e) => save({ late: e.target.checked })} /><label htmlFor="sl">Pokazuj na pulpicie lekcje do potwierdzenia</label></div></div>;
  const CEL = <div className="card"><h2>Cel miesięczny{tag}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>Pasek postępu na pulpicie pokazuje, ile z celu osiągnąłeś w wybranym miesiącu. Zostaw puste, aby wyłączyć.</p>
      <div className="f"><label htmlFor="sg">Cel (zł)</label><input id="sg" inputMode="decimal" value={goal} disabled={!pr} onChange={(e) => setGoal(e.target.value)} onBlur={() => { const v = goal.trim() === "" ? 0 : toG(goal); if (isNaN(v) || v < 0) { toast("Podaj poprawną, nieujemną kwotę."); return; } if (v !== (c.goal || 0)) save({ goal: v }); }} /></div>{up("Cel miesięczny")}</div>;
  const SZABLONY = <div className="card"><h2>Szablony notatek{tag}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>Wstawiasz je w formularzu lekcji. Dostępne są 4 gotowe szablony i Twoje własne.</p>
      {(c.tpl || []).map((x, i) => <div className="row" key={i}><div className="m"><b>{x.n}</b><span>{x.t}</span></div><button className="btn s d" disabled={!pr} onClick={() => save({ tpl: (c.tpl || []).filter((_, j) => j !== i) }, "Usunięto szablon.")}>Usuń</button></div>)}
      <div className="f" style={{ marginTop: 12 }}><label htmlFor="tn">Nazwa szablonu</label><input id="tn" disabled={!pr} value={tpl.n} onChange={(e) => setTpl({ ...tpl, n: e.target.value })} /></div>
      <div className="f"><label htmlFor="tt">Treść</label><textarea id="tt" rows={3} disabled={!pr} value={tpl.t} onChange={(e) => setTpl({ ...tpl, t: e.target.value })} /></div>
      {pr ? <button className="btn" onClick={async () => { if (!tpl.n.trim() || !tpl.t.trim()) { toast("Podaj nazwę i treść szablonu."); return; } await save({ tpl: [...(c.tpl || []), { n: tpl.n.trim(), t: tpl.t.trim() }] }, "Dodano szablon."); setTpl({ n: "", t: "" }); }}>Dodaj szablon</button> : up("Szablony notatek")}</div>;
  const DANE = <div className="card"><h2>Dane</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>Kopia danych zawiera dane uczniów – przechowuj ją bezpiecznie.</p>
      <div className="acts">
        <button className="btn" onClick={async () => { try { const d = await api("GET", "/api/export"); download("tutortrack-kopia-" + ymd(new Date()) + ".json", JSON.stringify(d, null, 1), "application/json"); toast("Kopia zapisana."); } catch (e) { toast(errMsg(e)); } }}>Eksportuj kopię danych</button>
        <button className="btn" disabled={demo} onClick={importFile}>Importuj kopię danych</button>
        <button className="btn d" disabled={demo} onClick={() => modal(<DeleteAccount onDone={() => { setUser(null); logout(); }} />)}>Usuń konto i dane</button>
      </div></div>;
  const KOSZ = <div className="card"><h2>Kosz{tag}</h2>
      {!pr ? <><p className="hint">W planie Pro usunięte lekcje i uczniowie trafiają do kosza na 30 dni i można je przywrócić.</p>{up("Kosz z przywracaniem")}</> : <>
        <p className="hint" style={{ margin: "-6px 0 12px" }}>Usunięte lekcje i uczniowie trafiają tu na 30 dni.</p>
        {data!.trash.length ? <>{data!.trash.map((x) => { const d = Math.max(0, 30 - Math.floor((Date.now() - x.deletedAt) / 864e5)); const nm = x.kind === "student" ? `Uczeń: ${x.name} (${x.lessons} lekcji)` : `Lekcja: ${x.name || "usunięty uczeń"} · ${fd(x.date!)}, ${x.time}`;
          return <div className="row" key={x.id}><div className="m"><b>{nm}</b><span>Pozostało dni: {d}</span></div><div className="acts">
            <button className="btn s" onClick={() => run(() => api("POST", `/api/trash/${x.kind}/${x.id}/restore`), "Przywrócono.")}>Przywróć</button>
            <button className="btn s d" onClick={() => confirm({ title: "Usunąć na stałe?", text: "Tej operacji nie można cofnąć.", ok: "Usuń na stałe", danger: true, onOk: () => { run(() => api("DELETE", `/api/trash/${x.kind}/${x.id}`)); } })}>Usuń na stałe</button></div></div>; })}
          <div style={{ marginTop: 12 }}><button className="btn d" onClick={() => confirm({ title: "Opróżnić kosz?", text: "Wszystkie elementy zostaną trwale usunięte.", ok: "Opróżnij", danger: true, onOk: () => { run(() => api("DELETE", "/api/trash"), "Kosz opróżniony."); } })}>Opróżnij kosz</button></div></>
          : <p className="hint">Kosz jest pusty.</p>}</>}</div>;

  const I = (k: string, t: string, ic: string, v?: ReactNode) => <button key={k} className="sitem" onClick={() => { setSec(k); window.scrollTo(0, 0); }}><span className="sic"><Ic n={ic} s={16} /></span><b>{t}</b>{v != null && <span className="sv">{v}</span>}<Ic n="chev" s={16} /></button>;
  const SEC: Record<string, [string, ReactNode]> = {
    profil: ["Profil", PROFIL],
    kontakt: ["Kontakt dla uczniów", <ContactCard />],
    haslo: ["Hasło i bezpieczeństwo", HASLO],
    plan: ["Plan", <PlanCard />],
    domyslne: ["Domyślne wartości lekcji", DOMYSLNE],
    szablony: ["Szablony notatek", SZABLONY],
    cel: ["Cel miesięczny", CEL],
    wyglad: ["Wygląd", <ThemePicker />],
    dane: ["Kopia danych", DANE],
    kosz: ["Kosz", KOSZ],
  };
  if (sec && SEC[sec]) return <div className="ssec">
    <button className="sback" onClick={() => { setSec(""); window.scrollTo(0, 0); }}><Ic n="chevl" s={16} />Ustawienia</button>
    {SEC[sec][1]}</div>;
  const thName: Record<string, string> = { light: "Jasny", auto: "Systemowy", dark: "Ciemny", graphite: "Grafit", blue: "Ocean", green: "Mięta", pink: "Róż", orange: "Zachód słońca", purple: "Lawenda" };
  return <div className="slist">
    <div className="sgrp"><button className="sitem sme" onClick={() => setSec("profil")}><span className="sav">{(user!.name || "?").charAt(0).toUpperCase()}</span><b>{user!.name}<small>{pr ? "Plan Pro" : "Plan Free"} · {user!.email}</small></b><Ic n="chev" s={16} /></button></div>
    <div className="sgt">Konto</div>
    <div className="sgrp">{I("kontakt", "Kontakt dla uczniów", "mail", c.showEmail || c.showPhone ? "widoczny" : "ukryty")}{I("haslo", "Hasło i bezpieczeństwo", "lock")}{I("plan", "Plan", "star", pr ? "Pro" : "Free")}</div>
    <div className="sgt">Praca</div>
    <div className="sgrp">{I("domyslne", "Domyślne wartości lekcji", "clock", (c.dur || 60) + " min · " + (c.time || "16:00"))}{I("szablony", "Szablony notatek", "note", pr ? String(4 + (c.tpl || []).length) : "Pro")}{I("cel", "Cel miesięczny", "target", pr ? (c.goal ? pln(c.goal).replace(",00", "") : "wyłączony") : "Pro")}</div>
    <div className="sgt">Aplikacja</div>
    <div className="sgrp">{I("wyglad", "Wygląd", "palette", thName[th] || "Jasny")}{I("dane", "Kopia danych", "download")}{I("kosz", "Kosz", "trash", pr ? (data!.trash.length ? String(data!.trash.length) : "pusty") : "Pro")}</div>
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
    const er = { cEmail: f.showEmail && !/^\S+@\S+\.\S+$/.test(f.cEmail.trim()) ? "Podaj poprawny e-mail." : "", cPhone: f.showPhone && f.cPhone.trim().length < 5 ? "Podaj numer telefonu." : "" };
    setE(er); if (er.cEmail || er.cPhone) return;
    try { await updateMe({ settings: { showEmail: f.showEmail, cEmail: f.cEmail.trim(), showPhone: f.showPhone, cPhone: f.cPhone.trim() } }); toast("Zapisano dane kontaktowe."); } catch (x) { toast(errMsg(x)); }
  };
  return <div className="card"><h2><span className="emo" aria-hidden="true">📇</span>Kontakt dla uczniów</h2>
    <p className="hint" style={{ margin: "-6px 0 12px" }}>Zaznacz, co uczniowie połączeni z Tobą kodem mają widzieć w zakładce „Korepetytorzy”. Domyślnie nic nie jest widoczne.</p>
    <label className="chk"><input type="checkbox" checked={f.showEmail} onChange={(x) => setF({ ...f, showEmail: x.target.checked })} />Pokazuj e-mail</label>
    {f.showEmail && <Field id="cem" label="E-mail dla uczniów" type="email" value={f.cEmail} onChange={(v) => setF({ ...f, cEmail: v })} error={e.cEmail} />}
    <label className="chk"><input type="checkbox" checked={f.showPhone} onChange={(x) => setF({ ...f, showPhone: x.target.checked })} />Pokazuj numer telefonu</label>
    {f.showPhone && <Field id="cph" label="Telefon dla uczniów" type="tel" value={f.cPhone} onChange={(v) => setF({ ...f, cPhone: v })} error={e.cPhone} />}
    <button className="btn p" style={{ marginTop: 8 }} disabled={demo} onClick={save}>Zapisz kontakt</button>
  </div>;
}

export function ChangePassword() {
  const { close, toast } = useOverlay();
  const [f, setF] = useState({ c: "", n1: "", n2: "" });
  const [e, setE] = useState<Record<string, string>>({});
  return <><h2>Zmień hasło</h2>
    <Field id="pc" label="Obecne hasło" type="password" value={f.c} onChange={(v) => setF({ ...f, c: v })} error={e.c} autoComplete="current-password" />
    <Field id="pn1" label="Nowe hasło (min. 8 znaków, litera i cyfra)" type="password" value={f.n1} onChange={(v) => setF({ ...f, n1: v })} error={e.n1} autoComplete="new-password" />
    <Field id="pn2" label="Powtórz nowe hasło" type="password" value={f.n2} onChange={(v) => setF({ ...f, n2: v })} error={e.n2} autoComplete="new-password" />
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" onClick={async () => {
      const er = { c: f.c ? "" : "Podaj obecne hasło.", n1: pwOk(f.n1) ? "" : "Hasło musi mieć co najmniej 8 znaków oraz literę i cyfrę.", n2: f.n1 === f.n2 ? "" : "Hasła muszą być identyczne." };
      setE(er); if (er.c || er.n1 || er.n2) return;
      try { await api("POST", "/api/me/password", { current: f.c, next: f.n1 }); close(); toast("Hasło zmienione. Inne urządzenia zostały wylogowane."); } catch (x) { setE({ c: errMsg(x) }); }
    }}>Zapisz hasło</button></div></>;
}

export function DeleteAccount({ onDone }: { onDone: () => void }) {
  const { close, toast } = useOverlay();
  const [pw, setPw] = useState(""), [err, setErr] = useState("");
  return <><h2>Usunąć konto i wszystkie dane?</h2><p>Zostaną trwale usunięte profil i wszystkie powiązane dane. Tej operacji nie można cofnąć.</p>
    <Field id="dpw" label="Potwierdź hasłem" type="password" value={pw} onChange={setPw} error={err} autoComplete="current-password" />
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" style={{ background: "var(--rd)", borderColor: "var(--rd)" }} onClick={async () => {
      try { await api("DELETE", "/api/me", { password: pw }); close(); toast("Konto usunięte."); onDone(); } catch (x) { setErr(errMsg(x)); }
    }}>Usuń konto</button></div></>;
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
    <h2 style={{ fontSize: 22, margin: "0 0 4px" }}>Cześć, {(user?.name || "").split(" ")[0]} - dobrze Cię widzieć</h2><p className="hint" style={{ margin: 0 }}>Trzy kroki dzielą Cię od działającego dziennika.</p>
    <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={n} aria-label="Postęp wdrożenia"><i style={{ width: Math.round(n / 3 * 100) + "%" }} /></div><p><b>{n} z 3 kroków</b></p>
    <div className="grid">
      {cd(1, "Dodaj pierwszego ucznia", a ? "Masz już uczniów: " + students.length + "." : "Imię, przedmiot i stawka za 60 minut.", a, false, addStudent, a ? "Dodaj kolejnego" : "Dodaj ucznia")}
      {cd(2, "Dodaj pierwszą lekcję", !students.length ? "Najpierw dodaj ucznia – lekcja musi być przypisana do ucznia." : b ? "Masz już lekcje: " + lessons.length + "." : "Kwota policzy się ze stawki ucznia.", b, !students.length, () => addLesson(), b ? "Dodaj kolejną" : "Dodaj lekcję")}
      {cd(3, "Sprawdź rozliczenia miesiąca", c ? "Rozliczenia zostały już sprawdzone." : !lessons.length ? "Najpierw dodaj lekcję – rozliczenia pojawią się po pierwszej przeprowadzonej lekcji." : "Zobacz należności i kwoty do zapłaty.", c, !lessons.length, () => navigate("/aplikacja/billing"), "Otwórz rozliczenia")}
    </div>
    {n === 3 ? <div className="card" style={{ marginTop: 16, borderColor: "#b9e3c8", background: "var(--grl)" }}><b>Wszystko gotowe!</b><div className="hint" style={{ marginBottom: 10 }}>Masz uczniów, lekcje i sprawdzone rozliczenia.</div><button className="btn p" onClick={finish}>Przejdź do pulpitu</button></div>
      : <p style={{ marginTop: 16 }}><button className="btn" onClick={finish}>Pomiń powitanie i przejdź do pulpitu</button></p>}
  </>;
}

export { isDemo };

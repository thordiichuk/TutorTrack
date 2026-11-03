import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Empty, Ic, Logo } from "../lib/icons";
import { addDays, CancelRequest, download, fd, fm, subjColor, fdt, fmtH, MSHORT, pd, pln, te, WDL, WDSHORT, ym, ymd } from "../lib/util";
import { useAuth } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { ChangePassword, DeleteAccount } from "../app/Views";
import { navigate } from "../lib/router";
import { ThemePicker } from "../ui/themes";

type SLesson = { id: string; date: string; time: string; min: number; subject: string; topic: string; status: "planned" | "done" | "cancelled"; notes: string; hw: string; hd: string; amount: number; paid: boolean; cr: CancelRequest | null };
type Link = { sid: string; tutor: string; studentName: string; subject: string; contact?: { email: string; phone: string }; lessons: SLesson[] };
type Ev = { id: string; title: string; cat: string; repeat: "w" | "o"; weekday: number; date: string; start: string; end: string };
type Data = { links: Link[]; events: Ev[]; done: string[] };
type L = SLesson & { tutor: string; sid: string };
const CATS: Record<string, string> = { school: "Szkoła", tutor: "Korepetycje spoza TutorTrack", extra: "Zajęcia dodatkowe", other: "Inne" };
/** Two time ranges ("HH:MM") overlap. */
const clash = (aS: string, aE: string, bS: string, bE: string) => aS < bE && bS < aE;
const wdOf = (date: string) => (pd(date).getDay() + 6) % 7; // Monday = 0
const RED = { background: "var(--rdl)", borderLeft: "4px solid var(--rd)", paddingLeft: 10, borderRadius: 8 };

/** tabs shown in the phone's bottom bar; the rest live under "Więcej" */
const MAIN = ["dash", "plan", "graf", "hw"];
const TABS: [string, string, string, string][] = [
  ["dash", "Pulpit", "home", "Pulpit"], ["plan", "Plan", "cal", "Plan"], ["graf", "Mój grafik", "book", "Grafik"], ["hw", "Zadania", "check", "Zadania"],
  ["sum", "Podsumowanie", "chart", "Miesiąc"], ["kor", "Korepetytorzy", "users", "Nauczyciele"], ["konto", "Ustawienia", "set", "Ustawienia"],
];

export function StudentPanel() {
  const { user, logout } = useAuth();
  const ov = useOverlay();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("dash");
  const [wk, setWk] = useState(0);
  const [sel, setSel] = useState(-1); // selected weekday in the phone view of Plan (-1 = today / Monday)
  const [m, setM] = useState(ym(new Date()));
  const [hf, setHf] = useState<"todo" | "done" | "all">("todo");

  const load = useCallback(async () => {
    try { setD(await api<Data>("GET", "/api/student/data")); setErr(""); } catch (e) { setErr(errMsg(e)); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    const f = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", f);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", f); };
  }, [load]);
  const cur = TABS.find((x) => x[0] === tab)!;
  useEffect(() => { document.title = cur[1] + " – TutorTrack"; }, [cur]);
  const go = (t: string) => { setTab(t); window.scrollTo(0, 0); };

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await load(); if (ok) ov.toast(ok); return true; } catch (e) { ov.toast(errMsg(e)); return false; }
  };

  const all: L[] = (d?.links || []).flatMap((k) => k.lessons.map((l) => ({ ...l, tutor: k.tutor, sid: k.sid })));
  const done = new Set(d?.done || []);
  const nT = all.filter((l) => l.hw && !done.has(l.id)).length;
  const find = (id: string) => all.find((l) => l.id === id);

  const toggleHw = (id: string, inModal = false) => {
    const now = !done.has(id);
    run(() => api("PUT", "/api/student/homework/" + id, { done: now }), now ? "Zadanie oznaczone jako zrobione." : "Cofnięto oznaczenie.").then(() => { if (inModal) ov.close(); });
  };

  const tags = (l: L) => {
    const st = ({ planned: ["Zaplanowana", "ac"], done: ["Przeprowadzona", "gr"], cancelled: ["Odwołana", "rd"] } as const)[l.status];
    return <>{l.cr?.status === "pending" && <><span className="tag am">{l.cr.kind === "move" ? "Prośba o przeniesienie" : "Prośba o odwołanie"}</span>{" "}</>}{l.cr?.status === "rejected" && l.status === "planned" && <><span className="tag rd">Odwołanie odrzucone</span>{" "}</>}{l.cr?.status === "moved" && l.status === "planned" && <><span className="tag ac">Przeniesiona</span>{" "}</>}<span className={"tag " + st[1]}>{st[0]}</span>{" "}{l.notes && <><span className="tag gr">Notatka</span>{" "}</>}{l.hw && (done.has(l.id) ? <span className="tag gr">Zadanie zrobione</span> : <span className="tag am">Zadanie</span>)}</>;
  };
  /** One short status for the compact plan row (most important first). */
  const shortTag = (l: L, clashing: boolean) => {
    if (clashing) return <span className="tag rd">Nakłada się</span>;
    if (l.status === "cancelled") return <span className="tag rd">Odwołana</span>;
    if (l.cr?.status === "pending") return <span className="tag am">{l.cr.kind === "move" ? "Prośba o przeniesienie" : "Prośba o odwołanie"}</span>;
    if (l.cr?.status === "rejected" && l.status === "planned") return <span className="tag rd">Odrzucono</span>;
    if (l.cr?.status === "moved" && l.status === "planned") return <span className="tag ac">Przeniesiona</span>;
    if (l.hw && !done.has(l.id)) return <span className="tag am">Zadanie</span>;
    if (l.status === "done" && l.notes) return <span className="tag gr">Notatka</span>;
    return null;
  };
  const due = (l: L) => {
    const td = ymd(new Date());
    if (done.has(l.id)) return <span className="tag gr">Zrobione</span>;
    if (!l.hd) return null;
    const sd = (x: string) => pd(x).getDate() + " " + MSHORT[pd(x).getMonth()];
    if (l.hd < td) return <span className="tag rd" title={"Termin: " + fd(l.hd)}>po terminie</span>;
    if (l.hd === td) return <span className="tag am">Na dziś</span>;
    if (l.hd === addDays(1)) return <span className="tag am">Na jutro</span>;
    return <span className="tag" title={"Termin: " + fd(l.hd)}>do {sd(l.hd)}</span>;
  };
  const lessonModal = (id: string) => {
    const l = find(id); if (!l) return;
    ov.modal(<><h2>{l.subject || "Lekcja"}</h2><p className="hint" style={{ margin: "-6px 0 10px" }}>{l.tutor} · {fd(l.date)}, {l.time}–{te(l.time, l.min)} ({l.min} min)</p>
      <div style={{ marginBottom: 12 }}>{tags(l)}</div>{l.topic && <p><b>Temat:</b> {l.topic}</p>}
      {l.status === "done" && <><h3 style={{ margin: "12px 0 4px", fontSize: 15 }}>Notatka po lekcji</h3><p className="pre" style={{ margin: 0 }}>{l.notes || <span className="hint">Brak notatki.</span>}</p></>}
      {l.hw && <><h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>Praca domowa</h3><p className="pre" style={{ margin: "0 0 6px" }}>{l.hw}</p>{due(l)}</>}
      {l.amount > 0 && <p className="hint" style={{ marginTop: 14 }}>Kwota: {pln(l.amount)}{l.paid ? " · opłacona" : " · nieopłacona"}</p>}
      {l.cr?.status === "pending" && <div className="nt" style={{ marginTop: 12 }}><b>{l.cr.kind === "move" ? "Prośba o przeniesienie na następny tydzień wysłana" : "Prośba o odwołanie wysłana"}</b> {fdt(l.cr.at)} – czeka na potwierdzenie korepetytora.<br />Przyczyna: {l.cr.reason}</div>}
      {l.cr?.status === "rejected" && l.status === "planned" && <div className="lerr" style={{ marginTop: 12 }}><b>{l.cr.kind === "move" ? "Korepetytor odrzucił prośbę o przeniesienie." : "Korepetytor odrzucił prośbę o odwołanie."}</b>{l.cr.note && <><br />Komentarz: {l.cr.note}</>}<br />Twoja przyczyna: {l.cr.reason}</div>}
      {l.cr?.status === "accepted" && l.status === "cancelled" && (l.cr.kind === "move"
        ? <div className="lerr" style={{ marginTop: 12 }}><b>Korepetytor nie mógł przenieść lekcji i ją odwołał.</b>{l.cr.note && <><br />Komentarz: {l.cr.note}</>}<br />Twoja przyczyna: {l.cr.reason}</div>
        : <p className="hint" style={{ marginTop: 12 }}>Lekcja odwołana na Twoją prośbę. Przyczyna: {l.cr.reason}{l.cr.note && <><br />Komentarz korepetytora: {l.cr.note}</>}</p>)}
      {l.cr?.status === "moved" && <div className="nt" style={{ marginTop: 12 }}><b>Korepetytor przeniósł lekcję na Twoją prośbę</b>{l.cr.note ? <> – z {fd(l.cr.note)} na {fd(l.date)}</> : null}.<br />Przyczyna: {l.cr.reason}</div>}
      <div className="mf">
        {l.status === "planned" && l.cr?.status !== "pending" && <button className="btn d" style={{ marginRight: "auto" }} onClick={() => ov.modal(<CancelRequestForm l={l} onSent={load} />)}>Odwołaj lub przenieś</button>}
        {l.cr?.status === "pending" && <button className="btn d" style={{ marginRight: "auto" }} onClick={() => { ov.close(); run(() => api("DELETE", `/api/student/lessons/${l.id}/cancel-request`), "Prośba o odwołanie wycofana."); }}>Wycofaj prośbę</button>}
        <button className="btn" onClick={ov.close}>Zamknij</button>{l.hw && <button className="btn p" onClick={() => toggleHw(l.id, true)}>{done.has(l.id) ? "Cofnij: niezrobione" : "Oznacz zadanie jako zrobione"}</button>}</div></>);
  };
  const evForm = (e?: Ev) => ov.modal(<EvForm e={e} lessons={all} events={d!.events} onSave={(b) => run(() => (e ? api("PATCH", "/api/student/events/" + e.id, b) : api("POST", "/api/student/events", b)), e ? "Zapisano zmiany." : "Dodano zajęcia do grafiku.")}
    onDel={e ? () => ov.confirm({ title: "Usunąć zajęcia?", text: "Zajęcia znikną z Twojego grafiku.", ok: "Usuń", danger: true, onOk: () => { run(() => api("DELETE", "/api/student/events/" + e.id), "Usunięto zajęcia."); } }) : undefined} />);
  const out = () => ov.confirm({ title: "Wylogować się?", text: "Twoje dane są bezpiecznie zapisane na koncie.", ok: "Wyloguj się", onOk: logout });

  /* ----- tabs ----- */
  function Dash() {
    const now = new Date(), td = ymd(now), nowKey = td + " " + now.toTimeString().slice(0, 5);
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    const week = all.filter((l) => l.status !== "cancelled" && l.date >= ymd(mon) && l.date <= ymd(sun));
    const upcoming = all.filter((l) => l.status === "planned" && l.date + " " + l.time >= nowKey).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const next = upcoming[0];
    const monthMin = all.filter((l) => l.status === "done" && l.date.slice(0, 7) === ym(now)).reduce((t, l) => t + l.min, 0);
    const todo = all.filter((l) => l.hw && !done.has(l.id)).sort((a, b) => (a.hd || a.date).localeCompare(b.hd || b.date));
    const notes = all.filter((l) => l.status === "done" && l.notes).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 3);
    const pending = all.filter((l) => l.cr?.status === "pending").length;
    const wdToday = (now.getDay() + 6) % 7;
    const today = [...all.filter((l) => l.date === td).map((l) => ({ s: l.time, e: te(l.time, l.min), l })), ...d!.events.filter((e) => (e.repeat === "w" ? e.weekday === wdToday : e.date === td)).map((e) => ({ s: e.start, e: e.end, ev: e }))].sort((a, b) => a.s.localeCompare(b.s));
    const nextLabel = next ? (next.date === td ? "dziś" : next.date === addDays(1) ? "jutro" : WDSHORT[pd(next.date).getDay()]) + " " + next.time : "—";
    const lrow = (l: L, when = false) => <button type="button" key={l.id} className={"srow" + (l.status === "cancelled" ? " cx" : "")} onClick={() => lessonModal(l.id)}>
      <span className="tm">{when ? <>{l.date === td ? "Dziś" : l.date === addDays(1) ? "Jutro" : pd(l.date).getDate() + " " + MSHORT[pd(l.date).getMonth()]}<small>{l.time}</small></> : <>{l.time}<small>{te(l.time, l.min)}</small></>}</span><span className="sb" />
      <span className="m"><b>{l.subject || "Lekcja"}</b><span>{l.tutor}{l.topic ? " · " + l.topic : ""}</span></span>{shortTag(l, false)}</button>;
    return <>
      <div className="bar"><div><h2 style={{ fontSize: 22, margin: 0 }}>Cześć, {(user!.name || "").split(" ")[0]}!</h2><span className="hint">{WDL[wdToday]}, {fd(td).split(", ")[1]}</span></div></div>
      {!d!.links.length && <div className="nt" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>Połącz się z korepetytorem, aby widzieć swoje lekcje, notatki i prace domowe. <button className="btn s p" onClick={() => go("kor")}>Dodaj kod</button></div>}
      {pending > 0 && <div className="nt">Prośby czekające na decyzję korepetytora: <b>{pending}</b>.</div>}
      <div className="bento">
        {next ? <button type="button" className="hero w2" onClick={() => lessonModal(next.id)}>
            <span className="hl"><span>Najbliższa lekcja · {next.date === td ? "dziś" : next.date === addDays(1) ? "jutro" : WDL[wdOf(next.date)].toLowerCase()}</span><span>{next.tutor}</span></span>
            <span className="hv">{next.subject || "Lekcja"} · {next.time}</span>
            <span className="hp"><span>{next.min} min</span>{next.topic && <span>{next.topic}</span>}</span></button>
          : <div className="hero w2" style={{ cursor: "default" }}><span className="hl"><span>Najbliższa lekcja</span></span><span className="hv">Brak zaplanowanych</span></div>}
        <div className="tile tl3"><div className="l">Zadania</div><div className="v">{todo.length}</div><small>{(() => { const late = todo.filter((l) => l.hd && l.hd < td).length; return late ? late + " po terminie" : todo.filter((l) => l.hd && l.hd <= ymd(sun)).length + " na ten tydzień"; })()}</small></div>
        <div className="tile tl2"><div className="l">Nauka w miesiącu</div><div className="v">{fmtH(monthMin)}</div><small>{week.length} {week.length === 1 ? "lekcja" : week.length > 1 && week.length < 5 ? "lekcje" : "lekcji"} w tym tygodniu</small></div>
      </div>
      <div className="bento" style={{ marginTop: 12 }}>
        <div className="card w2"><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><h2 style={{ margin: 0 }}>Do zrobienia</h2><span className="sp" style={{ flex: 1 }} />{todo.length > 4 && <button className="btn s" onClick={() => go("hw")}>Wszystkie ({todo.length})</button>}</div>
          {todo.length ? todo.slice(0, 4).map((l) => <div className="srow" key={l.id} style={{ cursor: "default" }}><button className="chkc" aria-label="Oznacz jako zrobione" onClick={() => toggleHw(l.id)} /><span className="m" onClick={() => lessonModal(l.id)} style={{ cursor: "pointer" }}><b>{l.hw}</b><span>{l.subject || "Lekcja"} · {l.tutor}</span></span>{due(l)}</div>) : <p className="hint" style={{ margin: 0 }}>Wszystkie prace domowe są zrobione.</p>}</div>
        <div className="card w2"><h2>Dziś</h2>{today.length ? today.map((x, k) => "l" in x && x.l ? lrow(x.l) : <button type="button" key={k} className="srow" onClick={() => evForm((x as any).ev)}><span className="tm">{x.s}<small>{x.e}</small></span><span className="sb o" /><span className="m"><b>{(x as any).ev.title}</b><span>{CATS[(x as any).ev.cat] || "Inne"}</span></span></button>) : <p className="hint" style={{ margin: 0 }}>Dziś nie masz zaplanowanych zajęć.</p>}</div>
        <div className="card w2"><h2>Najbliższe lekcje</h2>{upcoming.length ? upcoming.slice(0, 5).map((l) => lrow(l, true)) : <p className="hint" style={{ margin: 0 }}>Brak zaplanowanych lekcji.</p>}</div>
        <div className="card w2"><h2>Ostatnie notatki</h2>{notes.length ? notes.map((l) => <button type="button" key={l.id} className="srow" onClick={() => lessonModal(l.id)}><span className="tm">{pd(l.date).getDate()} {MSHORT[pd(l.date).getMonth()]}<small>{l.time}</small></span><span className="sb" /><span className="m"><b>{l.subject || "Lekcja"}{l.topic ? " · " + l.topic : ""}</b><span>{l.notes}</span></span></button>) : <p className="hint" style={{ margin: 0 }}>Tu pojawią się notatki od korepetytora po lekcjach.</p>}</div>
      </div>
    </>;
  }
  function Plan() {
    if (!d!.links.length && !d!.events.length) return <div className="card"><Empty icon="cal" title="Twój plan jest pusty" sub="Dodaj kod od korepetytora albo własne zajęcia, aby zobaczyć plan tygodnia." />
      <div className="acts" style={{ justifyContent: "center" }}><button className="btn p" onClick={() => go("kor")}>Dodaj kod od korepetytora</button><button className="btn" onClick={() => evForm()}>Dodaj własne zajęcia</button></div></div>;
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + 7 * wk);
    const end = new Date(mon); end.setDate(end.getDate() + 6);
    const td = ymd(new Date());
    type It = { s: string; e: string; l?: L; ev?: Ev; bad?: boolean };
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(mon); day.setDate(day.getDate() + i); const ds = ymd(day);
      const it: It[] = [...all.filter((l) => l.date === ds).map((l) => ({ s: l.time, e: te(l.time, l.min), l })), ...d!.events.filter((e) => (e.repeat === "w" ? e.weekday === i : e.date === ds)).map((e) => ({ s: e.start, e: e.end, ev: e }))].sort((a, b) => a.s.localeCompare(b.s));
      const live = (x: It) => !x.l || x.l.status !== "cancelled";
      it.forEach((x, j) => { x.bad = live(x) && it.some((y, k) => k !== j && live(y) && clash(x.s, x.e, y.s, y.e)); });
      return { day, ds, it };
    });
    const todayIdx = days.findIndex((x) => x.ds === td);
    const cur = sel >= 0 ? sel : todayIdx >= 0 ? todayIdx : 0;
    const block = (x: It, k: number) => x.l
      ? <button type="button" key={k} className={"pblk les" + (x.bad ? " clash" : "") + (x.l.status === "cancelled" ? " cx" : "")} style={{ ["--sc" as any]: subjColor(x.l.subject) }} onClick={() => lessonModal(x.l!.id)}>
          <span className="ptm">{x.s}–{x.e}</span><b>{x.l.subject || "Lekcja"}</b><span className="ps">{x.l.tutor}</span>{shortTag(x.l, !!x.bad)}</button>
      : <button type="button" key={k} className={"pblk own c-" + x.ev!.cat + (x.bad ? " clash" : "")} onClick={() => evForm(x.ev)}>
          <span className="ptm">{x.s}–{x.e}</span><b>{x.ev!.title}</b>{x.bad && <span className="tag rd">Nakłada się</span>}</button>;
    return <>
      <div className="wkbar"><button className="btn s" onClick={() => { setWk(wk - 1); setSel(-1); }} aria-label="Poprzedni tydzień">‹</button><b>{mon.getDate()} {MSHORT[mon.getMonth()]} – {end.getDate()} {MSHORT[end.getMonth()]}</b><button className="btn s" onClick={() => { setWk(wk + 1); setSel(-1); }} aria-label="Następny tydzień">›</button>{wk !== 0 && <button className="btn s" onClick={() => { setWk(0); setSel(-1); }}>Dziś</button>}</div>
      <div className="plegend"><span><i className="les" />Lekcje od korepetytorów</span><span><i className="own" />Mój grafik</span></div>
      {/* phone: day picker + agenda of one day */}
      <div className="dstrip" role="tablist" aria-label="Dzień tygodnia">{days.map((x, i) => <button key={x.ds} role="tab" aria-selected={i === cur} className={(i === cur ? "on" : "") + (x.ds === td ? " td" : "")} onClick={() => setSel(i)}>
        <small>{WDSHORT[x.day.getDay()].replace(".", "")}</small><b>{x.day.getDate()}</b><span className="dots">{x.it.some((y) => y.l && y.l.status !== "cancelled") && <i className="les" />}{x.it.some((y) => y.ev) && <i className="own" />}</span></button>)}</div>
      <div className="card pday">{days[cur].it.length ? days[cur].it.map(block) : <p className="hint" style={{ margin: 0, textAlign: "center" }}>Wolny dzień – brak lekcji i zajęć.</p>}</div>
      {/* desktop: whole week in columns */}
      <div className="pweek">{days.map((x) => <div key={x.ds} className={"pcol" + (x.ds === td ? " td" : "")}>
        <div className="pch"><small>{WDSHORT[x.day.getDay()]}</small><b>{x.day.getDate()} {MSHORT[x.day.getMonth()]}</b></div>
        {x.it.length ? x.it.map(block) : <span className="pfree">wolne</span>}</div>)}</div>
    </>;
  }
  function Graf() {
    const intro = <p className="hint" style={{ margin: "0 0 12px" }}>Tu zarządzasz własnymi zajęciami: szkołą, zajęciami dodatkowymi i korepetycjami spoza TutorTrack. Wszystko razem z lekcjami zobaczysz w zakładce Plan.</p>;
    if (!d!.events.length) return <>{intro}<div className="card"><Empty icon="cal" title="Brak własnych zajęć" sub="Dodaj szkołę, stałe zajęcia lub lekcje u innych korepetytorów." /><div className="acts" style={{ justifyContent: "center" }}><button className="btn p" onClick={() => evForm()}>Dodaj zajęcia</button></div></div></>;
    const WD2 = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];
    const td = ymd(new Date());
    const EMO: Record<string, string> = { school: "🏫", extra: "⚽", tutor: "📘", other: "📌" };
    const W = d!.events.filter((e) => e.repeat === "w");
    const O = d!.events.filter((e) => e.repeat === "o").sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const Oup = O.filter((e) => e.date >= td), Opast = O.filter((e) => e.date < td).reverse();
    // weekly items grouped by category, then by title (e.g. "Szkoła" Mon–Fri as one entry)
    const cats = Object.keys(CATS).filter((c) => W.some((e) => e.cat === c));
    return <>{intro}
      {cats.map((c) => { const byT: Record<string, Ev[]> = {}; W.filter((e) => e.cat === c).forEach((e) => { (byT[e.title] = byT[e.title] || []).push(e); });
        return <div className={"card gcat " + ({ school: "tl4", extra: "tl2", tutor: "tl3", other: "tl5" } as Record<string, string>)[c]} key={c}><h2><span className="emo" aria-hidden="true">{EMO[c]}</span>{CATS[c]}<span className="tag" style={{ marginLeft: 8 }}>co tydzień</span></h2>
          {Object.entries(byT).map(([t, es]) => <div className="gitem" key={t}><b>{t}</b><div className="gslots">{es.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)).map((e) => <button type="button" key={e.id} className={"gslot c-" + c} onClick={() => evForm(e)} aria-label={"Edytuj: " + t + ", " + WDL[e.weekday] + " " + e.start}><b>{WD2[e.weekday]}</b>{e.start}–{e.end}</button>)}</div></div>)}</div>; })}
      {Oup.length > 0 && <div className="card gcat"><h2><span className="emo" aria-hidden="true">🗓️</span>Jednorazowe – nadchodzące</h2>
        {Oup.map((e) => <button type="button" key={e.id} className="gone" onClick={() => evForm(e)}><span className={"gdate c-" + e.cat}><b>{pd(e.date).getDate()}</b><small>{MSHORT[pd(e.date).getMonth()]}</small></span><span className="m"><b>{e.title}</b><span>{WDL[wdOf(e.date)]} · {e.start}–{e.end} · {CATS[e.cat] || "Inne"}</span></span></button>)}</div>}
      {Opast.length > 0 && <details className="card gcat"><summary><b>Minione jednorazowe ({Opast.length})</b></summary>
        {Opast.map((e) => <button type="button" key={e.id} className="gone cx" onClick={() => evForm(e)}><span className={"gdate c-" + e.cat}><b>{pd(e.date).getDate()}</b><small>{MSHORT[pd(e.date).getMonth()]}</small></span><span className="m"><b>{e.title}</b><span>{e.start}–{e.end} · {CATS[e.cat] || "Inne"}</span></span></button>)}</details>}
    </>;
  }
  function Hw() {
    const X = all.filter((l) => l.hw && (hf === "all" || (hf === "done") === done.has(l.id))).sort((a, b) => { const x = a.hd || a.date, y = b.hd || b.date; return hf === "done" ? y.localeCompare(x) : x.localeCompare(y); });
    return <><div className="bar"><div className="seg" role="group" aria-label="Filtr zadań">{([["todo", "Do zrobienia"], ["done", "Zrobione"], ["all", "Wszystkie"]] as const).map(([v, t]) => <button key={v} aria-pressed={hf === v} onClick={() => setHf(v)}>{t}</button>)}</div></div>
      {!X.length ? <div className="card"><Empty icon="check" title={hf === "todo" ? "Nic do zrobienia" : "Brak zadań"} sub={hf === "todo" ? "Wszystkie prace domowe są zrobione albo korepetytor nie przesłał jeszcze zadań." : "Tu pojawią się prace domowe od korepetytorów."} /></div>
        : <div className="card">{X.map((l) => { const dn = done.has(l.id); return <div className="srow" key={l.id} style={{ cursor: "default" }}>
            <button className={"chkc" + (dn ? " on" : "")} aria-label={dn ? "Oznacz jako niezrobione" : "Oznacz jako zrobione"} aria-pressed={dn} onClick={() => toggleHw(l.id)}>{dn && <Ic n="check" s={14} />}</button>
            <span className="m" onClick={() => lessonModal(l.id)} style={{ cursor: "pointer" }}><b style={dn ? { textDecoration: "line-through", color: "var(--mu)" } : undefined}>{l.hw}</b><span>{l.subject || "Lekcja"} · {l.tutor}</span></span>{due(l)}</div>; })}</div>}</>;
  }
  function Sum() {
    const L = all.filter((l) => l.date.slice(0, 7) === m), dn = L.filter((l) => l.status === "done"), cn = L.filter((l) => l.status === "cancelled"), pl = L.filter((l) => l.status === "planned");
    const min = dn.reduce((t, l) => t + l.min, 0), bil = L.filter((l) => l.status === "done" || (l.status === "cancelled" && l.amount > 0)), tot = bil.reduce((t, l) => t + l.amount, 0), paid = bil.reduce((t, l) => t + (l.paid ? l.amount : 0), 0), hw = L.filter((l) => l.hw);
    const bs: Record<string, number> = {}; dn.forEach((l) => { const k = l.subject || "—"; bs[k] = (bs[k] || 0) + l.min; });
    const e = Object.entries(bs).sort((a, b) => b[1] - a[1]), mx = e.length ? e[0][1] : 1;
    const shiftM = (k: number) => { const [y, mo] = m.split("-").map(Number); setM(ym(new Date(y, mo - 1 + k, 1))); };
    const mt = fm(m);
    const head = <div className="bar"><div className="mpick" role="group" aria-label="Miesiąc"><button type="button" aria-label="Poprzedni miesiąc" onClick={() => shiftM(-1)}>‹</button><span aria-live="polite">{mt.charAt(0).toUpperCase() + mt.slice(1)}</span><button type="button" aria-label="Następny miesiąc" onClick={() => shiftM(1)}>›</button></div></div>;
    if (!L.length) return <>{head}<div className="card"><Empty icon="chart" title="Brak lekcji w tym miesiącu" sub="Wybierz inny miesiąc albo dodaj kod od korepetytora." /></div></>;
    const byDate = (a: L, b: L) => (a.date + a.time).localeCompare(b.date + b.time);
    return <>{head}
      <div className="grid g4"><div className="card stat"><div className="l">Lekcje</div><div className="v">{dn.length}</div></div><div className="card stat"><div className="l">Czas nauki</div><div className="v">{fmtH(min)}</div></div><div className="card stat"><div className="l">Odwołane</div><div className="v am">{cn.length}</div></div><div className="card stat"><div className="l">Zadania</div><div className="v">{hw.filter((l) => done.has(l.id)).length} / {hw.length}</div></div></div>
      {tot > 0 && <div className="grid g4" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 16 }}><div className="card stat"><div className="l">Kwota</div><div className="v">{pln(tot)}</div></div><div className="card stat"><div className="l">Opłacone</div><div className="v gr">{pln(paid)}</div></div><div className="card stat"><div className="l">Do zapłaty</div><div className="v am">{pln(tot - paid)}</div></div></div>}
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Czas nauki według przedmiotu</h2>{e.length ? e.map((x) => <div className="bl" key={x[0]}><span>{x[0]}</span><b>{fmtH(x[1])}</b><div className="bb"><i style={{ width: Math.round(x[1] / mx * 100) + "%" }} /></div></div>) : <p className="hint">Brak danych w wybranym okresie.</p>}</div>
        <div className="card"><h2>Zaplanowane</h2>{pl.length ? pl.sort(byDate).map((l) => <button type="button" className="srow" key={l.id} onClick={() => lessonModal(l.id)}><span className="tm">{pd(l.date).getDate()} {MSHORT[pd(l.date).getMonth()]}<small>{l.time}</small></span><span className="sb" /><span className="m"><b>{l.subject || "Lekcja"}</b><span>{l.tutor}</span></span></button>) : <p className="hint">Brak zaplanowanych lekcji w tym miesiącu.</p>}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h2>Lekcje i notatki</h2>{[...dn, ...cn].sort(byDate).map((l) => <button type="button" className={"srow" + (l.status === "cancelled" ? " cx" : "")} key={l.id} onClick={() => lessonModal(l.id)}><span className="tm">{pd(l.date).getDate()} {MSHORT[pd(l.date).getMonth()]}<small>{l.time}</small></span><span className="sb" /><span className="m"><b>{l.subject || "Lekcja"}{l.topic ? " · " + l.topic : ""}</b><span>{l.notes || l.tutor}</span></span>{shortTag(l, false)}</button>)}</div>
    </>;
  }

  const action = tab === "dash" || tab === "plan" || tab === "graf"
    ? <button className="btn p" onClick={() => evForm()}><Ic n="plus" s={16} /><span>Dodaj zajęcia</span></button>
    : tab === "kor" ? <button className="btn p" onClick={() => document.getElementById("kcode")?.focus()}><Ic n="plus" s={16} /><span>Dodaj kod</span></button> : null;

  return <>
    <div className="app">
      <aside className="side" aria-label="Menu ucznia">
        <div className="logo"><i><Logo /></i>TutorTrack</div>
        <div>{TABS.map((x) => <button key={x[0]} className={"nav" + (tab === x[0] ? " on" : "")} aria-current={tab === x[0] ? "page" : undefined} onClick={() => go(x[0])}><Ic n={x[2]} />{x[1]}{x[0] === "hw" && nT > 0 && <span className="tag am" style={{ marginLeft: "auto" }}>{nT}</span>}</button>)}
          {user!.isAdmin && <button className="nav" onClick={() => navigate("/admin")}><Ic n="alert" />Panel administratora</button>}
          <button className="nav" onClick={out}><Ic n="out" />Wyloguj się</button></div>
        <div className="planchip">Panel ucznia: <b>bezpłatny</b><br />{user!.name}</div>
      </aside>
      <div className="main">
        <header className="top">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><a className="brandm" href="/uczen" aria-label="TutorTrack"><span className="logo" style={{ padding: 0 }}><i><Logo /></i></span></a><div><h1>{cur[1]}</h1><small /></div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="hint" id="usr">{user!.name}</span><button className="btn s lo" aria-label="Ustawienia" onClick={() => go("konto")}><Ic n="set" s={16} /></button>{action}</div>
        </header>
        {err && <p className="banner">{err} <button className="lk" onClick={load}>Spróbuj ponownie</button></p>}
        <main className="content">{!d ? <p className="hint">Ładowanie…</p> : tab === "dash" ? Dash() : tab === "plan" ? Plan() : tab === "graf" ? Graf() : tab === "hw" ? Hw() : tab === "sum" ? Sum() : tab === "kor" ? <KorTab d={d} load={load} run={run} /> : <KontoTab out={out} d={d} load={load} />}</main>
      </div>
    </div>
    <nav className="tabs fit" aria-label="Menu">{TABS.filter((x) => MAIN.includes(x[0])).map((x) => <button key={x[0]} className={tab === x[0] ? "on" : ""} aria-current={tab === x[0] ? "page" : undefined} onClick={() => go(x[0])}><Ic n={x[2]} s={22} />{x[3]}{x[0] === "hw" && nT > 0 && <i className="tbadge">{nT}</i>}</button>)}
      <button className={MAIN.includes(tab) ? "" : "on"} aria-haspopup="dialog" onClick={() => ov.modal(<><h2>Więcej</h2><div className="more-list">
        {TABS.filter((x) => !MAIN.includes(x[0])).map((x) => <button key={x[0]} onClick={() => { ov.close(); go(x[0]); }}><Ic n={x[2]} />{x[1]}</button>)}
        <button onClick={() => { ov.close(); out(); }}><Ic n="out" />Wyloguj się</button></div>
        <div className="mf"><button className="btn" onClick={ov.close}>Zamknij</button></div></>)}><Ic n="menu" s={22} />Więcej</button></nav>
  </>;
}

function EvForm({ e, lessons, events, onSave, onDel }: { e?: Ev; lessons: L[]; events: Ev[]; onSave: (b: object) => Promise<boolean>; onDel?: () => void }) {
  const { close } = useOverlay();
  const [conf, setConf] = useState<{ key: string; list: string[] } | null>(null);
  const [f, setF] = useState(e ? { ...e } : { title: "", cat: "school", repeat: "w" as "w" | "o", weekday: (new Date().getDay() + 6) % 7, date: ymd(new Date()), start: "16:00", end: "17:00" });
  const [er, setEr] = useState<Record<string, string>>({});
  // any change of day or time invalidates an earlier overlap warning
  useEffect(() => { setConf(null); }, [f.repeat, f.weekday, f.date, f.start, f.end]);
  const save = async () => {
    const x = { title: f.title.trim() ? "" : "Podaj nazwę zajęć.", date: f.repeat === "o" && !f.date ? "Wybierz datę." : "", start: f.start ? "" : "Podaj godzinę.", end: !f.end ? "Podaj godzinę." : f.start && f.end <= f.start ? "Koniec musi być po początku." : "" };
    setEr(x); if (Object.values(x).some(Boolean)) return;
    // find lessons and own activities at the same time
    const td = ymd(new Date()), wd = f.repeat === "w" ? f.weekday : wdOf(f.date);
    const sameDay = (date: string) => (f.repeat === "w" ? date >= td && wdOf(date) === wd : date === f.date);
    const list = [
      ...lessons.filter((l) => l.status !== "cancelled" && sameDay(l.date) && clash(f.start, f.end, l.time, te(l.time, l.min)))
        .map((l) => `${l.subject || "Lekcja"} (${l.tutor}) – ${fd(l.date)}, ${l.time}–${te(l.time, l.min)}`),
      ...events.filter((o) => o.id !== e?.id && (o.repeat === "w" ? o.weekday === wd : sameDay(o.date)) && clash(f.start, f.end, o.start, o.end))
        .map((o) => `${o.title} – ${o.repeat === "w" ? WDL[o.weekday].toLowerCase() + ", co tydzień" : fd(o.date)}, ${o.start}–${o.end}`),
    ];
    const key = JSON.stringify([f.repeat, f.weekday, f.date, f.start, f.end]);
    if (list.length && conf?.key !== key) { setConf({ key, list }); return; }
    if (await onSave({ title: f.title.trim(), cat: f.cat, repeat: f.repeat, weekday: f.weekday, date: f.repeat === "o" ? f.date : "", start: f.start, end: f.end })) close();
  };
  return <><h2>{e ? "Edytuj zajęcia" : "Dodaj zajęcia"}</h2>
    <Field id="et" label="Nazwa *" value={f.title} onChange={(v) => setF({ ...f, title: v })} error={er.title} placeholder="Np. Szkoła, Basen, Chemia u p. Kowalskiej" />
    <div className="f2"><div className="f"><label htmlFor="ec">Rodzaj</label><select id="ec" value={f.cat} onChange={(x) => setF({ ...f, cat: x.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="f"><label htmlFor="er">Powtarzanie</label><select id="er" value={f.repeat} onChange={(x) => setF({ ...f, repeat: x.target.value as "w" | "o" })}><option value="w">Co tydzień</option><option value="o">Jednorazowo</option></select></div></div>
    {f.repeat === "w" ? <div className="f"><label htmlFor="ewd">Dzień tygodnia</label><select id="ewd" value={f.weekday} onChange={(x) => setF({ ...f, weekday: +x.target.value })}>{WDL.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></div>
      : <Field id="edt" label="Data *" type="date" value={f.date} onChange={(v) => setF({ ...f, date: v })} error={er.date} />}
    <div className="f2"><Field id="es" label="Od *" type="time" value={f.start} onChange={(v) => setF({ ...f, start: v })} error={er.start} /><Field id="ee" label="Do *" type="time" value={f.end} onChange={(v) => setF({ ...f, end: v })} error={er.end} /></div>
    {conf && <div className="lerr" role="alert"><b>Te zajęcia nakładają się na:</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{conf.list.slice(0, 5).map((t) => <li key={t}>{t}</li>)}</ul>{conf.list.length > 5 && <div>…i jeszcze {conf.list.length - 5}</div>}<div style={{ marginTop: 6 }}>Zmień godzinę albo zapisz mimo to.</div></div>}
    <div className="mf">{onDel && <button className="btn d" style={{ marginRight: "auto" }} onClick={onDel}>Usuń</button>}<button className="btn" onClick={close}>Anuluj</button><button className="btn p" onClick={save}>{conf && conf.key === JSON.stringify([f.repeat, f.weekday, f.date, f.start, f.end]) ? "Zapisz mimo to" : "Zapisz"}</button></div></>;
}

function KorTab({ d, load, run }: { d: Data; load: () => Promise<void>; run: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean> }) {
  const ov = useOverlay();
    const [code, setCode] = useState(""), [e, setE] = useState(""), [busy, setBusy] = useState(false);
    const add = async () => {
      const n = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (n.length !== 16) { setE("Kod ma 16 znaków (litery i cyfry), np. ABCD-EFGH-JKLM-NPQR."); return; }
      setBusy(true);
      try { await api("POST", "/api/student/link", { code }); setCode(""); setE(""); await load(); ov.toast("Połączono z korepetytorem."); } catch (x) { setE(errMsg(x)); } finally { setBusy(false); }
    };
    return <>
      <div className="card"><h2>Dodaj kod od korepetytora</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>Kod dostępu (16 znaków) dostajesz od korepetytora. Lekcje, notatki i prace domowe pojawią się automatycznie.</p>
        <form className="bar" style={{ margin: 0 }} onSubmit={(x) => { x.preventDefault(); add(); }}><input id="kcode" value={code} onChange={(x) => setCode(x.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} aria-label="Kod dostępu" aria-describedby="e_ucode" style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", letterSpacing: 1 }} /><button className="btn p" type="submit" disabled={busy}>Dodaj kod</button></form>
        <div className="er" id="e_ucode" role="alert" style={{ color: "var(--rd)", fontSize: 13, marginTop: 6 }}>{e}</div></div>
      <div className="card" style={{ marginTop: 16 }}><h2>Twoi korepetytorzy</h2>
        {d.links.length ? d.links.map((k) => <div className="row" key={k.sid}><div className="av">{(k.tutor || "K").charAt(0).toUpperCase()}</div><div className="m"><b>{k.tutor}</b><span>{k.subject} · lekcji: {k.lessons.length}</span>{k.contact?.email || k.contact?.phone ? <span className="ktc">{k.contact.email && <a href={"mailto:" + k.contact.email}>✉️ {k.contact.email}</a>}{k.contact.phone && <a href={"tel:" + k.contact.phone.replace(/\s/g, "")}>📞 {k.contact.phone}</a>}</span> : <span className="hint" style={{ fontSize: 12, display: "block", marginTop: 2 }}>Korepetytor nie udostępnił danych kontaktowych.</span>}</div>
          <button className="btn s d" onClick={() => ov.confirm({ title: "Odłączyć korepetytora?", text: "Lekcje, notatki i zadania od tego korepetytora znikną z Twojego panelu. Aby połączyć się ponownie, poproś korepetytora o nowy kod.", ok: "Odłącz", danger: true, onOk: () => { run(() => api("DELETE", "/api/student/link/" + k.sid), "Odłączono korepetytora."); } })}>Odłącz</button></div>)
          : <p className="hint">Nie połączono jeszcze żadnego korepetytora.</p>}</div>
      <p className="hint" style={{ marginTop: 12 }}>Twoje lekcje widzisz tylko Ty i korepetytor, który je prowadzi. Wszystkie funkcje dla ucznia są bezpłatne.</p></>;
  }

function KontoTab({ out, d, load }: { out: () => void; d: Data; load: () => Promise<void> }) {
  const ov = useOverlay();
  const { user, logout } = useAuth();
    const [name, setName] = useState(user!.name), [e, setE] = useState("");
    const { updateMe, setUser } = useAuth();
    return <div className="grid" style={{ gap: 16 }}>
      <ThemePicker />
      <div className="card"><h2>Profil</h2><Field id="sn2" label="Imię" value={name} onChange={setName} error={e} /><p className="hint" style={{ margin: "4px 0 16px" }}>E-mail: {user!.email}</p>
        <button className="btn p" onClick={async () => { if (!name.trim()) { setE("Podaj imię."); return; } try { await updateMe({ name: name.trim() }); setE(""); ov.toast("Profil zapisany."); } catch (x) { ov.toast(errMsg(x)); } }}>Zapisz profil</button></div>
      <div className="card"><h2>Kopia grafiku</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>Zapisz własny grafik (szkoła, zajęcia dodatkowe) do pliku albo wczytaj go z pliku. Lekcje od korepetytorów są zawsze na koncie i nie trzeba ich kopiować.</p>
        <div className="acts"><button className="btn" onClick={() => download("tutortrack-grafik-" + ymd(new Date()) + ".json", JSON.stringify({ app: "TutorTrack", kind: "student-schedule", events: d.events.map(({ id, ...e }) => e) }, null, 1), "application/json")}>Eksportuj grafik</button>
          <button className="btn" onClick={() => {
            const f = document.createElement("input"); f.type = "file"; f.accept = ".json,application/json";
            f.onchange = () => { const file = f.files?.[0]; if (!file) return; file.text().then((txt) => {
              let o: any = null; try { o = JSON.parse(txt); } catch { /* invalid */ }
              if (!o || !Array.isArray(o.events)) { ov.toast("Nieprawidłowy plik grafiku."); return; }
              ov.confirm({ title: "Wczytać grafik?", text: `Obecny grafik zostanie zastąpiony (${o.events.length} zajęć z pliku). Lekcje od korepetytorów się nie zmienią.`, ok: "Wczytaj", danger: true,
                onOk: async () => { try { await api("POST", "/api/student/import", { events: o.events }); await load(); ov.toast("Grafik wczytany."); } catch (x) { ov.toast(errMsg(x)); } } });
            }); };
            f.click();
          }}>Importuj grafik</button></div></div>
      <div className="card"><h2>Konto i bezpieczeństwo</h2><div className="acts"><button className="btn" onClick={() => ov.modal(<ChangePassword />)}>Zmień hasło</button><button className="btn" onClick={out}>Wyloguj się</button><button className="btn d" onClick={() => ov.modal(<DeleteAccount onDone={() => { setUser(null); logout(); }} />)}>Usuń konto</button></div></div>
    </div>;
  }

function CancelRequestForm({ l, onSent }: { l: L; onSent: () => Promise<void> }) {
  const { close, toast } = useOverlay();
  const [kind, setKind] = useState<"cancel" | "move">("cancel");
  const [reason, setReason] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const nd = (() => { const d = pd(l.date); d.setDate(d.getDate() + 7); return ymd(d); })();
  const send = async () => {
    if (reason.trim().length < 3) { setErr("Napisz krótko przyczynę."); return; }
    setBusy(true);
    try { await api("POST", `/api/student/lessons/${l.id}/cancel-request`, { reason: reason.trim(), kind }); close(); toast("Prośba wysłana do korepetytora."); await onSent(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return <>
    <h2>{kind === "move" ? "Przenieść lekcję?" : "Odwołać lekcję?"}</h2>
    <p className="hint" style={{ margin: "-6px 0 12px" }}>{l.subject || "Lekcja"} · {l.tutor} · {fd(l.date)}, {l.time}–{te(l.time, l.min)}</p>
    <div className="seg" role="radiogroup" aria-label="Rodzaj prośby" style={{ marginBottom: 14 }}>
      <button role="radio" aria-checked={kind === "cancel"} aria-pressed={kind === "cancel"} onClick={() => setKind("cancel")}>Odwołać</button>
      <button role="radio" aria-checked={kind === "move"} aria-pressed={kind === "move"} onClick={() => setKind("move")}>Przenieść na następny tydzień</button>
    </div>
    {kind === "move" && <div className="nt">Nowy termin: <b>{fd(nd)}, {l.time}–{te(l.time, l.min)}</b></div>}
    <div className="f"><label htmlFor="crr">Przyczyna *</label><textarea id="crr" rows={3} maxLength={500} placeholder="Np. Jestem chory, mam sprawdzian w szkole, wyjazd rodzinny…" value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="e_crr" />
      <div className="er" id="e_crr" role="alert" style={{ color: "var(--rd)", fontSize: 12 }}>{err}</div></div>
    <p className="hint">{kind === "move" ? "Korepetytor musi potwierdzić nowy termin." : "Korepetytor musi potwierdzić odwołanie. Zgodnie z waszymi ustaleniami może naliczyć opłatę za odwołanie."} Do czasu decyzji możesz wycofać prośbę.</p>
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" disabled={busy} onClick={send}>Wyślij prośbę</button></div>
  </>;
}

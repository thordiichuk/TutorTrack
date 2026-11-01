import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Empty, Ic, Logo } from "../lib/icons";
import { addDays, CancelRequest, fd, fdt, fmtH, MSHORT, pd, pln, te, WDL, WDSHORT, ym, ymd } from "../lib/util";
import { useAuth } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { ChangePassword, DeleteAccount } from "../app/Views";

type SLesson = { id: string; date: string; time: string; min: number; subject: string; topic: string; status: "planned" | "done" | "cancelled"; notes: string; hw: string; hd: string; amount: number; paid: boolean; cr: CancelRequest | null };
type Link = { sid: string; tutor: string; studentName: string; subject: string; lessons: SLesson[] };
type Ev = { id: string; title: string; cat: string; repeat: "w" | "o"; weekday: number; date: string; start: string; end: string };
type Data = { links: Link[]; events: Ev[]; done: string[] };
type L = SLesson & { tutor: string; sid: string };
const CATS: Record<string, string> = { school: "Szkoła", tutor: "Korepetycje spoza TutorTrack", extra: "Zajęcia dodatkowe", other: "Inne" };
/** Two time ranges ("HH:MM") overlap. */
const clash = (aS: string, aE: string, bS: string, bE: string) => aS < bE && bS < aE;
const wdOf = (date: string) => (pd(date).getDay() + 6) % 7; // Monday = 0
const RED = { background: "var(--rdl)", borderLeft: "4px solid var(--rd)", paddingLeft: 10, borderRadius: 8 };

const TABS: [string, string][] = [["plan", "Plan"], ["graf", "Mój grafik"], ["hw", "Zadania"], ["sum", "Podsumowanie"], ["kor", "Korepetytorzy"], ["konto", "Konto"]];

export function StudentPanel() {
  const { user, logout } = useAuth();
  const ov = useOverlay();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("plan");
  const [wk, setWk] = useState(0);
  const [m, setM] = useState(ym(new Date()));
  const [hf, setHf] = useState<"todo" | "done" | "all">("todo");

  const load = useCallback(async () => {
    try { setD(await api<Data>("GET", "/api/student/data")); setErr(""); } catch (e) { setErr(errMsg(e)); }
  }, []);
  useEffect(() => {
    document.title = "Panel ucznia – TutorTrack";
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    const f = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", f);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", f); };
  }, [load]);

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
    return <>{l.cr?.status === "pending" && <><span className="tag am">Prośba o odwołanie</span>{" "}</>}{l.cr?.status === "rejected" && l.status === "planned" && <><span className="tag rd">Odwołanie odrzucone</span>{" "}</>}<span className={"tag " + st[1]}>{st[0]}</span>{" "}{l.notes && <><span className="tag gr">Notatka</span>{" "}</>}{l.hw && (done.has(l.id) ? <span className="tag gr">Zadanie zrobione</span> : <span className="tag am">Zadanie</span>)}</>;
  };
  const due = (l: L) => {
    const td = ymd(new Date());
    if (done.has(l.id)) return <span className="tag gr">Zrobione</span>;
    if (!l.hd) return null;
    if (l.hd < td) return <span className="tag rd">Po terminie · {fd(l.hd)}</span>;
    if (l.hd === td) return <span className="tag am">Na dziś</span>;
    if (l.hd === addDays(1)) return <span className="tag am">Na jutro</span>;
    return <span className="tag">Termin: {fd(l.hd)}</span>;
  };
  const lessonModal = (id: string) => {
    const l = find(id); if (!l) return;
    ov.modal(<><h2>{l.subject || "Lekcja"}</h2><p className="hint" style={{ margin: "-6px 0 10px" }}>{l.tutor} · {fd(l.date)}, {l.time}–{te(l.time, l.min)} ({l.min} min)</p>
      <div style={{ marginBottom: 12 }}>{tags(l)}</div>{l.topic && <p><b>Temat:</b> {l.topic}</p>}
      <h3 style={{ margin: "12px 0 4px", fontSize: 15 }}>Notatka po lekcji</h3><p className="pre" style={{ margin: 0 }}>{l.notes || <span className="hint">Brak notatki.</span>}</p>
      {l.hw && <><h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>Praca domowa</h3><p className="pre" style={{ margin: "0 0 6px" }}>{l.hw}</p>{due(l)}</>}
      {l.amount > 0 && <p className="hint" style={{ marginTop: 14 }}>Kwota: {pln(l.amount)}{l.paid ? " · opłacona" : " · nieopłacona"}</p>}
      {l.cr?.status === "pending" && <div className="nt" style={{ marginTop: 12 }}><b>Prośba o odwołanie wysłana</b> {fdt(l.cr.at)} – czeka na potwierdzenie korepetytora.<br />Przyczyna: {l.cr.reason}</div>}
      {l.cr?.status === "rejected" && l.status === "planned" && <div className="lerr" style={{ marginTop: 12 }}><b>Korepetytor odrzucił prośbę o odwołanie.</b>{l.cr.note && <><br />Komentarz: {l.cr.note}</>}<br />Twoja przyczyna: {l.cr.reason}</div>}
      {l.cr?.status === "accepted" && l.status === "cancelled" && <p className="hint" style={{ marginTop: 12 }}>Lekcja odwołana na Twoją prośbę. Przyczyna: {l.cr.reason}</p>}
      <div className="mf">
        {l.status === "planned" && l.cr?.status !== "pending" && <button className="btn d" style={{ marginRight: "auto" }} onClick={() => ov.modal(<CancelRequestForm l={l} onSent={load} />)}>Odwołaj lekcję</button>}
        {l.cr?.status === "pending" && <button className="btn d" style={{ marginRight: "auto" }} onClick={() => { ov.close(); run(() => api("DELETE", `/api/student/lessons/${l.id}/cancel-request`), "Prośba o odwołanie wycofana."); }}>Wycofaj prośbę</button>}
        <button className="btn" onClick={ov.close}>Zamknij</button>{l.hw && <button className="btn p" onClick={() => toggleHw(l.id, true)}>{done.has(l.id) ? "Cofnij: niezrobione" : "Oznacz zadanie jako zrobione"}</button>}</div></>);
  };
  const evForm = (e?: Ev) => ov.modal(<EvForm e={e} lessons={all} events={d!.events} onSave={(b) => run(() => (e ? api("PATCH", "/api/student/events/" + e.id, b) : api("POST", "/api/student/events", b)), e ? "Zapisano zmiany." : "Dodano zajęcia do grafiku.")}
    onDel={e ? () => ov.confirm({ title: "Usunąć zajęcia?", text: "Zajęcia znikną z Twojego grafiku.", ok: "Usuń", danger: true, onOk: () => { run(() => api("DELETE", "/api/student/events/" + e.id), "Usunięto zajęcia."); } }) : undefined} />);
  const out = () => ov.confirm({ title: "Wylogować się?", text: "Twoje dane są bezpiecznie zapisane na koncie.", ok: "Wyloguj się", onOk: logout });

  /* ----- tabs ----- */
  function Plan() {
    if (!d!.links.length && !d!.events.length) return <div className="card"><Empty icon="cal" title="Twój plan jest pusty" sub="Dodaj kod od korepetytora albo własne zajęcia, aby zobaczyć plan tygodnia." />
      <div className="acts" style={{ justifyContent: "center" }}><button className="btn p" onClick={() => setTab("kor")}>Dodaj kod od korepetytora</button><button className="btn" onClick={() => evForm()}>Dodaj własne zajęcia</button></div></div>;
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + 7 * wk);
    const end = new Date(mon); end.setDate(end.getDate() + 6);
    const td = ymd(new Date());
    return <>
      <div className="bar"><button className="btn s" onClick={() => setWk(wk - 1)} aria-label="Poprzedni tydzień">‹</button><b>{mon.getDate()} {MSHORT[mon.getMonth()]} – {end.getDate()} {MSHORT[end.getMonth()]} {end.getFullYear()}</b><button className="btn s" onClick={() => setWk(wk + 1)} aria-label="Następny tydzień">›</button>{wk !== 0 && <button className="btn s" onClick={() => setWk(0)}>Ten tydzień</button>}<span className="sp" /><button className="btn s p" onClick={() => evForm()}><Ic n="plus" s={14} /> Dodaj zajęcia</button></div>
      <div className="card">{Array.from({ length: 7 }, (_, i) => {
        const day = new Date(mon); day.setDate(day.getDate() + i); const ds = ymd(day);
        const it = [...all.filter((l) => l.date === ds).map((l) => ({ s: l.time, e: te(l.time, l.min), l })), ...d!.events.filter((e) => (e.repeat === "w" ? e.weekday === i : e.date === ds)).map((e) => ({ s: e.start, e: e.end, ev: e }))].sort((a, b) => a.s.localeCompare(b.s));
        const live = (x: { l?: L } | { ev: Ev }) => !("l" in x) || !x.l || x.l.status !== "cancelled";
        const bad = it.map((x, j) => live(x) && it.some((y, k) => k !== j && live(y) && clash(x.s, x.e, y.s, y.e)));
        const warn = (k: number) => bad[k] ? <span className="tag rd">Nakłada się</span> : null;
        return <div className="uday" key={ds}><h3>{WDSHORT[day.getDay()]} {day.getDate()} {MSHORT[day.getMonth()]}{ds === td && <> <span className="tag ac">Dziś</span></>}</h3>
          {it.length ? it.map((x, k) => "l" in x && x.l ? <div className="row" key={k} style={bad[k] ? RED : undefined}><div className="m"><b>{x.s}–{x.e} · {x.l.subject || "Lekcja"}</b><span>{x.l.tutor}{x.l.topic ? " · " + x.l.topic : ""}</span></div><div>{warn(k)} {tags(x.l)}</div><button className="btn s" onClick={() => lessonModal(x.l.id)}>Szczegóły</button></div>
            : <div className="row" key={k} style={bad[k] ? RED : undefined}><div className="m"><b>{x.s}–{x.e} · {(x as any).ev.title}</b><span>{CATS[(x as any).ev.cat] || "Inne"}{(x as any).ev.repeat === "w" ? " · co tydzień" : ""}</span></div><div>{warn(k)} <span className="tag">Mój grafik</span></div><button className="btn s" onClick={() => evForm((x as any).ev)}>Edytuj</button></div>)
            : <p className="hint" style={{ margin: "0 0 4px" }}>Wolny dzień</p>}</div>;
      })}</div></>;
  }
  function Graf() {
    const head = <><div className="bar"><h2 style={{ margin: 0 }}>Mój grafik</h2><span className="sp" /><button className="btn p s" onClick={() => evForm()}><Ic n="plus" s={14} /> Dodaj zajęcia</button></div><p className="hint" style={{ margin: "-6px 0 14px" }}>Szkoła, zajęcia dodatkowe i korepetycje spoza TutorTrack. Grafik jest zapisany na Twoim koncie.</p></>;
    if (!d!.events.length) return <>{head}<div className="card"><Empty icon="cal" title="Brak własnych zajęć" sub="Dodaj szkołę, stałe zajęcia lub lekcje u innych korepetytorów." /></div></>;
    const row = (e: Ev) => <div className="row" key={e.id}><div className="m"><b>{e.start}–{e.end} · {e.title}</b><span>{CATS[e.cat] || "Inne"}{e.repeat === "o" ? " · " + fd(e.date) : ""}</span></div>{e.repeat === "o" && e.date < ymd(new Date()) && <span className="tag">Minęło</span>}<div className="acts"><button className="btn s" onClick={() => evForm(e)}>Edytuj</button><button className="btn s d" onClick={() => ov.confirm({ title: "Usunąć zajęcia?", text: "Zajęcia znikną z Twojego grafiku.", ok: "Usuń", danger: true, onOk: () => { run(() => api("DELETE", "/api/student/events/" + e.id), "Usunięto zajęcia."); } })}>Usuń</button></div></div>;
    const W = d!.events.filter((e) => e.repeat === "w"), O = d!.events.filter((e) => e.repeat === "o").sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return <>{head}
      {W.length > 0 && <div className="card"><h2>Co tydzień</h2>{WDL.map((n, i) => { const x = W.filter((e) => e.weekday === i).sort((a, b) => a.start.localeCompare(b.start)); return x.length ? <div key={i}><h3 style={{ margin: "10px 0 0", fontSize: 15 }}>{n}</h3>{x.map(row)}</div> : null; })}</div>}
      {O.length > 0 && <div className="card" style={{ marginTop: 16 }}><h2>Jednorazowe</h2>{O.map(row)}</div>}</>;
  }
  function Hw() {
    const fb = (v: typeof hf, t: string) => <button className={"btn s" + (hf === v ? " p" : "")} aria-pressed={hf === v} onClick={() => setHf(v)}>{t}</button>;
    const X = all.filter((l) => l.hw && (hf === "all" || (hf === "done") === done.has(l.id))).sort((a, b) => { const x = a.hd || a.date, y = b.hd || b.date; return hf === "done" ? y.localeCompare(x) : x.localeCompare(y); });
    return <><div className="bar"><h2 style={{ margin: 0 }}>Prace domowe</h2><span className="sp" />{fb("todo", "Do zrobienia")}{fb("done", "Zrobione")}{fb("all", "Wszystkie")}</div>
      {!X.length ? <div className="card"><Empty icon="check" title={hf === "todo" ? "Nic do zrobienia" : "Brak zadań"} sub={hf === "todo" ? "Wszystkie prace domowe są zrobione albo korepetytor nie przesłał jeszcze zadań." : "Tu pojawią się prace domowe od korepetytorów."} /></div>
        : <div className="card">{X.map((l) => { const dn = done.has(l.id); return <div className="row" key={l.id}><div className="m"><b className="pre">{l.hw}</b><span>{l.subject || "Lekcja"} · {l.tutor} · lekcja {fd(l.date)}</span></div><div>{due(l)}</div><button className={"btn s" + (dn ? "" : " p")} onClick={() => toggleHw(l.id)}>{dn ? "Cofnij" : "Zrobione"}</button></div>; })}</div>}</>;
  }
  function Sum() {
    const L = all.filter((l) => l.date.slice(0, 7) === m), dn = L.filter((l) => l.status === "done"), cn = L.filter((l) => l.status === "cancelled"), pl = L.filter((l) => l.status === "planned");
    const min = dn.reduce((t, l) => t + l.min, 0), bil = L.filter((l) => l.status === "done" || (l.status === "cancelled" && l.amount > 0)), tot = bil.reduce((t, l) => t + l.amount, 0), paid = bil.reduce((t, l) => t + (l.paid ? l.amount : 0), 0), hw = L.filter((l) => l.hw);
    const bs: Record<string, number> = {}; dn.forEach((l) => { const k = l.subject || "—"; bs[k] = (bs[k] || 0) + l.min; });
    const e = Object.entries(bs).sort((a, b) => b[1] - a[1]), mx = e.length ? e[0][1] : 1;
    const head = <div className="bar"><h2 style={{ margin: 0 }}>Podsumowanie miesiąca</h2><span className="sp" /><input type="month" value={m} aria-label="Miesiąc" onChange={(x) => x.target.value && setM(x.target.value)} /></div>;
    if (!L.length) return <>{head}<div className="card"><Empty icon="chart" title="Brak lekcji w tym miesiącu" sub="Wybierz inny miesiąc albo dodaj kod od korepetytora." /></div></>;
    const byDate = (a: L, b: L) => (a.date + a.time).localeCompare(b.date + b.time);
    return <>{head}
      <div className="grid g4"><div className="card stat"><div className="l">Przeprowadzone lekcje</div><div className="v">{dn.length}</div></div><div className="card stat"><div className="l">Czas nauki</div><div className="v">{fmtH(min)}</div></div><div className="card stat"><div className="l">Odwołane</div><div className="v am">{cn.length}</div></div><div className="card stat"><div className="l">Prace domowe</div><div className="v">{hw.filter((l) => done.has(l.id)).length} / {hw.length}</div></div></div>
      {tot > 0 && <div className="grid g4" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 16 }}><div className="card stat"><div className="l">Kwota za lekcje</div><div className="v">{pln(tot)}</div></div><div className="card stat"><div className="l">Opłacone</div><div className="v gr">{pln(paid)}</div></div><div className="card stat"><div className="l">Do zapłaty</div><div className="v am">{pln(tot - paid)}</div></div></div>}
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Czas nauki według przedmiotu</h2>{e.length ? e.map((x) => <div className="bl" key={x[0]}><span>{x[0]}</span><b>{fmtH(x[1])}</b><div className="bb"><i style={{ width: Math.round(x[1] / mx * 100) + "%" }} /></div></div>) : <p className="hint">Brak danych w wybranym okresie.</p>}</div>
        <div className="card"><h2>Zaplanowane</h2>{pl.length ? pl.sort(byDate).map((l) => <div className="row" key={l.id}><div className="m"><b>{fd(l.date)}, {l.time}</b><span>{l.subject || "Lekcja"} · {l.tutor}</span></div></div>) : <p className="hint">Brak zaplanowanych lekcji w tym miesiącu.</p>}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h2>Lekcje i notatki</h2>{[...dn, ...cn].sort(byDate).map((l) => <div className="row" key={l.id}><div className="m"><b>{fd(l.date)}, {l.time} · {l.subject || "Lekcja"}</b><span>{l.tutor}{l.topic ? " · Temat: " + l.topic : ""}</span>{l.notes && <span className="pre" style={{ display: "block", color: "var(--tx)" }}>{l.notes}</span>}</div><div>{tags(l)}</div></div>)}</div>
    </>;
  }

  return <>
    <header className="ph"><div className="pi phi"><a className="logo" href="/uczen"><i><Logo /></i>TutorTrack</a><span className="hint hide-sm">Panel ucznia</span>
      <span className="hint" style={{ marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{user!.name}</span>{user!.isAdmin && <a className="btn s" href="/admin">Admin</a>}<button className="btn s" onClick={out}>Wyloguj</button></div></header>
    <div className="pi">
      <nav className="utabs" aria-label="Sekcje panelu ucznia">{TABS.map((x) => <button key={x[0]} className={"btn s" + (tab === x[0] ? " p" : "")} aria-current={tab === x[0] ? "page" : undefined} onClick={() => { setTab(x[0]); window.scrollTo(0, 0); }}>{x[1]}{x[0] === "hw" && nT > 0 && <> <span className="tag am">{nT}</span></>}</button>)}</nav>
      {err && <div className="nt">{err} <button className="btn s" onClick={load}>Spróbuj ponownie</button></div>}
      <main style={{ paddingBottom: 48 }}>{!d ? <p className="hint">Ładowanie…</p> : tab === "plan" ? Plan() : tab === "graf" ? Graf() : tab === "hw" ? Hw() : tab === "sum" ? Sum() : tab === "kor" ? <KorTab d={d} load={load} run={run} /> : <KontoTab out={out} />}</main>
    </div>
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
        <form className="bar" style={{ margin: 0 }} onSubmit={(x) => { x.preventDefault(); add(); }}><input value={code} onChange={(x) => setCode(x.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} aria-label="Kod dostępu" aria-describedby="e_ucode" style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", letterSpacing: 1 }} /><button className="btn p" type="submit" disabled={busy}>Dodaj kod</button></form>
        <div className="er" id="e_ucode" role="alert" style={{ color: "var(--rd)", fontSize: 13, marginTop: 6 }}>{e}</div></div>
      <div className="card" style={{ marginTop: 16 }}><h2>Twoi korepetytorzy</h2>
        {d.links.length ? d.links.map((k) => <div className="row" key={k.sid}><div className="av">{(k.tutor || "K").charAt(0).toUpperCase()}</div><div className="m"><b>{k.tutor}</b><span>{k.subject} · lekcji: {k.lessons.length}</span></div>
          <button className="btn s d" onClick={() => ov.confirm({ title: "Odłączyć korepetytora?", text: "Lekcje, notatki i zadania od tego korepetytora znikną z Twojego panelu. Aby połączyć się ponownie, poproś korepetytora o nowy kod.", ok: "Odłącz", danger: true, onOk: () => { run(() => api("DELETE", "/api/student/link/" + k.sid), "Odłączono korepetytora."); } })}>Odłącz</button></div>)
          : <p className="hint">Nie połączono jeszcze żadnego korepetytora.</p>}</div>
      <p className="hint" style={{ marginTop: 12 }}>Twoje lekcje widzisz tylko Ty i korepetytor, który je prowadzi. Wszystkie funkcje dla ucznia są bezpłatne.</p></>;
  }

function KontoTab({ out }: { out: () => void }) {
  const ov = useOverlay();
  const { user, logout } = useAuth();
    const [name, setName] = useState(user!.name), [e, setE] = useState("");
    const { updateMe, setUser } = useAuth();
    return <div className="grid" style={{ gap: 16 }}>
      <div className="card"><h2>Profil</h2><Field id="sn2" label="Imię" value={name} onChange={setName} error={e} /><p className="hint" style={{ margin: "4px 0 16px" }}>E-mail: {user!.email}</p>
        <button className="btn p" onClick={async () => { if (!name.trim()) { setE("Podaj imię."); return; } try { await updateMe({ name: name.trim() }); setE(""); ov.toast("Profil zapisany."); } catch (x) { ov.toast(errMsg(x)); } }}>Zapisz profil</button></div>
      <div className="card"><h2>Konto i bezpieczeństwo</h2><div className="acts"><button className="btn" onClick={() => ov.modal(<ChangePassword />)}>Zmień hasło</button><button className="btn" onClick={out}>Wyloguj się</button><button className="btn d" onClick={() => ov.modal(<DeleteAccount onDone={() => { setUser(null); logout(); }} />)}>Usuń konto</button></div></div>
    </div>;
  }

function CancelRequestForm({ l, onSent }: { l: L; onSent: () => Promise<void> }) {
  const { close, toast } = useOverlay();
  const [reason, setReason] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const send = async () => {
    if (reason.trim().length < 3) { setErr("Napisz krótko przyczynę odwołania."); return; }
    setBusy(true);
    try { await api("POST", `/api/student/lessons/${l.id}/cancel-request`, { reason: reason.trim() }); close(); toast("Prośba wysłana do korepetytora."); await onSent(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return <>
    <h2>Odwołać lekcję?</h2>
    <p className="hint" style={{ margin: "-6px 0 10px" }}>{l.subject || "Lekcja"} · {l.tutor} · {fd(l.date)}, {l.time}–{te(l.time, l.min)}</p>
    <div className="f"><label htmlFor="crr">Przyczyna odwołania *</label><textarea id="crr" rows={3} maxLength={500} placeholder="Np. Jestem chory, mam sprawdzian w szkole, wyjazd rodzinny…" value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="e_crr" />
      <div className="er" id="e_crr" role="alert" style={{ color: "var(--rd)", fontSize: 12 }}>{err}</div></div>
    <p className="hint">Korepetytor musi potwierdzić odwołanie. Zgodnie z waszymi ustaleniami może naliczyć opłatę za odwołanie. Do czasu decyzji możesz wycofać prośbę.</p>
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" disabled={busy} onClick={send}>Wyślij prośbę</button></div>
  </>;
}

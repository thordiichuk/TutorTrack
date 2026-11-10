import { ReactNode, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Empty, Ic, Logo } from "../lib/icons";
import { addDays, copyText, fd, fm, fmtH, lekcje, MLONG, MSHORT, pd, pln, printText, shareText, te, WDL, ym, ymd } from "../lib/util";
import { useAuth } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { ChangePassword, DeleteAccount } from "../app/Views";
import { navigate } from "../lib/router";
import { ThemePicker } from "../ui/themes";
import { LangPicker, langName } from "../ui/lang";
import { tr } from "../lib/i18n";

type PLesson = { id: string; sid: string; tutor: string; date: string; time: string; min: number; subject: string; topic: string; status: "planned" | "done" | "cancelled"; notes: string; hw: string; hd: string; hwDone: boolean; amount: number; paid: boolean };
type Tutor = { sid: string; tutor: string; subject: string; contact: { email: string; phone: string } };
type Ev = { id: string; title: string; cat: string; repeat: "w" | "o"; weekday: number; date: string; start: string; end: string };
type Child = { cid: string; name: string; tutors: Tutor[]; lessons: PLesson[]; events: Ev[] };
type Data = { children: Child[] };

const TABS: [string, string, string][] = [["dash", tr("Pulpit"), "home"], ["plan", tr("Plan§sched"), "cal"], ["lek", tr("Lekcje"), "book"], ["pay", tr("Płatności"), "wallet"], ["konto", tr("Ustawienia"), "set"]];
const CATS: Record<string, string> = { school: tr("Szkoła"), tutor: tr("Korepetycje spoza TutorTrack"), extra: tr("Zajęcia dodatkowe"), other: tr("Inne") };
const key = (l: PLesson) => l.date + " " + l.time;
const sdate = (d: string) => pd(d).getDate() + " " + MSHORT[pd(d).getMonth()];
/** Lessons the tutor bills: done ones and cancellations with a fee. */
const billable = (l: PLesson) => l.status === "done" || (l.status === "cancelled" && l.amount > 0);

/** Form for the 16-character code the tutor gives to the parent. */
function AddCode({ onDone }: { onDone: () => Promise<void> }) {
  const ov = useOverlay();
  const [code, setCode] = useState(""), [e, setE] = useState(""), [busy, setBusy] = useState(false);
  const add = async () => {
    const n = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (n.length !== 16) { setE(tr("Kod ma 16 znaków (litery i cyfry), np. ABCD-EFGH-JKLM-NPQR.")); return; }
    setBusy(true);
    try { await api("POST", "/api/parent/link", { code }); setCode(""); setE(""); await onDone(); ov.toast(tr("Połączono z kontem dziecka.")); } catch (x) { setE(errMsg(x)); } finally { setBusy(false); }
  };
  return <div className="card"><h2>{tr("Dodaj kod od dziecka")}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Dziecko tworzy kod (16 znaków) w swoim panelu ucznia: Ustawienia → Dostęp dla rodzica. Po jego wpisaniu zobaczysz lekcje od wszystkich korepetytorów, zadania, płatności i plan zajęć.")}</p>
    <form className="bar" style={{ margin: 0 }} onSubmit={(x) => { x.preventDefault(); add(); }}><input id="pcode" value={code} onChange={(x) => setCode(x.target.value)} placeholder={tr("XXXX-XXXX-XXXX-XXXX")} autoComplete="off" spellCheck={false} aria-label={tr("Kod od dziecka")} aria-describedby="e_pcode" style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", letterSpacing: 1 }} /><button className="btn p" type="submit" disabled={busy}>{tr("Dodaj kod")}</button></form>
    <div className="er" id="e_pcode" role="alert" style={{ color: "var(--rd)", fontSize: 13, marginTop: 6 }}>{e}</div></div>;
}

export function ParentPanel() {
  const { user, logout } = useAuth();
  const ov = useOverlay();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("dash");
  const [ci, setCi] = useState(0);
  const [lv, setLv] = useState<"up" | "past">("up");
  const [m, setM] = useState(ym(new Date()));
  const [wk, setWk] = useState(0);

  const load = useCallback(async () => {
    try { setD(await api<Data>("GET", "/api/parent/data")); setErr(""); } catch (e) { setErr(errMsg(e)); }
  }, []);
  useEffect(() => {
    load();
    const f = () => { if (document.visibilityState === "visible") load(); };
    const t = setInterval(f, 60000);
    document.addEventListener("visibilitychange", f);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", f); };
  }, [load]);
  const cur = TABS.find((x) => x[0] === tab)!;
  useEffect(() => { document.title = cur[1] + tr(" – TutorTrack"); }, [cur]);
  const go = (t: string) => { setTab(t); window.scrollTo(0, 0); };
  const out = () => ov.confirm({ title: tr("Wylogować się?"), text: tr("Twoje dane są bezpiecznie zapisane na koncie."), ok: tr("Wyloguj się"), onOk: logout });

  const kids = d?.children || [];
  const c: Child | undefined = kids[Math.min(ci, kids.length - 1)];
  const ls = c?.lessons || [];
  const contact = (sid: string) => c?.tutors.find((t) => t.sid === sid)?.contact;
  const first = (n: string) => (n || "").split(" ")[0];

  const tags = (l: PLesson) => <>
    {l.status === "planned" && <span className="tag ac">{tr("Zaplanowana")}</span>}{l.status === "done" && <span className="tag gr">{tr("Przeprowadzona")}</span>}{l.status === "cancelled" && <span className="tag rd">{tr("Odwołana")}</span>}{" "}
    {l.notes && <><span className="tag gr">{tr("Notatka")}</span>{" "}</>}{l.hw && (l.hwDone ? <span className="tag gr">{tr("Zadanie zrobione")}</span> : <span className="tag am">{tr("Zadanie niezrobione")}</span>)}</>;
  const lessonModal = (l: PLesson) => ov.modal(<><h2>{l.subject || tr("Lekcja")}</h2><p className="hint" style={{ margin: "-6px 0 10px" }}>{l.tutor} · {fd(l.date)}, {l.time}–{te(l.time, l.min)} ({l.min}{" "}{tr("min)")}</p>
    <div style={{ marginBottom: 12 }}>{tags(l)}</div>{l.topic && <p><b>{tr("Temat:")}</b> {l.topic}</p>}
    {l.status === "done" && <><h3 style={{ margin: "12px 0 4px", fontSize: 15 }}>{tr("Notatka po lekcji")}</h3><p className="pre" style={{ margin: 0 }}>{l.notes || <span className="hint">{tr("Brak notatki.")}</span>}</p></>}
    {l.hw && <><h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>{tr("Praca domowa")}</h3><p className="pre" style={{ margin: "0 0 6px" }}>{l.hw}</p>{l.hd && <span className="tag">{tr("Termin: ")}{fd(l.hd)}</span>}</>}
    {(l.amount > 0 || l.status !== "cancelled") && <p className="hint" style={{ marginTop: 14 }}>{tr("Kwota:")}{" "}{pln(l.amount)}{l.status === "planned" ? "" : l.paid ? tr(" · opłacona") : tr(" · nieopłacona")}</p>}
    {(() => { const k = contact(l.sid); return k && (k.email || k.phone) ? <p className="ktc" style={{ marginTop: 10 }}>{k.email && <a href={"mailto:" + k.email}>✉️ {k.email}</a>}{k.phone && <a href={"tel:" + k.phone.replace(/\s/g, "")}>📞 {k.phone}</a>}</p> : null; })()}
    <div className="mf"><button className="btn p" onClick={ov.close}>{tr("Zamknij")}</button></div></>);
  const multi = (c?.tutors.length || 0) > 1;
  const TD = ymd(new Date());
  const lrow = (l: PLesson) => <button type="button" key={l.id} className={"srow" + (l.status === "cancelled" ? " cx" : "") + (l.date === TD ? " tday" : "")} onClick={() => lessonModal(l)}>
    <span className="tm">{sdate(l.date)}<small>{l.time}</small></span><span className="sb" />
    <span className="m"><b>{l.subject || tr("Lekcja")}{l.topic ? " · " + l.topic : ""}</b><span>{multi ? l.tutor + " · " : ""}{l.status === "done" ? l.notes || tr("bez notatki") : l.status === "cancelled" ? tr("Odwołana") : l.min + " " + tr("min")}</span></span>
    {l.status === "planned" ? null : billable(l) ? l.paid ? <span className="tag gr">{tr("Opłacona")}</span> : <span className="tag am">{pln(l.amount).replace(",00", "")}</span> : null}</button>;

  const switcher = kids.length > 1 && <div className="pkids" role="group" aria-label={tr("Dziecko")}>{kids.map((k, i) => <button key={k.cid} type="button" className={"chip" + (k === c ? " on" : "")} aria-pressed={k === c} onClick={() => setCi(i)}>{k.name}</button>)}</div>;
  const noTutors = c && !c.tutors.length && <div className="nt">{tr("{0} nie ma jeszcze połączonych korepetytorów w TutorTrack. Lekcje pojawią się tu same, gdy dziecko wpisze kod od korepetytora.", c.name)}</div>;

  function Dash() {
    const now = new Date(), td = ymd(now), nowKey = td + " " + now.toTimeString().slice(0, 5);
    const up = ls.filter((l) => l.status === "planned" && key(l) >= nowKey).sort((a, b) => key(a).localeCompare(key(b)));
    const next = up[0];
    const mo = ls.filter((l) => l.date.slice(0, 7) === ym(now));
    const owe = ls.filter((l) => billable(l) && !l.paid);
    const doneM = mo.filter((l) => l.status === "done");
    const notes = ls.filter((l) => l.status === "done" && (l.notes || l.hw)).sort((a, b) => key(b).localeCompare(key(a))).slice(0, 4);
    return <>
      <div className="bar"><div><h2 style={{ fontSize: 22, margin: 0 }}>{tr("Cześć,")}{" "}{first(user!.name)}!</h2><span className="hint">{WDL[(now.getDay() + 6) % 7]}, {fd(td).split(", ")[1]}</span></div></div>
      {!kids.length ? <AddCode onDone={load} /> : <>
        {switcher}
        <>{noTutors}
          <div className="bento">
            {next ? <button type="button" className="shero w2" onClick={() => lessonModal(next)}>
                <span className="hl"><span>{tr("Najbliższa lekcja ·")}{" "}{next.date === td ? tr("dziś") : next.date === addDays(1) ? tr("jutro") : WDL[(pd(next.date).getDay() + 6) % 7].toLowerCase()}</span><span>{next.tutor}</span></span>
                <span className="hv">{next.subject || tr("Lekcja")} · {next.time}</span>
                <span className="hp"><span>{sdate(next.date)}</span><span>{next.min}{" "}{tr("min")}</span>{next.topic && <span>{next.topic}</span>}</span></button>
              : <div className="shero w2" style={{ cursor: "default" }}><span className="hl"><span>{tr("Najbliższa lekcja")}</span><span>{c!.name}</span></span><span className="hv">{tr("Brak zaplanowanych")}</span></div>}
            <button type="button" className="tile tl3" onClick={() => go("pay")}><div className="l">{tr("Do zapłaty")}</div><div className="v">{pln(owe.reduce((t, l) => t + l.amount, 0)).replace(",00", "")}</div><small>{owe.length ? lekcje(owe.length) : tr("wszystko opłacone")}</small></button>
            <div className="tile tl2"><div className="l">{tr("Lekcje w miesiącu")}</div><div className="v">{doneM.length}</div><small>{fmtH(doneM.reduce((t, l) => t + l.min, 0))}{" "}{tr("nauki")}</small></div>
          </div>
          <div className="bento" style={{ marginTop: 12 }}>
            <div className="card w2"><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><h2 style={{ margin: 0 }}>{tr("Najbliższe lekcje")}</h2><span style={{ flex: 1 }} />{up.length > 4 && <button className="btn s" onClick={() => { setLv("up"); go("lek"); }}>{tr("Wszystkie (")}{up.length})</button>}</div>
              {up.length ? up.slice(0, 4).map(lrow) : <p className="hint" style={{ margin: 0 }}>{tr("Brak zaplanowanych lekcji.")}</p>}</div>
            <div className="card w2"><h2>{tr("Ostatnie notatki i zadania")}</h2>{notes.length ? notes.map((l) => <button type="button" key={l.id} className="srow" onClick={() => lessonModal(l)}><span className="tm">{sdate(l.date)}<small>{l.time}</small></span><span className="sb" /><span className="m"><b>{l.subject || tr("Lekcja")}{l.topic ? " · " + l.topic : ""}</b><span>{l.notes || tr("Zadanie: ") + l.hw}</span></span>{l.hw && (l.hwDone ? <span className="tag gr">{tr("Zrobione")}</span> : <span className="tag am">{tr("Zadanie")}</span>)}</button>) : <p className="hint" style={{ margin: 0 }}>{tr("Tu pojawią się notatki korepetytora po lekcjach.")}</p>}</div>
          </div>
        </>
      </>}
    </>;
  }

  function Lek() {
    const nowKey = ymd(new Date()) + " " + new Date().toTimeString().slice(0, 5);
    const list = lv === "up" ? ls.filter((l) => l.status === "planned" && key(l) >= nowKey).sort((a, b) => key(a).localeCompare(key(b)))
      : ls.filter((l) => !(l.status === "planned" && key(l) >= nowKey)).sort((a, b) => key(b).localeCompare(key(a)));
    const groups: [string, PLesson[]][] = [];
    list.forEach((l) => { const k = l.date.slice(0, 7); const g = groups[groups.length - 1]; if (g && g[0] === k) g[1].push(l); else groups.push([k, [l]]); });
    return <>{switcher}<>{noTutors}
      <div className="seg stseg" role="group" aria-label={tr("Pokaż lekcje")}>{([["up", tr("Nadchodzące")], ["past", tr("Minione")]] as const).map(([k, t]) => <button key={k} aria-pressed={lv === k} onClick={() => setLv(k)}>{t}</button>)}</div>
      {groups.length ? groups.map(([k, g]) => { const [y, mo] = k.split("-").map(Number); return <div key={k} style={{ marginTop: 14 }}><div className="pmh"><b>{MLONG[mo - 1].charAt(0).toUpperCase() + MLONG[mo - 1].slice(1)} {y}</b><span>{lekcje(g.length)}</span></div><div className="card" style={{ padding: "4px 14px" }}>{g.map(lrow)}</div></div>; })
        : <div className="card" style={{ marginTop: 14 }}><Empty icon="cal" title={lv === "up" ? tr("Brak zaplanowanych lekcji") : tr("Brak minionych lekcji")} sub={tr("Lekcje dodaje korepetytor.")} /></div>}
    </></>;
  }

  function Pay() {
    const L = ls.filter((l) => l.date.slice(0, 7) === m && billable(l)).sort((a, b) => key(a).localeCompare(key(b)));
    const tot = L.reduce((t, l) => t + l.amount, 0), paid = L.reduce((t, l) => t + (l.paid ? l.amount : 0), 0);
    const oweAll = ls.filter((l) => billable(l) && !l.paid), oweOld = oweAll.filter((l) => l.date.slice(0, 7) < m);
    const shiftM = (k: number) => { const [y, mo] = m.split("-").map(Number); setM(ym(new Date(y, mo - 1 + k, 1))); };
    const mt = fm(m);
    const tutorsM = c!.tutors.filter((t) => L.some((l) => l.sid === t.sid));
    const summary = (t: Tutor) => {
      const TL = L.filter((l) => l.sid === t.sid), tt = TL.reduce((x, l) => x + l.amount, 0), tp = TL.reduce((x, l) => x + (l.paid ? l.amount : 0), 0);
      const T = [tr("Podsumowanie lekcji – ") + mt, tr("Korepetytor: ") + t.tutor, tr("Uczeń: ") + c!.name, ""];
      TL.forEach((l) => T.push("• " + sdate(l.date) + ", " + l.time + " – " + (l.subject ? l.subject + ": " : "") + (l.status === "cancelled" ? tr("odwołana lekcja") : l.topic || tr("lekcja")) + " (" + l.min + tr(" min): ") + pln(l.amount) + (l.paid ? tr(" (opłacona)") : "")));
      T.push("", tr("Razem: ") + pln(tt), tr("Opłacone: ") + pln(tp), tr("Do zapłaty: ") + pln(tt - tp));
      const txt = T.join("\n");
      ov.modal(<><h2>{tr("Podsumowanie –")}{" "}{mt}</h2><p className="hint">{t.tutor}</p><textarea rows={11} readOnly value={txt} />
        <div className="mf"><button className="btn" onClick={ov.close}>{tr("Zamknij")}</button><button className="btn only-m" onClick={() => shareText(tr("Podsumowanie lekcji – ") + mt, txt)}>{tr("Udostępnij")}</button><button className="btn no-m" onClick={() => printText(tr("Podsumowanie lekcji – ") + mt, txt)}>{tr("Drukuj / PDF")}</button>
          <button className="btn p" onClick={async () => ov.toast((await copyText(txt)) ? tr("Skopiowano.") : tr("Zaznacz tekst i skopiuj go ręcznie."))}>{tr("Kopiuj")}</button></div></>);
    };
    return <>{switcher}<>{noTutors}
      <div className="bar"><div className="mpick" role="group" aria-label={tr("Miesiąc")}><button type="button" aria-label={tr("Poprzedni miesiąc")} onClick={() => shiftM(-1)}>‹</button><span aria-live="polite">{mt.charAt(0).toUpperCase() + mt.slice(1)}</span><button type="button" aria-label={tr("Następny miesiąc")} onClick={() => shiftM(1)}>›</button></div></div>
      {oweOld.length > 0 && <div className="nt">{tr("Nieopłacone lekcje z wcześniejszych miesięcy:")}{" "}<b>{lekcje(oweOld.length)}</b>{" · "}<b>{pln(oweOld.reduce((t, l) => t + l.amount, 0))}</b></div>}
      <div className="card bsum"><div className="l">{tr("Należności ·")}{" "}{mt}</div><div className="bv">{pln(tot).replace(",00", "")}</div>
        <div className="pbar" aria-hidden="true" style={{ margin: "10px 0 12px" }}><i style={{ width: (tot ? Math.round(paid / tot * 100) : 0) + "%", background: "var(--gr)" }} /></div>
        <div className="bsr"><div><div className="l">{tr("Opłacone")}</div><b className="gr">{pln(paid).replace(",00", "")}</b></div><div><div className="l">{tr("Do zapłaty")}</div><b className="am">{pln(tot - paid).replace(",00", "")}</b></div><div><div className="l">{tr("Lekcje")}</div><b>{L.length}</b></div></div></div>
      {!L.length ? <div className="card" style={{ marginTop: 16 }}><p className="hint" style={{ margin: 0 }}>{tr("Brak przeprowadzonych lekcji w tym miesiącu.")}</p></div>
        : tutorsM.map((t) => { const TL = L.filter((l) => l.sid === t.sid), tt = TL.reduce((x, l) => x + l.amount, 0), tp = TL.reduce((x, l) => x + (l.paid ? l.amount : 0), 0);
          return <div className="card" style={{ marginTop: 16 }} key={t.sid}>
            <div className="ptut"><div><h2 style={{ margin: 0 }}>{t.tutor}</h2><span className="hint">{lekcje(TL.length)}{" · "}{tr("razem")}{" "}{pln(tt).replace(",00", "")}</span></div>{tt - tp > 0 ? <b className="am">{pln(tt - tp).replace(",00", "")}</b> : <span className="tag gr">{tr("rozliczone")}</span>}</div>
            {TL.map(lrow)}
            <div className="acts" style={{ marginTop: 10 }}><button className="btn" onClick={() => summary(t)}>{tr("Podsumowanie do wysłania")}</button></div></div>; })}
      <p className="hint" style={{ marginTop: 12 }}>{tr("Status płatności zaznacza korepetytor. Płatności odbywają się bezpośrednio między Tobą a korepetytorem.")}</p>
    </></>;
  }

  function Plan() {
    const td = ymd(new Date());
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + wk * 7);
    const days = [...Array(7)].map((_, i) => { const x = new Date(mon); x.setDate(x.getDate() + i); return ymd(x); });
    const label = sdate(days[0]) + " – " + sdate(days[6]);
    return <>{switcher}{noTutors}
      <div className="pwk"><div className="mpick" role="group" aria-label={tr("Tydzień")}><button type="button" aria-label={tr("Poprzedni tydzień")} onClick={() => setWk(wk - 1)}>‹</button><span aria-live="polite">{label}</span><button type="button" aria-label={tr("Następny tydzień")} onClick={() => setWk(wk + 1)}>›</button></div>{wk !== 0 && <button className="btn s" onClick={() => setWk(0)}>{tr("Dziś")}</button>}</div>
      {days.map((dd, i) => {
        const items = [
          ...ls.filter((l) => l.date === dd).map((l) => ({ s: l.time, e: te(l.time, l.min), l })),
          ...c!.events.filter((e) => (e.repeat === "w" ? e.weekday === i : e.date === dd)).map((e) => ({ s: e.start, e: e.end, ev: e })),
        ].sort((a, b) => a.s.localeCompare(b.s));
        return <section key={dd} className={"dgrp pdg" + (dd === td ? " today" : "")} style={{ marginTop: 12 }}><div className={"dgh" + (dd === td ? " td" : "")}><b>{dd === td ? tr("Dziś") : WDL[i]}</b>{dd === td && <i className="tdtag">{tr("dzisiaj")}</i>}<span>{sdate(dd)}</span></div>
          <div className="card dgl" style={{ padding: "4px 14px" }}>{items.length ? items.map((x, k) => "l" in x && x.l
            ? <button type="button" key={k} className={"srow" + (x.l.status === "cancelled" ? " cx" : "")} onClick={() => lessonModal(x.l!)}><span className="tm">{x.s}<small>{x.e}</small></span><span className="sb" /><span className="m"><b>{x.l.subject || tr("Lekcja")}{x.l.topic ? " · " + x.l.topic : ""}</b><span>{x.l.tutor}</span></span>{x.l.status === "cancelled" && <span className="tag rd">{tr("Odwołana")}</span>}</button>
            : <div key={k} className="srow" style={{ cursor: "default" }}><span className="tm">{x.s}<small>{x.e}</small></span><span className="sb o" /><span className="m"><b>{(x as any).ev.title}</b><span>{CATS[(x as any).ev.cat] || tr("Inne")}</span></span></div>)
            : <p className="hint" style={{ margin: "10px 0" }}>{tr("Brak zajęć.")}</p>}</div></section>;
      })}
      <p className="hint" style={{ marginTop: 12 }}><span className="sb" style={{ display: "inline-block", width: 4, height: 12, verticalAlign: "middle", marginRight: 6 }} />{tr("lekcje od korepetytorów")}{"  "}<span className="sb o" style={{ display: "inline-block", width: 4, height: 12, verticalAlign: "middle", margin: "0 6px 0 12px" }} />{tr("własne zajęcia dziecka")}</p>
    </>;
  }

  return <>
    <div className="app">
      <aside className="side" aria-label={tr("Menu rodzica")}>
        <div className="logo"><i><Logo /></i>{tr("TutorTrack")}</div>
        <div>{TABS.map((x) => <button key={x[0]} className={"nav" + (tab === x[0] ? " on" : "")} aria-current={tab === x[0] ? "page" : undefined} onClick={() => go(x[0])}><Ic n={x[2]} />{x[1]}</button>)}
          {user!.isAdmin && <button className="nav" onClick={() => navigate("/admin")}><Ic n="alert" />{tr("Panel administratora")}</button>}
          <button className="nav" onClick={out}><Ic n="out" />{tr("Wyloguj się")}</button></div>
      </aside>
      <div className="main">
        <header className="top">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><a className="brandm" href="/" aria-label={tr("TutorTrack")}><span className="logo" style={{ padding: 0 }}><i><Logo /></i></span></a><div><h1>{cur[1]}</h1><small /></div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="hint" id="usr">{user!.name}</span></div>
        </header>
        {err && <p className="banner">{err} <button className="lk" onClick={load}>{tr("Spróbuj ponownie")}</button></p>}
        <main className="content">{!d ? <p className="hint">{tr("Ładowanie…")}</p> : tab === "konto" ? <KontoTab d={d} load={load} out={out} /> : !kids.length && tab !== "dash" ? <AddCode onDone={load} /> : tab === "dash" ? Dash() : tab === "plan" ? Plan() : tab === "lek" ? Lek() : Pay()}</main>
      </div>
    </div>
    <nav className="tabs fit" aria-label={tr("Menu")}>{TABS.map((x) => <button key={x[0]} className={tab === x[0] ? "on" : ""} aria-current={tab === x[0] ? "page" : undefined} onClick={() => go(x[0])}><Ic n={x[2]} s={22} />{x[1]}</button>)}</nav>
  </>;
}

function KontoTab({ d, load, out }: { d: Data; load: () => Promise<void>; out: () => void }) {
  const ov = useOverlay();
  const { user, logout, updateMe, setUser } = useAuth();
  const [name, setName] = useState(user!.name), [e, setE] = useState("");
  const [sec, setSec] = useState("");
  const SEC: Record<string, ReactNode> = {
    profil: <div className="card"><h2>{tr("Profil")}</h2><Field id="pn2" label={tr("Imię")} value={name} onChange={setName} error={e} /><p className="hint" style={{ margin: "4px 0 16px" }}>{tr("E-mail:")}{" "}{user!.email}</p>
      <button className="btn p" onClick={async () => { if (!name.trim()) { setE(tr("Podaj imię.")); return; } try { await updateMe({ name: name.trim() }); setE(""); ov.toast(tr("Profil zapisany.")); } catch (x) { ov.toast(errMsg(x)); } }}>{tr("Zapisz profil")}</button></div>,
    dzieci: <><AddCode onDone={load} />
      <div className="card" style={{ marginTop: 16 }}><h2>{tr("Połączone dzieci")}</h2>
        {d.children.length ? d.children.map((k) => <div className="row" key={k.cid}><div className="av">{(k.name || "?").charAt(0).toUpperCase()}</div><div className="m"><b>{k.name}</b>
          {k.tutors.length ? k.tutors.map((t) => <span key={t.sid} style={{ display: "block" }}>{t.tutor}{t.subject ? " · " + t.subject : ""}{(t.contact.email || t.contact.phone) && <span className="ktc">{t.contact.email && <a href={"mailto:" + t.contact.email}>✉️ {t.contact.email}</a>}{t.contact.phone && <a href={"tel:" + t.contact.phone.replace(/\s/g, "")}>📞 {t.contact.phone}</a>}</span>}</span>) : <span>{tr("Brak połączonych korepetytorów.")}</span>}</div>
          <button className="btn s d" onClick={() => ov.confirm({ title: tr("Odłączyć dziecko?"), text: tr("Lekcje, płatności i plan tego dziecka znikną z Twojego panelu. Aby połączyć się ponownie, poproś dziecko o nowy kod."), ok: tr("Odłącz"), danger: true, onOk: async () => { try { await api("DELETE", "/api/parent/link/" + k.cid); await load(); ov.toast(tr("Odłączono.")); } catch (x) { ov.toast(errMsg(x)); } } })}>{tr("Odłącz")}</button></div>)
          : <p className="hint">{tr("Nie połączono jeszcze żadnego dziecka.")}</p>}</div>
      <p className="hint" style={{ marginTop: 12 }}>{tr("Panel rodzica jest bezpłatny i służy tylko do podglądu – lekcje zmienia korepetytor, a plan zajęć dziecko.")}</p></>,
    wyglad: <ThemePicker />,
    jezyk: <LangPicker />,
    haslo: <div className="card"><h2>{tr("Konto i bezpieczeństwo")}</h2><div className="acts"><button className="btn" onClick={() => ov.modal(<ChangePassword />)}>{tr("Zmień hasło")}</button><button className="btn d" onClick={() => ov.modal(<DeleteAccount onDone={() => { setUser(null); logout(); }} />)}>{tr("Usuń konto")}</button></div></div>,
  };
  if (sec && SEC[sec]) return <div className="ssec">
    <button className="sback" onClick={() => { setSec(""); window.scrollTo(0, 0); }}><Ic n="chevl" s={16} />{tr("Ustawienia")}</button>{SEC[sec]}</div>;
  const I = (k: string, t: string, ic: string, v?: string, fn?: () => void) => <button key={k} className="sitem" onClick={fn || (() => { setSec(k); window.scrollTo(0, 0); })}><span className="sic"><Ic n={ic} s={16} /></span><b>{t}</b>{v != null && <span className="sv">{v}</span>}<Ic n="chev" s={16} /></button>;
  const thName: Record<string, string> = { light: tr("Jasny"), auto: tr("Systemowy"), dark: tr("Ciemny"), graphite: tr("Grafit"), blue: tr("Ocean"), green: tr("Mięta"), pink: tr("Róż"), orange: tr("Zachód słońca"), purple: tr("Lawenda") };
  return <div className="slist">
    <div className="sgrp"><button className="sitem sme" onClick={() => setSec("profil")}><span className="sav">{(user!.name || "?").charAt(0).toUpperCase()}</span><b>{user!.name}<small>{tr("Panel rodzica ·")}{" "}{user!.email}</small></b><Ic n="chev" s={16} /></button></div>
    <div className="sgt">{tr("Konto")}</div>
    <div className="sgrp">{I("dzieci", tr("Dzieci i kody"), "users", String(d.children.length))}{I("haslo", tr("Hasło i bezpieczeństwo"), "lock")}</div>
    <div className="sgt">{tr("Aplikacja")}</div>
    <div className="sgrp">{I("wyglad", tr("Wygląd"), "palette", thName[user!.settings.theme || "light"] || tr("Jasny"))}{I("jezyk", tr("Język"), "globe", langName())}</div>
    {user!.isAdmin && <div className="sgrp" style={{ marginTop: 16 }}>{I("adm", tr("Panel administratora"), "alert", undefined, () => navigate("/admin"))}</div>}
    <button className="slogout" onClick={out}><Ic n="out" s={18} />{tr("Wyloguj się")}</button>
  </div>;
}

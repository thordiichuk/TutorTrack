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

type PLesson = { id: string; date: string; time: string; min: number; subject: string; topic: string; status: "planned" | "done" | "cancelled"; notes: string; hw: string; hd: string; amount: number; paid: boolean };
type Child = { sid: string; name: string; subject: string; tutor: string; locked: boolean; contact: { email: string; phone: string }; lessons: PLesson[] };
type Data = { children: Child[] };

const TABS: [string, string, string][] = [["dash", tr("Pulpit"), "home"], ["lek", tr("Lekcje"), "cal"], ["pay", tr("Płatności"), "wallet"], ["konto", tr("Ustawienia"), "set"]];
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
  return <div className="card"><h2>{tr("Dodaj kod od korepetytora")}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Kod od korepetytora (16 znaków) dostajesz od korepetytora dziecka. Po jego wpisaniu zobaczysz lekcje, notatki i płatności.")}</p>
    <form className="bar" style={{ margin: 0 }} onSubmit={(x) => { x.preventDefault(); add(); }}><input id="pcode" value={code} onChange={(x) => setCode(x.target.value)} placeholder={tr("XXXX-XXXX-XXXX-XXXX")} autoComplete="off" spellCheck={false} aria-label={tr("Kod od korepetytora")} aria-describedby="e_pcode" style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", letterSpacing: 1 }} /><button className="btn p" type="submit" disabled={busy}>{tr("Dodaj kod")}</button></form>
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
  const first = (n: string) => (n || "").split(" ")[0];

  const tags = (l: PLesson) => <>
    {l.status === "planned" && <span className="tag ac">{tr("Zaplanowana")}</span>}{l.status === "done" && <span className="tag gr">{tr("Przeprowadzona")}</span>}{l.status === "cancelled" && <span className="tag rd">{tr("Odwołana")}</span>}{" "}
    {l.notes && <><span className="tag gr">{tr("Notatka")}</span>{" "}</>}{l.hw && <span className="tag am">{tr("Zadanie")}</span>}</>;
  const lessonModal = (l: PLesson) => ov.modal(<><h2>{l.subject || tr("Lekcja")}</h2><p className="hint" style={{ margin: "-6px 0 10px" }}>{c!.name} · {fd(l.date)}, {l.time}–{te(l.time, l.min)} ({l.min}{" "}{tr("min)")}</p>
    <div style={{ marginBottom: 12 }}>{tags(l)}</div>{l.topic && <p><b>{tr("Temat:")}</b> {l.topic}</p>}
    {l.status === "done" && <><h3 style={{ margin: "12px 0 4px", fontSize: 15 }}>{tr("Notatka po lekcji")}</h3><p className="pre" style={{ margin: 0 }}>{l.notes || <span className="hint">{tr("Brak notatki.")}</span>}</p></>}
    {l.hw && <><h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>{tr("Praca domowa")}</h3><p className="pre" style={{ margin: "0 0 6px" }}>{l.hw}</p>{l.hd && <span className="tag">{tr("Termin: ")}{fd(l.hd)}</span>}</>}
    {(l.amount > 0 || l.status !== "cancelled") && <p className="hint" style={{ marginTop: 14 }}>{tr("Kwota:")}{" "}{pln(l.amount)}{l.status === "planned" ? "" : l.paid ? tr(" · opłacona") : tr(" · nieopłacona")}</p>}
    <div className="mf"><button className="btn p" onClick={ov.close}>{tr("Zamknij")}</button></div></>);
  const lrow = (l: PLesson) => <button type="button" key={l.id} className={"srow" + (l.status === "cancelled" ? " cx" : "")} onClick={() => lessonModal(l)}>
    <span className="tm">{sdate(l.date)}<small>{l.time}</small></span><span className="sb" />
    <span className="m"><b>{l.subject || tr("Lekcja")}{l.topic ? " · " + l.topic : ""}</b><span>{l.status === "done" ? l.notes || tr("bez notatki") : l.status === "cancelled" ? tr("Odwołana") : l.min + " " + tr("min")}</span></span>
    {l.status === "planned" ? null : billable(l) ? l.paid ? <span className="tag gr">{tr("Opłacona")}</span> : <span className="tag am">{pln(l.amount).replace(",00", "")}</span> : null}</button>;

  const switcher = kids.length > 1 && <div className="pkids" role="group" aria-label={tr("Dziecko")}>{kids.map((k, i) => <button key={k.sid} type="button" className={"chip" + (k === c ? " on" : "")} aria-pressed={k === c} onClick={() => setCi(i)}>{k.name}</button>)}</div>;
  const locked = <div className="card"><Empty icon="lock" title={tr("Dostęp jest chwilowo wyłączony")} sub={tr("Korepetytor ({0}) nie ma teraz planu Pro, dlatego lekcje dziecka nie są widoczne. Połączenie zostaje – dane pojawią się, gdy korepetytor włączy plan Pro.", c?.tutor || "")} /></div>;

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
        {c!.locked ? locked : <>
          <div className="bento">
            {next ? <button type="button" className="shero w2" onClick={() => lessonModal(next)}>
                <span className="hl"><span>{tr("Najbliższa lekcja ·")}{" "}{next.date === td ? tr("dziś") : next.date === addDays(1) ? tr("jutro") : WDL[(pd(next.date).getDay() + 6) % 7].toLowerCase()}</span><span>{c!.tutor}</span></span>
                <span className="hv">{next.subject || tr("Lekcja")} · {next.time}</span>
                <span className="hp"><span>{sdate(next.date)}</span><span>{next.min}{" "}{tr("min")}</span>{next.topic && <span>{next.topic}</span>}</span></button>
              : <div className="shero w2" style={{ cursor: "default" }}><span className="hl"><span>{tr("Najbliższa lekcja")}</span><span>{c!.tutor}</span></span><span className="hv">{tr("Brak zaplanowanych")}</span></div>}
            <button type="button" className="tile tl3" onClick={() => go("pay")}><div className="l">{tr("Do zapłaty")}</div><div className="v">{pln(owe.reduce((t, l) => t + l.amount, 0)).replace(",00", "")}</div><small>{owe.length ? lekcje(owe.length) : tr("wszystko opłacone")}</small></button>
            <div className="tile tl2"><div className="l">{tr("Lekcje w miesiącu")}</div><div className="v">{doneM.length}</div><small>{fmtH(doneM.reduce((t, l) => t + l.min, 0))}{" "}{tr("nauki")}</small></div>
          </div>
          <div className="bento" style={{ marginTop: 12 }}>
            <div className="card w2"><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><h2 style={{ margin: 0 }}>{tr("Najbliższe lekcje")}</h2><span style={{ flex: 1 }} />{up.length > 4 && <button className="btn s" onClick={() => { setLv("up"); go("lek"); }}>{tr("Wszystkie (")}{up.length})</button>}</div>
              {up.length ? up.slice(0, 4).map(lrow) : <p className="hint" style={{ margin: 0 }}>{tr("Brak zaplanowanych lekcji.")}</p>}</div>
            <div className="card w2"><h2>{tr("Ostatnie notatki i zadania")}</h2>{notes.length ? notes.map((l) => <button type="button" key={l.id} className="srow" onClick={() => lessonModal(l)}><span className="tm">{sdate(l.date)}<small>{l.time}</small></span><span className="sb" /><span className="m"><b>{l.subject || tr("Lekcja")}{l.topic ? " · " + l.topic : ""}</b><span>{l.notes || tr("Zadanie: ") + l.hw}</span></span>{l.hw && <span className="tag am">{tr("Zadanie")}</span>}</button>) : <p className="hint" style={{ margin: 0 }}>{tr("Tu pojawią się notatki korepetytora po lekcjach.")}</p>}</div>
          </div>
        </>}
      </>}
    </>;
  }

  function Lek() {
    const nowKey = ymd(new Date()) + " " + new Date().toTimeString().slice(0, 5);
    const list = lv === "up" ? ls.filter((l) => l.status === "planned" && key(l) >= nowKey).sort((a, b) => key(a).localeCompare(key(b)))
      : ls.filter((l) => !(l.status === "planned" && key(l) >= nowKey)).sort((a, b) => key(b).localeCompare(key(a)));
    const groups: [string, PLesson[]][] = [];
    list.forEach((l) => { const k = l.date.slice(0, 7); const g = groups[groups.length - 1]; if (g && g[0] === k) g[1].push(l); else groups.push([k, [l]]); });
    return <>{switcher}{c!.locked ? locked : <>
      <div className="seg stseg" role="group" aria-label={tr("Pokaż lekcje")}>{([["up", tr("Nadchodzące")], ["past", tr("Minione")]] as const).map(([k, t]) => <button key={k} aria-pressed={lv === k} onClick={() => setLv(k)}>{t}</button>)}</div>
      {groups.length ? groups.map(([k, g]) => { const [y, mo] = k.split("-").map(Number); return <div key={k} style={{ marginTop: 14 }}><div className="pmh"><b>{MLONG[mo - 1].charAt(0).toUpperCase() + MLONG[mo - 1].slice(1)} {y}</b><span>{lekcje(g.length)}</span></div><div className="card" style={{ padding: "4px 14px" }}>{g.map(lrow)}</div></div>; })
        : <div className="card" style={{ marginTop: 14 }}><Empty icon="cal" title={lv === "up" ? tr("Brak zaplanowanych lekcji") : tr("Brak minionych lekcji")} sub={tr("Lekcje dodaje korepetytor.")} /></div>}
    </>}</>;
  }

  function Pay() {
    const L = ls.filter((l) => l.date.slice(0, 7) === m && billable(l)).sort((a, b) => key(a).localeCompare(key(b)));
    const tot = L.reduce((t, l) => t + l.amount, 0), paid = L.reduce((t, l) => t + (l.paid ? l.amount : 0), 0);
    const oweAll = ls.filter((l) => billable(l) && !l.paid), oweOld = oweAll.filter((l) => l.date.slice(0, 7) < m);
    const shiftM = (k: number) => { const [y, mo] = m.split("-").map(Number); setM(ym(new Date(y, mo - 1 + k, 1))); };
    const mt = fm(m);
    const summary = () => {
      const T = [tr("Podsumowanie lekcji – ") + mt, tr("Korepetytor: ") + c!.tutor, tr("Uczeń: ") + c!.name, ""];
      L.forEach((l) => T.push("• " + sdate(l.date) + ", " + l.time + " – " + (l.subject ? l.subject + ": " : "") + (l.status === "cancelled" ? tr("odwołana lekcja") : l.topic || tr("lekcja")) + " (" + l.min + tr(" min): ") + pln(l.amount) + (l.paid ? tr(" (opłacona)") : "")));
      T.push("", tr("Razem: ") + pln(tot), tr("Opłacone: ") + pln(paid), tr("Do zapłaty: ") + pln(tot - paid));
      const txt = T.join("\n");
      ov.modal(<><h2>{tr("Podsumowanie –")}{" "}{mt}</h2><textarea rows={11} readOnly value={txt} />
        <div className="mf"><button className="btn" onClick={ov.close}>{tr("Zamknij")}</button><button className="btn only-m" onClick={() => shareText(tr("Podsumowanie lekcji – ") + mt, txt)}>{tr("Udostępnij")}</button><button className="btn no-m" onClick={() => printText(tr("Podsumowanie lekcji – ") + mt, txt)}>{tr("Drukuj / PDF")}</button>
          <button className="btn p" onClick={async () => ov.toast((await copyText(txt)) ? tr("Skopiowano.") : tr("Zaznacz tekst i skopiuj go ręcznie."))}>{tr("Kopiuj")}</button></div></>);
    };
    return <>{switcher}{c!.locked ? locked : <>
      <div className="bar"><div className="mpick" role="group" aria-label={tr("Miesiąc")}><button type="button" aria-label={tr("Poprzedni miesiąc")} onClick={() => shiftM(-1)}>‹</button><span aria-live="polite">{mt.charAt(0).toUpperCase() + mt.slice(1)}</span><button type="button" aria-label={tr("Następny miesiąc")} onClick={() => shiftM(1)}>›</button></div></div>
      {oweOld.length > 0 && <div className="nt">{tr("Nieopłacone lekcje z wcześniejszych miesięcy:")}{" "}<b>{lekcje(oweOld.length)}</b>{" · "}<b>{pln(oweOld.reduce((t, l) => t + l.amount, 0))}</b></div>}
      <div className="card bsum"><div className="l">{tr("Należności ·")}{" "}{mt}</div><div className="bv">{pln(tot).replace(",00", "")}</div>
        <div className="pbar" aria-hidden="true" style={{ margin: "10px 0 12px" }}><i style={{ width: (tot ? Math.round(paid / tot * 100) : 0) + "%", background: "var(--gr)" }} /></div>
        <div className="bsr"><div><div className="l">{tr("Opłacone")}</div><b className="gr">{pln(paid).replace(",00", "")}</b></div><div><div className="l">{tr("Do zapłaty")}</div><b className="am">{pln(tot - paid).replace(",00", "")}</b></div><div><div className="l">{tr("Lekcje")}</div><b>{L.length}</b></div></div></div>
      <div className="card" style={{ marginTop: 16 }}><h2>{tr("Lekcje do rozliczenia")}</h2>{L.length ? L.map(lrow) : <p className="hint" style={{ margin: 0 }}>{tr("Brak przeprowadzonych lekcji w tym miesiącu.")}</p>}</div>
      {L.length > 0 && <div className="card sumc" style={{ marginTop: 16 }}><div><h2 style={{ margin: 0 }}>{tr("Podsumowanie miesiąca")}</h2><span className="hint">{tr("Lista lekcji z tematami i kwotami – do skopiowania lub wysłania.")}</span></div>
        <div className="acts"><button className="btn p" onClick={summary}>{tr("Pokaż podsumowanie")}</button></div></div>}
      <p className="hint" style={{ marginTop: 12 }}>{tr("Status płatności zaznacza korepetytor. Płatności odbywają się bezpośrednio między Tobą a korepetytorem.")}</p>
    </>}</>;
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
        <main className="content">{!d ? <p className="hint">{tr("Ładowanie…")}</p> : tab === "konto" ? <KontoTab d={d} load={load} out={out} /> : !kids.length && tab !== "dash" ? <AddCode onDone={load} /> : tab === "dash" ? Dash() : tab === "lek" ? Lek() : Pay()}</main>
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
        {d.children.length ? d.children.map((k) => <div className="row" key={k.sid}><div className="av">{(k.name || "?").charAt(0).toUpperCase()}</div><div className="m"><b>{k.name}</b><span>{tr("Korepetytor:")}{" "}{k.tutor}{k.subject ? " · " + k.subject : ""}</span>
          {k.contact.email || k.contact.phone ? <span className="ktc">{k.contact.email && <a href={"mailto:" + k.contact.email}>✉️ {k.contact.email}</a>}{k.contact.phone && <a href={"tel:" + k.contact.phone.replace(/\s/g, "")}>📞 {k.contact.phone}</a>}</span> : <span className="hint" style={{ fontSize: 12, display: "block", marginTop: 2 }}>{tr("Korepetytor nie udostępnił danych kontaktowych.")}</span>}</div>
          <button className="btn s d" onClick={() => ov.confirm({ title: tr("Odłączyć dziecko?"), text: tr("Lekcje i płatności tego dziecka znikną z Twojego panelu. Aby połączyć się ponownie, poproś korepetytora o nowy kod."), ok: tr("Odłącz"), danger: true, onOk: async () => { try { await api("DELETE", "/api/parent/link/" + k.sid); await load(); ov.toast(tr("Odłączono.")); } catch (x) { ov.toast(errMsg(x)); } } })}>{tr("Odłącz")}</button></div>)
          : <p className="hint">{tr("Nie połączono jeszcze żadnego dziecka.")}</p>}</div>
      <p className="hint" style={{ marginTop: 12 }}>{tr("Panel rodzica jest bezpłatny i służy tylko do podglądu – zmiany w lekcjach wprowadza korepetytor.")}</p></>,
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

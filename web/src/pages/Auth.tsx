import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { navigate } from "../lib/router";
import { emailOk, pwOk, User } from "../lib/util";
import { useAuth } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { PubPage } from "./Public";

type Errs = Record<string, string>;
const dest = (u: User) => (u.role === "tutor" ? "/aplikacja/dash" : "/uczen/panel");

function PwRules({ p, q }: { p: string; q: string }) {
  const ok = { len: p.length >= 8, let: /\p{L}/u.test(p), num: /\d/.test(p) };
  return <>
    <ul className="pw" aria-live="polite">
      <li className={ok.len ? "ok" : ""}><span className="dt" />Co najmniej 8 znaków</li>
      <li className={ok.let ? "ok" : ""}><span className="dt" />Litera</li>
      <li className={ok.num ? "ok" : ""}><span className="dt" />Cyfra</li>
    </ul>
  </>;
}

function Shortcut({ u }: { u: User }) {
  return <div className="au"><div className="card"><h2>Jesteś zalogowany</h2><p>Zalogowano jako {u.name}.</p><a className="btn p" href={dest(u)}>Przejdź do panelu</a></div></div>;
}

export function Register({ role }: { role: "tutor" | "student" }) {
  const { user, demo, setUser } = useAuth();
  const { toast } = useOverlay();
  const [f, setF] = useState({ name: "", email: "", pw: "", pw2: "", brand: "", code: "", terms: false, show: false });
  const [e, setE] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
  const st = role === "student";
  if (user && !demo) return <PubPage aud={st ? "student" : "tutor"}><Shortcut u={user} /></PubPage>;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const em = f.email.trim().toLowerCase();
    const er: Errs = {
      name: f.name.trim() ? "" : st ? "Podaj imię." : "Podaj imię lub imię i nazwisko.",
      email: emailOk(em) ? "" : "Podaj poprawny adres e-mail.",
      pw: pwOk(f.pw) ? "" : f.pw.length < 8 ? "Hasło musi mieć co najmniej 8 znaków." : "Hasło musi zawierać literę i cyfrę.",
      pw2: f.pw2 && f.pw === f.pw2 ? "" : f.pw2 ? "Hasła muszą być identyczne." : "Powtórz hasło.",
      terms: f.terms ? "" : "Zaakceptuj regulamin, aby kontynuować.",
    };
    setE(er);
    const first = Object.keys(er).find((k) => er[k]);
    if (first) { document.getElementById("r_" + first)?.focus(); return; }
    setBusy(true);
    try {
      const r = await api<{ user: User }>("POST", "/api/auth/register", { role, name: f.name.trim(), email: em, password: f.pw, brand: f.brand.trim(), code: f.code.trim(), remember: true });
      setUser(r.user);
      toast(st ? "Konto ucznia utworzone." : "Konto utworzone.");
      navigate(st ? "/uczen/panel" : "/aplikacja/welcome");
    } catch (x) {
      const m = errMsg(x);
      if (/kod/i.test(m)) setE({ code: m }); else if (/istnieje/.test(m)) setE({ email: m }); else toast(m);
    } finally { setBusy(false); }
  }

  return (
    <PubPage aud={st ? "student" : "tutor"}><div className="au">
      <h1>{st ? "Załóż konto ucznia" : "Utwórz konto"}</h1>
      <p className="hint">{st ? "Bezpłatnie. Po rejestracji wpisz kod od korepetytora, aby zobaczyć swoje lekcje." : "Bezpłatnie, bez karty. Plan Free obejmuje do 3 aktywnych uczniów."}</p>
      <form onSubmit={submit} noValidate>
        <Field id="r_name" label={st ? "Imię *" : "Imię lub imię i nazwisko *"} value={f.name} onChange={set("name")} error={e.name} autoComplete="name" />
        <Field id="r_email" label="Adres e-mail *" type="email" value={f.email} onChange={set("email")} error={e.email} autoComplete="email" />
        <Field id="r_pw" label="Hasło * (min. 8 znaków)" type={f.show ? "text" : "password"} value={f.pw} onChange={set("pw")} error={e.pw} autoComplete="new-password" />
        <PwRules p={f.pw} q={f.pw2} />
        <Field id="r_pw2" label="Powtórz hasło *" type={f.show ? "text" : "password"} value={f.pw2} onChange={set("pw2")} error={e.pw2} autoComplete="new-password" />
        <div className="hint" aria-live="polite" style={{ margin: "-6px 0 8px", color: f.pw2 && f.pw2 === f.pw ? "var(--gr)" : "var(--mu)" }}>{!f.pw2 ? "" : f.pw2 === f.pw ? "Hasła są takie same." : "Hasła nie są jeszcze takie same."}</div>
        <div className="chk"><input type="checkbox" id="spw" checked={f.show} onChange={(x) => setF({ ...f, show: x.target.checked })} /><label htmlFor="spw">Pokaż hasło</label></div>
        {st ? <Field id="r_code" label="Kod od korepetytora (opcjonalnie)" value={f.code} onChange={set("code")} error={e.code} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} />
          : <Field id="r_brand" label="Nazwa lub marka korepetytora (opcjonalnie)" value={f.brand} onChange={set("brand")} />}
        <div className="chk"><input type="checkbox" id="r_terms" checked={f.terms} onChange={(x) => setF({ ...f, terms: x.target.checked })} aria-describedby="e_r_terms" /><label htmlFor="r_terms">Akceptuję <a href="/regulamin" target="_blank" rel="noopener">regulamin</a> i <a href="/prywatnosc" target="_blank" rel="noopener">politykę prywatności</a> *</label></div>
        <div className="er" id="e_r_terms" role="alert" style={{ marginBottom: 12, color: "var(--rd)", fontSize: 12 }}>{e.terms || ""}</div>
        <button className="btn p" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{st ? "Zarejestruj się" : "Utwórz konto"}</button>
      </form>
      <p className="hint" style={{ textAlign: "center" }}>Masz już konto? <a href={st ? "/uczen/logowanie" : "/logowanie"}>Zaloguj się</a></p>
      <p className="hint" style={{ textAlign: "center" }}>{st ? <>Jesteś korepetytorem? <a href="/rejestracja">Załóż konto korepetytora</a></> : <>Jesteś uczniem? <a href="/uczen/rejestracja">Załóż konto ucznia</a></>}</p>
    </div></PubPage>
  );
}

export function Login({ role, notice }: { role: "tutor" | "student"; notice?: boolean }) {
  const { user, demo, setUser } = useAuth();
  const { modal } = useOverlay();
  const [f, setF] = useState({ email: "", pw: "", remember: true });
  const [e, setE] = useState<Errs>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const st = role === "student";
  if (user && !demo) return <PubPage aud={st ? "student" : "tutor"}><Shortcut u={user} /></PubPage>;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const em = f.email.trim().toLowerCase();
    const er = { email: em ? "" : "Podaj adres e-mail.", pw: f.pw ? "" : "Podaj hasło." };
    setE(er); setMsg("");
    if (er.email || er.pw) return;
    setBusy(true);
    try {
      const r = await api<{ user: User }>("POST", "/api/auth/login", { email: em, password: f.pw, remember: f.remember });
      setUser(r.user);
      navigate(dest(r.user));
    } catch (x) { setMsg(errMsg(x)); document.getElementById("l_pw")?.focus(); } finally { setBusy(false); }
  }

  return (
    <PubPage aud={st ? "student" : "tutor"}><div className="au">
      <h1>{st ? "Zaloguj się jako uczeń" : "Zaloguj się"}</h1>
      {notice && <div className="nt" role="alert">{st ? "Aby wejść do panelu ucznia, zaloguj się." : "Aby wejść do panelu, zaloguj się."}</div>}
      <form onSubmit={submit} noValidate>
        <div className="lerr" role="alert">{msg}</div>
        <Field id="l_email" label="Adres e-mail" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} error={e.email} autoComplete="email" />
        <Field id="l_pw" label="Hasło" type="password" value={f.pw} onChange={(v) => setF({ ...f, pw: v })} error={e.pw} autoComplete="current-password" />
        <div className="chk"><input type="checkbox" id="lr" checked={f.remember} onChange={(x) => setF({ ...f, remember: x.target.checked })} /><label htmlFor="lr">Zapamiętaj mnie na tym urządzeniu</label></div>
        <button className="btn p" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 10 }}>Zaloguj się</button>
      </form>
      <p style={{ textAlign: "center" }}><button className="lk" type="button" onClick={() => modal(<Forgot />)}>Nie pamiętasz hasła?</button></p>
      <p className="hint" style={{ textAlign: "center" }}>Nie masz konta? <a href={st ? "/uczen/rejestracja" : "/rejestracja"}>Zarejestruj się</a></p>
    </div></PubPage>
  );
}

function Forgot() {
  const { close } = useOverlay();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState<null | { devLink?: string }>(null);
  async function send() {
    if (!emailOk(email.trim())) { setErr("Podaj poprawny adres e-mail."); return; }
    try { setSent(await api("POST", "/api/auth/forgot", { email: email.trim() })); } catch (x) { setErr(errMsg(x)); }
  }
  if (sent) return <><h2>Sprawdź skrzynkę</h2><p>Jeśli konto z adresem <b>{email.trim()}</b> istnieje, wysłaliśmy na nie link do ustawienia nowego hasła. Link jest ważny przez godzinę.</p>
    {sent.devLink && <p className="hint">Tryb deweloperski (brak skonfigurowanej poczty): <a href={sent.devLink.replace(/^https?:\/\/[^/]+/, "")} onClick={close}>otwórz link</a></p>}
    <div className="mf"><button className="btn p" onClick={close}>Zamknij</button></div></>;
  return <><h2>Ustaw nowe hasło</h2><p className="hint">Podaj adres e-mail konta. Wyślemy link do ustawienia nowego hasła.</p>
    <Field id="fe" label="Adres e-mail" type="email" value={email} onChange={setEmail} error={err} autoComplete="email" />
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" onClick={send}>Wyślij link</button></div></>;
}

export function ResetPassword() {
  const { toast } = useOverlay();
  const token = new URLSearchParams(location.search).get("token") || "";
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState("");
  const [e, setE] = useState<Errs>({});
  const [done, setDone] = useState(false);
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const er = { pw: pwOk(pw) ? "" : "Hasło musi mieć co najmniej 8 znaków oraz literę i cyfrę.", pw2: pw === pw2 ? "" : "Hasła muszą być identyczne." };
    setE(er); if (er.pw || er.pw2) return;
    try { await api("POST", "/api/auth/reset", { token, password: pw }); setDone(true); } catch (x) { toast(errMsg(x)); }
  }
  return <PubPage aud="tutor"><div className="au"><h1>Nowe hasło</h1>
    {done ? <div className="card"><p>Hasło zostało zmienione. Możesz się zalogować.</p><div className="acts"><a className="btn p" href="/logowanie">Zaloguj się (korepetytor)</a><a className="btn" href="/uczen/logowanie">Zaloguj się (uczeń)</a></div></div>
      : !token ? <p>Link jest niepełny. Poproś o nowy link na stronie logowania.</p>
        : <form onSubmit={submit} noValidate>
          <Field id="np" label="Nowe hasło (min. 8 znaków, litera i cyfra)" type="password" value={pw} onChange={setPw} error={e.pw} autoComplete="new-password" />
          <Field id="np2" label="Powtórz nowe hasło" type="password" value={pw2} onChange={setPw2} error={e.pw2} autoComplete="new-password" />
          <button className="btn p" type="submit" style={{ width: "100%", justifyContent: "center" }}>Zapisz hasło</button></form>}
  </div></PubPage>;
}

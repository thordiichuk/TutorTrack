import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { navigate } from "../lib/router";
import { emailOk, pwOk, User } from "../lib/util";
import { useAuth } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { PubPage } from "./Public";
import { LANG, tr } from "../lib/i18n";

type Errs = Record<string, string>;
const dest = (u: User) => (u.role === "tutor" ? "/aplikacja/dash" : u.role === "parent" ? "/rodzic/panel" : "/uczen/panel");

function PwRules({ p, q }: { p: string; q: string }) {
  const ok = { len: p.length >= 8, let: /\p{L}/u.test(p), num: /\d/.test(p) };
  return <>
    <ul className="pw" aria-live="polite">
      <li className={ok.len ? "ok" : ""}><span className="dt" />{tr("Co najmniej 8 znaków")}</li>
      <li className={ok.let ? "ok" : ""}><span className="dt" />{tr("Litera")}</li>
      <li className={ok.num ? "ok" : ""}><span className="dt" />{tr("Cyfra")}</li>
    </ul>
  </>;
}

function Shortcut({ u }: { u: User }) {
  return <div className="au"><div className="card"><h2>{tr("Jesteś zalogowany")}</h2><p>{tr("Zalogowano jako")}{" "}{u.name}.</p><a className="btn p" href={dest(u)}>{tr("Przejdź do panelu")}</a></div></div>;
}

export function Register({ role }: { role: "tutor" | "student" | "parent" }) {
  const { user, demo, setUser } = useAuth();
  const { toast } = useOverlay();
  const [f, setF] = useState({ name: "", email: "", pw: "", pw2: "", brand: "", code: role === "parent" ? new URLSearchParams(location.search).get("kod") || "" : "", terms: false, show: false });
  const [e, setE] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
  const pa = role === "parent", st = role === "student" || pa;
  if (user && !demo) return <PubPage aud={st ? "student" : "tutor"}><Shortcut u={user} /></PubPage>;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const em = f.email.trim().toLowerCase();
    const er: Errs = {
      name: f.name.trim() ? "" : st ? tr("Podaj imię.") : tr("Podaj imię lub imię i nazwisko."),
      email: emailOk(em) ? "" : tr("Podaj poprawny adres e-mail."),
      pw: pwOk(f.pw) ? "" : f.pw.length < 8 ? tr("Hasło musi mieć co najmniej 8 znaków.") : tr("Hasło musi zawierać literę i cyfrę."),
      pw2: f.pw2 && f.pw === f.pw2 ? "" : f.pw2 ? tr("Hasła muszą być identyczne.") : tr("Powtórz hasło."),
      terms: f.terms ? "" : tr("Zaakceptuj regulamin, aby kontynuować."),
    };
    setE(er);
    const first = Object.keys(er).find((k) => er[k]);
    if (first) { document.getElementById("r_" + first)?.focus(); return; }
    setBusy(true);
    try {
      const r = await api<{ user: User }>("POST", "/api/auth/register", { role, name: f.name.trim(), email: em, password: f.pw, brand: f.brand.trim(), code: f.code.trim(), remember: true });
      setUser(r.user);
      toast(pa ? tr("Konto rodzica utworzone.") : st ? tr("Konto ucznia utworzone.") : tr("Konto utworzone."));
      navigate(dest(r.user) === "/aplikacja/dash" ? "/aplikacja/welcome" : dest(r.user));
    } catch (x) {
      const m = errMsg(x);
      if (/kod/i.test(m)) setE({ code: m }); else if (/istnieje/.test(m)) setE({ email: m }); else toast(m);
    } finally { setBusy(false); }
  }

  return (
    <PubPage aud={st ? "student" : "tutor"}><div className="au">
      <h1>{pa ? tr("Załóż konto rodzica") : st ? tr("Załóż konto ucznia") : tr("Utwórz konto")}</h1>
      <p className="hint">{pa ? tr("Bezpłatnie. Wpisz kod dla rodzica od korepetytora dziecka, aby widzieć jego lekcje, notatki i płatności.") : st ? tr("Bezpłatnie. Po rejestracji wpisz kod od korepetytora, aby zobaczyć swoje lekcje.") : tr("Bezpłatnie, bez karty. Plan Free obejmuje do 3 aktywnych uczniów.")}</p>
      <form onSubmit={submit} noValidate>
        <Field id="r_name" label={st ? tr("Imię *") : tr("Imię lub imię i nazwisko *")} value={f.name} onChange={set("name")} error={e.name} autoComplete="name" />
        <Field id="r_email" label={tr("Adres e-mail *")} type="email" value={f.email} onChange={set("email")} error={e.email} autoComplete="email" />
        <Field id="r_pw" label={tr("Hasło * (min. 8 znaków)")} type={f.show ? "text" : "password"} value={f.pw} onChange={set("pw")} error={e.pw} autoComplete="new-password" />
        <PwRules p={f.pw} q={f.pw2} />
        <Field id="r_pw2" label={tr("Powtórz hasło *")} type={f.show ? "text" : "password"} value={f.pw2} onChange={set("pw2")} error={e.pw2} autoComplete="new-password" />
        <div className="hint" aria-live="polite" style={{ margin: "-6px 0 8px", color: f.pw2 && f.pw2 === f.pw ? "var(--gr)" : "var(--mu)" }}>{!f.pw2 ? "" : f.pw2 === f.pw ? tr("Hasła są takie same.") : tr("Hasła nie są jeszcze takie same.")}</div>
        <div className="chk"><input type="checkbox" id="spw" checked={f.show} onChange={(x) => setF({ ...f, show: x.target.checked })} /><label htmlFor="spw">{tr("Pokaż hasło")}</label></div>
        {st ? <Field id="r_code" label={pa ? tr("Kod dla rodzica (opcjonalnie)") : tr("Kod od korepetytora (opcjonalnie)")} value={f.code} onChange={set("code")} error={e.code} placeholder={tr("XXXX-XXXX-XXXX-XXXX")} autoComplete="off" spellCheck={false} />
          : <Field id="r_brand" label={tr("Nazwa lub marka korepetytora (opcjonalnie)")} value={f.brand} onChange={set("brand")} />}
        <div className="chk"><input type="checkbox" id="r_terms" checked={f.terms} onChange={(x) => setF({ ...f, terms: x.target.checked })} aria-describedby="e_r_terms" /><label htmlFor="r_terms">{tr("Akceptuję")}{" "}<a href="/regulamin" target="_blank" rel="noopener">{tr("regulamin")}</a>{" "}{tr("i")}{" "}<a href="/prywatnosc" target="_blank" rel="noopener">{tr("politykę prywatności")}</a> *</label></div>
        <div className="er" id="e_r_terms" role="alert" style={{ marginBottom: 12, color: "var(--rd)", fontSize: 12 }}>{e.terms || ""}</div>
        <button className="btn p" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{st ? tr("Zarejestruj się") : tr("Utwórz konto")}</button>
      </form>
      <p className="hint" style={{ textAlign: "center" }}>{tr("Masz już konto?")}{" "}<a href={pa ? "/rodzic/logowanie" : st ? "/uczen/logowanie" : "/logowanie"}>{tr("Zaloguj się")}</a></p>
      <p className="hint" style={{ textAlign: "center" }}>{pa ? <>{tr("Jesteś uczniem?")}{" "}<a href="/uczen/rejestracja">{tr("Załóż konto ucznia")}</a></> : st ? <>{tr("Jesteś korepetytorem?")}{" "}<a href="/rejestracja">{tr("Załóż konto korepetytora")}</a></> : <>{tr("Jesteś uczniem?")}{" "}<a href="/uczen/rejestracja">{tr("Załóż konto ucznia")}</a></>}</p>
    </div></PubPage>
  );
}

export function Login({ role, notice }: { role: "tutor" | "student" | "parent"; notice?: boolean }) {
  const { user, demo, setUser } = useAuth();
  const { modal } = useOverlay();
  const [f, setF] = useState({ email: "", pw: "", remember: true });
  const [e, setE] = useState<Errs>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const pa = role === "parent", st = role === "student" || pa;
  if (user && !demo) return <PubPage aud={st ? "student" : "tutor"}><Shortcut u={user} /></PubPage>;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const em = f.email.trim().toLowerCase();
    const er = { email: em ? "" : tr("Podaj adres e-mail."), pw: f.pw ? "" : tr("Podaj hasło.") };
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
      <h1>{pa ? tr("Zaloguj się jako rodzic") : st ? tr("Zaloguj się jako uczeń") : tr("Zaloguj się")}</h1>
      {notice && <div className="nt" role="alert">{pa ? tr("Aby wejść do panelu rodzica, zaloguj się.") : st ? tr("Aby wejść do panelu ucznia, zaloguj się.") : tr("Aby wejść do panelu, zaloguj się.")}</div>}
      <form onSubmit={submit} noValidate>
        <div className="lerr" role="alert">{msg}</div>
        <Field id="l_email" label={tr("Adres e-mail")} type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} error={e.email} autoComplete="email" />
        <Field id="l_pw" label={tr("Hasło")} type="password" value={f.pw} onChange={(v) => setF({ ...f, pw: v })} error={e.pw} autoComplete="current-password" />
        <div className="chk"><input type="checkbox" id="lr" checked={f.remember} onChange={(x) => setF({ ...f, remember: x.target.checked })} /><label htmlFor="lr">{tr("Zapamiętaj mnie na tym urządzeniu")}</label></div>
        <button className="btn p" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 10 }}>{tr("Zaloguj się")}</button>
      </form>
      <p style={{ textAlign: "center" }}><button className="lk" type="button" onClick={() => modal(<Forgot />)}>{tr("Nie pamiętasz hasła?")}</button></p>
      <p className="hint" style={{ textAlign: "center" }}>{tr("Nie masz konta?")}{" "}<a href={pa ? "/rodzic/rejestracja" : st ? "/uczen/rejestracja" : "/rejestracja"}>{tr("Zarejestruj się")}</a></p>
      {st && !pa && <p className="hint" style={{ textAlign: "center" }}>{tr("Jesteś rodzicem?")}{" "}<a href="/rodzic/logowanie">{tr("Zaloguj się jako rodzic")}</a></p>}
    </div></PubPage>
  );
}

function Forgot() {
  const { close } = useOverlay();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState<null | { devLink?: string }>(null);
  async function send() {
    if (!emailOk(email.trim())) { setErr(tr("Podaj poprawny adres e-mail.")); return; }
    try { setSent(await api("POST", "/api/auth/forgot", { email: email.trim(), lang: LANG })); } catch (x) { setErr(errMsg(x)); }
  }
  if (sent) return <><h2>{tr("Sprawdź skrzynkę")}</h2><p>{tr("Jeśli konto z adresem")}{" "}<b>{email.trim()}</b>{" "}{tr("istnieje, wysłaliśmy na nie link do ustawienia nowego hasła. Link jest ważny przez godzinę.")}</p>
    {sent.devLink && <p className="hint">{tr("Tryb deweloperski (brak skonfigurowanej poczty):")}{" "}<a href={sent.devLink.replace(/^https?:\/\/[^/]+/, "")} onClick={close}>{tr("otwórz link")}</a></p>}
    <div className="mf"><button className="btn p" onClick={close}>{tr("Zamknij")}</button></div></>;
  return <><h2>{tr("Ustaw nowe hasło")}</h2><p className="hint">{tr("Podaj adres e-mail konta. Wyślemy link do ustawienia nowego hasła.")}</p>
    <Field id="fe" label={tr("Adres e-mail")} type="email" value={email} onChange={setEmail} error={err} autoComplete="email" />
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" onClick={send}>{tr("Wyślij link")}</button></div></>;
}

export function ResetPassword() {
  const { toast } = useOverlay();
  const token = new URLSearchParams(location.search).get("token") || "";
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState("");
  const [e, setE] = useState<Errs>({});
  const [done, setDone] = useState(false);
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const er = { pw: pwOk(pw) ? "" : tr("Hasło musi mieć co najmniej 8 znaków oraz literę i cyfrę."), pw2: pw === pw2 ? "" : tr("Hasła muszą być identyczne.") };
    setE(er); if (er.pw || er.pw2) return;
    try { await api("POST", "/api/auth/reset", { token, password: pw }); setDone(true); } catch (x) { toast(errMsg(x)); }
  }
  return <PubPage aud="tutor"><div className="au"><h1>{tr("Nowe hasło")}</h1>
    {done ? <div className="card"><p>{tr("Hasło zostało zmienione. Możesz się zalogować.")}</p><div className="acts"><a className="btn p" href="/logowanie">{tr("Zaloguj się (korepetytor)")}</a><a className="btn" href="/uczen/logowanie">{tr("Zaloguj się (uczeń)")}</a></div></div>
      : !token ? <p>{tr("Link jest niepełny. Poproś o nowy link na stronie logowania.")}</p>
        : <form onSubmit={submit} noValidate>
          <Field id="np" label={tr("Nowe hasło (min. 8 znaków, litera i cyfra)")} type="password" value={pw} onChange={setPw} error={e.pw} autoComplete="new-password" />
          <Field id="np2" label={tr("Powtórz nowe hasło")} type="password" value={pw2} onChange={setPw2} error={e.pw2} autoComplete="new-password" />
          <button className="btn p" type="submit" style={{ width: "100%", justifyContent: "center" }}>{tr("Zapisz hasło")}</button></form>}
  </div></PubPage>;
}

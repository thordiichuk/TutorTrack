import { ReactNode, useEffect, useState } from "react";
import { Ic, Logo } from "../lib/icons";
import { navigate } from "../lib/router";
import { calc, fm, FREE, pln, PRO_PLN, toG, ym } from "../lib/util";
import { useAuth } from "../state";
import { LangFlags } from "../ui/lang";
import { tr } from "../lib/i18n";

/* ---------- shared chrome ---------- */
export type Aud = "tutor" | "student";

function scrollToId(id: string, home: string) {
  const t = document.getElementById(id);
  if (t) t.scrollIntoView({ behavior: "smooth" });
  else { navigate(home + "#" + id); setTimeout(() => document.getElementById(id)?.scrollIntoView(), 60); }
}

export function PubHeader({ aud }: { aud: Aud }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState("");
  const links: [string, string, string][] = aud === "student"
    ? [["korzysci", tr("Korzyści"), "star"], ["jak", tr("Jak to działa"), "check"], ["pytania-u", tr("Pytania"), "note"]]
    : [["funkcje", tr("Funkcje"), "star"], ["kroki", tr("Pierwsze kroki"), "check"], ["cennik", tr("Cennik"), "wallet"]];
  const home = aud === "student" ? "/uczen" : "/";

  useEffect(() => {
    if (!window.IntersectionObserver) return;
    const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) setOn(x.target.id); }), { rootMargin: "-40% 0px -55% 0px" });
    links.forEach(([id]) => { const e = document.getElementById(id); if (e) io.observe(e); });
    return () => io.disconnect();
  });
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  let cta: ReactNode;
  if (aud === "student") {
    cta = <><a className="btn" href="/">{tr("Jestem korepetytorem")}</a>{user?.role === "student"
      ? <a className="btn p" href="/uczen/panel">{tr("Mój panel")}</a>
      : <><a className="btn" href="/uczen/logowanie">{tr("Zaloguj się")}</a><a className="btn p" href="/uczen/rejestracja">{tr("Zarejestruj się")}</a></>}</>;
  } else {
    cta = user?.role === "tutor" ? <a className="btn p" href="/aplikacja/dash">{tr("Przejdź do panelu")}</a>
      : <><a className="btn" href="/logowanie">{tr("Zaloguj się")}</a><a className="btn p" href="/rejestracja">{tr("Zacznij bezpłatnie")}</a></>;
  }
  return (
    <><header className="ph"><div className="pi phi">
      <a className="logo" href={home}><i><Logo /></i>{tr("TutorTrack")}</a>
      <nav className={"pn" + (open ? " open" : "")} id="pn" aria-label={tr("Nawigacja główna")}>
        {links.map(([id, t, ic]) => <button key={id} className={"lk" + (on === id ? " on" : "")} aria-current={on === id ? "true" : undefined} onClick={() => { setOpen(false); scrollToId(id, home); }}><span className="pni"><Ic n={ic} s={18} /></span>{t}</button>)}
        <span className="mo">{cta}</span>
      </nav>
      <LangFlags /><div className="de">{cta}</div>
      <button className="btn s mt" id="mt" aria-expanded={open} aria-controls="pn" aria-label={open ? tr("Zamknij menu") : tr("Menu")} onClick={() => setOpen(!open)}><Ic n={open ? "x" : "menu"} /></button>
    </div></header>{open && <div className="pnb" onClick={() => setOpen(false)} />}</>
  );
}

export function PubFooter() {
  return <footer className="pi pf"><span>© {new Date().getFullYear()}{" "}{tr("TutorTrack")}</span><a href="/regulamin">{tr("Regulamin")}</a><a href="/prywatnosc">{tr("Polityka prywatności")}</a></footer>;
}

/** Adds the "in" class to .rv elements as they scroll into view. */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".rv");
    if (!window.IntersectionObserver) { els.forEach((e) => e.classList.add("in")); return; }
    const o = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); o.unobserve(x.target); } }), { threshold: 0.1 });
    els.forEach((e) => o.observe(e));
    return () => o.disconnect();
  });
}

function useHashScroll() {
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 60);
  }, []);
}

export function PubPage({ aud, children }: { aud: Aud; children: ReactNode }) {
  return <><PubHeader aud={aud} />{children}<PubFooter /></>;
}

function Card3({ i, t, d }: { i: string; t: string; d: string }) {
  return <div className="card rv"><div className="ico"><Ic n={i} s={20} /></div><h3>{t}</h3><p>{d}</p></div>;
}
function AudSw({ s }: { s: boolean }) {
  return <nav className="aud" aria-label={tr("Wersja strony")}><a href="/" aria-current={s ? undefined : "page"}>{tr("Dla korepetytora")}</a><a href="/uczen" aria-current={s ? "page" : undefined}>{tr("Dla ucznia")}</a></nav>;
}
function Faq({ q }: { q: [string, string][] }) {
  return <>{q.map((x) => <details key={x[0]}><summary>{x[0]}</summary><p>{x[1]}</p></details>)}</>;
}

/* ---------- tutor home ---------- */
const span = (t: string) => <span style={{ color: "var(--mu)" }}>{t}</span>;
function Demo({ i }: { i: number }) {
  if (i === 0) return <div className="dm" aria-hidden="true"><div className="fl">{span(tr("Imię i nazwisko"))}<b><span className="ty">{tr("Anna Kowalska")}</span></b></div><div className="fl">{span(tr("Przedmiot, stawka"))}<b>{tr("Matematyka · 120 zł")}</b></div><div className="fl pb" style={{ borderColor: "#d9dcff", background: "var(--acl)" }}><span><b>{tr("Anna Kowalska")}</b>{" "}{tr("· Matematyka")}</span><span className="tag gr">{tr("Aktywny")}</span></div></div>;
  if (i === 1) return <div className="dm" aria-hidden="true"><div className="fl pa"><span><b>16:00</b>{" "}{tr("· 60 min ·")}{" "}{pln(12000)}</span><span className="tag ac">{tr("Zaplanowana")}</span></div><div className="fl pb"><span><b>17:30</b>{" "}{tr("· 45 min ·")}{" "}{pln(9000)}</span><span className="tag ac">{tr("Zaplanowana")}</span></div><div className="fl pc"><span><b>18:30</b>{" "}{tr("· 60 min ·")}{" "}{pln(10000)}</span><span className="tag gr">{tr("Opłacona")}</span></div></div>;
  return <div className="dm" role="img" aria-label={tr("Przykładowy podgląd rozliczenia")}><div className="hint" style={{ marginBottom: 6 }}>{tr("Przykładowy podgląd rozliczenia ·")}{" "}{fm(ym(new Date()))}</div><div className="mk" style={{ marginBottom: 6 }}><div className="card stat st" style={{ animationDelay: "0s" }}><div className="l">{tr("Należności")}</div><div className="v">{pln(42000)}</div></div><div className="card stat st" style={{ animationDelay: "1s" }}><div className="l">{tr("Opłacone")}</div><div className="v gr">{pln(24000)}</div></div><div className="card stat st" style={{ animationDelay: "2s" }}><div className="l">{tr("Do zapłaty")}</div><div className="v am">{pln(18000)}</div></div></div><div className="fl st" style={{ animationDelay: "3.2s" }}><span><b>{tr("Anna K.")}</b>{" "}{tr("· 2 lekcje ·")}{" "}{pln(24000)}</span><span className="tag gr">{tr("Rozliczone")}</span></div><div className="fl st" style={{ animationDelay: "4.4s" }}><span><b>{tr("Jan N.")}</b>{" "}{tr("· 2 lekcje ·")}{" "}{pln(18000)}</span><span className="tag am">{tr("Do zapłaty")}</span></div></div>;
}

function Calculator() {
  const [r, setR] = useState("100"), [m, setM] = useState("45");
  const g = toG(r), n = Number(m);
  return <><h2>{tr("Kalkulator lekcji")}</h2><p className="hint" style={{ margin: "0 0 12px" }}>{tr("Sprawdź, jak TutorTrack liczy kwotę lekcji.")}</p><div className="card rv" style={{ maxWidth: 560 }}><p className="hint" style={{ marginBottom: 12 }}>{tr("Tak TutorTrack liczy kwotę lekcji: stawka × czas ÷ 60.")}</p><div className="f2"><div className="f"><label htmlFor="ck_r">{tr("Stawka za 60 min (zł)")}</label><input id="ck_r" inputMode="decimal" value={r} onChange={(e) => setR(e.target.value)} /></div><div className="f"><label htmlFor="ck_m">{tr("Czas (min)")}</label><input id="ck_m" type="number" min={1} step={5} value={m} onChange={(e) => setM(e.target.value)} /></div></div><b style={{ fontSize: 22 }} aria-live="polite">{!isNaN(g) && g >= 0 && n > 0 ? pln(calc(g, n)) : "—"}</b></div></>;
}

export function Home() {
  const { enterDemo } = useAuth();
  useReveal(); useHashScroll();
  const proList = [tr("Bez limitu aktywnych uczniów"), tr("Wszystko z planu Free"), tr("Rozszerzone statystyki: przychód według przedmiotu i ucznia, odwołania, obłożenie"), tr("Wykres przychodu z 6 miesięcy i eksport roku"), tr("Podsumowania dla wszystkich uczniów naraz i wydruk PDF"), tr("Cel miesięczny z paskiem postępu"), tr("Szablony notatek"), tr("Kosz z przywracaniem przez 30 dni")];
  return (
    <PubPage aud="tutor"><div className="pi">
      <section className="hero"><div><AudSw s={false} /><h1>{tr("Dziennik korepetytora, który porządkuje uczniów, lekcje i rozliczenia")}</h1><p>{tr("Notatki w kilku miejscach i niepewność, kto ma zapłacić i ile? TutorTrack trzyma wszystko w jednym miejscu.")}</p><div className="btns"><a className="btn p" href="/rejestracja">{tr("Zacznij bezpłatnie")}</a><button className="btn" onClick={enterDemo}>{tr("Zobacz demo")}</button></div><p className="hint" style={{ marginTop: 12 }}>{tr("Bez karty. Plan darmowy do")}{" "}{FREE}{" "}{tr("aktywnych uczniów.")}</p></div>
        <div className="card" role="img" aria-label={tr("Przykładowy podgląd panelu TutorTrack")}><div className="hint" style={{ marginBottom: 8 }}>{tr("Przykładowy podgląd panelu")}</div><div className="mk"><div className="card stat"><div className="l">{tr("Lekcje")}</div><div className="v">3</div></div><div className="card stat"><div className="l">{tr("Opłacone")}</div><div className="v gr">{pln(22000)}</div></div><div className="card stat"><div className="l">{tr("Do zapłaty")}</div><div className="v am">{pln(9000)}</div></div></div>
          {([[tr("Matematyka"), tr("Anna K."), 12000, 1], [tr("Angielski"), tr("Jan N."), 9000, 0], [tr("Fizyka"), tr("Maria W."), 10000, 1]] as const).map((r) => <div className="row" key={r[0]}><div className="m"><b>{r[0]}</b><span>{r[1]}</span></div><span className={"tag " + (r[3] ? "gr" : "am")}>{r[3] ? tr("Opłacona") : tr("Nieopłacona")}</span><div className="amt">{pln(r[2])}</div></div>)}
        </div></section>
      <section className="sec"><h2>{tr("Problem, który rozwiązujemy")}</h2><p className="hint">{tr("Z tym najczęściej mierzą się korepetytorzy.")}</p><div className="grid g3"><Card3 i="note" t={tr("Rozproszone notatki")} d={tr("Uwagi po lekcjach lądują w telefonie, zeszycie i mailach.")} /><Card3 i="wallet" t={tr("Brak kontroli nad płatnościami")} d={tr("Trudno szybko sprawdzić, która lekcja jest opłacona.")} /><Card3 i="alert" t={tr("Niepewna kwota do zapłaty")} d={tr("Ręczne liczenie godzin i stawek kończy się pomyłkami.")} /></div></section>
      <section className="sec" id="funkcje"><h2>{tr("Funkcje")}</h2><p className="hint">{tr("Tylko to, co naprawdę jest w produkcie.")}</p><div className="grid g3">
        <Card3 i="users" t={tr("Uczniowie")} d={tr("Dane kontaktowe, stawka, notatki, kilka przedmiotów u jednego ucznia, archiwizacja oraz gotowe miesięczne podsumowanie lekcji i kwot do wysłania uczniowi lub rodzicowi.")} />
        <Card3 i="book" t={tr("Lekcje")} d={tr("Terminy, czas trwania, temat, notatka po zajęciach, praca domowa i status płatności.")} />
        <Card3 i="wallet" t={tr("Rozliczenia")} d={tr("Suma należności, opłacone lekcje, kwota do zapłaty i podsumowanie według uczniów.")} />
        <Card3 i="home" t={tr("Pulpit")} d={tr("Liczba uczniów, lekcje w miesiącu, opłacone kwoty i zaległości.")} />
        <Card3 i="star" t={tr("Plan i płatności")} d={tr("Darmowy start i plan Pro bez limitu uczniów.")} />
        <Card3 i="note" t={tr("Panel ucznia")} d={tr("Uczeń zakłada konto i wpisuje kod od Ciebie – widzi plan lekcji, notatki po zajęciach i prace domowe. Wszystko aktualizuje się samo.")} />
      </div></section>
      <section className="sec" id="kroki"><h2>{tr("Pierwsze kroki")}</h2><p className="hint">{tr("Pierwszy użyteczny stan osiągniesz w kilka minut.")}</p><div className="grid g3">
        {[[tr("1. Dodaj ucznia"), tr("Imię, przedmiot i stawka za 60 minut.")], [tr("2. Dodaj pierwszą lekcję"), tr("Kwota policzy się sama.")], [tr("3. Sprawdź rozliczenie miesiąca"), tr("Zobacz, kto i ile ma zapłacić.")]].map((x, i) => <div className="card rv" key={i}><h3>{x[0]}</h3><p>{x[1]}</p><Demo i={i} /></div>)}
      </div></section>
      <section className="sec" id="cennik"><h2>{tr("Cennik")}</h2><p className="hint">{tr("Prosty plan, bez niespodzianek.")}</p><div className="plans">
        <div className="card plan"><h2>{tr("Free")}</h2><div className="pr">{tr("0 zł")}</div><ul><li>{tr("Do")}{" "}{FREE}{" "}{tr("aktywnych uczniów")}</li><li>{tr("Wszystkie podstawowe funkcje")}</li><li>{tr("Panel ucznia dla Twoich uczniów")}</li><li>{tr("Motywy kolorystyczne")}</li></ul><a className="btn" href="/rejestracja">{tr("Zacznij bezpłatnie")}</a></div>
        <div className="card plan cur"><h2>{tr("Pro")}{" "}<span className="tag ac">{tr("Polecany")}</span></h2><div className="pr">{pln(PRO_PLN).replace(",00", "")} <span className="hint" style={{ fontSize: 14, fontWeight: 400 }}>{tr("/ miesiąc")}</span></div><ul>{proList.map((x) => <li key={x}>{x}</li>)}</ul><a className="btn p" href="/rejestracja">{tr("Zacznij i przetestuj Pro")}</a></div>
      </div><p className="hint">{tr("Płatność za Pro jest na razie symulowana – nic nie jest pobierane.")}</p></section>
      <section className="sec"><Calculator /></section>
      <section className="sec"><h2>{tr("Pytania")}</h2><Faq q={[[tr("Czy dane uczniów są bezpieczne?"), tr("Dane są przechowywane w bazie danych na serwerze TutorTrack i dostępne tylko po zalogowaniu na Twoje konto. Hasła są szyfrowane. Uczeń widzi wyłącznie swoje lekcje, notatki po zajęciach i prace domowe – Twoje notatki przed zajęciami zostają prywatne.")], [tr("Czy mogę wrócić do Free?"), tr("Tak. Dane zostają, ale nie można dodawać ani przywracać uczniów, dopóki aktywnych jest więcej niż {0}.", FREE)], [tr("Czy stracę historię po anulowaniu Pro?"), tr("Nie. Historia lekcji i rozliczeń zostaje zachowana.")], [tr("Czy muszę podać dane karty?"), tr("Nie. Rejestracja jest bezpłatna, a zakup Pro jest na razie symulowany.")], [tr("Czy to zastępuje księgowość?"), tr("Nie. To dziennik rozliczeń, a nie system księgowy i nie narzędzie do faktur.")]]} /></section>
      <section className="cta rv"><h2>{tr("Zacznij porządkować lekcje")}</h2><p>{tr("Załóż konto w minutę – bez karty.")}</p><a className="btn" href="/rejestracja">{tr("Zacznij bezpłatnie")}</a></section>
    </div></PubPage>
  );
}

/* ---------- student home ---------- */
function StudentDemo({ i }: { i: number }) {
  const fl = (c: string, a: ReactNode, b: ReactNode, dl?: number) => <div className={"fl " + c} style={dl != null ? { animationDelay: dl + "s" } : undefined}><span>{a}</span>{b}</div>;
  if (i === 0) return <div className="dm" aria-hidden="true">{fl("pa", <><b>{tr("pon. 8:00–14:30")}</b>{" "}{tr("· Szkoła")}</>, <span className="tag">{tr("Moje zajęcia")}</span>)}{fl("pb", <><b>{tr("wt. 15:00")}</b>{" "}{tr("· Basen")}</>, <span className="tag">{tr("Moje zajęcia")}</span>)}{fl("pc", <><b>{tr("czw. 18:00")}</b>{" "}{tr("· wolne")}</>, <span className="tag gr">{tr("Wolny termin")}</span>)}</div>;
  if (i === 1) return <div className="dm" aria-hidden="true">{fl("pa", <><b>{tr("pon. 16:00")}</b>{" "}{tr("· Matematyka · Ewa M.")}</>, <span className="tag ac">{tr("Korepetycje")}</span>)}{fl("pb", <><b>{tr("śr. 18:00")}</b>{" "}{tr("· Angielski · Tomasz L.")}</>, <span className="tag ac">{tr("Korepetycje")}</span>)}{fl("pc", <><b>{tr("czw. 17:00")}</b>{" "}{tr("· Fizyka · Piotr Z.")}</>, <span className="tag ac">{tr("Korepetycje")}</span>)}</div>;
  return <div className="dm" aria-hidden="true">{fl("st", <><b>{tr("Notatka po lekcji")}</b>{" "}{tr("· Matematyka")}</>, <span className="tag gr">{tr("Nowa")}</span>, 0)}{fl("st", tr("Omówione: funkcje kwadratowe"), "", 1.2)}{fl("st", <><b>{tr("Praca domowa:")}</b>{" "}{tr("zad. 3–7, str. 52")}</>, <span className="tag am">{tr("do czw.")}</span>, 2.4)}{fl("st", tr("✓ Zadanie zrobione"), <span className="tag gr">{tr("Gotowe")}</span>, 3.6)}</div>;
}

export function StudentHome() {
  const { user } = useAuth();
  useReveal(); useHashScroll();
  const W = [["pon.", "16:00", tr("Matematyka"), tr("Ewa M."), "note"], [tr("śr."), "18:00", tr("Angielski"), tr("Tomasz L."), "hw"], ["czw.", "17:00", tr("Fizyka"), tr("Piotr Z."), ""], ["sob.", "10:00", tr("Matematyka"), tr("Ewa M."), ""]];
  return (
    <PubPage aud="student"><div className="pi">
      <section className="hero"><div><AudSw s /><h1>{tr("Wszystkie korepetycje w jednym planie")}</h1><p>{tr("Własny grafik, lekcje u wszystkich korepetytorów, notatki po zajęciach i prace domowe – w jednym miejscu.")}</p>
        <div className="btns">{user?.role === "student" ? <a className="btn p" href="/uczen/panel">{tr("Przejdź do panelu")}</a> : <a className="btn p" href="/uczen/rejestracja">{tr("Zarejestruj się")}</a>}<a className="btn" href="/rodzic/rejestracja">{tr("Jestem rodzicem")}</a></div>
        <p className="hint" style={{ marginTop: 12 }}>{tr("Wszystkie funkcje dla ucznia są bezpłatne.")}{user?.role === "student" ? null : <><br />{tr("Masz już konto?")}{" "}<a href="/uczen/logowanie" style={{ whiteSpace: "nowrap", color: "var(--ac)", fontWeight: 600 }}>{tr("Zaloguj się")}</a></>}</p></div>
        <div className="card" role="img" aria-label={tr("Przykładowy podgląd planu ucznia")}><div className="hint" style={{ marginBottom: 8 }}>{tr("Przykładowy plan ucznia · ten tydzień")}</div><div className="mk"><div className="card stat"><div className="l">{tr("Lekcje w miesiącu")}</div><div className="v">9</div></div><div className="card stat"><div className="l">{tr("Godziny")}</div><div className="v">{tr("8,5 h")}</div></div><div className="card stat"><div className="l">{tr("Zadania")}</div><div className="v am">2</div></div></div>
          {W.map((r) => <div className="row" key={r[0]}><div className="m"><b>{r[0]} {r[1]} · {r[2]}</b><span>{tr("Korepetytor:")}{" "}{r[3]}</span></div>{r[4] === "note" ? <span className="tag gr">{tr("Nowa notatka")}</span> : r[4] === "hw" ? <span className="tag am">{tr("Zadanie do czw.")}</span> : <span className="tag ac">{tr("Zaplanowana")}</span>}</div>)}
        </div></section>
      <section className="sec" id="korzysci"><h2>{tr("Korzyści dla ucznia")}</h2><p className="hint">{tr("Mniej chaosu, więcej czasu na naukę.")}</p><div className="grid g3">
        <Card3 i="cal" t={tr("Własny grafik")} d={tr("Układaj swój tydzień: korepetycje, szkoła i inne zajęcia w jednym kalendarzu. Od razu widzisz wolne terminy.")} />
        <Card3 i="book" t={tr("Plan wszystkich korepetycji")} d={tr("Lekcje u różnych korepetytorów i z różnych przedmiotów w jednym planie – bez szukania terminów w kilku komunikatorach.")} />
        <Card3 i="chart" t={tr("Podsumowanie miesiąca")} d={tr("Co miesiąc widzisz, ile było lekcji, z jakich przedmiotów, ile godzin nauki i jakie tematy zostały omówione.")} />
        <Card3 i="note" t={tr("Notatki od korepetytora")} d={tr("Po lekcji korepetytor przesyła podsumowanie: co omówiliście i co warto powtórzyć przed kolejnymi zajęciami.")} />
        <Card3 i="check" t={tr("Praca domowa")} d={tr("Zadania od korepetytora trafiają na Twoją listę razem z terminem. Odhaczasz je, gdy są gotowe.")} />
      </div></section>
      <section className="sec" id="jak"><h2>{tr("Jak to działa")}</h2><p className="hint">{tr("Trzy kroki do uporządkowanej nauki.")}</p><div className="grid g3">
        {[[tr("1. Ułóż swój grafik"), tr("Dodaj szkołę i stałe zajęcia, żeby widzieć wolne terminy.")], [tr("2. Wpisz kod od korepetytora"), tr("Lekcje, notatki i zadania same trafiają do Twojego planu.")], [tr("3. Notatka i praca domowa po lekcji"), tr("Korepetytor przesyła podsumowanie i zadanie z terminem.")]].map((x, i) => <div className="card rv" key={i}><h3>{x[0]}</h3><p>{x[1]}</p><StudentDemo i={i} /></div>)}
      </div></section>
      <section className="sec" id="pytania-u"><h2>{tr("Pytania")}</h2><Faq q={[[tr("Czy panel ucznia jest płatny?"), tr("Nie. Wszystkie funkcje dla ucznia są bezpłatne.")], [tr("Jak połączyć się z korepetytorem?"), tr("Korepetytor tworzy w TutorTrack kod dostępu. Wpisujesz go przy rejestracji albo później w zakładce Korepetytorzy – lekcje, notatki i prace domowe pojawiają się automatycznie.")], [tr("Czy mogę mieć kilku korepetytorów?"), tr("Tak. Dodaj kod od każdego korepetytora korzystającego z TutorTrack, a pozostałe lekcje wpisz do własnego grafiku.")], [tr("Kto widzi moje lekcje i notatki?"), tr("Ty oraz korepetytor, który je prowadzi. Twój grafik i odhaczone zadania widzisz tylko Ty.")], [tr("Czy działa na telefonie i komputerze?"), tr("Tak. Zaloguj się na dowolnym urządzeniu – dane są zapisane na Twoim koncie.")]]} /></section>
      <section className="cta rv"><h2>{tr("Uczysz się z korepetytorem?")}</h2><p>{tr("Załóż bezpłatne konto i poproś korepetytora o kod – plan, notatki i prace domowe będą w jednym miejscu.")}</p><a className="btn" href={user?.role === "student" ? "/uczen/panel" : "/uczen/rejestracja"}>{user?.role === "student" ? tr("Przejdź do panelu") : tr("Zarejestruj się")}</a></section>
    </div></PubPage>
  );
}

/* ---------- legal ---------- */
export function Legal({ kind }: { kind: "regulamin" | "prywatnosc" }) {
  const T = kind === "regulamin"
    ? [tr("Regulamin"), [
      [tr("Czym jest TutorTrack"), tr("Dziennik korepetytora do prowadzenia uczniów, lekcji i rozliczeń oraz bezpłatny panel ucznia. Nie jest systemem księgowym ani narzędziem do wystawiania faktur.")],
      [tr("Konta"), tr("Konto zakładasz, podając imię, adres e-mail i hasło. Odpowiadasz za poufność hasła i za dane, które wpisujesz do dziennika.")],
      [tr("Plany"), tr("Free: do {0} aktywnych uczniów. Pro: {1} miesięcznie, bez limitu. Płatność za Pro jest obecnie symulowana i nic nie jest pobierane. Po powrocie do Free dane zostają, a dodawanie i przywracanie uczniów jest ograniczone.", FREE, pln(PRO_PLN).replace(",00", ""))],
      [tr("Panel ucznia"), tr("Uczeń korzysta z panelu bezpłatnie. Dostęp do lekcji konkretnego korepetytora uzyskuje kodem, który korepetytor może w każdej chwili unieważnić.")],
      [tr("Usunięcie konta"), tr("Konto i wszystkie powiązane dane możesz usunąć w Ustawieniach (korepetytor) lub w panelu ucznia.")]]]
    : [tr("Polityka prywatności"), [
      [tr("Jakie dane"), tr("Konto (imię, e-mail, nazwa marki, hasło w postaci skrótu), uczniowie, lekcje, notatki i prace domowe wpisane przez korepetytora oraz grafik ucznia.")],
      [tr("Gdzie są zapisane"), tr("W bazie danych na serwerze TutorTrack. Dostęp wymaga zalogowania. Połączenie jest szyfrowane (HTTPS).")],
      [tr("Kto widzi dane"), tr("Korepetytor widzi swoje dane. Uczeń połączony kodem widzi swoje lekcje, notatki po zajęciach i prace domowe – bez notatek przed zajęciami i bez danych innych uczniów.")],
      [tr("Hasło"), tr("Hasła są przechowywane wyłącznie jako skrót (scrypt), nigdy jawnie.")],
      [tr("Ciasteczka"), tr("Używamy jednego niezbędnego ciasteczka sesji, aby utrzymać Cię zalogowanym. Nie używamy ciasteczek reklamowych ani analitycznych.")],
      [tr("Usuwanie danych"), tr("Usunięcie konta trwale usuwa profil i wszystkie powiązane dane.")],
      [tr("Kopie zapasowe"), tr("Wyeksportowany plik zawiera dane uczniów – przechowuj go bezpiecznie.")]]];
  return (
    <PubPage aud="tutor"><div className="au" style={{ maxWidth: 640 }}><h1>{T[0] as string}</h1>
      {(T[1] as string[][]).map((x) => <div key={x[0]}><h3 style={{ margin: "16px 0 4px" }}>{x[0]}</h3><p style={{ margin: 0, color: "var(--mu)" }}>{x[1]}</p></div>)}
      <p><a className="btn" href="/">{tr("Wróć na stronę główną")}</a></p></div></PubPage>
  );
}

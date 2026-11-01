import { useEffect, useState } from "react";
import { Ic, Logo } from "../lib/icons";
import { navigate } from "../lib/router";
import { FREE } from "../lib/util";
import { useAuth, useTutor } from "../state";
import { ModalHost, useOverlay } from "../ui/overlay";
import { initialUi, UiCtx } from "./common";
import { Billing, Dashboard, Lessons, Plan, Settings, Stats, Students, useAdd, usePlanActions, Welcome } from "./Views";

const VIEWS: [string, string, string][] = [["dash", "Pulpit", "home"], ["students", "Uczniowie", "users"], ["lessons", "Lekcje", "book"], ["billing", "Rozliczenia", "wallet"], ["stats", "Statystyki", "chart"], ["plan", "Plan i płatności", "star"], ["settings", "Ustawienia", "set"]];
const TITLES: Record<string, [string, string, string]> = {
  dash: ["Pulpit", "Dodaj lekcję", "addL"], students: ["Uczniowie", "Dodaj ucznia", "addS"], lessons: ["Lekcje", "Dodaj lekcję", "addL"], billing: ["Rozliczenia", "Dodaj lekcję", "addL"],
  plan: ["Plan i płatności", "Przetestuj Pro", "tryPro"], welcome: ["Powitanie", "Przejdź do pulpitu", "goDash"], settings: ["Ustawienia", "Pulpit", "goDash"], stats: ["Statystyki", "Dodaj lekcję", "addL"],
};

export function TutorApp({ view: v0 }: { view: string }) {
  const view = TITLES[v0] ? v0 : "dash";
  const ui = useState(initialUi);
  const { user, demo, logout, updateMe } = useAuth();
  const { data, error, reload } = useTutor();
  const { confirm } = useOverlay();

  useEffect(() => { document.title = TITLES[view][0] + " – TutorTrack"; window.scrollTo(0, 0); }, [view]);
  useEffect(() => {
    if (view === "billing" && user && !demo && !user.settings.onbBilling) updateMe({ settings: { onbBilling: true } }).catch(() => {});
  }, [view, user?.id]);

  if (!data) return <><div className="au" style={{ textAlign: "center" }}>{error ? <><p>{error}</p><button className="btn" onClick={reload}>Spróbuj ponownie</button></> : <p className="hint">Ładowanie…</p>}</div><ModalHost /></>;

  const out = () => confirm({
    title: demo ? "Wyjść z trybu demo?" : "Wylogować się?", text: demo ? "Dane przykładowe nie są zapisywane." : "Twoje dane są bezpiecznie zapisane na koncie.",
    ok: demo ? "Wyjdź" : "Wyloguj się", onOk: logout,
  });
  const pro = user!.plan === "pro", active = data.students.filter((s) => s.active).length;
  return (
    <UiCtx.Provider value={ui}>
      <div className="app">
        <aside className="side" aria-label="Menu główne">
          <div className="logo"><i><Logo /></i>TutorTrack</div>
          <div>{VIEWS.map((x) => <button key={x[0]} className={"nav" + (x[0] === view ? " on" : "")} onClick={() => navigate("/aplikacja/" + x[0])} aria-current={x[0] === view ? "page" : undefined}><Ic n={x[2]} />{x[1]}</button>)}
            <button className="nav" onClick={out}><Ic n="out" />{demo ? "Wyjdź z dema" : "Wyloguj się"}</button></div>
          <div className="planchip">Plan: <b>{pro ? "Pro" : "Free"}</b><br />Aktywni uczniowie: {active}{pro ? "" : " / " + FREE}</div>
        </aside>
        <div className="main">
          <Top view={view} onOut={out} />
          <div>{demo && <p className="banner demo-b">TRYB DEMO – dane przykładowe, nic nie jest zapisywane. <button className="lk" onClick={logout} style={{ color: "#fff", textDecoration: "underline" }}>Wyjdź z dema</button></p>}</div>
          <main className="content" id="view" tabIndex={-1}>
            {view === "dash" ? <Dashboard /> : view === "students" ? <Students /> : view === "lessons" ? <Lessons /> : view === "billing" ? <Billing />
              : view === "stats" ? <Stats /> : view === "plan" ? <Plan /> : view === "settings" ? <Settings /> : <Welcome />}
          </main>
        </div>
      </div>
      <nav className="tabs" aria-label="Menu">{VIEWS.map((x) => <button key={x[0]} className={x[0] === view ? "on" : ""} onClick={() => navigate("/aplikacja/" + x[0])} aria-current={x[0] === view ? "page" : undefined}><Ic n={x[2]} s={22} />{x[0] === "plan" ? "Plan" : x[1]}</button>)}</nav>
      <ModalHost />
    </UiCtx.Provider>
  );
}

function Top({ view, onOut }: { view: string; onOut: () => void }) {
  const { user } = useAuth();
  const { addStudent, addLesson } = useAdd();
  const { tryPro, toFree } = usePlanActions();
  const t = TITLES[view], pro = user!.plan === "pro";
  const act = view === "plan" && pro ? "free" : t[2];
  const label = view === "plan" && pro ? "Wróć do Free" : t[1];
  const click = () => act === "addL" ? addLesson() : act === "addS" ? addStudent() : act === "tryPro" ? tryPro() : act === "free" ? toFree() : navigate("/aplikacja/dash");
  return (
    <header className="top">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><a className="brandm" href="/" aria-label="TutorTrack"><span className="logo" style={{ padding: 0 }}><i><Logo /></i></span></a><div><h1>{t[0]}</h1><small /></div></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="hint" id="usr">{user!.brand || user!.name}</span><button className="btn s lo" onClick={onOut}>Wyloguj</button>
        {view !== "settings" && <button className="btn p" onClick={click}>{act !== "free" && <Ic n="plus" s={16} />}<span>{label}</span></button>}</div>
    </header>
  );
}

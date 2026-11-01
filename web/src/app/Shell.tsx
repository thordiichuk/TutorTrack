import { useEffect, useState } from "react";
import { Ic, Logo } from "../lib/icons";
import { navigate } from "../lib/router";
import { FREE } from "../lib/util";
import { useAuth, useTutor } from "../state";
import { ModalHost, useOverlay } from "../ui/overlay";
import { initialUi, UiCtx } from "./common";
import { Billing, Dashboard, Lessons, Settings, Students, useAdd, Welcome } from "./Views";

const VIEWS: [string, string, string][] = [["dash", "Pulpit", "home"], ["students", "Uczniowie", "users"], ["lessons", "Lekcje", "book"], ["billing", "Rozliczenia", "wallet"], ["settings", "Ustawienia", "set"]];
/** Old addresses that now live inside other sections. */
const ALIAS: Record<string, string> = { stats: "billing", plan: "settings" };
const TITLES: Record<string, [string, string, string]> = {
  dash: ["Pulpit", "Dodaj lekcję", "addL"], students: ["Uczniowie", "Dodaj ucznia", "addS"], lessons: ["Lekcje", "Dodaj lekcję", "addL"], billing: ["Rozliczenia", "Dodaj lekcję", "addL"],
  welcome: ["Powitanie", "Przejdź do pulpitu", "goDash"], settings: ["Ustawienia", "Pulpit", "goDash"],
};

export function TutorApp({ view: v0 }: { view: string }) {
  const anchor = ALIAS[v0] ? v0 : "";
  const view = ALIAS[v0] || (TITLES[v0] ? v0 : "dash");
  const ui = useState(initialUi);
  const { user, demo, logout, updateMe } = useAuth();
  const { data, error, reload } = useTutor();
  const { confirm } = useOverlay();

  useEffect(() => {
    document.title = TITLES[view][0] + " – TutorTrack";
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" }), 80); else window.scrollTo(0, 0);
  }, [view, anchor]);
  useEffect(() => {
    if (view === "billing" && user && !demo && !user.settings.onbBilling) updateMe({ settings: { onbBilling: true } }).catch(() => {});
  }, [view, user?.id]);

  if (!data) return <><div className="au" style={{ textAlign: "center" }}>{error ? <><p>{error}</p><button className="btn" onClick={reload}>Spróbuj ponownie</button></> : <p className="hint">Ładowanie…</p>}</div><ModalHost /></>;

  const out = () => confirm({
    title: demo ? "Wyjść z trybu demo?" : "Wylogować się?", text: demo ? "Dane przykładowe nie są zapisywane." : "Twoje dane są bezpiecznie zapisane na koncie.",
    ok: demo ? "Wyjdź" : "Wyloguj się", onOk: logout,
  });
  const pro = user!.plan === "pro", active = data.students.filter((s) => s.active).length;
  const pending = data.lessons.filter((l) => l.cr?.status === "pending").length;
  return (
    <UiCtx.Provider value={ui}>
      <div className="app">
        <aside className="side" aria-label="Menu główne">
          <div className="logo"><i><Logo /></i>TutorTrack</div>
          <div>{VIEWS.map((x) => <button key={x[0]} className={"nav" + (x[0] === view ? " on" : "")} onClick={() => navigate("/aplikacja/" + x[0])} aria-current={x[0] === view ? "page" : undefined}><Ic n={x[2]} />{x[1]}{x[0] === "dash" && pending > 0 && <span className="tag am" style={{ marginLeft: "auto" }}>{pending}</span>}</button>)}
            {user!.isAdmin && !demo && <button className="nav" onClick={() => navigate("/admin")}><Ic n="alert" />Panel administratora</button>}
            <button className="nav" onClick={out}><Ic n="out" />{demo ? "Wyjdź z dema" : "Wyloguj się"}</button></div>
          <button className="planchip" style={{ textAlign: "left", background: "none", cursor: "pointer", font: "inherit" }} onClick={() => navigate("/aplikacja/plan")}>Plan: <b>{pro ? "Pro" : "Free"}</b><br />Aktywni uczniowie: {active}{pro ? "" : " / " + FREE}</button>
        </aside>
        <div className="main">
          <Top view={view} onOut={out} />
          <div>{demo && <p className="banner demo-b">TRYB DEMO – dane przykładowe, nic nie jest zapisywane. <button className="lk" onClick={logout} style={{ color: "#fff", textDecoration: "underline" }}>Wyjdź z dema</button></p>}</div>
          <main className="content" id="view" tabIndex={-1}>
            {view === "dash" ? <Dashboard /> : view === "students" ? <Students /> : view === "lessons" ? <Lessons /> : view === "billing" ? <Billing />
              : view === "settings" ? <Settings key={anchor} group="konto" /> : <Welcome />}
          </main>
        </div>
      </div>
      <nav className="tabs fit" aria-label="Menu">{VIEWS.map((x) => <button key={x[0]} className={x[0] === view ? "on" : ""} onClick={() => navigate("/aplikacja/" + x[0])} aria-current={x[0] === view ? "page" : undefined}><Ic n={x[2]} s={22} />{x[1]}{x[0] === "dash" && pending > 0 && <i className="tbadge">{pending}</i>}</button>)}</nav>
      <ModalHost />
    </UiCtx.Provider>
  );
}

function Top({ view, onOut }: { view: string; onOut: () => void }) {
  const { user } = useAuth();
  const { addStudent, addLesson } = useAdd();
  const t = TITLES[view];
  const act = t[2];
  const label = t[1];
  const click = () => act === "addL" ? addLesson() : act === "addS" ? addStudent() : navigate("/aplikacja/dash");
  return (
    <header className="top">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><a className="brandm" href="/" aria-label="TutorTrack"><span className="logo" style={{ padding: 0 }}><i><Logo /></i></span></a><div><h1>{t[0]}</h1><small /></div></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="hint" id="usr">{user!.brand || user!.name}</span>
        {view !== "settings" && <button className="btn p" onClick={click}>{act !== "goDash" && <Ic n="plus" s={16} />}<span>{label}</span></button>}</div>
    </header>
  );
}

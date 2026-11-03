import { useEffect, useState } from "react";
import { Ic, Logo } from "../lib/icons";
import { navigate } from "../lib/router";
import { FREE } from "../lib/util";
import { useAuth, useTutor } from "../state";
import { ModalHost, useOverlay } from "../ui/overlay";
import { initialUi, UiCtx } from "./common";
import { Billing, Dashboard, Lessons, Settings, Students, useAdd, Welcome } from "./Views";
import { tr } from "../lib/i18n";

const VIEWS: [string, string, string][] = [["dash", tr("Pulpit"), "home"], ["students", tr("Uczniowie"), "users"], ["lessons", tr("Lekcje"), "book"], ["billing", tr("Rozliczenia"), "wallet"], ["settings", tr("Ustawienia"), "set"]];
/** Old addresses that now live inside other sections. */
const ALIAS: Record<string, string> = { stats: "billing", plan: "settings" };
const TITLES: Record<string, [string, string, string]> = {
  dash: [tr("Pulpit"), tr("Dodaj lekcję"), "addL"], students: [tr("Uczniowie"), tr("Dodaj ucznia"), "addS"], lessons: [tr("Lekcje"), tr("Dodaj lekcję"), "addL"], billing: [tr("Rozliczenia"), tr("Dodaj lekcję"), "addL"],
  welcome: [tr("Powitanie"), tr("Przejdź do pulpitu"), "goDash"], settings: [tr("Ustawienia"), tr("Pulpit"), "goDash"],
};

export function TutorApp({ view: v0 }: { view: string }) {
  const anchor = ALIAS[v0] ? v0 : "";
  const view = ALIAS[v0] || (TITLES[v0] ? v0 : "dash");
  const ui = useState(initialUi);
  const { user, demo, logout, updateMe } = useAuth();
  const { data, error, reload } = useTutor();
  const { confirm } = useOverlay();

  useEffect(() => {
    document.title = TITLES[view][0] + tr(" – TutorTrack");
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" }), 80); else window.scrollTo(0, 0);
  }, [view, anchor]);
  useEffect(() => {
    if (view === "billing" && user && !demo && !user.settings.onbBilling) updateMe({ settings: { onbBilling: true } }).catch(() => {});
  }, [view, user?.id]);

  if (!data) return <><div className="au" style={{ textAlign: "center" }}>{error ? <><p>{error}</p><button className="btn" onClick={reload}>{tr("Spróbuj ponownie")}</button></> : <p className="hint">{tr("Ładowanie…")}</p>}</div><ModalHost /></>;

  const out = () => confirm({
    title: demo ? tr("Wyjść z trybu demo?") : tr("Wylogować się?"), text: demo ? tr("Dane przykładowe nie są zapisywane.") : tr("Twoje dane są bezpiecznie zapisane na koncie."),
    ok: demo ? tr("Wyjdź") : tr("Wyloguj się"), onOk: logout,
  });
  const pro = user!.plan === "pro", active = data.students.filter((s) => s.active).length;
  const pending = data.lessons.filter((l) => l.cr?.status === "pending").length;
  return (
    <UiCtx.Provider value={ui}>
      <div className="app">
        <aside className="side" aria-label={tr("Menu główne")}>
          <div className="logo"><i><Logo /></i>{tr("TutorTrack")}</div>
          <div>{VIEWS.map((x) => <button key={x[0]} className={"nav" + (x[0] === view ? " on" : "")} onClick={() => navigate("/aplikacja/" + x[0])} aria-current={x[0] === view ? "page" : undefined}><Ic n={x[2]} />{x[1]}{x[0] === "dash" && pending > 0 && <span className="tag am" style={{ marginLeft: "auto" }}>{pending}</span>}</button>)}
            {user!.isAdmin && !demo && <button className="nav" onClick={() => navigate("/admin")}><Ic n="alert" />{tr("Panel administratora")}</button>}
            <button className="nav" onClick={out}><Ic n="out" />{demo ? tr("Wyjdź z dema") : tr("Wyloguj się")}</button></div>
        </aside>
        <div className="main">
          <Top view={view} onOut={out} />
          <div>{demo && <p className="banner demo-b">{tr("TRYB DEMO – dane przykładowe, nic nie jest zapisywane.")}{" "}<button className="lk" onClick={logout} style={{ color: "#fff", textDecoration: "underline" }}>{tr("Wyjdź z dema")}</button></p>}</div>
          <main className="content" id="view" tabIndex={-1}>
            {view === "dash" ? <Dashboard /> : view === "students" ? <Students /> : view === "lessons" ? <Lessons /> : view === "billing" ? <Billing />
              : view === "settings" ? <Settings key={anchor} group={anchor === "plan" ? "plan" : ""} /> : <Welcome />}
          </main>
        </div>
      </div>
      <nav className="tabs fit" aria-label={tr("Menu")}>{VIEWS.map((x) => <button key={x[0]} className={x[0] === view ? "on" : ""} onClick={() => navigate("/aplikacja/" + x[0])} aria-current={x[0] === view ? "page" : undefined}><Ic n={x[2]} s={22} />{x[1]}{x[0] === "dash" && pending > 0 && <i className="tbadge">{pending}</i>}</button>)}</nav>
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><a className="brandm" href="/" aria-label={tr("TutorTrack")}><span className="logo" style={{ padding: 0 }}><i><Logo /></i></span></a><div><h1>{t[0]}</h1><small /></div></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="hint" id="usr">{user!.brand || user!.name}</span>
        {view !== "settings" && <button className="btn p" onClick={click}>{act !== "goDash" && <Ic n="plus" s={16} />}<span>{label}</span></button>}</div>
    </header>
  );
}

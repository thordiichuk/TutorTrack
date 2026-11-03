import { useEffect } from "react";
import { TutorApp } from "./app/Shell";
import { navigate, useLinkInterception, useLocation } from "./lib/router";
import { Login, Register, ResetPassword } from "./pages/Auth";
import { Home, Legal, StudentHome } from "./pages/Public";
import { useAuth, TutorProvider } from "./state";
import { StudentPanel } from "./student/Panel";
import { AdminPanel } from "./admin/AdminPanel";
import { ModalHost } from "./ui/overlay";
import { useApplyTheme } from "./ui/themes";
import { LANG, setLang, tr } from "./lib/i18n";

const TITLES: Record<string, string> = {
  "/": tr("TutorTrack – dziennik korepetytora"), "/uczen": tr("TutorTrack – dla ucznia"), "/rejestracja": tr("Załóż konto – TutorTrack"), "/logowanie": tr("Zaloguj się – TutorTrack"),
  "/uczen/rejestracja": tr("Rejestracja ucznia – TutorTrack"), "/uczen/logowanie": tr("Logowanie ucznia – TutorTrack"), "/regulamin": tr("Regulamin – TutorTrack"), "/prywatnosc": tr("Polityka prywatności – TutorTrack"), "/reset-hasla": tr("Nowe hasło – TutorTrack"),
};

function Redirect({ to }: { to: string }) {
  useEffect(() => { navigate(to, true); }, [to]);
  return null;
}

export function App() {
  const { path } = useLocation();
  return <>{<Routes path={path} />}{!path.startsWith("/aplikacja") && <ModalHost />}</>;
}

function Routes({ path }: { path: string }) {
  useLinkInterception();
  const { user, loading, demo } = useAuth();

  // page-level body state: demo grayscale and the user's colour theme inside the panels
  const inApp = path.startsWith("/aplikacja");
  const inPanel = inApp || path === "/uczen/panel" || path === "/admin";
  useApplyTheme(inPanel && user && !demo ? user.settings.theme || "light" : "");
  useEffect(() => {
    document.body.classList.toggle("demo", demo && inApp);
    document.body.classList.toggle("stu", path === "/uczen/panel");
    document.body.classList.toggle("pubp", !inPanel);
    if (TITLES[path]) document.title = TITLES[path];
  }, [path, demo, inApp, inPanel]);
  useEffect(() => { if (!location.hash) window.scrollTo(0, 0); }, [path]);
  // the account's language wins over this device's choice
  useEffect(() => { const l = user && !demo ? user.settings.lang : undefined; if (l && l !== LANG) setLang(l); }, [user?.id, user?.settings.lang]);

  if (loading) return null;

  if (path.startsWith("/aplikacja")) {
    if (!user) return <><Login role="tutor" notice /><ModalHost /></>;
    if (user.role !== "tutor") return <Redirect to="/uczen/panel" />;
    return <TutorProvider><TutorApp view={path.split("/")[2] || "dash"} /></TutorProvider>;
  }
  if (path === "/admin") {
    if (!user || demo) return <Login role="tutor" notice />;
    if (!user.isAdmin) return <Redirect to={user.role === "tutor" ? "/aplikacja/dash" : "/uczen/panel"} />;
    return <AdminPanel />;
  }
  if (path === "/uczen/panel") {
    if (!user || demo) return <Login role="student" notice />;
    if (user.role !== "student") return <Redirect to="/aplikacja/dash" />;
    return <StudentPanel />;
  }
  switch (path) {
    case "/uczen": return <StudentHome />;
    case "/rejestracja": return <Register role="tutor" />;
    case "/logowanie": return <Login role="tutor" />;
    case "/uczen/rejestracja": return <Register role="student" />;
    case "/uczen/logowanie": return <Login role="student" />;
    case "/regulamin": return <Legal kind="regulamin" />;
    case "/prywatnosc": return <Legal kind="prywatnosc" />;
    case "/reset-hasla": return <ResetPassword />;
    default: return <Home />;
  }
}

import { useEffect } from "react";
import { TutorApp } from "./app/Shell";
import { navigate, useLinkInterception, useLocation } from "./lib/router";
import { Login, Register, ResetPassword } from "./pages/Auth";
import { Home, Legal, StudentHome } from "./pages/Public";
import { useAuth, TutorProvider } from "./state";
import { StudentPanel } from "./student/Panel";
import { AdminPanel } from "./admin/AdminPanel";
import { ModalHost } from "./ui/overlay";

const TITLES: Record<string, string> = {
  "/": "TutorTrack – dziennik korepetytora", "/uczen": "TutorTrack – dla ucznia", "/rejestracja": "Załóż konto – TutorTrack", "/logowanie": "Zaloguj się – TutorTrack",
  "/uczen/rejestracja": "Rejestracja ucznia – TutorTrack", "/uczen/logowanie": "Logowanie ucznia – TutorTrack", "/regulamin": "Regulamin – TutorTrack", "/prywatnosc": "Polityka prywatności – TutorTrack", "/reset-hasla": "Nowe hasło – TutorTrack",
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

  // page-level body state: demo grayscale and Pro colour themes
  useEffect(() => {
    const inApp = path.startsWith("/aplikacja");
    document.body.classList.toggle("demo", demo && inApp);
    const th = inApp && !demo && user?.plan === "pro" && user.settings.theme && user.settings.theme !== "light" ? user.settings.theme : "";
    if (th) document.body.dataset.th = th; else delete document.body.dataset.th;
    if (TITLES[path]) document.title = TITLES[path];
  }, [path, demo, user]);
  useEffect(() => { if (!location.hash) window.scrollTo(0, 0); }, [path]);

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

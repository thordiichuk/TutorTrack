import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, demoUser, isDemo, startDemo, stopDemo } from "./lib/api";
import { navigate } from "./lib/router";
import { Settings, TutorData, User } from "./lib/util";
import { errMsg, useOverlay } from "./ui/overlay";

/* ---------- session ---------- */
type AuthCtx = {
  user: User | null; loading: boolean; demo: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
  enterDemo: () => void;
  updateMe: (b: { name?: string; brand?: string; settings?: Settings }) => Promise<User>;
};
const Auth = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Auth);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    api<{ user: User | null }>("GET", "/api/auth/me").then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    if (isDemo()) { stopDemo(); setDemo(false); setUser(null); }
    else { await api("POST", "/api/auth/logout").catch(() => {}); setUser(null); }
    navigate("/");
  }, []);

  const enterDemo = useCallback(() => {
    startDemo(); setDemo(true); setUser(demoUser()); navigate("/aplikacja/dash"); window.scrollTo(0, 0);
  }, []);

  const updateMe = useCallback(async (b: { name?: string; brand?: string; settings?: Settings }) => {
    const r = await api<{ user: User }>("PATCH", "/api/me", b);
    setUser(r.user);
    return r.user;
  }, []);

  return <Auth.Provider value={{ user, loading, demo, setUser, logout, enterDemo, updateMe }}>{children}</Auth.Provider>;
}

/* ---------- tutor data ---------- */
type TutorCtx = {
  data: TutorData | null; error: string;
  reload: () => Promise<void>;
  /** Run an API call, refresh data, toast on success; errors are toasted and returned as false. */
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
};
const Tutor = createContext<TutorCtx>(null as any);
export const useTutor = () => useContext(Tutor);

export function TutorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast, modal, close } = useOverlay();
  const [data, setData] = useState<TutorData | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setData(await api<TutorData>("GET", "/api/tutor/data")); setError(""); }
    catch (e) { setError(errMsg(e)); }
  }, []);

  useEffect(() => { if (user && user.role === "tutor") reload(); else setData(null); }, [user?.id, reload]);

  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await reload(); if (ok) toast(ok); return true; }
    catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        modal(<><h2>Limit planu Free został osiągnięty</h2><p>{e.message}</p><div className="mf"><button className="btn" onClick={close}>Zamknij</button><button className="btn p" onClick={() => { close(); navigate("/aplikacja/plan"); }}>Zobacz plan Pro</button></div></>);
      } else toast(errMsg(e));
      await reload(); return false;
    }
  }, [reload, toast, modal, close]);

  return <Tutor.Provider value={{ data, error, reload, run }}>{children}</Tutor.Provider>;
}

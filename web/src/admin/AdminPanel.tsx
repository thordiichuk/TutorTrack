import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Empty, Logo } from "../lib/icons";
import { fd, fdt, MSHORT, pd, ymd } from "../lib/util";
import { useAuth } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";

type Stats = {
  users: { tutors: number; pro: number; student_accounts: number; new7: number; new30: number; active7: number; blocked: number };
  students: { records: number; linked: number };
  lessons: { total: number; last30: number };
  days: { day: string; tutors: number; students: number }[];
};
type AUser = {
  id: string; name: string; brand: string; email: string; role: "tutor" | "student"; plan: "free" | "pro"; createdAt: number; lastLoginAt: number | null;
  blocked: boolean; isAdmin: boolean; students: number; lessons: number; tutors: number;
};
type Action = { admin: string; action: string; target: string; details: Record<string, string>; at: number };

const TABS: [string, string][] = [["stats", "Przegląd"], ["users", "Użytkownicy"], ["log", "Historia działań"]];
const ACT: Record<string, (a: Action) => string> = {
  block: () => "Zablokowano konto", unblock: () => "Odblokowano konto", delete: () => "Usunięto konto",
  plan: (a) => "Zmieniono plan na " + (a.details.plan === "pro" ? "Pro" : "Free"),
};

export function AdminPanel() {
  const { user, logout } = useAuth();
  const ov = useOverlay();
  const [tab, setTab] = useState("stats");
  useEffect(() => { document.title = "Panel administratora – TutorTrack"; }, []);
  const home = user!.role === "tutor" ? "/aplikacja/dash" : "/uczen/panel";
  return <>
    <header className="ph"><div className="pi phi">
      <a className="logo" href="/"><i><Logo /></i>TutorTrack</a><span className="hint hide-sm">Panel administratora</span>
      <span style={{ flex: 1 }} /><span className="hint hide-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{user!.email}</span>
      <a className="btn s" href={home}>Moje konto</a>
      <button className="btn s" onClick={() => ov.confirm({ title: "Wylogować się?", text: "Wrócisz do strony głównej.", ok: "Wyloguj się", onOk: logout })}>Wyloguj</button>
    </div></header>
    <div className="pi">
      <nav className="utabs" aria-label="Sekcje panelu administratora">{TABS.map((x) => <button key={x[0]} className={"btn s" + (tab === x[0] ? " p" : "")} aria-current={tab === x[0] ? "page" : undefined} onClick={() => setTab(x[0])}>{x[1]}</button>)}</nav>
      <main style={{ paddingBottom: 48 }}>{tab === "stats" ? <StatsTab /> : tab === "users" ? <UsersTab /> : <LogTab />}</main>
    </div>
  </>;
}

function useLoad<T>(path: string) {
  const [d, setD] = useState<T | null>(null), [err, setErr] = useState("");
  const load = useCallback(async () => { try { setD(await api<T>("GET", path)); setErr(""); } catch (e) { setErr(errMsg(e)); } }, [path]);
  useEffect(() => { load(); }, [load]);
  return { d, err, load };
}
const Loading = ({ err, retry }: { err: string; retry: () => void }) => err ? <div className="nt">{err} <button className="btn s" onClick={retry}>Spróbuj ponownie</button></div> : <p className="hint">Ładowanie…</p>;
const Stat = ({ l, v, c, sub }: { l: string; v: number | string; c?: string; sub?: string }) => <div className="card stat"><div className="l">{l}</div><div className={"v" + (c ? " " + c : "")}>{v}</div>{sub && <div className="hint">{sub}</div>}</div>;

function StatsTab() {
  const { d, err, load } = useLoad<Stats>("/api/admin/stats");
  if (!d) return <Loading err={err} retry={load} />;
  const mx = Math.max(1, ...d.days.map((x) => x.tutors + x.students));
  return <>
    <div className="bar"><h2 style={{ margin: 0 }}>Przegląd</h2><span className="sp" /><button className="btn s" onClick={load}>Odśwież</button></div>
    <div className="grid g4">
      <Stat l="Korepetytorzy" v={d.users.tutors} sub={`w tym Pro: ${d.users.pro}`} />
      <Stat l="Konta uczniów" v={d.users.student_accounts} />
      <Stat l="Nowe konta (7 dni)" v={d.users.new7} c="gr" sub={`30 dni: ${d.users.new30}`} />
      <Stat l="Aktywni (7 dni)" v={d.users.active7} sub="logowanie w ostatnim tygodniu" />
    </div>
    <div className="grid g4" style={{ marginTop: 16 }}>
      <Stat l="Uczniowie w dziennikach" v={d.students.records} />
      <Stat l="Połączeni z panelem ucznia" v={d.students.linked} />
      <Stat l="Lekcje łącznie" v={d.lessons.total} sub={`dodane w 30 dni: ${d.lessons.last30}`} />
      <Stat l="Zablokowane konta" v={d.users.blocked} c={d.users.blocked ? "am" : undefined} />
    </div>
    <div className="card" style={{ marginTop: 16 }}><h2>Nowe konta – ostatnie 14 dni</h2>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>{d.days.map((x) => { const dd = pd(x.day); return <div key={x.day} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 11 }} title={`${fd(x.day)}: korepetytorzy ${x.tutors}, uczniowie ${x.students}`}>
        <div style={{ height: 110, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}><div style={{ background: "var(--gr)", height: Math.round(x.students / mx * 110), borderRadius: "4px 4px 0 0" }} /><div style={{ background: "var(--ac)", height: Math.round(x.tutors / mx * 110) }} /></div>
        {dd.getDate()} {MSHORT[dd.getMonth()]}<br /><b>{x.tutors + x.students}</b></div>; })}</div>
      <p className="hint">Fioletowy: korepetytorzy, zielony: uczniowie.</p></div>
    <p className="hint" style={{ marginTop: 12 }}>Panel nie pokazuje treści lekcji, notatek ani danych uczniów z dzienników – tylko dane potrzebne do zarządzania kontami.</p>
  </>;
}

function UsersTab() {
  const { user: me } = useAuth();
  const ov = useOverlay();
  const [f, setF] = useState({ q: "", role: "", status: "" });
  const [q, setQ] = useState(f);
  const [list, setList] = useState<AUser[]>([]), [total, setTotal] = useState(0), [err, setErr] = useState(""), [busy, setBusy] = useState(true);
  const fetchPage = useCallback(async (offset: number) => {
    setBusy(true);
    try {
      const r = await api<{ total: number; users: AUser[] }>("GET", `/api/admin/users?q=${encodeURIComponent(q.q)}&role=${q.role}&status=${q.status}&offset=${offset}`);
      setTotal(r.total); setList((l) => (offset ? [...l, ...r.users] : r.users)); setErr("");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }, [q]);
  useEffect(() => { fetchPage(0); }, [fetchPage]);
  useEffect(() => { const t = setTimeout(() => setQ(f), 300); return () => clearTimeout(t); }, [f]);

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); ov.toast(ok); await fetchPage(0); } catch (e) { ov.toast(errMsg(e)); } };
  const del = (u: AUser) => ov.modal(<DeleteUser u={u} onDone={() => fetchPage(0)} />);

  return <>
    <div className="bar">
      <input type="search" placeholder="Szukaj: imię, nazwisko, e-mail" value={f.q} aria-label="Szukaj konta" onChange={(e) => setF({ ...f, q: e.target.value })} />
      <select aria-label="Rodzaj konta" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="">Wszystkie konta</option><option value="tutor">Korepetytorzy</option><option value="student">Uczniowie</option></select>
      <select aria-label="Status konta" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Każdy status</option><option value="blocked">Zablokowane</option></select>
    </div>
    {err && <div className="nt">{err}</div>}
    <p className="hint">Znaleziono: {total}</p>
    {!list.length && !busy ? <div className="card"><Empty icon="users" title="Brak kont" sub="Zmień wyszukiwanie lub filtry." /></div> :
      <div className="card">{list.map((u) => {
        const self = u.id === me!.id, locked = self || u.isAdmin;
        return <div className="row" key={u.id}>
          <div className="av">{(u.name || "?").charAt(0).toUpperCase()}</div>
          <div className="m"><b>{u.name}{u.brand ? " · " + u.brand : ""}</b><span>{u.email}</span>
            <span style={{ display: "block" }}>Konto od {fd(ymd(new Date(u.createdAt)))} · {u.lastLoginAt ? "ostatnie logowanie " + fdt(u.lastLoginAt) : "brak logowania"}</span>
            <span style={{ display: "block" }}>{u.role === "tutor" ? `Uczniów: ${u.students} · lekcji: ${u.lessons}` : `Połączonych korepetytorów: ${u.tutors}`}</span></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className={"tag " + (u.role === "tutor" ? "ac" : "gr")}>{u.role === "tutor" ? "Korepetytor" : "Uczeń"}</span>
            {u.role === "tutor" && <span className="tag">{u.plan === "pro" ? "Pro" : "Free"}</span>}
            {u.isAdmin && <span className="tag am">Administrator</span>}
            {self && <span className="tag">Ty</span>}
            {u.blocked && <span className="tag rd">Zablokowane</span>}
          </div>
          {!locked && <div className="acts">
            {u.role === "tutor" && <button className="btn s" onClick={() => act(() => api("POST", `/api/admin/users/${u.id}/plan`, { plan: u.plan === "pro" ? "free" : "pro" }), "Zmieniono plan.")}>{u.plan === "pro" ? "Ustaw Free" : "Ustaw Pro"}</button>}
            <button className="btn s" onClick={() => u.blocked
              ? act(() => api("POST", `/api/admin/users/${u.id}/block`, { blocked: false }), "Konto odblokowane.")
              : ov.confirm({ title: "Zablokować konto?", text: <>{u.email} zostanie wylogowany i nie będzie mógł się zalogować, dopóki go nie odblokujesz. Dane konta zostaną zachowane.</>, ok: "Zablokuj", danger: true,
                onOk: () => act(() => api("POST", `/api/admin/users/${u.id}/block`, { blocked: true }), "Konto zablokowane.") })}>{u.blocked ? "Odblokuj" : "Zablokuj"}</button>
            <button className="btn s d" onClick={() => del(u)}>Usuń</button>
          </div>}
        </div>;
      })}</div>}
    {list.length < total && <p style={{ textAlign: "center" }}><button className="btn" disabled={busy} onClick={() => fetchPage(list.length)}>Pokaż więcej</button></p>}
  </>;
}

function DeleteUser({ u, onDone }: { u: AUser; onDone: () => void }) {
  const { close, toast } = useOverlay();
  const [v, setV] = useState(""), [err, setErr] = useState("");
  return <><h2>Usunąć konto na stałe?</h2>
    <p>Zostanie trwale usunięte konto <b>{u.email}</b>{u.role === "tutor" ? <> razem z uczniami ({u.students}) i lekcjami ({u.lessons}).</> : <> razem z jego grafikiem.</>} Tej operacji nie można cofnąć.</p>
    <Field id="dconf" label="Wpisz adres e-mail konta, aby potwierdzić" value={v} onChange={setV} error={err} autoComplete="off" />
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" style={{ background: "var(--rd)", borderColor: "var(--rd)" }} onClick={async () => {
      try { await api("DELETE", "/api/admin/users/" + u.id, { confirmEmail: v }); close(); toast("Konto usunięte."); onDone(); } catch (e) { setErr(errMsg(e)); }
    }}>Usuń konto</button></div></>;
}

function LogTab() {
  const { d, err, load } = useLoad<{ actions: Action[] }>("/api/admin/actions");
  if (!d) return <Loading err={err} retry={load} />;
  return <>
    <div className="bar"><h2 style={{ margin: 0 }}>Historia działań</h2><span className="sp" /><button className="btn s" onClick={load}>Odśwież</button></div>
    {!d.actions.length ? <div className="card"><Empty icon="note" title="Brak działań" sub="Tu pojawią się blokady, zmiany planów i usunięcia kont." /></div> :
      <div className="card">{d.actions.map((a, i) => <div className="row" key={i}><div className="m"><b>{(ACT[a.action] || (() => a.action))(a)}: {a.target}</b><span>{fdt(a.at)} · {a.admin}</span></div></div>)}</div>}
    <p className="hint" style={{ marginTop: 12 }}>Pokazane jest ostatnie 200 działań.</p>
  </>;
}

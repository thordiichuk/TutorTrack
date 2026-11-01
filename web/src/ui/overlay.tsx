import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

type ModalSpec = { node: ReactNode; wide?: boolean };
type Ctx = {
  current: ModalSpec | null; box: React.RefObject<HTMLDivElement | null>;
  modal: (node: ReactNode, wide?: boolean) => void;
  close: () => void;
  confirm: (o: { title: string; text: ReactNode; ok: string; danger?: boolean; onOk: () => void | Promise<void> }) => void;
  toast: (t: string) => void;
};
const OverlayCtx = createContext<Ctx>(null as any);
export const useOverlay = () => useContext(OverlayCtx);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [m, setM] = useState<ModalSpec | null>(null);
  const [toasts, setToasts] = useState<{ id: number; t: string }[]>([]);
  const last = useRef<HTMLElement | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setM(null);
    const el = last.current;
    setTimeout(() => { try { el?.focus(); } catch { /* ignore */ } }, 0);
  }, []);
  const modal = useCallback((node: ReactNode, wide?: boolean) => {
    if (!box.current) last.current = document.activeElement as HTMLElement;
    setM({ node, wide });
  }, []);
  const toast = useCallback((t: string) => {
    const id = Math.random();
    setToasts((x) => [...x.filter((y) => y.t !== t), { id, t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 2800);
  }, []);
  const confirm: Ctx["confirm"] = useCallback((o) => {
    modal(<Confirm {...o} />);
  }, [modal]);

  return (
    <OverlayCtx.Provider value={{ current: m, box, modal, close, confirm, toast }}>
      {children}
      <div id="toast" role="status" aria-live="polite">{toasts.map((x) => <div className="t" key={x.id}>{x.t}</div>)}</div>
    </OverlayCtx.Provider>
  );
}


/** Renders the open modal. Mounted inside the deepest providers so modal content can use their context. */
export function ModalHost() {
  const { current: m, box, close } = useOverlay();
  useEffect(() => {
    if (!m || !box.current) return;
    const f = box.current.querySelector<HTMLElement>("input,select,textarea,button");
    (f || box.current).focus();
  }, [m]);

  useEffect(() => {
    if (!m) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "Tab" && box.current) {
        const f = [...box.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,select,textarea")].filter((x) => x.offsetParent);
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [m, close]);

  if (!m) return null;
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={box} className={"modal" + (m.wide ? " w" : "")} role="dialog" aria-modal="true" tabIndex={-1}>{m.node}</div>
    </div>
  );
}

function Confirm({ title, text, ok, danger, onOk }: { title: string; text: ReactNode; ok: string; danger?: boolean; onOk: () => void | Promise<void> }) {
  const { close } = useOverlay();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="mf">
        <button className="btn" onClick={close}>Anuluj</button>
        <button className="btn p" disabled={busy} style={danger ? { background: "var(--rd)", borderColor: "var(--rd)" } : undefined}
          onClick={async () => { setBusy(true); close(); await onOk(); }}>{ok}</button>
      </div>
    </>
  );
}

/* ---------- form helpers ---------- */
export function Field({ id, label, value, onChange, type = "text", error, ...rest }:
  { id: string; label: ReactNode; value: string | number; onChange: (v: string) => void; type?: string; error?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div className="f">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={"e_" + id}
        aria-invalid={error ? "true" : "false"} className={error ? "bad" : undefined} {...rest} />
      <div className="er" id={"e_" + id} role="alert">{error || ""}</div>
    </div>
  );
}

export function errMsg(e: unknown) { return e instanceof Error ? e.message : "Wystąpił błąd."; }

import { useEffect, useRef, useState } from "react";
import { LANG, LANGS, Lang, setLang, tr } from "../lib/i18n";
import { useAuth } from "../state";

/** Language list used in tutor and student settings. */
export function LangPicker() {
  const { user, demo, updateMe } = useAuth();
  const pick = async (l: Lang) => {
    if (l === LANG) return;
    if (user && !demo) { try { await updateMe({ settings: { lang: l } }); } catch { /* still switch locally */ } }
    setLang(l);
  };
  return <div className="card"><h2>{tr("Język")}</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Język interfejsu. Zapisuje się na Twoim koncie.")}</p>
    <div className="langs">{LANGS.map(([k, n]) => <button key={k} className={"langb" + (k === LANG ? " on" : "")} aria-pressed={k === LANG} onClick={() => pick(k)}><span className="lflag">{k.toUpperCase()}</span>{n}{k === LANG && <span className="lok">✓</span>}</button>)}</div></div>;
}

/** Compact switch for public pages (footer). */
export function LangSelect() {
  return <select className="lsel" aria-label={tr("Język")} value={LANG} onChange={(e) => setLang(e.target.value as Lang)}>{LANGS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>;
}

export const langName = () => LANGS.find((x) => x[0] === LANG)![1];

/** Small flag images (drawn inline – emoji flags don't show on Windows). */
export function Flag({ l }: { l: Lang }) {
  if (l === "pl") return <svg className="flag" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="10" fill="#fff" /><rect y="10" width="30" height="10" fill="#dc143c" /><rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.15)" /></svg>;
  if (l === "uk") return <svg className="flag" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="10" fill="#0057b7" /><rect y="10" width="30" height="10" fill="#ffd700" /></svg>;
  return <svg className="flag" viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#012169" /><path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" /><path d="M0 0 60 40M60 0 0 40" stroke="#c8102e" strokeWidth="3" /><path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" /><path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="7" /></svg>;
}

/** Language switch with flags for the public header. */
export function LangFlags() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return <div className="lflags" ref={ref}>
    <button type="button" className="lfbtn" aria-haspopup="listbox" aria-expanded={open} aria-label={tr("Język") + ": " + langName()} onClick={() => setOpen(!open)}><Flag l={LANG} /><span>{LANG.toUpperCase()}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
    {open && <ul className="lfmenu" role="listbox" aria-label={tr("Język")}>{LANGS.map(([k, n]) => <li key={k}><button type="button" role="option" aria-selected={k === LANG} className={k === LANG ? "on" : ""} onClick={() => { setOpen(false); setLang(k); }}><Flag l={k} />{n}</button></li>)}</ul>}
  </div>;
}

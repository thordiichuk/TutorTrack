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

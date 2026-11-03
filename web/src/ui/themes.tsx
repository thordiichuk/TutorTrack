import { useEffect } from "react";
import { Settings } from "../lib/util";
import { useAuth } from "../state";
import { errMsg, useOverlay } from "./overlay";
import { tr } from "../lib/i18n";

export type ThemeId = NonNullable<Settings["theme"]>;
export const THEMES: { id: ThemeId; name: string; sw: [string, string, string] }[] = [
  { id: "light", name: tr("Jasny"), sw: ["#f6f7fb", "#4f46e5", "#ffffff"] },
  { id: "auto", name: tr("Systemowy"), sw: ["#f6f7fb", "#4f46e5", "#181b24"] },
  { id: "dark", name: tr("Ciemny"), sw: ["#0f1117", "#8b85ff", "#181b24"] },
  { id: "graphite", name: tr("Grafit"), sw: ["#0e0e10", "#3b9eff", "#1a1a1d"] },
  { id: "blue", name: tr("Ocean"), sw: ["#f2f8fc", "#0369a1", "#ffffff"] },
  { id: "green", name: tr("Mięta"), sw: ["#f2faf5", "#15803d", "#ffffff"] },
  { id: "pink", name: tr("Róż"), sw: ["#fff6fa", "#db2777", "#ffffff"] },
  { id: "orange", name: tr("Zachód słońca"), sw: ["#fff8f1", "#c2410c", "#ffffff"] },
  { id: "purple", name: tr("Lawenda"), sw: ["#f7f5ff", "#7c3aed", "#ffffff"] },
];

/** Applies a theme to <body data-th>. "auto" follows the device's light/dark setting. */
export function useApplyTheme(theme: ThemeId | "") {
  useEffect(() => {
    const body = document.body;
    const set = (t: string) => { if (t && t !== "light") body.dataset.th = t; else delete body.dataset.th; };
    if (theme !== "auto") { set(theme); return; }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => set(mq.matches ? "dark" : "light");
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);
}

export function ThemePicker() {
  const { user, demo, updateMe } = useAuth();
  const { toast } = useOverlay();
  const cur = user?.settings.theme || "light";
  const pick = async (id: ThemeId) => {
    if (demo) { toast(tr("W trybie demo wygląd jest czarno-biały. Załóż konto, aby wybrać motyw.")); return; }
    try { await updateMe({ settings: { theme: id } }); toast(tr("Zmieniono motyw.")); } catch (e) { toast(errMsg(e)); }
  };
  return <div className="card"><h2><span className="emo" aria-hidden="true">🎨</span>{tr("Wygląd")}</h2>
    <p className="hint" style={{ margin: "-6px 0 12px" }}>{tr("Wybierz kolory panelu. „Systemowy” dopasowuje się do jasnego lub ciemnego trybu telefonu i komputera.")}</p>
    <div className="thms">{THEMES.map((x) => <button key={x.id} className={"thm" + (cur === x.id ? " on" : "")} aria-pressed={cur === x.id} onClick={() => pick(x.id)}>
      <span className="sw">{x.sw.map((k, i) => <i key={i} style={{ background: k }} />)}</span><b>{x.name}</b></button>)}</div>
  </div>;
}

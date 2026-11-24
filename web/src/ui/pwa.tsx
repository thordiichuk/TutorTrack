import { useEffect, useState } from "react";
import { tr } from "../lib/i18n";
import { applyUpdate, isIOS, isStandalone, onPwa, promptInstall, pwa } from "../lib/pwa";
import { Ic } from "../lib/icons";
import { useOverlay } from "./overlay";

export function usePwa() {
  const [, set] = useState(0);
  useEffect(() => onPwa(() => set((n) => n + 1)), []);
  return pwa;
}

/** Whether to offer installation at all (not already installed, and the browser can do it or it is an iPhone/iPad). */
export function useCanOfferInstall() {
  const p = usePwa();
  return !isStandalone() && (p.canInstall || isIOS());
}

/** Starts the browser's install dialog, or explains the steps on iPhone/iPad. */
export function useInstall() {
  const ov = useOverlay();
  return async () => {
    if (await promptInstall()) return;
    if (isIOS()) ov.modal(<><h2>{tr("Zainstaluj aplikację")}</h2>
      <p>{tr("Na iPhonie i iPadzie aplikację dodasz z Safari:")}</p>
      <ol className="iosteps"><li>{tr("Stuknij przycisk Udostępnij")} <span className="ioshare" aria-hidden="true">⬆︎</span> {tr("na dole ekranu.")}</li><li>{tr("Wybierz „Do ekranu początkowego”.")}</li><li>{tr("Stuknij „Dodaj”. Ikona TutorTrack pojawi się na ekranie telefonu.")}</li></ol>
      <div className="mf"><button className="btn p" onClick={ov.close}>{tr("Rozumiem")}</button></div></>);
  };
}

/** Bars at the bottom: offline (saved data) and a new version. */
export function PwaBars() {
  const p = usePwa();
  if (p.update) return <div className="pwabar" role="status"><span>{tr("Dostępna nowa wersja aplikacji.")}</span><button className="btn s p" onClick={applyUpdate}>{tr("Odśwież")}</button></div>;
  if (p.offlineSince) { const d = new Date(p.offlineSince), t = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return <div className="pwabar off" role="status"><Ic n="alert" s={16} /><span>{tr("Brak internetu – dane z {0}. Zmiany zapiszesz po połączeniu.", t)}</span></div>; }
  return null;
}

/** One-time, dismissible install banner for dashboards (after a few visits). */
export function InstallBanner() {
  const can = useCanOfferInstall();
  const install = useInstall();
  const [off, setOff] = useState(() => { try { return localStorage.getItem("tt_inst_off") === "1" || Number(localStorage.getItem("tt_visits") || 0) < 3; } catch { return true; } });
  if (!can || off) return null;
  const close = () => { try { localStorage.setItem("tt_inst_off", "1"); } catch { /* ignore */ } setOff(true); };
  return <div className="instb"><span className="instic" aria-hidden="true"><Ic n="download" s={18} /></span><div><b>{tr("Zainstaluj TutorTrack na telefonie")}</b><span>{tr("Ikona na ekranie, pełny ekran i szybszy start. Bez sklepu z aplikacjami.")}</span></div>
    <button className="btn s p" onClick={() => { install(); close(); }}>{tr("Zainstaluj")}</button><button className="mx2" aria-label={tr("Zamknij")} onClick={close}><Ic n="x" s={16} /></button></div>;
}

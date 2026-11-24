import { useState } from "react";
import { ApiError, isDemo } from "../lib/api";
import { tr } from "../lib/i18n";
import { Material, MSHORT, pd } from "../lib/util";
import { Field, useOverlay } from "./overlay";

/** Recognise well-known services, so a OneDrive or Google Drive link looks like one. */
export function linkInfo(url: string): [string, string] {
  let h = ""; try { h = new URL(url).hostname.toLowerCase(); } catch { /* not a URL */ }
  if (/(^|\.)1drv\.ms$|onedrive\.live\.com$|sharepoint\.com$/.test(h)) return ["☁️", "OneDrive"];
  if (/drive\.google\.com$|docs\.google\.com$/.test(h)) return ["🟢", "Google Drive"];
  if (/youtube\.com$|youtu\.be$/.test(h)) return ["▶️", "YouTube"];
  if (/dropbox\.com$/.test(h)) return ["📦", "Dropbox"];
  if (/quizlet\.com$/.test(h)) return ["🃏", "Quizlet"];
  if (/canva\.com$/.test(h)) return ["🎨", "Canva"];
  return ["🔗", h.replace(/^www\./, "") || tr("Link")];
}
const fileIcon = (m: Material) => (m.mime.startsWith("image/") ? "🖼️" : m.mime === "application/pdf" ? "📕" : /word|opendocument\.text/.test(m.mime) ? "📘" : /sheet|excel/.test(m.mime) ? "📗" : /presentation|powerpoint/.test(m.mime) ? "📙" : "📄");
export const fsize = (n: number) => (n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + " KB" : (n / 1024 / 1024).toFixed(1).replace(".", ",") + " MB");
export const openMaterial = (m: Material) => window.open(m.kind === "link" ? m.url : `/api/materials/${m.id}/file`, "_blank", "noopener");

/** List of materials; a delete button where `canDelete` allows it. */
export function MatList({ items, canDelete, onDelete, empty }: { items: Material[]; canDelete?: (m: Material) => boolean; onDelete?: (m: Material) => void; empty?: string }) {
  const ov = useOverlay();
  if (!items.length) return empty ? <p className="hint" style={{ margin: "4px 0 0" }}>{empty}</p> : null;
  return <div className="mats">{items.map((m) => { const [ic, src] = m.kind === "link" ? linkInfo(m.url) : [fileIcon(m), fsize(m.size)];
    return <div className="mat" key={m.id}>
      <button type="button" className="matb" onClick={() => openMaterial(m)}><span className="matic" aria-hidden="true">{ic}</span><span className="m"><b>{m.name}</b><span>{m.byStudent ? tr("Rozwiązanie ucznia") + " · " : ""}{src}</span></span></button>
      {canDelete?.(m) && onDelete && <button className="mx2" aria-label={tr("Usuń")} onClick={() => ov.confirm({ title: tr("Usunąć materiał?"), text: m.name, ok: tr("Usuń"), danger: true, onOk: () => onDelete(m) })}>✕</button>}
    </div>; })}</div>;
}

/** Ask the browser for one file. */
export function pickFile(accept = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.ods,.txt"): Promise<File | null> {
  return new Promise((res) => { const f = document.createElement("input"); f.type = "file"; f.accept = accept; f.onchange = () => res(f.files?.[0] || null); f.click(); });
}
/** Send a file as raw bytes (max. 5 MB); the server checks the type and the space left. */
export async function uploadFile(url: string, file: File) {
  if (isDemo()) throw new ApiError(400, "W trybie demo nie można dodawać plików.");
  if (file.size > 5 * 1024 * 1024) throw new ApiError(413, "Plik jest za duży – maksymalnie 5 MB. Większe pliki dodaj jako link do OneDrive lub Google Drive.");
  let r: Response;
  try { r = await fetch(url + (url.includes("?") ? "&" : "?") + "name=" + encodeURIComponent(file.name), { method: "POST", credentials: "same-origin", headers: { "content-type": "application/octet-stream" }, body: file }); }
  catch { throw new ApiError(0, "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie."); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, d.error || "Wystąpił błąd. Spróbuj ponownie.");
  return d;
}

/** Window for adding a link, with a hint about sharing on OneDrive / Google Drive. */
export function AddLink({ onSave, series, back }: { onSave: (b: { name: string; url: string; series: boolean }) => Promise<boolean>; series?: boolean; back?: () => void }) {
  const { close } = useOverlay();
  const [url, setUrl] = useState(""), [name, setName] = useState(""), [all, setAll] = useState(false), [e, setE] = useState(""), [busy, setBusy] = useState(false);
  const info = /^https?:\/\//i.test(url.trim()) ? linkInfo(url.trim()) : null;
  const save = async () => {
    const u = url.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) { setE(tr("Podaj adres zaczynający się od http:// lub https://.")); return; }
    setBusy(true); const ok = await onSave({ name: name.trim(), url: u, series: all }); setBusy(false); if (ok) (back || close)();
  };
  return <><h2>{tr("Dodaj link")}</h2>
    <Field id="mlu" label={tr("Adres (link) *")} value={url} onChange={setUrl} error={e} placeholder="https://" />
    {info && <p className="hint" style={{ margin: "-4px 0 10px" }}>{info[0]} {info[1]}</p>}
    <Field id="mln" label={tr("Nazwa (opcjonalnie)")} value={name} onChange={setName} placeholder={tr("Np. Karta wzorów, Arkusz maturalny 2025")} />
    <div className="nt" style={{ fontSize: 13 }}>{tr("Pliki z OneDrive lub Google Drive: kliknij „Udostępnij” → „Kopiuj link” i upewnij się, że każdy z linkiem może wyświetlać plik. Tak dodasz też pliki większe niż 5 MB.")}</div>
    {series && <div className="chk" style={{ marginTop: 10 }}><input type="checkbox" id="mls" checked={all} onChange={(x) => setAll(x.target.checked)} /><label htmlFor="mls">{tr("Dołącz też do następnych lekcji z tej serii")}</label></div>}
    <div className="mf"><button className="btn" onClick={back || close}>{tr("Anuluj")}</button><button className="btn p" disabled={busy} onClick={save}>{tr("Dodaj")}</button></div></>;
}

/** All materials of a student (library and lessons) – student and parent panels. */
export function MaterialsPage({ items, lessons, tutorOf, onBack, canDelete, onDelete }: {
  items: Material[]; lessons: { id: string; date: string; subject: string }[]; tutorOf: (sid: string) => { tutor: string; subject: string } | undefined; onBack: () => void;
  canDelete?: (m: Material) => boolean; onDelete?: (m: Material) => void;
}) {
  const [q, setQ] = useState(""), [sub, setSub] = useState("");
  const les = (m: Material) => (m.lessonId ? lessons.find((l) => l.id === m.lessonId) : undefined);
  const subjOf = (m: Material) => les(m)?.subject || (tutorOf(m.sid)?.subject || "").split(",")[0].trim();
  const subs = [...new Set(items.map(subjOf).filter(Boolean))].sort();
  const vis = items.filter((m) => (m.lessonId ? !!les(m) : true) && (!sub || subjOf(m) === sub) && (!q.trim() || (m.name + " " + m.url).toLowerCase().includes(q.trim().toLowerCase())));
  const lib = vis.filter((m) => !m.lessonId), fromL = vis.filter((m) => m.lessonId).sort((a, b) => les(b)!.date.localeCompare(les(a)!.date));
  const tutors = [...new Set(lib.map((m) => m.sid))];
  return <>
    <button className="sback" onClick={onBack}><span aria-hidden="true">‹</span> {tr("Lekcje")}</button>
    <div className="bar" style={{ margin: "0 0 10px" }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Szukaj materiału")} aria-label={tr("Szukaj materiału")} /></div>
    {subs.length > 1 && <div className="chips" style={{ marginBottom: 12 }}><button className={"chip" + (!sub ? " on" : "")} onClick={() => setSub("")}>{tr("Wszystkie")}</button>{subs.map((x) => <button key={x} className={"chip" + (sub === x ? " on" : "")} onClick={() => setSub(x)}>{x}</button>)}</div>}
    {!vis.length ? <div className="card"><p className="hint" style={{ margin: 0 }}>{items.length ? tr("Żaden materiał nie pasuje do wyszukiwania.") : tr("Korepetytor nie dodał jeszcze materiałów.")}</p></div> : <>
      {tutors.map((sid) => <div className="card" key={sid} style={{ marginBottom: 12 }}><h2 style={{ marginBottom: 2 }}>{tr("Materiały od:")}{" "}{tutorOf(sid)?.tutor || ""}</h2><MatList items={lib.filter((m) => m.sid === sid)} canDelete={canDelete} onDelete={onDelete} /></div>)}
      {fromL.length > 0 && <div className="card"><h2 style={{ marginBottom: 2 }}>{tr("Z lekcji")}</h2>{[...new Set(fromL.map((m) => m.lessonId))].map((lid) => { const l = lessons.find((x) => x.id === lid)!; const d = pd(l.date);
        return <div key={lid} style={{ marginTop: 10 }}><div className="hint" style={{ fontWeight: 600 }}>{d.getDate()} {MSHORT[d.getMonth()]} · {l.subject || tr("Lekcja")}</div><MatList items={fromL.filter((m) => m.lessonId === lid)} canDelete={canDelete} onDelete={onDelete} /></div>; })}</div>}
    </>}
  </>;
}

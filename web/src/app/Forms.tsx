import { useState } from "react";
import { api, isDemo } from "../lib/api";
import {
  printText, shareText, FREE, calc, cancelFee, copyText, emailOk, fd, fm, gStr, Lesson, lev, MSHORT, overlap, pd, pln, rateFor, sortL, Student, subjList, toG, ymd, amt, billable, sumAmt, te,
  subjRates,
} from "../lib/util";
import { useAuth, useTutor } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { Empty, Ic } from "../lib/icons";
import { laterInSeries, newRep, Rep, RepeatBox, repDates, ScopeAsk, SeriesList } from "./series";
import { LessonItem, LessonTags, registerLessonUi, useData, useUi, useUpsell } from "./common";
import { tr } from "../lib/i18n";

const APP_URL = typeof location !== "undefined" ? location.origin : "";

/* ---------- student form ---------- */
export function StudentForm({ s, onSaved }: { s?: Student; onSaved?: () => void }) {
  const { user } = useAuth();
  const { students, lessons } = useData();
  const { run } = useTutor();
  const { close } = useOverlay();
  const base = s || { name: "", subject: "", email: "", phone: "", rate: user?.settings.rate || 10000, note: "", cancelMode: "off", cancelPct: 0, cancelFixed: 0, rates: {} } as Partial<Student>;
  const [f, setF] = useState({
    name: base.name || "", subject: base.subject || "", rate: gStr(base.rate || 0), email: base.email || "", phone: base.phone || "", note: base.note || "",
    cm: (base.cancelMode || (base.cancelPct! > 0 ? "percent" : "off")) as Student["cancelMode"], cp: String(base.cancelPct || 0), cx: gStr(base.cancelFixed || 0),
  });
  const [rates, setRates] = useState<Record<string, string>>(Object.fromEntries(Object.entries(base.rates || {}).map(([k, v]) => [k, gStr(v)])));
  const [e, setE] = useState<Record<string, string>>({});
  const [warned, setWarned] = useState("");
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const subs = (() => { const seen: Record<string, 1> = {}; return subjList({ subject: f.subject }).filter((x) => { const k = x.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }); })();

  async function save() {
    const n = f.name.trim(); let sub = f.subject.trim(); const r = toG(f.rate), em = f.email.trim();
    const sl = sub.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean), dup = sl.find((x, i) => sl.indexOf(x) !== i);
    const cp = Number(f.cp), cx = toG(f.cx);
    const er: Record<string, string> = {
      name: n ? "" : tr("Podaj imię i nazwisko."),
      subject: !sub ? tr("Podaj przedmiot.") : dup ? tr("Przedmiot „{0}” powtarza się na liście.", dup) : "",
      rate: isNaN(r) || r < 0 ? tr("Podaj poprawną, nieujemną stawkę.") : "",
      email: em && !emailOk(em) ? tr("Niepoprawny adres e-mail.") : "",
      cp: f.cm === "percent" && !(cp >= 0 && cp <= 100) ? tr("Podaj liczbę od 0 do 100.") : "",
      cx: f.cm === "fixed" && (isNaN(cx) || cx < 0) ? tr("Podaj poprawną, nieujemną kwotę.") : "",
    };
    const known: Record<string, string> = {};
    students.forEach((o) => { if (o.id !== s?.id) subjList(o).forEach((x) => { known[x.toLowerCase()] = x; }); });
    const orig = subjList({ subject: sub }), cn = orig.map((x) => known[x.toLowerCase()] || x);
    let near: [string, string] | null = null;
    orig.forEach((x) => { if (near || known[x.toLowerCase()] || x.length < 4) return; Object.keys(known).forEach((k) => { if (!near && lev(x.toLowerCase(), k) <= 1) near = [x, known[k]]; }); });
    if (!Object.values(er).some(Boolean) && near && warned !== sub) {
      setWarned(sub); setE({ subject: tr("Przedmiot „{0}” jest podobny do istniejącego „{1}”. Popraw pisownię lub zapisz ponownie, jeśli to inny przedmiot.", near[0], near[1]) });
      document.getElementById("ss")?.focus(); return;
    }
    const rr: Record<string, number> = {};
    for (const [k, v] of Object.entries(rates)) {
      if (!v.trim()) continue;
      const g = toG(v);
      if (isNaN(g) || g < 0) er.rates = tr("Popraw stawki przedmiotów – podaj kwoty nieujemne.");
      else { const i = orig.indexOf(k); const key = i >= 0 ? cn[i] : k; if (cn.includes(key)) rr[key] = g; }
    }
    setE(er);
    if (Object.values(er).some(Boolean)) return;
    sub = cn.join(", ");
    const body = { name: n, subject: sub, rate: r, email: em, phone: f.phone.trim(), note: f.note.trim(), cancelMode: f.cm, cancelPct: cp, cancelFixed: isNaN(cx) ? 0 : cx, rates: rr };
    const ok = await run(async () => {
      if (s) {
        await api("PATCH", "/api/students/" + s.id, body);
        // apply a newly configured cancellation fee to cancelled, unpaid lessons without a fee
        const st = { ...s, ...body } as Student;
        const fix = lessons.filter((l) => l.sid === s.id && l.status === "cancelled" && !l.paid && !l.fee && cancelFee(st, l.amount) > 0);
        for (const l of fix) await api("PATCH", "/api/lessons/" + l.id, { fee: cancelFee(st, l.amount) });
      } else await api("POST", "/api/students", body);
    }, s ? tr("Zapisano zmiany ucznia.") : tr("Dodano ucznia."));
    if (ok) { close(); onSaved?.(); }
  }

  return <>
    <h2>{s ? tr("Edytuj ucznia") : tr("Dodaj ucznia")}</h2>
    <Field id="sn" label={tr("Imię i nazwisko *")} value={f.name} onChange={set("name")} error={e.name} autoComplete="off" />
    <div className="f2">
      <Field id="ss" label={tr("Przedmioty * (kilka po przecinku)")} value={f.subject} onChange={set("subject")} error={e.subject} />
      <Field id="sr" label={tr("Stawka za 60 min (zł) *")} value={f.rate} onChange={set("rate")} error={e.rate} inputMode="decimal" />
    </div>
    {subs.length > 1 && <div><div className="hint" style={{ marginBottom: 6 }}>{tr("Osobne stawki dla przedmiotów (puste pole = stawka podstawowa):")}</div>
      {subs.map((x) => <div className="f" key={x}><label>{tr("Stawka:")}{" "}{x}{" "}{tr("(zł / 60 min)")}</label><input value={rates[x] || ""} placeholder={f.rate} inputMode="decimal" onChange={(ev) => setRates({ ...rates, [x]: ev.target.value })} /></div>)}
      {e.rates && <div className="er" role="alert" style={{ color: "var(--rd)", fontSize: 12, marginBottom: 8 }}>{e.rates}</div>}</div>}
    <div className="f2">
      <Field id="se" label={tr("E-mail (opcjonalnie)")} type="email" value={f.email} onChange={set("email")} error={e.email} />
      <Field id="sp" label={tr("Telefon (opcjonalnie)")} type="tel" value={f.phone} onChange={set("phone")} />
    </div>
    <fieldset className="cfs"><legend>{tr("Odwołane lekcje")}</legend>
      <div className="f"><label htmlFor="scm">{tr("Opłata za odwołanie")}</label><select id="scm" value={f.cm} onChange={(ev) => setF({ ...f, cm: ev.target.value as Student["cancelMode"] })}><option value="off">{tr("Brak opłaty")}</option><option value="percent">{tr("Procent ceny lekcji")}</option><option value="fixed">{tr("Stała kwota")}</option></select></div>
      {f.cm === "percent" && <Field id="scp" label={tr("Procent ceny lekcji (%)")} type="number" min={0} max={100} step={5} value={f.cp} onChange={set("cp")} error={e.cp} />}
      {f.cm === "fixed" && <Field id="scx" label={tr("Stała kwota (zł)")} value={f.cx} onChange={set("cx")} error={e.cx} inputMode="decimal" />}
    </fieldset>
    <div className="f"><label htmlFor="sno">{tr("Notatka")}</label><textarea id="sno" rows={3} value={f.note} onChange={(ev) => setF({ ...f, note: ev.target.value })} /></div>
    <div className="mf">{s && <ArchiveActions s={s} />}<button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" onClick={save}>{tr("Zapisz ucznia")}</button></div>
  </>;
}

/* ---------- note templates (Pro) ---------- */
const TPL: [string, string][] = [[tr("Plan lekcji"), tr("Plan lekcji:\n1. \n2. \n3. ")], [tr("Zadanie domowe"), tr("Zadanie domowe: ")], [tr("Podsumowanie lekcji"), tr("Omówione: \nTrudności: \nNa następną lekcję: ")], [tr("Do powtórzenia"), tr("Do powtórzenia: ")]];
function TplSel({ onPick }: { onPick: (t: string) => void }) {
  const { user } = useAuth();
  if (user?.plan !== "pro") return null;
  const all = TPL.concat((user.settings.tpl || []).map((x) => [x.n, x.t] as [string, string]));
  return <select aria-label={tr("Wstaw szablon")} style={{ marginBottom: 6 }} value="" onChange={(e) => { if (e.target.value !== "") onPick(all[+e.target.value][1]); }}>
    <option value="">{tr("Wstaw szablon…")}</option>{all.map((x, i) => <option key={i} value={i}>{x[0]}</option>)}</select>;
}

/* ---------- lesson form ---------- */
export function LessonForm({ l, pre, draft }: { l?: Lesson; pre?: string; draft?: Partial<Lesson> }) {
  const { user } = useAuth();
  const { students, lessons, stu } = useData();
  const { run } = useTutor();
  const { close, modal } = useOverlay();
  const act = students.filter((s) => s.active || (l && s.id === l.sid));
  const first = stu(pre || "") || act[0];
  const init: Lesson = l ? { ...l } : {
    id: "", sid: first.id, subject: subjList(first)[0] || "", date: ymd(new Date()), time: user?.settings.time || "16:00", min: user?.settings.dur || 60,
    topic: "", prep: "", notes: "", hw: "", hd: "", status: "planned", paid: false, amount: calc(rateFor(first, subjList(first)[0]), user?.settings.dur || 60), fee: 0,
  };
  const d0 = { ...init, ...(draft || {}) };
  const [d, setD] = useState({ ...d0, minS: String(d0.min), amtS: gStr(d0.amount), feeS: gStr(d0.fee > 0 ? d0.fee : cancelFee(stu(d0.sid), d0.amount)) });
  const [manual, setManual] = useState(!!l || !!draft);
  const [feeManual, setFeeManual] = useState(false);
  const [e, setE] = useState<Record<string, string>>({});
  const [rep, setRep] = useState<Rep>(() => newRep(d0.date));
  const { proUp } = useUpsell();
  const upd = (p: Partial<typeof d>, auto = !manual) => {
    const n = { ...d, ...p };
    if (auto) { const s = stu(n.sid), m = Number(n.minS); if (s && m > 0) n.amtS = gStr(calc(rateFor(s, n.subject), m)); }
    if (n.status === "cancelled" && !feeManual) { const a = toG(n.amtS); n.feeS = gStr(cancelFee(stu(n.sid), isNaN(a) ? 0 : a)); }
    setD(n);
  };
  const subOpts = (() => { const s = stu(d.sid); const list = s ? subjList(s) : []; if (d.subject && !list.includes(d.subject)) list.push(d.subject); return list; })();

  async function save() {
    const m = Number(d.minS), a = toG(d.amtS), fe = toG(d.feeS);
    const er = {
      date: d.date ? "" : tr("Wybierz datę."), time: d.time ? "" : tr("Wybierz godzinę."),
      min: !(m > 0) || Math.round(m) !== m ? tr("Czas trwania musi być dodatnią liczbą minut.") : "",
      amount: isNaN(a) || a < 0 ? tr("Podaj poprawną, nieujemną kwotę.") : "",
      fee: d.status === "cancelled" && (isNaN(fe) || fe < 0) ? tr("Podaj poprawną, nieujemną kwotę.") : "",
      // a lesson can't be done (or added as cancelled) on a future date
      status: d.date > ymd(new Date()) && (d.status === "done" || (d.status === "cancelled" && !l)) ? (d.status === "done" ? tr("Przeprowadzona lekcja nie może mieć przyszłej daty.") : tr("Nie można dodać odwołanej lekcji z przyszłą datą – dodaj ją jako zaplanowaną i odwołaj później.")) : "",
    };
    setE(er); if (Object.values(er).some(Boolean)) return;
    const rec = {
      sid: d.sid, subject: d.subject, date: d.date, time: d.time, min: m, topic: d.topic.trim(), prep: d.prep.trim(),
      // notes and homework are only edited once the lesson is done; otherwise keep what was saved before
      notes: d.status === "done" ? d.notes.trim() : l?.notes || "",
      hw: d.status === "done" ? d.hw.trim() : l?.hw || "", hd: d.status === "done" ? (d.hw.trim() ? d.hd : "") : l?.hd || "",
      status: d.status, paid: d.paid, amount: a, fee: d.status === "cancelled" ? fe : 0,
    };
    if (rec.status === "cancelled" && !rec.fee) rec.paid = false;
    // a new recurring series
    if (!l && rep.freq) {
      const dates = repDates(rec.date, rec.time, m, rep, lessons);
      if (!dates.length) { setE({ ...er, date: tr("Brak terminów – sprawdź datę początku i końca.") }); return; }
      const ok = await run(() => api("POST", "/api/lessons/series", { ...rec, status: "planned", paid: false, notes: "", hw: "", hd: "", fee: 0, freq: rep.freq, dates }), tr("Dodano serię: {0} lekcji.", dates.length));
      if (ok) close();
      return;
    }
    const later = l ? laterInSeries(l, lessons) : [];
    const shared = l && later.length > 0 && (rec.date !== l.date || rec.time !== l.time || rec.min !== l.min || rec.amount !== l.amount || rec.subject !== l.subject);
    const send = async (scope: "one" | "future") => {
      const ok = await run(() => (l ? api("PATCH", "/api/lessons/" + l.id + (scope === "future" ? "?scope=future" : ""), rec) : api("POST", "/api/lessons", rec)), l ? tr("Zapisano zmiany lekcji.") : tr("Dodano lekcję."));
      if (ok) close();
    };
    const commit = async () => {
      if (shared) modal(<ScopeAsk title={tr("Zmienić też kolejne lekcje?")} text={tr("Zmiana dnia, godziny, czasu trwania, kwoty lub przedmiotu może dotyczyć tylko tej lekcji albo także kolejnych zaplanowanych lekcji z tej serii.")} n={later.length} onPick={send} />);
      else await send("one");
    };
    const ov = rec.status === "cancelled" ? [] : overlap(lessons, rec.date, rec.time, m, l?.id);
    if (ov.length) {
      const x = ov[0], s = stu(x.sid);
      modal(<><h2>{tr("Nakładające się terminy")}</h2><p>{tr("W tym czasie masz już lekcję:")}{" "}<b>{s ? s.name : ""}</b>, {fd(x.date)}, {x.time} ({x.min}{" "}{tr("min). Czy na pewno zapisać obie?")}</p>
        <div className="mf"><button className="btn" onClick={() => modal(<LessonForm l={l} draft={{ ...rec }} />)}>{tr("Wróć do edycji")}</button><button className="btn p" onClick={commit}>{tr("Zapisz mimo to")}</button></div></>);
    } else await commit();
  }

  return <>
    <h2>{l ? tr("Edytuj lekcję") : tr("Dodaj lekcję")}</h2>
    <div className="f"><label htmlFor="lst">{tr("Uczeń *")}</label><select id="lst" value={d.sid} onChange={(ev) => { const s = stu(ev.target.value); setManual(false); upd({ sid: ev.target.value, subject: s ? subjList(s)[0] || "" : "" }, true); }}>
      {act.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? "" : tr(" (zarchiwizowany)")}</option>)}</select></div>
    {subOpts.length > 1 && <div className="f"><label htmlFor="lsu">{tr("Przedmiot")}</label><select id="lsu" value={d.subject} onChange={(ev) => { setManual(false); upd({ subject: ev.target.value }, true); }}>{subOpts.map((x) => <option key={x}>{x}</option>)}</select></div>}
    <div className="f2"><Field id="ld" label={tr("Data *")} type="date" value={d.date} onChange={(v) => upd({ date: v, ...(v > ymd(new Date()) && (d.status === "done" || (d.status === "cancelled" && !l)) ? { status: "planned" as const } : {}) })} error={e.date} /><Field id="lt" label={tr("Godzina *")} type="time" value={d.time} onChange={(v) => upd({ time: v })} error={e.time} /></div>
    <Field id="lto" label={tr("Temat lekcji")} value={d.topic} onChange={(v) => upd({ topic: v })} />
    {l?.seriesId && <p className="hint" style={{ margin: "-6px 0 10px" }}>↻ {tr("Lekcja z serii. Przy zapisie zapytamy, czy zmienić też kolejne lekcje.")}</p>}
    <div className="f2"><Field id="lm" label={tr("Czas trwania (min) *")} type="number" min={1} step={5} value={d.minS} onChange={(v) => upd({ minS: v })} error={e.min} /><Field id="la" label={tr("Kwota (zł) *")} value={d.amtS} onChange={(v) => { setManual(true); upd({ amtS: v }, false); }} error={e.amount} inputMode="decimal" /></div>
    {!l && <RepeatBox start={d.date} time={d.time} min={Number(d.minS) || 60} rep={rep} set={setRep} pro={user?.plan === "pro"} onPro={() => proUp(tr("Lekcje cykliczne"))} />}
    {(d.status === "planned" || !!d.prep) && <div className="f"><label htmlFor="lpn">{tr("Notatka przed zajęciami")}</label><TplSel onPick={(t) => upd({ prep: (d.prep ? d.prep + "\n" : "") + t })} /><textarea id="lpn" rows={2} placeholder={tr("Plan lekcji, materiały – widzisz ją tylko Ty")} value={d.prep} onChange={(ev) => upd({ prep: ev.target.value })} /></div>}
    <div className="f2">
      <div className="f"><label htmlFor="lss">{tr("Status lekcji")}</label><select id="lss" value={d.status} onChange={(ev) => upd({ status: ev.target.value as Lesson["status"] }, false)}><option value="planned">{tr("Zaplanowana")}</option><option value="done" disabled={d.date > ymd(new Date())}>{tr("Przeprowadzona")}</option><option value="cancelled" disabled={!l && d.date > ymd(new Date())}>{tr("Odwołana")}</option></select>{e.status && <div className="er" role="alert">{e.status}</div>}</div>
      <div className="f"><label htmlFor="lps">{tr("Status płatności")}</label><select id="lps" value={d.paid ? "1" : "0"} onChange={(ev) => upd({ paid: ev.target.value === "1" }, false)}><option value="0">{tr("Nieopłacona")}</option><option value="1">{tr("Opłacona")}</option></select></div>
    </div>
    {d.status === "done" ? <>
      <div className="f"><label htmlFor="lno">{tr("Notatka po zajęciach")}</label><TplSel onPick={(t) => upd({ notes: (d.notes ? d.notes + "\n" : "") + t })} /><textarea id="lno" rows={3} value={d.notes} onChange={(ev) => upd({ notes: ev.target.value })} /></div>
      <div className="f2"><div className="f"><label htmlFor="lhw">{tr("Praca domowa")}</label><textarea id="lhw" rows={2} placeholder={tr("Np. zad. 3–7, str. 52")} value={d.hw} onChange={(ev) => upd({ hw: ev.target.value })} /></div><Field id="lhd" label={tr("Termin pracy domowej")} type="date" value={d.hd} onChange={(v) => upd({ hd: v })} /></div>
      <p className="hint" style={{ margin: "-6px 0 10px" }}>{tr("Notatka po zajęciach i praca domowa są widoczne w panelu ucznia, jeśli uczeń jest połączony z Tobą kodem. Notatka przed zajęciami zostaje prywatna.")}</p>
    </> : d.status === "planned" && <p className="hint" style={{ margin: "-6px 0 10px" }}>{tr("Notatkę po zajęciach i pracę domową dodasz, gdy oznaczysz lekcję jako przeprowadzoną.")}</p>}
    {d.status === "cancelled" && <Field id="lfe" label={tr("Opłata za odwołanie (zł)")} value={d.feeS} onChange={(v) => { setFeeManual(true); setD({ ...d, feeS: v }); }} error={e.fee} inputMode="decimal" />}
    {d.status === "cancelled" && <p className="hint">{tr("Odwołana lekcja jest płatna tylko wtedy, gdy w danych ucznia ustawiono opłatę za odwołanie.")}</p>}
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" onClick={save}>{!l && rep.freq ? tr("Zapisz serię") : tr("Zapisz lekcję")}</button></div>
  </>;
}

/* ---------- mark as done ---------- */
function DoneModal({ l }: { l: Lesson }) {
  const { stu } = useData();
  const { run } = useTutor();
  const { close } = useOverlay();
  const [n, setN] = useState(l.notes), [hw, setHw] = useState(l.hw), [hd, setHd] = useState(l.hd);
  const s = stu(l.sid);
  return <>
    <h2>{tr("Oznaczyć lekcję jako przeprowadzoną?")}</h2>
    <p className="hint">{l.topic || tr("Bez tematu")} · {s ? s.name : ""} · {fd(l.date)}, {l.time}</p>
    <div className="f"><label htmlFor="dn">{tr("Notatka podsumowująca (opcjonalnie)")}</label><textarea id="dn" rows={4} placeholder={tr("Co omówiliście? Co warto powtórzyć na następnej lekcji?")} value={n} onChange={(e) => setN(e.target.value)} /></div>
    <div className="f2"><div className="f"><label htmlFor="dhw">{tr("Praca domowa (opcjonalnie)")}</label><textarea id="dhw" rows={2} placeholder={tr("Np. zad. 3–7, str. 52")} value={hw} onChange={(e) => setHw(e.target.value)} /></div><Field id="dhd" label={tr("Termin pracy domowej")} type="date" value={hd} onChange={setHd} /></div>
    <p className="hint">{tr("Po potwierdzeniu lekcja trafi do rozliczeń jako przeprowadzona.")}</p>
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" onClick={async () => {
      close();
      await run(() => api("PATCH", "/api/lessons/" + l.id, { status: "done", notes: n.trim() || l.notes, hw: hw.trim(), hd: hw.trim() ? hd : "" }), n.trim() ? tr("Lekcja przeprowadzona, notatka zapisana.") : tr("Lekcja oznaczona jako przeprowadzona."));
    }}>{tr("Potwierdź")}</button></div>
  </>;
}

/* ---------- row actions ---------- */
/* ---------- student's cancellation request: accept / reject ---------- */
export function CancelRequestActions({ l }: { l: Lesson }) {
  const { stu } = useData();
  const { run } = useTutor();
  const { modal, confirm } = useOverlay();
  const s = stu(l.sid);
  const fee = cancelFee(s, l.amount);
  const { lessons } = useData();
  if (l.cr?.status !== "pending") return null;
  if (l.cr.kind === "move") {
    const d = pd(l.date); d.setDate(d.getDate() + 7); const nd = ymd(d);
    return <>
      <button className="btn s p" onClick={async () => {
        const ok = await run(() => api("POST", `/api/lessons/${l.id}/cancel-request/move`), tr("Lekcja przeniesiona na ") + fd(nd) + ".");
        if (ok && overlap(lessons, nd, l.time, l.min, l.id).length) modal(<><h2>{tr("Uwaga: nakładające się terminy")}</h2><p>{tr("Lekcja została przeniesiona na")}{" "}{fd(nd)}, {l.time}{tr(", ale nakłada się na inną lekcję. Jeśli to pomyłka, zmień termin w edycji.")}</p><DoneBtn /></>);
      }}>{tr("Przenieś na")}{" "}{fd(nd).replace(/ \d{4}$/, "")}</button>
      <button className="btn s" onClick={() => modal(<CancelInstead l={l} nd={nd} />)}>{tr("Odwołaj zamiast przenosić")}</button>
      <button className="btn s" onClick={() => modal(<RejectRequest l={l} />)}>{tr("Odrzuć prośbę")}</button>
    </>;
  }
  return <>
    <button className="btn s p" onClick={() => confirm({
      title: tr("Potwierdzić odwołanie lekcji?"), ok: tr("Potwierdź odwołanie"),
      text: <>{s ? s.name : ""} · {fd(l.date)}, {l.time}<br />{tr("Przyczyna:")}{" "}{l.cr!.reason}<br />{fee > 0 ? <>{tr("Zostanie naliczona opłata za odwołanie:")}{" "}<b>{pln(fee)}</b>.</> : tr("Odwołana lekcja nie będzie płatna.")}</>,
      onOk: () => { run(() => api("POST", `/api/lessons/${l.id}/cancel-request/accept`, { fee }), tr("Lekcja odwołana. Uczeń zobaczy potwierdzenie.")); },
    })}>{tr("Potwierdź odwołanie")}</button>
    <button className="btn s" onClick={() => modal(<RejectRequest l={l} />)}>{tr("Odrzuć prośbę")}</button>
  </>;
}
/** Student asked to move the lesson, but the tutor cancels it instead and tells the student why. */
function CancelInstead({ l, nd }: { l: Lesson; nd: string }) {
  const { run } = useTutor();
  const { close } = useOverlay();
  const [note, setNote] = useState(""), [err, setErr] = useState("");
  return <>
    <h2>{tr("Odwołać lekcję zamiast przenosić?")}</h2>
    <p className="hint">{tr("Uczeń prosił o przeniesienie na")}{" "}{fd(nd)}, {l.time}{tr(". Przyczyna ucznia:")}{" "}{l.cr?.reason}</p>
    <div className="f"><label htmlFor="cin">{tr("Komentarz dla ucznia *")}</label><textarea id="cin" rows={3} maxLength={500} placeholder={tr("Np. W tym terminie nie mogę – napisz, proszę, jaki inny dzień Ci pasuje.")} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="e_cin" />
      <div className="er" id="e_cin" role="alert" style={{ color: "var(--rd)", fontSize: 12 }}>{err}</div></div>
    <p className="hint">{tr("Lekcja zostanie odwołana bez opłaty. Uczeń zobaczy Twój komentarz w swoim panelu.")}</p>
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" onClick={async () => {
      if (note.trim().length < 3) { setErr(tr("Napisz krótki komentarz dla ucznia.")); return; }
      if (await run(() => api("POST", `/api/lessons/${l.id}/cancel-request/accept`, { fee: 0, note: note.trim() }), tr("Lekcja odwołana. Uczeń zobaczy Twój komentarz."))) close();
    }}>{tr("Odwołaj lekcję")}</button></div>
  </>;
}
function RejectRequest({ l }: { l: Lesson }) {
  const { run } = useTutor();
  const { close } = useOverlay();
  const [note, setNote] = useState("");
  return <>
    <h2>{l.cr?.kind === "move" ? tr("Odrzucić prośbę o przeniesienie?") : tr("Odrzucić prośbę o odwołanie?")}</h2>
    <p className="hint">{tr("Przyczyna podana przez ucznia:")}{" "}{l.cr?.reason}</p>
    <div className="f"><label htmlFor="rjn">{tr("Komentarz dla ucznia (opcjonalnie)")}</label><textarea id="rjn" rows={3} maxLength={500} placeholder={tr("Np. Odwołanie jest możliwe najpóźniej 24 godziny przed lekcją.")} value={note} onChange={(e) => setNote(e.target.value)} /></div>
    <p className="hint">{tr("Lekcja zostanie zaplanowana bez zmian. Uczeń zobaczy Twoją decyzję i komentarz.")}</p>
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" onClick={async () => { if (await run(() => api("POST", `/api/lessons/${l.id}/cancel-request/reject`, { note: note.trim() }), tr("Prośba odrzucona."))) close(); }}>{tr("Odrzuć prośbę")}</button></div>
  </>;
}

export function LessonActions({ l }: { l: Lesson }) {
  const { user } = useAuth();
  const { stu, lessons } = useData();
  const { run } = useTutor();
  const { modal, confirm } = useOverlay();
  const s = stu(l.sid);
  const fee = cancelFee(s, l.amount);
  const pro = user?.plan === "pro";
  const pendingCr = l.cr?.status === "pending";
  return <div className="acts">
    <CancelRequestActions l={l} />
    {!pendingCr && l.status === "planned" && <>
      {l.date <= ymd(new Date()) && <button className="btn s p" onClick={() => modal(<DoneModal l={l} />)}>{tr("Przeprowadzona")}</button>}
      <button className="btn s" onClick={() => confirm({ title: tr("Odwołać lekcję?"), text: <>{l.topic || tr("Bez tematu")} · {fd(l.date)}<br />{fee > 0 ? <>{tr("Zostanie naliczona opłata:")}{" "}<b>{pln(fee)}</b>.</> : tr("Odwołana lekcja nie jest płatna.")}</>, ok: tr("Odwołaj lekcję"),
        onOk: () => { run(() => api("PATCH", "/api/lessons/" + l.id, { status: "cancelled", fee, paid: false }), tr("Lekcja odwołana.")); } })}>{tr("Odwołana")}</button>
    </>}
    {!pendingCr && (l.status !== "cancelled" || l.fee > 0) && <button className="btn s" onClick={() => {
      if (l.paid) run(() => api("PATCH", "/api/lessons/" + l.id, { paid: false }), tr("Cofnięto oznaczenie płatności."));
      else confirm({ title: tr("Czy na pewno lekcja została opłacona?"), text: <>{l.topic || tr("Bez tematu")} · {s ? s.name : ""} · {fd(l.date)}{l.status === "cancelled" ? <><br />{tr("Odwołana lekcja – opłata za odwołanie:")}{" "}</> : <br />}<b>{pln(amt(l))}</b>{tr(". Możesz to później cofnąć.")}</>, ok: tr("Tak, opłacona"),
        onOk: () => { run(() => api("PATCH", "/api/lessons/" + l.id, { paid: true }), tr("Lekcja oznaczona jako opłacona.")); } });
    }}>{l.paid ? tr("Cofnij płatność") : tr("Opłacona")}</button>}
    {l.status === "cancelled" && !l.fee && fee > 0 && <button className="btn s p" onClick={() => run(() => api("PATCH", "/api/lessons/" + l.id, { fee }), tr("Naliczono opłatę: ") + pln(fee) + ".")}>{tr("Nalicz opłatę")}</button>}
    {!pendingCr && <button className="btn s" onClick={async () => {
      const d = pd(l.date); d.setDate(d.getDate() + 7);
      const n = { sid: l.sid, subject: l.subject, date: ymd(d), time: l.time, min: l.min, topic: l.topic, status: "planned", paid: false, amount: l.amount, fee: 0 };
      const ok = await run(() => api("POST", "/api/lessons", n));
      if (!ok) return;
      if (overlap(lessons, n.date, n.time, n.min).length) modal(<><h2>{tr("Uwaga: nakładające się terminy")}</h2><p>{tr("Dodano lekcję na")}{" "}{fd(n.date)}{tr(", ale nakłada się ona na inną lekcję. Jeśli to pomyłka, zmień termin w edycji.")}</p><DoneBtn /></>);
      else modal(<><h2>{tr("Dodano lekcję")}</h2><p>{tr("Nowa lekcja:")}{" "}{fd(n.date)}, {n.time}.</p><DoneBtn /></>);
    }}>{tr("Powtórz za tydzień")}</button>}
    <button className="btn s" onClick={() => modal(<LessonForm l={l} />)}>{tr("Edytuj")}</button>
    <button className="btn s d" onClick={() => { const later = laterInSeries(l, lessons);
      if (later.length) modal(<ScopeAsk danger title={tr("Usunąć lekcję?")} text={pro ? tr("Usunięte lekcje trafią do kosza na 30 dni.") : tr("Tej operacji nie można cofnąć.")} n={later.length}
        onPick={(sc) => { run(() => api("DELETE", "/api/lessons/" + l.id + (sc === "future" ? "?scope=future" : "")), sc === "future" ? tr("Usunięto lekcję i kolejne z serii.") : (pro ? tr("Lekcja w koszu.") : tr("Lekcja usunięta."))); }} />);
      else confirm({ title: tr("Usunąć lekcję?"), text: pro ? tr("Lekcja trafi do kosza na 30 dni.") : tr("Tej operacji nie można cofnąć. W planie Pro usunięte lekcje trafiają do kosza."), ok: tr("Usuń lekcję"), danger: true,
      onOk: () => { run(() => api("DELETE", "/api/lessons/" + l.id), pro ? tr("Lekcja w koszu.") : tr("Lekcja usunięta.")); } }); }}>{tr("Usuń")}</button>
  </div>;
}
function DoneBtn() { const { close } = useOverlay(); return <div className="mf"><button className="btn p" onClick={close}>{tr("Rozumiem")}</button></div>; }

/* ---------- student detail ---------- */
export function StudentDetail({ id }: { id: string }) {
  const { stu, lessons } = useData();
  const { close, modal } = useOverlay();
  const s = stu(id);
  if (!s) return null;
  const ls = sortL(lessons.filter((l) => l.sid === id), -1), dn = ls.filter((l) => l.status === "done");
  return <>
    <h2>{s.name} <span className={"tag " + (s.active ? "gr" : "")}>{s.active ? tr("Aktywny") : tr("Zarchiwizowany")}</span></h2>
    <div className="rates">{subjRates(s).map(([x, r]) => <span key={x} className="rate">{x && <b>{x}</b>}{pln(r)}{" "}{tr("/ 60 min")}</span>)}</div>
    <p>{tr("E-mail:")}{" "}{s.email || tr("brak")}<br />{tr("Telefon:")}{" "}{s.phone || tr("brak")}{s.note && <><br />{tr("Notatka:")}{" "}{s.note}</>}</p>
    <div className="grid g2" style={{ marginBottom: 12 }}><div className="card stat"><div className="l">{tr("Przeprowadzone lekcje")}</div><div className="v">{dn.length}</div></div><div className="card stat"><div className="l">{tr("Do zapłaty")}</div><div className="v am">{pln(sumAmt(ls.filter(billable), (l) => !l.paid))}</div></div></div>
    <SeriesList sid={id} />
    <h2>{tr("Historia lekcji")}</h2>
    {ls.length ? ls.map((l) => <LessonItem key={l.id} l={l} quick={false} />) : <Empty icon="book" title={tr("Brak lekcji")} sub={tr("Dodaj pierwszą lekcję dla tego ucznia.")} />}
    <div className="mf"><button className="btn" onClick={() => modal(<StudentForm s={s} />)}>{tr("Edytuj")}</button><button className="btn" onClick={() => modal(<ShareModal id={id} />, true)}>{s.inviteCode ? tr("Kod ucznia") : tr("Udostępnij uczniowi")}</button><span style={{ flex: 1 }} /><button className="btn" onClick={close}>{tr("Zamknij")}</button><button className="btn p" onClick={() => modal(<LessonForm pre={id} />)}>{tr("Dodaj lekcję")}</button></div>
  </>;
}

/* ---------- share with student (invite code) ---------- */
export function ShareModal({ id }: { id: string }) {
  const { stu } = useData();
  const { run } = useTutor();
  const { close, confirm, toast, modal } = useOverlay();
  const s = stu(id);
  if (!s) return null;
  if (isDemo()) return <><h2>{tr("Panel ucznia")}</h2><p>{tr("W trybie demo nie można udostępniać danych uczniom. Załóż konto, aby korzystać z panelu ucznia.")}</p><div className="mf"><button className="btn" onClick={close}>{tr("Zamknij")}</button></div></>;
  const create = () => run(() => api("POST", `/api/students/${id}/invite`)).then((ok) => { if (ok) modal(<ShareModal id={id} />); });
  if (!s.inviteCode) return <>
    <h2>{tr("Udostępnij panel ucznia")}</h2>
    <p>{s.name}{" "}{tr("założy bezpłatne konto ucznia i wpisze kod – zobaczy swoje lekcje, notatki po zajęciach i prace domowe. Wszystko aktualizuje się samo po każdej zmianie w dzienniku.")}</p>
    <p className="hint">{tr("Uczeń widzi: terminy, przedmioty, tematy, statusy i kwoty swoich lekcji, notatki po zajęciach oraz prace domowe. Notatki przed zajęciami i dane innych uczniów zostają prywatne.")}</p>
    <div className="mf"><button className="btn" onClick={close}>{tr("Anuluj")}</button><button className="btn p" onClick={create}>{tr("Utwórz kod dostępu")}</button></div>
  </>;
  const msg = tr("Cześć! Twoje lekcje, notatki i prace domowe znajdziesz w panelu ucznia TutorTrack.\n1. Załóż bezpłatne konto: {0}/uczen/rejestracja\n2. Wpisz kod od korepetytora: {1}", APP_URL, s.inviteCode);
  return <>
    <h2>{tr("Panel ucznia –")}{" "}{s.name}</h2>
    <p className="hint" style={{ margin: "0 0 4px" }}>{tr("Kod dostępu")}</p>
    <div className="code">{s.inviteCode}</div>
    <p className="hint" aria-live="polite">{s.linked ? <span className="tag gr">{tr("Uczeń jest połączony")}</span> : tr("Uczeń jeszcze nie wpisał kodu.")}{" "}{tr("Zmiany w dzienniku są widoczne u ucznia od razu.")}</p>
    <div className="f"><label htmlFor="shm">{tr("Wiadomość dla ucznia")}</label><textarea id="shm" rows={5} readOnly value={msg} /></div>
    <p className="hint">{tr("Kod działa dla jednego konta ucznia. Jeśli wycieknie, utwórz nowy – stary przestanie działać, a uczeń zostanie odłączony.")}</p>
    <div className="mf">
      <button className="btn d" onClick={() => confirm({ title: tr("Wyłączyć dostęp ucznia?"), text: tr("Uczeń przestanie widzieć lekcje w panelu ucznia. Twój dziennik się nie zmieni."), ok: tr("Wyłącz dostęp"), danger: true, onOk: () => { run(() => api("DELETE", `/api/students/${id}/invite`), tr("Dostęp ucznia wyłączony.")); } })}>{tr("Wyłącz dostęp")}</button>
      <button className="btn" onClick={() => confirm({ title: tr("Utworzyć nowy kod?"), text: tr("Stary kod przestanie działać, a połączone konto ucznia zostanie odłączone."), ok: tr("Utwórz nowy kod"), onOk: create })}>{tr("Nowy kod")}</button>
      <button className="btn p" onClick={async () => { toast((await copyText(msg)) ? tr("Skopiowano.") : tr("Zaznacz tekst i skopiuj go ręcznie.")); }}>{tr("Kopiuj wiadomość")}</button>
    </div>
  </>;
}

/* ---------- monthly summary text ---------- */
export function summaryText(s: Student, lessons: Lesson[], m: string, brand: string) {
  const ls = sortL(lessons.filter((l) => l.sid === s.id && (l.status === "done" || l.status === "cancelled") && l.date.slice(0, 7) === m), 1);
  const L = [tr("Podsumowanie lekcji – ") + fm(m), ...(brand ? [tr("Korepetytor: ") + brand] : []), tr("Uczeń: ") + s.name, ""];
  ls.forEach((l) => { const d = pd(l.date); L.push("• " + d.getDate() + " " + MSHORT[d.getMonth()] + ", " + l.time + " – " + (l.status === "cancelled" ? tr("odwołana lekcja") : l.topic || tr("lekcja")) + " (" + l.min + tr(" min): ") + (l.status === "cancelled" && !l.fee ? tr("bez opłaty") : pln(amt(l))) + (l.paid ? tr(" (opłacona)") : "")); });
  const t = sumAmt(ls, () => true), p = sumAmt(ls, (l) => l.paid);
  L.push("", tr("Razem: ") + pln(t), tr("Opłacone: ") + pln(p), tr("Do zapłaty: ") + pln(t - p));
  return L.join("\n");
}

export function SummaryModal({ id }: { id: string }) {
  const { user } = useAuth();
  const { stu, lessons } = useData();
  const [ui] = useUi();
  const { close, toast } = useOverlay();
  const { proUp } = useUpsell();
  const s = stu(id)!;
  const t = summaryText(s, lessons, ui.bm, user?.brand || "");
  return <>
    <h2>{tr("Podsumowanie dla ucznia")}</h2><p className="hint">{tr("Skopiuj i wyślij uczniowi lub rodzicowi.")}</p>
    <textarea rows={11} readOnly value={t} />
    <div className="pt">{t}</div>
    <div className="mf"><button className="btn" onClick={close}>{tr("Zamknij")}</button>
      <button className="btn only-m" onClick={() => shareText("Podsumowanie lekcji – " + s.name, t)}>{tr("Udostępnij")}</button>
      <button className="btn no-m" onClick={() => { if (user?.plan !== "pro") { proUp(tr("Wydruk i PDF podsumowania")); return; } printText("Podsumowanie lekcji – " + s.name, t); }}>{tr("Drukuj / PDF")}{user?.plan !== "pro" && <> <span className="tag ac">{tr("Pro")}</span></>}</button>
      <button className="btn p" onClick={async () => toast((await copyText(t)) ? tr("Skopiowano.") : tr("Zaznacz tekst i skopiuj go ręcznie."))}>{tr("Kopiuj")}</button></div>
  </>;
}

export { errMsg };

/* ---------- lesson window: details + every action in one place ---------- */
export function LessonSheet({ id }: { id: string }) {
  const { lessons, stu } = useData();
  const { close } = useOverlay();
  const l = lessons.find((x) => x.id === id);
  if (!l) return <><h2>{tr("Lekcja")}</h2><p className="hint">{tr("Ta lekcja została usunięta.")}</p><div className="mf"><button className="btn" onClick={close}>{tr("Zamknij")}</button></div></>;
  const s = stu(l.sid), sub = l.subject || (s ? subjList(s)[0] : "");
  const st = l.status === "done" ? tr("przeprowadzona") : l.status === "cancelled" ? tr("odwołana") : tr("zaplanowana");
  const pay = l.status === "cancelled" ? (l.fee > 0 ? pln(l.fee) + tr(" (opłata) · ") + (l.paid ? tr("opłacona") : tr("nieopłacona")) : tr("bez opłaty")) : pln(l.amount) + " · " + (l.paid ? tr("opłacona") : tr("nieopłacona"));
  return <div className="lsheet">
    <div className="lsh"><div><h2>{s ? s.name : tr("Lekcja")}{sub ? " · " + sub : ""}</h2><div className="hint">{fd(l.date)} · {st}</div></div></div>
    <div className="kv"><span>{tr("Godzina")}</span><b>{l.time}–{te(l.time, l.min)} ({l.min}{" "}{tr("min)")}</b></div>
    {l.topic && <div className="kv"><span>{tr("Temat")}</span><b>{l.topic}</b></div>}
    <div className="kv"><span>{tr("Kwota")}</span><b>{pay}</b></div>
    {l.prep && <div className="kvb"><span>{tr("Przed zajęciami")}</span><p className="pre">{l.prep}</p></div>}
    {l.notes && <div className="kvb"><span>{tr("Po zajęciach")}</span><p className="pre">{l.notes}</p></div>}
    {l.hw && <div className="kvb"><span>{tr("Praca domowa")}{l.hd ? tr(" · termin ") + fd(l.hd) : ""}</span><p className="pre">{l.hw}</p></div>}
    {l.cr?.status === "pending" && <div className="rqbox"><b>{l.cr.kind === "move" ? tr("Prośba o przeniesienie na następny tydzień") : tr("Prośba o odwołanie")}</b><span>{tr("Przyczyna: „")}{l.cr.reason}”</span></div>}
    {l.cr?.status === "accepted" && l.status === "cancelled" && <p className="hint">{l.cr.kind === "move" ? tr("Uczeń prosił o przeniesienie – lekcja odwołana") : tr("Odwołana na prośbę ucznia")}: {l.cr.reason}{l.cr.note ? <><br />{tr("Twój komentarz:")}{" "}{l.cr.note}</> : null}</p>}
    {l.cr?.status === "moved" && <p className="hint">{tr("Przeniesiona na prośbę ucznia")}{l.cr.note ? tr(" z ") + fd(l.cr.note) : ""}{tr(". Przyczyna:")}{" "}{l.cr.reason}</p>}
    <LessonActions l={l} />
  </div>;
}

/** One-tap "done" for planned lessons that already took place (today or earlier). */
export function QuickDone({ l }: { l: Lesson }) {
  const { modal } = useOverlay();
  if (l.status !== "planned" || l.date > ymd(new Date()) || l.cr?.status === "pending") return null;
  return <button className="btn s qd" title={tr("Oznacz jako przeprowadzoną")} onClick={(e) => { e.stopPropagation(); modal(<DoneModal l={l} />); }}>{tr("Przeprowadzona")}</button>;
}
registerLessonUi((p) => <LessonSheet {...p} />, (p) => <QuickDone {...p} />);

/** Archive / restore / delete – kept in the edit window instead of every student card. */
function ArchiveActions({ s }: { s: Student }) {
  const { user } = useAuth();
  const { students, lessons } = useData();
  const { run } = useTutor();
  const { confirm, close } = useOverlay();
  const { upsell } = useUpsell();
  const pro = user?.plan === "pro";
  if (s.active) return <button className="btn" style={{ marginRight: "auto" }} onClick={() => confirm({ title: tr("Zarchiwizować ucznia?"), text: tr("Historia lekcji i rozliczenia zostaną zachowane. Ucznia możesz przywrócić w każdej chwili."), ok: tr("Archiwizuj"), onOk: () => { run(() => api("PATCH", "/api/students/" + s.id, { active: false }), tr("Uczeń zarchiwizowany.")); } })}>{tr("Archiwizuj")}</button>;
  return <span style={{ marginRight: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
    <button className="btn" onClick={() => { if (user?.plan === "free" && students.filter((x) => x.active).length >= FREE) { upsell(); return; } close(); run(() => api("PATCH", "/api/students/" + s.id, { active: true }), tr("Uczeń przywrócony.")); }}>{tr("Przywróć")}</button>
    <button className="btn d" onClick={() => confirm({ title: tr("Usunąć ucznia?"), text: tr("{0} i jego lekcje ({1}) {2}", s.name, lessons.filter((l) => l.sid === s.id).length, pro ? "trafią do kosza na 30 dni." : "zostaną trwale usunięte. W planie Pro można je przywrócić z kosza."), ok: tr("Usuń ucznia"), danger: true, onOk: () => { run(() => api("DELETE", "/api/students/" + s.id), pro ? tr("Uczeń w koszu.") : tr("Uczeń usunięty.")); } })}>{tr("Usuń")}</button>
  </span>;
}

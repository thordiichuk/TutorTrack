import { useState } from "react";
import { api, isDemo } from "../lib/api";
import {
  FREE, calc, cancelFee, copyText, emailOk, fd, fm, gStr, Lesson, lev, MSHORT, overlap, pd, pln, rateFor, sortL, Student, subjList, toG, ymd, amt, billable, sumAmt, te,
  subjRates,
} from "../lib/util";
import { useAuth, useTutor } from "../state";
import { errMsg, Field, useOverlay } from "../ui/overlay";
import { Empty } from "../lib/icons";
import { LessonItem, LessonTags, registerLessonUi, useData, useUi, useUpsell } from "./common";

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
      name: n ? "" : "Podaj imię i nazwisko.",
      subject: !sub ? "Podaj przedmiot." : dup ? `Przedmiot „${dup}” powtarza się na liście.` : "",
      rate: isNaN(r) || r < 0 ? "Podaj poprawną, nieujemną stawkę." : "",
      email: em && !emailOk(em) ? "Niepoprawny adres e-mail." : "",
      cp: f.cm === "percent" && !(cp >= 0 && cp <= 100) ? "Podaj liczbę od 0 do 100." : "",
      cx: f.cm === "fixed" && (isNaN(cx) || cx < 0) ? "Podaj poprawną, nieujemną kwotę." : "",
    };
    const known: Record<string, string> = {};
    students.forEach((o) => { if (o.id !== s?.id) subjList(o).forEach((x) => { known[x.toLowerCase()] = x; }); });
    const orig = subjList({ subject: sub }), cn = orig.map((x) => known[x.toLowerCase()] || x);
    let near: [string, string] | null = null;
    orig.forEach((x) => { if (near || known[x.toLowerCase()] || x.length < 4) return; Object.keys(known).forEach((k) => { if (!near && lev(x.toLowerCase(), k) <= 1) near = [x, known[k]]; }); });
    if (!Object.values(er).some(Boolean) && near && warned !== sub) {
      setWarned(sub); setE({ subject: `Przedmiot „${near[0]}” jest podobny do istniejącego „${near[1]}”. Popraw pisownię lub zapisz ponownie, jeśli to inny przedmiot.` });
      document.getElementById("ss")?.focus(); return;
    }
    const rr: Record<string, number> = {};
    for (const [k, v] of Object.entries(rates)) {
      if (!v.trim()) continue;
      const g = toG(v);
      if (isNaN(g) || g < 0) er.rates = "Popraw stawki przedmiotów – podaj kwoty nieujemne.";
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
    }, s ? "Zapisano zmiany ucznia." : "Dodano ucznia.");
    if (ok) { close(); onSaved?.(); }
  }

  return <>
    <h2>{s ? "Edytuj ucznia" : "Dodaj ucznia"}</h2>
    <Field id="sn" label="Imię i nazwisko *" value={f.name} onChange={set("name")} error={e.name} autoComplete="off" />
    <div className="f2">
      <Field id="ss" label="Przedmioty * (kilka po przecinku)" value={f.subject} onChange={set("subject")} error={e.subject} />
      <Field id="sr" label="Stawka za 60 min (zł) *" value={f.rate} onChange={set("rate")} error={e.rate} inputMode="decimal" />
    </div>
    {subs.length > 1 && <div><div className="hint" style={{ marginBottom: 6 }}>Osobne stawki dla przedmiotów (puste pole = stawka podstawowa):</div>
      {subs.map((x) => <div className="f" key={x}><label>Stawka: {x} (zł / 60 min)</label><input value={rates[x] || ""} placeholder={f.rate} inputMode="decimal" onChange={(ev) => setRates({ ...rates, [x]: ev.target.value })} /></div>)}
      {e.rates && <div className="er" role="alert" style={{ color: "var(--rd)", fontSize: 12, marginBottom: 8 }}>{e.rates}</div>}</div>}
    <div className="f2">
      <Field id="se" label="E-mail (opcjonalnie)" type="email" value={f.email} onChange={set("email")} error={e.email} />
      <Field id="sp" label="Telefon (opcjonalnie)" type="tel" value={f.phone} onChange={set("phone")} />
    </div>
    <fieldset className="cfs"><legend>Odwołane lekcje</legend>
      <div className="f"><label htmlFor="scm">Opłata za odwołanie</label><select id="scm" value={f.cm} onChange={(ev) => setF({ ...f, cm: ev.target.value as Student["cancelMode"] })}><option value="off">Brak opłaty</option><option value="percent">Procent ceny lekcji</option><option value="fixed">Stała kwota</option></select></div>
      {f.cm === "percent" && <Field id="scp" label="Procent ceny lekcji (%)" type="number" min={0} max={100} step={5} value={f.cp} onChange={set("cp")} error={e.cp} />}
      {f.cm === "fixed" && <Field id="scx" label="Stała kwota (zł)" value={f.cx} onChange={set("cx")} error={e.cx} inputMode="decimal" />}
    </fieldset>
    <div className="f"><label htmlFor="sno">Notatka</label><textarea id="sno" rows={3} value={f.note} onChange={(ev) => setF({ ...f, note: ev.target.value })} /></div>
    <div className="mf">{s && <ArchiveActions s={s} />}<button className="btn" onClick={close}>Anuluj</button><button className="btn p" onClick={save}>Zapisz ucznia</button></div>
  </>;
}

/* ---------- note templates (Pro) ---------- */
const TPL: [string, string][] = [["Plan lekcji", "Plan lekcji:\n1. \n2. \n3. "], ["Zadanie domowe", "Zadanie domowe: "], ["Podsumowanie lekcji", "Omówione: \nTrudności: \nNa następną lekcję: "], ["Do powtórzenia", "Do powtórzenia: "]];
function TplSel({ onPick }: { onPick: (t: string) => void }) {
  const { user } = useAuth();
  if (user?.plan !== "pro") return null;
  const all = TPL.concat((user.settings.tpl || []).map((x) => [x.n, x.t] as [string, string]));
  return <select aria-label="Wstaw szablon" style={{ marginBottom: 6 }} value="" onChange={(e) => { if (e.target.value !== "") onPick(all[+e.target.value][1]); }}>
    <option value="">Wstaw szablon…</option>{all.map((x, i) => <option key={i} value={i}>{x[0]}</option>)}</select>;
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
      date: d.date ? "" : "Wybierz datę.", time: d.time ? "" : "Wybierz godzinę.",
      min: !(m > 0) || Math.round(m) !== m ? "Czas trwania musi być dodatnią liczbą minut." : "",
      amount: isNaN(a) || a < 0 ? "Podaj poprawną, nieujemną kwotę." : "",
      fee: d.status === "cancelled" && (isNaN(fe) || fe < 0) ? "Podaj poprawną, nieujemną kwotę." : "",
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
    const commit = async () => {
      const ok = await run(() => (l ? api("PATCH", "/api/lessons/" + l.id, rec) : api("POST", "/api/lessons", rec)), l ? "Zapisano zmiany lekcji." : "Dodano lekcję.");
      if (ok) close();
    };
    const ov = rec.status === "cancelled" ? [] : overlap(lessons, rec.date, rec.time, m, l?.id);
    if (ov.length) {
      const x = ov[0], s = stu(x.sid);
      modal(<><h2>Nakładające się terminy</h2><p>W tym czasie masz już lekcję: <b>{s ? s.name : ""}</b>, {fd(x.date)}, {x.time} ({x.min} min). Czy na pewno zapisać obie?</p>
        <div className="mf"><button className="btn" onClick={() => modal(<LessonForm l={l} draft={{ ...rec }} />)}>Wróć do edycji</button><button className="btn p" onClick={commit}>Zapisz mimo to</button></div></>);
    } else await commit();
  }

  return <>
    <h2>{l ? "Edytuj lekcję" : "Dodaj lekcję"}</h2>
    <div className="f"><label htmlFor="lst">Uczeń *</label><select id="lst" value={d.sid} onChange={(ev) => { const s = stu(ev.target.value); setManual(false); upd({ sid: ev.target.value, subject: s ? subjList(s)[0] || "" : "" }, true); }}>
      {act.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? "" : " (zarchiwizowany)"}</option>)}</select></div>
    {subOpts.length > 1 && <div className="f"><label htmlFor="lsu">Przedmiot</label><select id="lsu" value={d.subject} onChange={(ev) => { setManual(false); upd({ subject: ev.target.value }, true); }}>{subOpts.map((x) => <option key={x}>{x}</option>)}</select></div>}
    <div className="f2"><Field id="ld" label="Data *" type="date" value={d.date} onChange={(v) => upd({ date: v })} error={e.date} /><Field id="lt" label="Godzina *" type="time" value={d.time} onChange={(v) => upd({ time: v })} error={e.time} /></div>
    <Field id="lto" label="Temat lekcji" value={d.topic} onChange={(v) => upd({ topic: v })} />
    <div className="f2"><Field id="lm" label="Czas trwania (min) *" type="number" min={1} step={5} value={d.minS} onChange={(v) => upd({ minS: v })} error={e.min} /><Field id="la" label="Kwota (zł) *" value={d.amtS} onChange={(v) => { setManual(true); upd({ amtS: v }, false); }} error={e.amount} inputMode="decimal" /></div>
    {(d.status === "planned" || !!d.prep) && <div className="f"><label htmlFor="lpn">Notatka przed zajęciami</label><TplSel onPick={(t) => upd({ prep: (d.prep ? d.prep + "\n" : "") + t })} /><textarea id="lpn" rows={2} placeholder="Plan lekcji, materiały – widzisz ją tylko Ty" value={d.prep} onChange={(ev) => upd({ prep: ev.target.value })} /></div>}
    <div className="f2">
      <div className="f"><label htmlFor="lss">Status lekcji</label><select id="lss" value={d.status} onChange={(ev) => upd({ status: ev.target.value as Lesson["status"] }, false)}><option value="planned">Zaplanowana</option><option value="done">Przeprowadzona</option><option value="cancelled">Odwołana</option></select></div>
      <div className="f"><label htmlFor="lps">Status płatności</label><select id="lps" value={d.paid ? "1" : "0"} onChange={(ev) => upd({ paid: ev.target.value === "1" }, false)}><option value="0">Nieopłacona</option><option value="1">Opłacona</option></select></div>
    </div>
    {d.status === "done" ? <>
      <div className="f"><label htmlFor="lno">Notatka po zajęciach</label><TplSel onPick={(t) => upd({ notes: (d.notes ? d.notes + "\n" : "") + t })} /><textarea id="lno" rows={3} value={d.notes} onChange={(ev) => upd({ notes: ev.target.value })} /></div>
      <div className="f2"><div className="f"><label htmlFor="lhw">Praca domowa</label><textarea id="lhw" rows={2} placeholder="Np. zad. 3–7, str. 52" value={d.hw} onChange={(ev) => upd({ hw: ev.target.value })} /></div><Field id="lhd" label="Termin pracy domowej" type="date" value={d.hd} onChange={(v) => upd({ hd: v })} /></div>
      <p className="hint" style={{ margin: "-6px 0 10px" }}>Notatka po zajęciach i praca domowa są widoczne w panelu ucznia, jeśli uczeń jest połączony z Tobą kodem. Notatka przed zajęciami zostaje prywatna.</p>
    </> : d.status === "planned" && <p className="hint" style={{ margin: "-6px 0 10px" }}>Notatkę po zajęciach i pracę domową dodasz, gdy oznaczysz lekcję jako przeprowadzoną.</p>}
    {d.status === "cancelled" && <Field id="lfe" label="Opłata za odwołanie (zł)" value={d.feeS} onChange={(v) => { setFeeManual(true); setD({ ...d, feeS: v }); }} error={e.fee} inputMode="decimal" />}
    {d.status === "cancelled" && <p className="hint">Odwołana lekcja jest płatna tylko wtedy, gdy w danych ucznia ustawiono opłatę za odwołanie.</p>}
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" onClick={save}>Zapisz lekcję</button></div>
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
    <h2>Oznaczyć lekcję jako przeprowadzoną?</h2>
    <p className="hint">{l.topic || "Bez tematu"} · {s ? s.name : ""} · {fd(l.date)}, {l.time}</p>
    <div className="f"><label htmlFor="dn">Notatka podsumowująca (opcjonalnie)</label><textarea id="dn" rows={4} placeholder="Co omówiliście? Co warto powtórzyć na następnej lekcji?" value={n} onChange={(e) => setN(e.target.value)} /></div>
    <div className="f2"><div className="f"><label htmlFor="dhw">Praca domowa (opcjonalnie)</label><textarea id="dhw" rows={2} placeholder="Np. zad. 3–7, str. 52" value={hw} onChange={(e) => setHw(e.target.value)} /></div><Field id="dhd" label="Termin pracy domowej" type="date" value={hd} onChange={setHd} /></div>
    <p className="hint">Po potwierdzeniu lekcja trafi do rozliczeń jako przeprowadzona.</p>
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" onClick={async () => {
      close();
      await run(() => api("PATCH", "/api/lessons/" + l.id, { status: "done", notes: n.trim() || l.notes, hw: hw.trim(), hd: hw.trim() ? hd : "" }), n.trim() ? "Lekcja przeprowadzona, notatka zapisana." : "Lekcja oznaczona jako przeprowadzona.");
    }}>Potwierdź</button></div>
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
  if (l.cr?.status !== "pending") return null;
  return <>
    <button className="btn s p" onClick={() => confirm({
      title: "Potwierdzić odwołanie lekcji?", ok: "Potwierdź odwołanie",
      text: <>{s ? s.name : ""} · {fd(l.date)}, {l.time}<br />Przyczyna: {l.cr!.reason}<br />{fee > 0 ? <>Zostanie naliczona opłata za odwołanie: <b>{pln(fee)}</b>.</> : "Odwołana lekcja nie będzie płatna."}</>,
      onOk: () => { run(() => api("POST", `/api/lessons/${l.id}/cancel-request/accept`, { fee }), "Lekcja odwołana. Uczeń zobaczy potwierdzenie."); },
    })}>Potwierdź odwołanie</button>
    <button className="btn s" onClick={() => modal(<RejectRequest l={l} />)}>Odrzuć prośbę</button>
  </>;
}
function RejectRequest({ l }: { l: Lesson }) {
  const { run } = useTutor();
  const { close } = useOverlay();
  const [note, setNote] = useState("");
  return <>
    <h2>Odrzucić prośbę o odwołanie?</h2>
    <p className="hint">Przyczyna podana przez ucznia: {l.cr?.reason}</p>
    <div className="f"><label htmlFor="rjn">Komentarz dla ucznia (opcjonalnie)</label><textarea id="rjn" rows={3} maxLength={500} placeholder="Np. Odwołanie jest możliwe najpóźniej 24 godziny przed lekcją." value={note} onChange={(e) => setNote(e.target.value)} /></div>
    <p className="hint">Lekcja zostanie zaplanowana bez zmian. Uczeń zobaczy Twoją decyzję i komentarz.</p>
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" onClick={async () => { if (await run(() => api("POST", `/api/lessons/${l.id}/cancel-request/reject`, { note: note.trim() }), "Prośba odrzucona.")) close(); }}>Odrzuć prośbę</button></div>
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
  return <div className="acts">
    <CancelRequestActions l={l} />
    {l.status === "planned" && <>
      <button className="btn s" onClick={() => modal(<DoneModal l={l} />)}>Przeprowadzona</button>
      <button className="btn s" onClick={() => confirm({ title: "Odwołać lekcję?", text: <>{l.topic || "Bez tematu"} · {fd(l.date)}<br />{fee > 0 ? <>Zostanie naliczona opłata: <b>{pln(fee)}</b>.</> : "Odwołana lekcja nie jest płatna."}</>, ok: "Odwołaj lekcję",
        onOk: () => { run(() => api("PATCH", "/api/lessons/" + l.id, { status: "cancelled", fee, paid: false }), "Lekcja odwołana."); } })}>Odwołana</button>
    </>}
    {(l.status !== "cancelled" || l.fee > 0) && <button className="btn s" onClick={() => {
      if (l.paid) run(() => api("PATCH", "/api/lessons/" + l.id, { paid: false }), "Cofnięto oznaczenie płatności.");
      else confirm({ title: "Czy na pewno lekcja została opłacona?", text: <>{l.topic || "Bez tematu"} · {s ? s.name : ""} · {fd(l.date)}{l.status === "cancelled" ? <><br />Odwołana lekcja – opłata za odwołanie: </> : <br />}<b>{pln(amt(l))}</b>. Możesz to później cofnąć.</>, ok: "Tak, opłacona",
        onOk: () => { run(() => api("PATCH", "/api/lessons/" + l.id, { paid: true }), "Lekcja oznaczona jako opłacona."); } });
    }}>{l.paid ? "Cofnij płatność" : "Opłacona"}</button>}
    {l.status === "cancelled" && !l.fee && fee > 0 && <button className="btn s p" onClick={() => run(() => api("PATCH", "/api/lessons/" + l.id, { fee }), "Naliczono opłatę: " + pln(fee) + ".")}>Nalicz opłatę</button>}
    <button className="btn s" onClick={async () => {
      const d = pd(l.date); d.setDate(d.getDate() + 7);
      const n = { sid: l.sid, subject: l.subject, date: ymd(d), time: l.time, min: l.min, topic: l.topic, status: "planned", paid: false, amount: l.amount, fee: 0 };
      const ok = await run(() => api("POST", "/api/lessons", n));
      if (!ok) return;
      if (overlap(lessons, n.date, n.time, n.min).length) modal(<><h2>Uwaga: nakładające się terminy</h2><p>Dodano lekcję na {fd(n.date)}, ale nakłada się ona na inną lekcję. Jeśli to pomyłka, zmień termin w edycji.</p><DoneBtn /></>);
      else modal(<><h2>Dodano lekcję</h2><p>Nowa lekcja: {fd(n.date)}, {n.time}.</p><DoneBtn /></>);
    }}>Powtórz za tydzień</button>
    <button className="btn s" onClick={() => modal(<LessonForm l={l} />)}>Edytuj</button>
    <button className="btn s d" onClick={() => confirm({ title: "Usunąć lekcję?", text: pro ? "Lekcja trafi do kosza na 30 dni." : "Tej operacji nie można cofnąć. W planie Pro usunięte lekcje trafiają do kosza.", ok: "Usuń lekcję", danger: true,
      onOk: () => { run(() => api("DELETE", "/api/lessons/" + l.id), pro ? "Lekcja w koszu." : "Lekcja usunięta."); } })}>Usuń</button>
  </div>;
}
function DoneBtn() { const { close } = useOverlay(); return <div className="mf"><button className="btn p" onClick={close}>Rozumiem</button></div>; }

/* ---------- student detail ---------- */
export function StudentDetail({ id }: { id: string }) {
  const { stu, lessons } = useData();
  const { close, modal } = useOverlay();
  const s = stu(id);
  if (!s) return null;
  const ls = sortL(lessons.filter((l) => l.sid === id), -1), dn = ls.filter((l) => l.status === "done");
  return <>
    <h2>{s.name} <span className={"tag " + (s.active ? "gr" : "")}>{s.active ? "Aktywny" : "Zarchiwizowany"}</span></h2>
    <div className="rates">{subjRates(s).map(([x, r]) => <span key={x} className="rate">{x && <b>{x}</b>}{pln(r)} / 60 min</span>)}</div>
    <p>E-mail: {s.email || "brak"}<br />Telefon: {s.phone || "brak"}{s.note && <><br />Notatka: {s.note}</>}</p>
    <div className="grid g2" style={{ marginBottom: 12 }}><div className="card stat"><div className="l">Przeprowadzone lekcje</div><div className="v">{dn.length}</div></div><div className="card stat"><div className="l">Do zapłaty</div><div className="v am">{pln(sumAmt(ls.filter(billable), (l) => !l.paid))}</div></div></div>
    <h2>Historia lekcji</h2>
    {ls.length ? ls.map((l) => <LessonItem key={l.id} l={l} quick={false} />) : <Empty icon="book" title="Brak lekcji" sub="Dodaj pierwszą lekcję dla tego ucznia." />}
    <div className="mf"><button className="btn" onClick={close}>Zamknij</button><button className="btn p" onClick={() => modal(<LessonForm pre={id} />)}>Dodaj lekcję</button></div>
  </>;
}

/* ---------- share with student (invite code) ---------- */
export function ShareModal({ id }: { id: string }) {
  const { stu } = useData();
  const { run } = useTutor();
  const { close, confirm, toast, modal } = useOverlay();
  const s = stu(id);
  if (!s) return null;
  if (isDemo()) return <><h2>Panel ucznia</h2><p>W trybie demo nie można udostępniać danych uczniom. Załóż konto, aby korzystać z panelu ucznia.</p><div className="mf"><button className="btn" onClick={close}>Zamknij</button></div></>;
  const create = () => run(() => api("POST", `/api/students/${id}/invite`)).then((ok) => { if (ok) modal(<ShareModal id={id} />); });
  if (!s.inviteCode) return <>
    <h2>Udostępnij panel ucznia</h2>
    <p>{s.name} założy bezpłatne konto ucznia i wpisze kod – zobaczy swoje lekcje, notatki po zajęciach i prace domowe. Wszystko aktualizuje się samo po każdej zmianie w dzienniku.</p>
    <p className="hint">Uczeń widzi: terminy, przedmioty, tematy, statusy i kwoty swoich lekcji, notatki po zajęciach oraz prace domowe. Notatki przed zajęciami i dane innych uczniów zostają prywatne.</p>
    <div className="mf"><button className="btn" onClick={close}>Anuluj</button><button className="btn p" onClick={create}>Utwórz kod dostępu</button></div>
  </>;
  const msg = `Cześć! Twoje lekcje, notatki i prace domowe znajdziesz w panelu ucznia TutorTrack.\n1. Załóż bezpłatne konto: ${APP_URL}/uczen/rejestracja\n2. Wpisz kod od korepetytora: ${s.inviteCode}`;
  return <>
    <h2>Panel ucznia – {s.name}</h2>
    <p className="hint" style={{ margin: "0 0 4px" }}>Kod dostępu</p>
    <div className="code">{s.inviteCode}</div>
    <p className="hint" aria-live="polite">{s.linked ? <span className="tag gr">Uczeń jest połączony</span> : "Uczeń jeszcze nie wpisał kodu."} Zmiany w dzienniku są widoczne u ucznia od razu.</p>
    <div className="f"><label htmlFor="shm">Wiadomość dla ucznia</label><textarea id="shm" rows={5} readOnly value={msg} /></div>
    <p className="hint">Kod działa dla jednego konta ucznia. Jeśli wycieknie, utwórz nowy – stary przestanie działać, a uczeń zostanie odłączony.</p>
    <div className="mf">
      <button className="btn d" onClick={() => confirm({ title: "Wyłączyć dostęp ucznia?", text: "Uczeń przestanie widzieć lekcje w panelu ucznia. Twój dziennik się nie zmieni.", ok: "Wyłącz dostęp", danger: true, onOk: () => { run(() => api("DELETE", `/api/students/${id}/invite`), "Dostęp ucznia wyłączony."); } })}>Wyłącz dostęp</button>
      <button className="btn" onClick={() => confirm({ title: "Utworzyć nowy kod?", text: "Stary kod przestanie działać, a połączone konto ucznia zostanie odłączone.", ok: "Utwórz nowy kod", onOk: create })}>Nowy kod</button>
      <button className="btn p" onClick={async () => { toast((await copyText(msg)) ? "Skopiowano." : "Zaznacz tekst i skopiuj go ręcznie."); }}>Kopiuj wiadomość</button>
    </div>
  </>;
}

/* ---------- monthly summary text ---------- */
export function summaryText(s: Student, lessons: Lesson[], m: string, brand: string) {
  const ls = sortL(lessons.filter((l) => l.sid === s.id && (l.status === "done" || l.status === "cancelled") && l.date.slice(0, 7) === m), 1);
  const L = ["Podsumowanie lekcji – " + fm(m), ...(brand ? ["Korepetytor: " + brand] : []), "Uczeń: " + s.name, ""];
  ls.forEach((l) => { const d = pd(l.date); L.push("• " + d.getDate() + " " + MSHORT[d.getMonth()] + ", " + l.time + " – " + (l.status === "cancelled" ? "odwołana lekcja" : l.topic || "lekcja") + " (" + l.min + " min): " + (l.status === "cancelled" && !l.fee ? "bez opłaty" : pln(amt(l))) + (l.paid ? " (opłacona)" : "")); });
  const t = sumAmt(ls, () => true), p = sumAmt(ls, (l) => l.paid);
  L.push("", "Razem: " + pln(t), "Opłacone: " + pln(p), "Do zapłaty: " + pln(t - p));
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
    <h2>Podsumowanie dla ucznia</h2><p className="hint">Skopiuj i wyślij uczniowi lub rodzicowi.</p>
    <textarea rows={11} readOnly value={t} />
    <div className="pt">{t}</div>
    <div className="mf"><button className="btn" onClick={close}>Zamknij</button>
      <button className="btn" onClick={() => { if (user?.plan !== "pro") { proUp("Wydruk i PDF podsumowania"); return; } document.body.classList.add("printing"); window.print(); document.body.classList.remove("printing"); }}>Drukuj / PDF{user?.plan !== "pro" && <> <span className="tag ac">Pro</span></>}</button>
      <button className="btn p" onClick={async () => toast((await copyText(t)) ? "Skopiowano." : "Zaznacz tekst i skopiuj go ręcznie.")}>Kopiuj</button></div>
  </>;
}

export { errMsg };

/* ---------- lesson window: details + every action in one place ---------- */
export function LessonSheet({ id }: { id: string }) {
  const { lessons, stu } = useData();
  const { close } = useOverlay();
  const l = lessons.find((x) => x.id === id);
  if (!l) return <><h2>Lekcja</h2><p className="hint">Ta lekcja została usunięta.</p><div className="mf"><button className="btn" onClick={close}>Zamknij</button></div></>;
  const s = stu(l.sid), sub = l.subject || (s ? subjList(s)[0] : "");
  return <>
    <h2>{s ? s.name : "Lekcja"}{sub ? " · " + sub : ""}</h2>
    <p className="hint" style={{ margin: "-6px 0 10px" }}>{fd(l.date)}, {l.time}–{te(l.time, l.min)} ({l.min} min) · {l.status === "cancelled" ? (l.fee > 0 ? "opłata " + pln(l.fee) : "bez opłaty") : pln(l.amount)}</p>
    <div style={{ marginBottom: 12 }}><LessonTags l={l} lessons={lessons} /></div>
    {l.topic && <p style={{ margin: "0 0 8px" }}><b>Temat:</b> {l.topic}</p>}
    {l.prep && <p className="pre" style={{ margin: "0 0 8px" }}><b>Przed zajęciami:</b> {l.prep}</p>}
    {l.notes && <p className="pre" style={{ margin: "0 0 8px" }}><b>Po zajęciach:</b> {l.notes}</p>}
    {l.hw && <p className="pre" style={{ margin: "0 0 8px" }}><b>Praca domowa:</b> {l.hw}{l.hd ? " (termin: " + fd(l.hd) + ")" : ""}</p>}
    {l.cr?.status === "pending" && <div className="nt">Uczeń prosi o odwołanie: {l.cr.reason}</div>}
    {l.cr?.status === "accepted" && l.status === "cancelled" && <p className="hint">Odwołana na prośbę ucznia: {l.cr.reason}</p>}
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--bd)" }}><LessonActions l={l} /></div>
    <div className="mf"><button className="btn" onClick={close}>Zamknij</button></div>
  </>;
}

/** One-tap "done" for planned lessons that already took place (today or earlier). */
export function QuickDone({ l }: { l: Lesson }) {
  const { modal } = useOverlay();
  if (l.status !== "planned" || l.date > ymd(new Date()) || l.cr?.status === "pending") return null;
  return <button className="btn s qd" title="Oznacz jako przeprowadzoną" onClick={(e) => { e.stopPropagation(); modal(<DoneModal l={l} />); }}>Przeprowadzona</button>;
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
  if (s.active) return <button className="btn" style={{ marginRight: "auto" }} onClick={() => confirm({ title: "Zarchiwizować ucznia?", text: "Historia lekcji i rozliczenia zostaną zachowane. Ucznia możesz przywrócić w każdej chwili.", ok: "Archiwizuj", onOk: () => { run(() => api("PATCH", "/api/students/" + s.id, { active: false }), "Uczeń zarchiwizowany."); } })}>Archiwizuj</button>;
  return <span style={{ marginRight: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
    <button className="btn" onClick={() => { if (user?.plan === "free" && students.filter((x) => x.active).length >= FREE) { upsell(); return; } close(); run(() => api("PATCH", "/api/students/" + s.id, { active: true }), "Uczeń przywrócony."); }}>Przywróć</button>
    <button className="btn d" onClick={() => confirm({ title: "Usunąć ucznia?", text: `${s.name} i jego lekcje (${lessons.filter((l) => l.sid === s.id).length}) ${pro ? "trafią do kosza na 30 dni." : "zostaną trwale usunięte. W planie Pro można je przywrócić z kosza."}`, ok: "Usuń ucznia", danger: true, onOk: () => { run(() => api("DELETE", "/api/students/" + s.id), pro ? "Uczeń w koszu." : "Uczeń usunięty."); } })}>Usuń</button>
  </span>;
}

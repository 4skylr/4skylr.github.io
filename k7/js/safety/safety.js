// Safety & maintenance — the branch's safety devices, the checks each needs, and a log of who checked what.
// A check's next date = last logged date + its interval. Never-logged checks are shown as "not logged yet", not as
// overdue, so the board only raises what it actually knows. Logs live in the "safetyLog" collection (Firestore when
// connected, this browser otherwise). Device list: data/safety-assets.js · drawings: safety/art.js.
import { ASSETS, SYSTEMS } from "../data/safety-assets.js?v=95";
import { ART } from "./art.js?v=95";

const COL = "safetyLog", DAY = 864e5, NAME_KEY = "noir-safety-by";
const state = { sys: "all", remote: null, loading: false };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function logs(H) {
  const all = new Map([...(state.remote || []), ...H.localDocs(COL)].map(d => [d.id, d]));
  return [...all.values()].filter(d => d && d.asset && d.at).sort((a, b) => b.at.localeCompare(a.at));
}
// status of one check from the log
function statusOf(a, t, L, now) {
  if (t.info) return { state: "info" };
  const last = L.find(l => l.asset === a.id && l.task === t.id);
  if (!last) return { state: "none" };
  const due = Date.parse(last.at) + t.every * DAY, left = Math.floor((due - now) / DAY);
  const soon = Math.max(1, Math.min(7, Math.round(t.every / 4)));
  return { state: !last.ok ? "issue" : left < 0 ? "late" : left <= soon ? "soon" : "ok", last, due, left };
}

// counts for the overview's shift brief (local log plus whatever the page already pulled from Firestore)
export function safetySummary(H) {
  const now = Date.now(), L = logs(H), out = { late: 0, soon: 0, issue: 0, none: 0, ok: 0, devices: ASSETS.reduce((s, a) => s + a.count, 0), next: null };
  ASSETS.forEach(a => a.tasks.forEach(t => { const s = statusOf(a, t, L, now); if (s.state === "info") return; out[s.state]++;
    if ((s.state === "late" || s.state === "soon" || s.state === "issue") && (!out.next || (s.left ?? -1e9) < (out.next.left ?? -1e9))) out.next = { a, t, left: s.left, state: s.state }; }));
  return out;
}

export function renderSafety(host, H) {
  const ar = (sessionStorage.getItem("noir-lang") || "en") === "ar", T = (en, a) => ar ? a : en;
  const now = Date.now(), L = logs(H);
  const rows = ASSETS.map(a => ({ a, tasks: a.tasks.map(t => ({ t, s: statusOf(a, t, L, now) })) }));
  const live = rows.flatMap(r => r.tasks.filter(x => x.s.state !== "info").map(x => ({ ...x, a: r.a })));
  const cnt = k => live.filter(x => x.s.state === k).length;
  const month = new Date(now).toISOString().slice(0, 7), doneMonth = L.filter(l => l.at.startsWith(month)).length;
  const total = ASSETS.reduce((s, a) => s + a.count, 0);
  const bySys = Object.keys(SYSTEMS).map(k => ({ k, n: ASSETS.filter(a => a.system === k).reduce((s, a) => s + a.count, 0) }));
  const fmtDate = ms => new Date(ms).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "2-digit", month: "short" });
  const label = s => ({ none: T("Not logged yet", "ما انسجل"), ok: T(`Next ${fmtDate(s.due)}`, `القادم ${fmtDate(s.due)}`),
    soon: s.left === 0 ? T("Due today", "اليوم") : T(`Due in ${s.left} d`, `بعد ${s.left} يوم`), late: T(`${-s.left} d overdue`, `متأخر ${-s.left} يوم`),
    issue: T("Issue reported", "فيه ملاحظة"), info: T("Reminder", "تذكير") })[s.state];
  const who = w => w === "tech" ? T("Contractor", "المقاول") : T("Staff", "الفريق");

  // radar: one ring per system, length = its share of all devices; a beam sweeps over them
  const ringR = [96, 80, 64, 48], C = r => 2 * Math.PI * r;
  const radar = `<svg class="sf-radar-svg" viewBox="0 0 240 240" aria-hidden="true">
      ${ringR.map(r => `<circle cx="120" cy="120" r="${r}" class="sf-track"/>`).join("")}
      ${bySys.map((s, i) => `<circle cx="120" cy="120" r="${ringR[i]}" class="sf-arc tone-${SYSTEMS[s.k].tone}" stroke-dasharray="${(s.n / total * C(ringR[i])).toFixed(1)} ${C(ringR[i]).toFixed(1)}" transform="rotate(-90 120 120)"/>`).join("")}
      <path d="M120 10v14M120 216v14M10 120h14M216 120h14" class="sf-tick"/></svg>`;

  const card = r => {
    const a = r.a, sys = SYSTEMS[a.system], worst = ["issue", "late", "soon", "none", "ok"].find(k => r.tasks.some(x => x.s.state === k)) || "ok";
    return `<article class="sf-card tone-${sys.tone} w-${worst}" data-asset="${a.id}">
      <div class="sf-art">${ART[a.art]()}<span class="sf-count"><b class="data">${a.count}</b>${a.split ? `<small class="data">${a.split.join(" + ")}</small>` : ""}</span></div>
      <div class="sf-body">
        <p class="sf-sys">${esc(ar ? sys.ar : sys.en)}</p>
        <h3>${esc(ar ? a.ar : a.en)}</h3>
        <p class="sf-about">${esc(a.about[ar ? 1 : 0])}</p>
        <ul class="sf-tasks">${r.tasks.map(({ t, s }) => `<li class="s-${s.state}">
          <span class="sf-every data">${t.every >= 365 ? `${Math.round(t.every / 365)}${T("y", " سنة")}` : t.every >= 28 ? `${Math.round(t.every / 30)}${T("mo", " شهر")}` : `${t.every}${T("d", " يوم")}`}</span>
          <span class="sf-t"><b>${esc(ar ? t.ar : t.en)}</b><small>${who(t.who)}${s.last ? ` · ${T("last", "آخر")} ${fmtDate(Date.parse(s.last.at))}${s.last.by ? ` · ${esc(s.last.by)}` : ""}` : ""}</small></span>
          <span class="sf-st">${label(s)}</span>
          ${t.info ? "" : `<button class="btn sm sf-log" data-log="${a.id}:${t.id}">${T("Log", "سجّل")}</button>`}</li>`).join("")}</ul>
      </div></article>`;
  };
  const shown = rows.filter(r => state.sys === "all" || r.a.system === state.sys);
  const queue = live.filter(x => ["issue", "late", "soon"].includes(x.s.state)).sort((p, q) => (p.s.state === "issue" ? -1e9 : p.s.left) - (q.s.state === "issue" ? -1e9 : q.s.left));

  host.innerHTML = `<div class="sf">
    <section class="sf-hero">
      <div class="sf-hero-copy">
        <p class="sf-kick">${T("Noir Cinema · Unaizah", "نوار سينما · عنيزة")}</p>
        <h2>${T(`${total} safety devices, ${ASSETS.length} kinds`, `${total} جهاز سلامة، ${ASSETS.length} أنواع`)}</h2>
        <div class="sf-kpis">
          <div class="k-late"><b class="data">${cnt("late")}</b><span>${T("Overdue", "متأخرة")}</span></div>
          <div class="k-soon"><b class="data">${cnt("soon")}</b><span>${T("Due soon", "قريبة")}</span></div>
          <div class="k-issue"><b class="data">${cnt("issue")}</b><span>${T("Open issues", "ملاحظات مفتوحة")}</span></div>
          <div class="k-done"><b class="data">${doneMonth}</b><span>${T("Logged this month", "انسجلت هالشهر")}</span></div>
        </div>
        <ul class="sf-legend">${bySys.map(s => `<li class="tone-${SYSTEMS[s.k].tone}"><i></i>${esc(ar ? SYSTEMS[s.k].ar : SYSTEMS[s.k].en)} <b class="data">${s.n}</b></li>`).join("")}</ul>
      </div>
      <div class="sf-radar">${radar}<div class="sf-sweep" aria-hidden="true"></div><div class="sf-core"><b class="data">${total}</b><span>${T("devices", "جهاز")}</span></div></div>
    </section>

    ${queue.length ? `<section class="slab sf-queue"><div class="slab-h"><h2>${T("Needs doing", "المطلوب الحين")}</h2></div>
      <ol>${queue.map(x => `<li class="s-${x.s.state}"><span class="sf-q-art">${ART[x.a.art]()}</span><span><b>${esc(ar ? x.a.ar : x.a.en)}</b><small>${esc(ar ? x.t.ar : x.t.en)}</small></span><em>${label(x.s)}</em><button class="btn sm hot sf-log" data-log="${x.a.id}:${x.t.id}">${T("Log", "سجّل")}</button></li>`).join("")}</ol></section>`
      : live.every(x => x.s.state === "none") ? `<p class="note sf-start">${T("Nothing has been logged yet. Each check counts from the first time someone logs it, so start with this month's walk-round.", "ما فيه أي فحص مسجّل للحين. كل فحص يبدأ عدّه من أول مرة ينسجل، فابدأ بجولة هالشهر.")}</p>` : ""}

    <div class="seg sf-filter" role="group">${[["all", T("All", "الكل")], ...Object.entries(SYSTEMS).map(([k, s]) => [k, ar ? s.ar : s.en])].map(([k, l]) => `<button data-sys="${k}" aria-pressed="${state.sys === k}">${esc(l)}</button>`).join("")}</div>
    <div class="sf-grid">${shown.map(card).join("")}</div>

    <section class="slab sf-history"><div class="slab-h"><h2>${T("Check log", "سجل الفحص")}</h2><span class="tag">${L.length}</span></div>
      ${L.length ? `<ol>${L.slice(0, 30).map(l => { const a = ASSETS.find(x => x.id === l.asset), t = a?.tasks.find(x => x.id === l.task); return `<li class="${l.ok ? "ok" : "bad"}">
        <time class="data">${new Date(l.at).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</time>
        <span><b>${esc(a ? (ar ? a.ar : a.en) : l.asset)}</b> · ${esc(t ? (ar ? t.ar : t.en) : l.task)}${l.note ? `<small>${esc(l.note)}</small>` : ""}</span>
        <em>${l.ok ? T("OK", "سليم") : T("Issue", "ملاحظة")}${l.by ? ` · ${esc(l.by)}` : ""}</em></li>`; }).join("")}</ol>`
        : `<p class="empty">${T("Logged checks show here with who did them.", "الفحوصات المسجلة تطلع هنا مع اسم اللي سواها.")}</p>`}
      <p class="sf-src">${T("Intervals follow NFPA 10, 25, 72 and 101. Where Civil Defense or the maintenance contract asks for more, follow that.", "المدد حسب NFPA 10 و25 و72 و101. إذا الدفاع المدني أو عقد الصيانة يطلب أكثر، يُتّبع.")}</p>
    </section>
    <dialog class="sf-dlg" id="sf-dlg"></dialog>
  </div>`;

  host.querySelectorAll("[data-sys]").forEach(b => b.onclick = () => { state.sys = b.dataset.sys; renderSafety(host, H); });
  host.querySelectorAll("[data-log]").forEach(b => b.onclick = () => openLog(host, H, ...b.dataset.log.split(":")));
  if (state.remote === null && !state.loading && H.allDocs) {
    state.loading = true;
    Promise.race([H.allDocs(COL), new Promise(r => setTimeout(() => r(null), 4000))]).then(d => { state.remote = d || []; state.loading = false; if (host.isConnected) renderSafety(host, H); }).catch(() => { state.remote = []; state.loading = false; });
  }
}

function openLog(host, H, assetId, taskId) {
  const ar = (sessionStorage.getItem("noir-lang") || "en") === "ar", T = (en, a) => ar ? a : en;
  const a = ASSETS.find(x => x.id === assetId), t = a?.tasks.find(x => x.id === taskId), dlg = host.querySelector("#sf-dlg");
  if (!a || !t || !dlg) return;
  let by = ""; try { by = localStorage.getItem(NAME_KEY) || ""; } catch {}
  dlg.innerHTML = `<form method="dialog" class="sf-form">
    <div class="sf-form-art">${ART[a.art]()}</div>
    <h3>${esc(ar ? a.ar : a.en)}</h3><p>${esc(ar ? t.ar : t.en)}</p>
    <div class="seg sf-res" role="radiogroup"><button type="button" data-ok="1" aria-pressed="true">${T("All OK", "كله سليم")}</button><button type="button" data-ok="0" aria-pressed="false">${T("Found an issue", "فيه ملاحظة")}</button></div>
    <label>${T("Checked by", "الفاحص")}<input class="input" name="by" required maxlength="40" value="${esc(by)}" autocomplete="name"></label>
    <label>${T("Note", "ملاحظة")} <small>${T("(optional; say where, for an issue)", "(اختياري؛ حدد المكان لو فيه ملاحظة)")}</small><textarea class="input" name="note" rows="2" maxlength="300"></textarea></label>
    <div class="sf-form-act"><button type="button" class="btn ghost" data-close>${T("Cancel", "إلغاء")}</button><button class="btn hot" type="submit">${T("Save check", "حفظ الفحص")}</button></div>
  </form>`;
  let ok = true;
  dlg.querySelectorAll("[data-ok]").forEach(b => b.onclick = () => { ok = b.dataset.ok === "1"; dlg.querySelectorAll("[data-ok]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  dlg.querySelector("[data-close]").onclick = () => dlg.close();
  dlg.querySelector("form").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, name = f.by.value.trim(); if (!name) { f.by.focus(); return; }
    try { localStorage.setItem(NAME_KEY, name); } catch {}
    const at = new Date().toISOString(), doc = { id: `${assetId}-${taskId}-${at.replace(/\D/g, "").slice(0, 14)}`, asset: assetId, task: taskId, at, by: name, ok, note: f.note.value.trim() };
    try { await H.putDoc(COL, doc.id, doc); } catch (err) { H.toast?.(err.message || T("Could not save", "ما انحفظ"), true); return; }
    if (state.remote) state.remote = [doc, ...state.remote.filter(d => d.id !== doc.id)];
    dlg.close(); H.toast?.(T("Check saved", "انحفظ الفحص")); renderSafety(host, H);
  };
  dlg.showModal(); dlg.querySelector("[name=by]").focus();
}

// Count mission on the product watch, and its review on the Count page.
//   Watch: Start → for each place the product is in (Store → Mini Store → Concession, only where it has stock):
//     "Go to …" (a map that opens like Google Maps) → OK → quantity + expiry date on a scroll wheel, one or more groups →
//     next place → name → send.
//   On send: the counted totals are compared with the current stock report. Every place that matches gets a tick and waits
//   for a supervisor; a place that does not is sent straight back as a recount for that place, to the same watch.
//   Dates and quantities go into the expiry sheet at once (expiry-edits.js), so the Excel download is always current.
// Records live in the "watchCounts" collection (Firestore, with a copy in this browser).
import * as store from "../core/store.js?v=102";
import { countToEdits, MAX_GROUPS } from "../data/expiry-edits.js?v=102";
import { AR as NAMES_AR } from "../core/names-ar.js?v=102";

export const COL = "watchCounts";
export const ORDER = ["stores", "mini", "refuel"]; // the walk: Store → Mini Store → Concession
const LOC_T = { stores: ["Main Store", "المستودع"], mini: ["Mini Store", "الميني ستور"], refuel: ["Concession", "الكونسيشن"] };
export const locLabel = (id, ar) => (LOC_T[id] || [id, id])[ar ? 1 : 0];
// items with no expiry date (cups, lids, tubs, trays, napkins, CO₂ …): quantity only
export const noDate = p => p.category === "packaging" || p.category === "other" || /^(cups-|lids-|tub-|slush-glass|cotton-candy-tub|dip-cup|hotdog-tray|nachos-tray|napkin|straw|stirrer|co2)/.test(p.id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r3 = n => Math.round(n * 1000) / 1000;
const fmtN = n => (Number.isInteger(n) ? String(n) : String(r3(n)));
// a count matches the stock report when it is the same number (by the piece) or within 2% (kg / litres)
export const same = (p, counted, expected) => (p.unit === "kg" || p.unit === "ltr") ? Math.abs(counted - expected) <= Math.max(0.05, expected * 0.02) : Math.abs(counted - expected) < 1e-6;

// ── records ─────────────────────────────────────────────────────────
let cache = null;
export async function loadCounts(force) { if (!cache || force) cache = await store.allDocs(COL).catch(() => store.localDocs(COL)); return cache; }
export const cachedCounts = () => cache || store.localDocs(COL);
export const openRecount = (list, pid) => list.filter(r => r.pid === pid && r.status === "recount").sort((a, b) => b.at.localeCompare(a.at))[0] || null;
export const pendingCount = list => list.filter(r => r.status === "match" || r.status === "recount").length;

function evaluate(p, stops) {
  return stops.map(s => { const counted = r3(s.groups.reduce((a, g) => a + (Number(g.qty) || 0), 0)), expected = Number(p.stock?.[s.loc]) || 0;
    return { ...s, counted, expected, ok: same(p, counted, expected) }; });
}
async function submit(p, stops, by, prev) {
  const now = new Date().toISOString(), ev = evaluate(p, stops);
  // a recount replaces only the places it was asked for
  const merged = prev ? prev.stops.map(s => ev.find(x => x.loc === s.loc) || s).concat(ev.filter(x => !prev.stops.some(s => s.loc === x.loc))) : ev;
  const bad = merged.filter(s => !s.ok).map(s => s.loc);
  const rec = { id: prev?.id || `${p.id}-${now.replace(/\D/g, "").slice(0, 14)}`, pid: p.id, name: p.name, unit: p.unit || "", by, at: now, first: prev?.first || now,
    tries: (prev?.tries || 0) + 1, stops: merged, status: bad.length ? "recount" : "match", recount: bad, dated: !noDate(p) };
  if (rec.dated) ev.forEach(s => countToEdits(p, s.loc, s.groups));
  await store.putDoc(COL, rec.id, rec);
  store.log("count", `${rec.status === "match" ? "Watch count matches" : "Watch count differs"} · ${p.name} · ${by}`).catch(() => {});
  if (cache) cache = [...cache.filter(x => x.id !== rec.id), rec];
  return rec;
}
// counts sent from other phones: put their dates into this device's expiry sheet too (each record once)
export async function syncCountsToSheet(products) {
  const list = await loadCounts(true); let seen = {};
  try { seen = JSON.parse(localStorage.getItem("noir-wc-applied") || "{}") || {}; } catch {}
  for (const r of [...list].sort((a, b) => a.at.localeCompare(b.at))) {
    if (!r.dated || seen[r.id] === r.at) continue;
    const p = products.find(x => x.id === r.pid); if (!p) continue;
    r.stops.forEach(s => countToEdits(p, s.loc, s.groups || []));
    seen[r.id] = r.at;
  }
  try { localStorage.setItem("noir-wc-applied", JSON.stringify(seen)); } catch {}
  return list;
}

// ── the date wheel ──────────────────────────────────────────────────
const MON = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"] };
const ROW = 30;
function wheelHtml(iso, ar) {
  const d = /^\d{4}-\d{2}-\d{2}/.test(iso || "") ? iso : new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
  const [y, m, day] = d.split("-").map(Number), y0 = new Date().getFullYear() - 1;
  const col = (k, items, sel) => `<div class="nw-wcol" data-k="${k}" data-sel="${sel}" tabindex="0">${items.map((t, i) => `<span data-i="${i}">${t}</span>`).join("")}</div>`;
  return `<div class="nw-wheel" dir="ltr">
    ${col("d", Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")), day - 1)}
    ${col("m", MON[ar ? "ar" : "en"], m - 1)}
    ${col("y", Array.from({ length: 9 }, (_, i) => String(y0 + i)), Math.max(0, y - y0))}
    <i class="nw-wband" aria-hidden="true"></i></div>`;
}
function mountWheel(el) {
  const y0 = new Date().getFullYear() - 1;
  el.querySelectorAll(".nw-wcol").forEach(c => {
    c.scrollTop = Number(c.dataset.sel) * ROW;
    const mark = () => { const i = Math.max(0, Math.min(c.children.length - 1, Math.round(c.scrollTop / ROW))); c.dataset.sel = i; [...c.children].forEach((s, k) => s.classList.toggle("on", k === i)); };
    let t = 0; c.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(mark, 60); }, { passive: true }); mark();
    c.addEventListener("click", e => { const s = e.target.closest("span"); if (s) c.scrollTo({ top: Number(s.dataset.i) * ROW, behavior: "smooth" }); });
    c.addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); c.scrollBy({ top: e.key === "ArrowDown" ? ROW : -ROW, behavior: "smooth" }); } });
  });
  return () => { const v = k => Number(el.querySelector(`.nw-wcol[data-k="${k}"]`).dataset.sel);
    const y = y0 + v("y"), m = v("m") + 1, last = new Date(y, m, 0).getDate(), d = Math.min(v("d") + 1, last);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
}

// ── the mission on the watch ────────────────────────────────────────
// opts: { p, H, ar, only (locations to recount), prev (record being recounted), groupsAt(loc) → current groups, onDone(rec) }
export function startMission(disp, opts) {
  const { p, H, ar } = opts, T = (e, a) => (ar ? a : e), dated = !noDate(p);
  const withStock = ORDER.filter(l => (Number(p.stock?.[l]) || 0) > 0);
  const stops = (opts.only?.length ? ORDER.filter(l => opts.only.includes(l)) : withStock.length ? withStock : ORDER).map(loc => ({ loc, groups: [] }));
  const unit = esc(H.UNITS?.[p.unit] || p.unit || "");
  const box = document.createElement("div"); box.className = "nw-m"; box.dir = ar ? "rtl" : "ltr";
  disp.append(box); disp.classList.add("is-mission");
  const close = () => { box.remove(); disp.classList.remove("is-mission"); dispatchEvent(new Event("nw-mission-end")); };
  let i = 0, draft = null;
  const steps = () => `<span class="nw-m-step data">${i + 1} / ${stops.length}</span>`;

  const intro = () => {
    box.innerHTML = `<div class="nw-m-in nw-m-intro"><h4>${opts.only?.length ? T("Recount", "إعادة جرد") : T("Count", "جرد")}<small>${esc(opts.name || p.name)}</small></h4>
      <ol class="nw-m-route">${stops.map((s, k) => `<li><i class="data">${k + 1}</i>${esc(locLabel(s.loc, ar))}<small class="data" dir="ltr">${fmtN(Number(p.stock?.[s.loc]) || 0)} ${unit}</small></li>`).join("")}</ol>
      <div class="nw-m-actions"><button type="button" class="nw-m-btn ghost" data-x>${T("Later", "لاحقاً")}</button><button type="button" class="nw-m-btn" data-go>${T("Start", "ابدأ")}</button></div></div>`;
    box.querySelector("[data-x]").onclick = close; box.querySelector("[data-go]").onclick = go;
  };
  // "Go to …": a little map that opens like a maps app, the pin drops on the place
  const go = () => {
    const s = stops[i];
    box.innerHTML = `<div class="nw-m-in nw-m-go"><div class="nw-map l-${s.loc}" aria-hidden="true"><div class="nw-map-tiles"><i class="park"></i><i class="water"></i><i class="blk a"></i><i class="blk b"></i><i class="blk c"></i></div>
        <svg class="nw-route" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M18 92 C 22 70, 44 74, 48 58 S 70 40, 66 30"/></svg>
        <span class="nw-me"></span><span class="nw-pin"><i></i></span><span class="nw-pulse"></span></div>
      <div class="nw-go-card">${steps()}<small>${T("Go to", "اذهب إلى")}</small><b>${esc(locLabel(s.loc, ar))}</b>
        <button type="button" class="nw-m-btn" data-ok>${T("OK", "موافق")}</button></div></div>`;
    box.querySelector("[data-ok]").onclick = () => entry(true);
  };
  const entry = fresh => {
    const s = stops[i];
    if (fresh) { draft = { qty: "", date: "" }; if (!s.groups.length && dated) { const g = opts.groupsAt?.(s.loc)?.[0]; if (g?.date) draft.date = g.date; } }
    const last = i === stops.length - 1;
    box.innerHTML = `<div class="nw-m-in nw-m-entry"><header><b>${esc(locLabel(s.loc, ar))}</b>${steps()}</header>
      ${s.groups.length ? `<div class="nw-m-groups">${s.groups.map((g, k) => `<span class="nw-m-chip"><em class="data">${k + 1}</em><b class="data" dir="ltr">${fmtN(g.qty)}${g.date ? ` · ${g.date.slice(2).split("-").reverse().join("/")}` : ""}</b><button type="button" data-rm="${k}" aria-label="${T("Remove", "حذف")}">×</button></span>`).join("")}</div>` : ""}
      <label class="nw-m-l">${dated ? `${T("Group", "المجموعة")} ${s.groups.length + 1} · ` : ""}${T("Quantity", "العدد")} <small>${unit}</small></label>
      <div class="nw-step" dir="ltr"><button type="button" data-d="-1" aria-label="−">−</button><input class="data" type="number" inputmode="decimal" min="0" step="any" value="${esc(draft.qty)}" placeholder="0" aria-label="${T("Quantity", "العدد")}"><button type="button" data-d="1" aria-label="+">+</button></div>
      ${dated ? `<label class="nw-m-l">${T("Expiry date", "تاريخ الانتهاء")}</label>${wheelHtml(draft.date, ar)}` : ""}
      <p class="nw-m-err" role="alert"></p>
      <div class="nw-m-actions">${dated && s.groups.length < MAX_GROUPS - 1 ? `<button type="button" class="nw-m-btn ghost" data-more>+ ${T("Group", "مجموعة")}</button>` : ""}
        <button type="button" class="nw-m-btn" data-next>${last ? T("Finish", "إنهاء") : T("Next place", "الموقع التالي")}</button></div></div>`;
    const inp = box.querySelector("input"), read = dated ? mountWheel(box.querySelector(".nw-wheel")) : () => "";
    box.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { inp.value = fmtN(Math.max(0, (Number(inp.value) || 0) + Number(b.dataset.d))); });
    box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { draft = { qty: inp.value, date: read() }; s.groups.splice(Number(b.dataset.rm), 1); entry(false); });
    const take = (needed) => {
      const raw = inp.value.trim(), q = Number(raw);
      if (raw === "" && !needed) return true;
      if (raw === "" || !isFinite(q) || q < 0) { box.querySelector(".nw-m-err").textContent = T("Enter the quantity", "اكتب العدد"); inp.focus(); return false; }
      s.groups.push({ qty: r3(q), date: dated ? read() : "" }); return true;
    };
    box.querySelector("[data-more]")?.addEventListener("click", () => { if (take(true)) { draft = { qty: "", date: "" }; entry(false); } });
    box.querySelector("[data-next]").onclick = () => { if (!take(!s.groups.length)) return; i++; if (i < stops.length) go(); else finish(); };
  };
  const finish = () => {
    let who = ""; try { who = localStorage.getItem("noir-counter") || ""; } catch {}
    box.innerHTML = `<div class="nw-m-in nw-m-sum"><h4>${T("Your count", "جردك")}</h4>
      <ul class="nw-m-tot">${stops.map(s => `<li><span>${esc(locLabel(s.loc, ar))}</span><b class="data" dir="ltr">${fmtN(r3(s.groups.reduce((a, g) => a + g.qty, 0)))} ${unit}</b></li>`).join("")}</ul>
      <label class="nw-m-l">${T("Counted by", "اسم الموظف")}</label><input class="nw-m-name" value="${esc(opts.prev?.by || who)}" placeholder="${T("Your name", "اسمك")}" autocomplete="name">
      <p class="nw-m-err" role="alert"></p>
      <div class="nw-m-actions"><button type="button" class="nw-m-btn ghost" data-back>${T("Back", "رجوع")}</button><button type="button" class="nw-m-btn" data-send>${T("Send", "إرسال")}</button></div></div>`;
    box.querySelector("[data-back]").onclick = () => { i = stops.length - 1; entry(true); };
    box.querySelector("[data-send]").onclick = async e => {
      const by = box.querySelector(".nw-m-name").value.trim();
      if (!by) { box.querySelector(".nw-m-err").textContent = T("Write your name", "اكتب اسمك"); return; }
      try { localStorage.setItem("noir-counter", by); } catch {}
      e.target.disabled = true; e.target.textContent = T("Sending…", "جارٍ الإرسال…");
      const rec = await submit(p, stops, by, opts.prev).catch(err => { box.querySelector(".nw-m-err").textContent = err.message; e.target.disabled = false; return null; });
      if (rec) result(rec);
    };
  };
  const result = rec => {
    const mine = rec.stops.filter(s => stops.some(x => x.loc === s.loc)), bad = mine.filter(s => !s.ok);
    box.innerHTML = `<div class="nw-m-in nw-m-res ${bad.length ? "is-bad" : "is-ok"}"><span class="nw-m-mark" aria-hidden="true"></span>
      <h4>${bad.length ? T("Count again", "أعد الجرد") : T("Matches", "مطابق")}</h4>
      <ul class="nw-m-tot">${mine.map(s => `<li class="${s.ok ? "ok" : "bad"}"><span>${s.ok ? "✓" : "✗"} ${esc(locLabel(s.loc, ar))}</span><b class="data" dir="ltr">${fmtN(s.counted)}</b></li>`).join("")}</ul>
      <p class="nw-m-note">${bad.length ? T(`Your count does not match the stock report in ${bad.map(s => locLabel(s.loc, ar)).join(", ")}. Count that place again.`, `عدّك ما يطابق تقرير المخزون في ${bad.map(s => locLabel(s.loc, ar)).join("، ")}. أعد جرد هالموقع.`)
        : T("Sent to the supervisor for approval.", "انرسل للمشرف للاعتماد.")}</p>
      <div class="nw-m-actions">${bad.length ? `<button type="button" class="nw-m-btn ghost" data-x>${T("Later", "لاحقاً")}</button><button type="button" class="nw-m-btn" data-again>${T("Recount now", "أعد الآن")}</button>`
        : `<button type="button" class="nw-m-btn" data-x>${T("Done", "تم")}</button>`}</div></div>`;
    box.querySelector("[data-x]").onclick = () => { close(); opts.onDone?.(rec); };
    box.querySelector("[data-again]")?.addEventListener("click", () => { close(); opts.onDone?.(rec, true); });
  };
  intro();
  return close;
}

// ── review on the Count page ────────────────────────────────────────
export function reviewHtml(list, H, ar) {
  const T = (e, a) => (ar ? a : e), P = H.data().products;
  const open = list.filter(r => r.status === "match" || r.status === "recount").sort((a, b) => b.at.localeCompare(a.at));
  const done = list.filter(r => r.status === "approved").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const when = iso => new Date(iso).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const card = r => { const p = P.find(x => x.id === r.pid) || { id: r.pid, name: r.name, unit: r.unit, stock: {} }, unit = esc(H.UNITS[p.unit] || p.unit || "");
    // re-checked against today's stock report, so a report uploaded after the count is taken into account
    const rows = r.stops.map(s => { const expected = Number(p.stock?.[s.loc]) || 0; return { ...s, expected, ok: same(p, s.counted, expected) }; });
    const bad = rows.filter(s => !s.ok);
    return `<article class="wc-card ${r.status === "approved" ? "is-done" : bad.length ? "is-bad" : "is-ok"}" data-wc="${esc(r.id)}">
      <header><b>${esc(ar ? (NAMES_AR[p.id] || p.name) : p.name)}</b><span class="wc-tag">${r.status === "approved" ? T("Approved", "معتمد") : bad.length ? T("Recount sent", "انرسل لإعادة الجرد") : T("Matches", "مطابق")}</span></header>
      <p class="wc-by">${esc(r.by)} · ${when(r.at)}${r.tries > 1 ? ` · ${T("try", "محاولة")} ${r.tries}` : ""}</p>
      <ul>${rows.map(s => `<li class="${s.ok ? "ok" : "bad"}"><span>${s.ok ? "✓" : "✗"} ${esc(locLabel(s.loc, ar))}</span><b class="data" dir="ltr">${fmtN(s.counted)} ${unit}</b>
        <small>${s.ok ? T("as the report", "مثل التقرير") : `${T("report", "التقرير")} <b class="data" dir="ltr">${fmtN(s.expected)}</b> · ${T("difference", "الفرق")} <b class="data" dir="ltr">${s.counted > s.expected ? "+" : ""}${fmtN(r3(s.counted - s.expected))}</b>`}</small>
        ${(s.groups || []).filter(g => g.date).length ? `<em class="data" dir="ltr">${s.groups.filter(g => g.date).map(g => `${fmtN(g.qty)} → ${g.date}`).join(" · ")}</em>` : ""}</li>`).join("")}</ul>
      ${r.status === "approved" ? "" : `<div class="wc-act">${bad.length ? `<button type="button" class="btn sm ghost" data-wc-ok="${esc(r.id)}">${T("Approve anyway", "اعتماد رغم الفرق")}</button>` : `<button type="button" class="btn sm hot" data-wc-ok="${esc(r.id)}">${T("Approve", "اعتماد")}</button>`}</div>`}
    </article>`; };
  return `<section class="slab wc" id="wc">
    <div class="slab-h"><h2>${T("Watch counts", "جرد الساعة")}${open.length ? ` <sup class="wc-badge data">${open.length}</sup>` : ""}</h2>
      <button type="button" class="btn sm" id="wc-xlsx">${T("Expiry sheet (Excel)", "ملف الصلاحيات (إكسل)")}</button></div>
    ${open.length ? `<div class="wc-list">${open.map(card).join("")}</div>` : `<p class="empty">${T("Nothing waiting. Counts sent from a product watch show up here.", "ما فيه شي ينتظر. الجرد اللي ينرسل من ساعة المنتج يطلع هنا.")}</p>`}
    ${done.length ? `<details class="wc-done"><summary>${T("Approved lately", "آخر المعتمد")} · ${done.length}</summary><div class="wc-list">${done.map(card).join("")}</div></details>` : ""}
  </section>`;
}
export async function approve(id, by) {
  const list = await loadCounts(); const r = list.find(x => x.id === id); if (!r) return null;
  const rec = { ...r, status: "approved", approvedAt: new Date().toISOString(), approvedBy: by || "" };
  await store.putDoc(COL, id, rec); cache = list.map(x => x.id === id ? rec : x);
  store.log("count", `Watch count approved · ${r.name}`).catch(() => {});
  return rec;
}

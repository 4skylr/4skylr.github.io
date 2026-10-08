// Count on the product watch, and the admin's match against the live stock.
//
// Employee (any phone, no PIN):
//   Start count → Main Stores → Mini Store → Concession: counted quantity, and the expiry date of each group when the
//   product is dated (more than one group per place is fine) → name → saved to "watchCounts" as status "pending".
//   Nothing is written to products. "Send report to admin" (under the watch) turns this phone's pending counts "submitted".
//
// Admin (Settings → admin panel): each submitted place is compared with store.snapshot().products, never with a figure
// painted on a page: match · mismatch · expired · missing date.
//   Update (only on a match whose dates are not expired): writes that product's stock for that place and nothing else,
//   writes the recorded dates into the expiry sheet, and marks the place ready for Excel.
//   Recount: leaves the stock as it is and sends the place back to the employee's watch.
import * as store from "../core/store.js?v=106";
import { EXPIRY_SHEET } from "../data/expiry-data.js?v=106";
import { countToEdits, MAX_GROUPS } from "../data/expiry-edits.js?v=106";

export const COL = "watchCounts";
export const ORDER = ["stores", "mini", "refuel"]; // the walk: Main Stores → Mini Store → Concession
const LOC_NAME = { stores: "Main Stores", mini: "Mini Store", refuel: "Concession" };
export const locLabel = id => LOC_NAME[id] || id;
// items with no expiry date (cups, lids, tubs, trays, napkins, straws, CO₂ …): quantity only
export const noDate = p => p.category === "packaging" || p.category === "other" || /^(cups-|lids-|tub-|slush-glass|cotton-candy-tub|dip-cup|hotdog-tray|nachos-tray|napkin|straw|stirrer|co2)/.test(p.id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r3 = n => Math.round(n * 1000) / 1000;
const fmtN = n => (Number.isInteger(n) ? String(n) : String(r3(n)));
const dmy = iso => /^\d{4}-\d{2}-\d{2}/.test(iso || "") ? iso.slice(0, 10).split("-").reverse().join("/") : "";
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// a count matches the stock when it is the same number (by the piece) or within 2% (kg / litres)
export const same = (p, counted, expected) => (p.unit === "kg" || p.unit === "ltr") ? Math.abs(counted - expected) <= Math.max(0.05, expected * 0.02) : Math.abs(counted - expected) < 1e-6;

// ── records ─────────────────────────────────────────────────────────
let cache = null;
export async function loadCounts(force) { if (!cache || force) cache = await store.allDocs(COL).catch(() => store.localDocs(COL)); return cache; }
export const cachedCounts = () => cache || store.localDocs(COL);
const keep = rec => { if (cache) cache = [...cache.filter(x => x.id !== rec.id), rec]; return rec; };
export const counterName = () => { try { return localStorage.getItem("noir-counter") || ""; } catch { return ""; } };
export const myPending = (list, by) => by ? list.filter(r => r.status === "pending" && r.by === by) : [];
export const openRecount = (list, pid) => list.filter(r => r.pid === pid && r.status === "recount" && r.recount?.length).sort((a, b) => b.at.localeCompare(a.at))[0] || null;
// reports waiting for the admin (the badge on the Count key); "match" is a report sent before pending / submitted existed
const waiting = r => r.status === "submitted" || r.status === "match";
export const pendingCount = list => list.filter(waiting).length;

async function save(p, stops, by, recount) {
  const now = new Date().toISOString(), list = await loadCounts();
  const fresh = stops.map(s => ({ loc: s.loc, counted: r3(s.groups.reduce((a, g) => a + (Number(g.qty) || 0), 0)), groups: s.groups }));
  // a recount replaces only the places it was asked for; a second count of the same product before sending replaces the first
  const prev = recount || list.find(r => r.pid === p.id && r.status === "pending" && r.by === by) || null;
  const stopsOut = recount ? recount.stops.map(s => fresh.find(x => x.loc === s.loc) || s).concat(fresh.filter(x => !recount.stops.some(s => s.loc === x.loc))) : fresh;
  const rec = { id: prev?.id || `${p.id}-${now.replace(/\D/g, "").slice(0, 14)}`, pid: p.id, name: p.name, unit: p.unit || "", by, at: now,
    first: prev?.first || now, tries: (recount?.tries || 0) + 1, dated: !noDate(p), stops: stopsOut, status: "pending", recount: [] };
  await store.putDoc(COL, rec.id, rec);
  store.log("count", `Watch count saved · ${p.name} · ${by}`).catch(() => {});
  return keep(rec);
}
// "Send report to admin": every pending count this person saved becomes submitted
export async function sendReport(by) {
  const list = await loadCounts(true), at = new Date().toISOString(), mine = myPending(list, by);
  for (const r of mine) keep(await store.putDoc(COL, r.id, { ...r, status: "submitted", submittedAt: at }));
  if (mine.length) store.log("count", `Watch count report sent · ${mine.length} products · ${by}`).catch(() => {});
  return mine.length;
}
// places the admin updated on another device: put their dates into this device's expiry sheet too (each place once)
export async function syncCountsToSheet(products) {
  const list = await loadCounts(true); let seen = {};
  try { seen = JSON.parse(localStorage.getItem("noir-wc-applied") || "{}") || {}; } catch {}
  for (const r of list) for (const s of r.stops || []) {
    if (s.state !== "updated" || !s.updatedAt || seen[`${r.id}:${s.loc}`] === s.updatedAt) continue;
    const p = products.find(x => x.id === r.pid); if (!p) continue;
    toSheet(p, s); seen[`${r.id}:${s.loc}`] = s.updatedAt;
  }
  try { localStorage.setItem("noir-wc-applied", JSON.stringify(seen)); } catch {}
  return list;
}
// the expiry sheet gets the counted groups; an undated item only updates a row the sheet already has
function toSheet(p, s) {
  if (!noDate(p)) return countToEdits(p, s.loc, (s.groups || []).filter(g => Number(g.qty) > 0));
  if (EXPIRY_SHEET.rows.some(r => r.productId === p.id && r.loc === s.loc)) return countToEdits(p, s.loc, [{ qty: s.counted, date: "" }]);
  return null;
}

// ── the admin's match ───────────────────────────────────────────────
// one row per place of every report sent in: current stock from the live products, never from the page
export function reviewRows(list, products, today = todayIso()) {
  const rows = [];
  for (const r of list) {
    if (!(waiting(r) || r.status === "recount" || r.status === "done")) continue;
    const p = products.find(x => x.id === r.pid);
    for (const s of r.stops || []) {
      const current = p ? Number(p.stock?.[s.loc]) || 0 : null, counted = Number(s.counted) || 0;
      const dated = p ? !noDate(p) : !!r.dated, live = (s.groups || []).filter(g => Number(g.qty) > 0);
      const dates = live.map(g => g.date).filter(Boolean);
      const flags = [];
      if (!p) flags.push("missing product");
      else if (!same(p, counted, current)) flags.push("mismatch");
      if (dated && dates.some(d => d.slice(0, 10) < today)) flags.push("expired");
      if (dated && live.some(g => !g.date)) flags.push("missing date");
      rows.push({ rec: r, s, p, loc: s.loc, current, counted, dated, groups: live, flags, ok: !flags.length, state: s.state || "" });
    }
  }
  return rows.sort((a, b) => Number(!!a.state) - Number(!!b.state) || (b.rec.submittedAt || b.rec.at).localeCompare(a.rec.submittedAt || a.rec.at) || ORDER.indexOf(a.loc) - ORDER.indexOf(b.loc));
}
const settle = rec => {
  const open = rec.stops.filter(s => !s.state), back = rec.stops.filter(s => s.state === "recount").map(s => s.loc);
  return { ...rec, recount: back, status: back.length ? "recount" : open.length ? rec.status === "match" ? "submitted" : rec.status : "done" };
};
// Update: checked again against the live products at the moment of writing; only that place's quantity changes
export async function updateRow(id, loc, by) {
  const list = await loadCounts(true), rec = list.find(x => x.id === id); if (!rec) throw new Error("That report is gone");
  if (!(waiting(rec) || rec.status === "recount")) throw new Error("That report has not been sent yet");
  const s = rec.stops.find(x => x.loc === loc); if (!s || s.state) throw new Error("That place is already settled");
  const p = store.snapshot().products.find(x => x.id === rec.pid); if (!p) throw new Error("This product is not in the catalog");
  const row = reviewRows([{ ...rec, status: "submitted" }], [p]).find(x => x.loc === loc);
  if (!row?.ok) throw new Error(`Not updated: ${row ? row.flags.join(", ") : "no match"}. Ask for a recount.`);
  await store.setStock(p.id, { [loc]: row.counted }, `Watch count · ${locLabel(loc)} · ${by || "admin"}`);
  const at = new Date().toISOString();
  const next = settle({ ...rec, stops: rec.stops.map(x => x.loc === loc ? { ...x, state: "updated", updatedAt: at, updatedBy: by || "", excel: true } : x) });
  toSheet(p, next.stops.find(x => x.loc === loc));
  // this device has written the dates already; the minute sync must not write them again
  try { const seen = JSON.parse(localStorage.getItem("noir-wc-applied") || "{}") || {}; seen[`${id}:${loc}`] = at; localStorage.setItem("noir-wc-applied", JSON.stringify(seen)); } catch {}
  await store.putDoc(COL, id, next);
  return keep(next);
}
// Recount: the stock stays as it is; the place goes back to the employee's watch
export async function recountRow(id, loc, by) {
  const list = await loadCounts(true), rec = list.find(x => x.id === id); if (!rec) throw new Error("That report is gone");
  const next = settle({ ...rec, stops: rec.stops.map(x => x.loc === loc && !x.state ? { ...x, state: "recount", recountAt: new Date().toISOString(), recountBy: by || "" } : x) });
  await store.putDoc(COL, id, next);
  store.log("count", `Recount asked · ${rec.name} · ${locLabel(loc)}`).catch(() => {});
  return keep(next);
}

const STATUS_TXT = { match: "Match", mismatch: "Mismatch", expired: "Expired", "missing date": "Missing date", "missing product": "Not in catalog" };
export function reviewHtml(list, H) {
  const rows = reviewRows(list, H.data().products), open = rows.filter(r => !r.state), done = rows.filter(r => r.state).slice(0, 40);
  const when = iso => iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const unitOf = r => esc(H.UNITS[r.p?.unit || r.rec.unit] || r.p?.unit || r.rec.unit || "");
  const dates = r => !r.dated ? `<span class="wc-mute">Not dated</span>` : r.groups.length
    ? r.groups.map(g => `<span class="data" dir="ltr">${g.date ? dmy(g.date) : "—"}<small> · ${fmtN(Number(g.qty) || 0)}</small></span>`).join("") : `<span class="wc-mute">—</span>`;
  const chips = r => r.state === "updated" ? `<span class="wc-st is-done">Updated · ready for Excel</span>` : r.state === "recount" ? `<span class="wc-st is-back">Recount sent</span>`
    : r.ok ? `<span class="wc-st is-ok">Match</span>` : r.flags.map(f => `<span class="wc-st is-bad">${STATUS_TXT[f] || f}</span>`).join("");
  const act = r => r.state ? "" : r.ok ? `<button type="button" class="btn sm hot" data-wc-up="${esc(r.rec.id)}" data-loc="${r.loc}">Update</button>`
    : `<button type="button" class="btn sm" data-wc-re="${esc(r.rec.id)}" data-loc="${r.loc}">Recount</button>`;
  const tr = r => `<tr class="${r.state ? "is-settled" : r.ok ? "is-ok" : "is-bad"}">
      <td><b>${esc(r.p?.name || r.rec.name)}</b><small>${esc(r.rec.by)} · ${when(r.rec.submittedAt || r.rec.at)}</small></td>
      <td>${esc(locLabel(r.loc))}</td>
      <td class="data num">${r.current == null ? "—" : fmtN(r3(r.current))} <small>${unitOf(r)}</small></td>
      <td class="data num">${fmtN(r3(r.counted))} <small>${unitOf(r)}</small></td>
      <td class="wc-dates">${dates(r)}</td>
      <td class="wc-sts">${chips(r)}</td>
      <td class="wc-act">${act(r)}</td></tr>`;
  const table = list => `<div class="wc-tw"><table class="wc-table"><thead><tr><th>Product</th><th>Warehouse</th><th>Current stock</th><th>Counted</th><th>Recorded date</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(tr).join("")}</tbody></table></div>`;
  const ready = rows.filter(r => r.state === "updated").length;
  return `<section class="slab wc" id="wc">
    <div class="slab-h"><h2>Watch count reports${open.length ? ` <sup class="wc-badge data">${open.length}</sup>` : ""}</h2>
      <button type="button" class="btn sm" id="wc-xlsx">Download Excel${ready ? ` · ${ready} updated` : ""}</button></div>
    <p class="note">Compared with the live stock. Update writes only that place's quantity and the recorded dates, and only on a match. Anything else goes back for a recount and the stock stays as it is.</p>
    ${open.length ? table(open) : `<p class="empty">Nothing waiting. A report shows up here once an employee taps Send report to admin.</p>`}
    ${done.length ? `<details class="wc-done"><summary>Settled lately · ${done.length}</summary>${table(done)}</details>` : ""}
  </section>`;
}

// ── the date wheel ──────────────────────────────────────────────────
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ROW = 30;
function wheelHtml(iso) {
  const d = /^\d{4}-\d{2}-\d{2}/.test(iso || "") ? iso : new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
  const [y, m, day] = d.split("-").map(Number), y0 = new Date().getFullYear() - 1;
  const col = (k, items, sel) => `<div class="nw-wcol" data-k="${k}" data-sel="${sel}" tabindex="0">${items.map((t, i) => `<span data-i="${i}">${t}</span>`).join("")}</div>`;
  return `<div class="nw-wheel">
    ${col("d", Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")), day - 1)}
    ${col("m", MON, m - 1)}
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

// ── the count on the watch ──────────────────────────────────────────
// opts: { p, H, only (places to recount), prev (the record being recounted), groupsAt(loc) → groups on file, onDone(rec) }
export function startMission(disp, opts) {
  const { p, H } = opts, dated = !noDate(p);
  const stops = (opts.only?.length ? ORDER.filter(l => opts.only.includes(l)) : ORDER).map(loc => ({ loc, groups: [] }));
  const unit = esc(H.UNITS?.[p.unit] || p.unit || "");
  const box = document.createElement("div"); box.className = "nw-m";
  disp.append(box); disp.classList.add("is-mission");
  const close = () => { box.remove(); disp.classList.remove("is-mission"); dispatchEvent(new Event("nw-mission-end")); };
  let i = 0, draft = null;
  const steps = () => `<span class="nw-m-step data">${i + 1} / ${stops.length}</span>`;

  const intro = () => {
    box.innerHTML = `<div class="nw-m-in nw-m-intro"><h4>${opts.only?.length ? "Recount" : "Count"}<small>${esc(p.name)}</small></h4>
      <ol class="nw-m-route">${stops.map((s, k) => `<li><i class="data">${k + 1}</i>${esc(locLabel(s.loc))}<small>${dated ? "quantity · date" : "quantity"}</small></li>`).join("")}</ol>
      <div class="nw-m-actions"><button type="button" class="nw-m-btn ghost" data-x>Later</button><button type="button" class="nw-m-btn" data-go>Start</button></div></div>`;
    box.querySelector("[data-x]").onclick = close; box.querySelector("[data-go]").onclick = go;
  };
  // "Go to …": a little map that opens like a maps app, the pin drops on the place
  const go = () => {
    const s = stops[i];
    box.innerHTML = `<div class="nw-m-in nw-m-go"><div class="nw-map l-${s.loc}" aria-hidden="true"><div class="nw-map-tiles"><i class="park"></i><i class="water"></i><i class="blk a"></i><i class="blk b"></i><i class="blk c"></i></div>
        <svg class="nw-route" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M18 92 C 22 70, 44 74, 48 58 S 70 40, 66 30"/></svg>
        <span class="nw-me"></span><span class="nw-pin"><i></i></span><span class="nw-pulse"></span></div>
      <div class="nw-go-card">${steps()}<small>Go to</small><b>${esc(locLabel(s.loc))}</b>
        <button type="button" class="nw-m-btn" data-ok>OK</button></div></div>`;
    box.querySelector("[data-ok]").onclick = () => entry(true);
  };
  const entry = fresh => {
    const s = stops[i];
    if (fresh) { draft = { qty: "", date: "" }; if (!s.groups.length && dated) { const g = opts.groupsAt?.(s.loc)?.[0]; if (g?.date) draft.date = g.date; } }
    const last = i === stops.length - 1;
    box.innerHTML = `<div class="nw-m-in nw-m-entry"><header><b>${esc(locLabel(s.loc))}</b>${steps()}</header>
      ${s.groups.length ? `<div class="nw-m-groups">${s.groups.map((g, k) => `<span class="nw-m-chip"><em class="data">${k + 1}</em><b class="data">${fmtN(g.qty)}${g.date ? ` · ${dmy(g.date)}` : ""}</b><button type="button" data-rm="${k}" aria-label="Remove group ${k + 1}">×</button></span>`).join("")}</div>` : ""}
      <label class="nw-m-l">${dated ? `Group ${s.groups.length + 1} · ` : ""}Quantity <small>${unit}</small></label>
      <div class="nw-step"><button type="button" data-d="-1" aria-label="One less">−</button><input class="data" type="number" inputmode="decimal" min="0" step="any" value="${esc(draft.qty)}" placeholder="0" aria-label="Quantity"><button type="button" data-d="1" aria-label="One more">+</button></div>
      ${dated ? `<label class="nw-m-l">Expiry date</label>${wheelHtml(draft.date)}` : ""}
      <p class="nw-m-err" role="alert"></p>
      <div class="nw-m-actions">${dated && s.groups.length < MAX_GROUPS - 1 ? `<button type="button" class="nw-m-btn ghost" data-more>+ Group</button>` : ""}
        <button type="button" class="nw-m-btn" data-next>${last ? "Finish" : "Next place"}</button></div></div>`;
    const inp = box.querySelector("input"), read = dated ? mountWheel(box.querySelector(".nw-wheel")) : () => "";
    box.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { inp.value = fmtN(Math.max(0, (Number(inp.value) || 0) + Number(b.dataset.d))); });
    box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { draft = { qty: inp.value, date: read() }; s.groups.splice(Number(b.dataset.rm), 1); entry(false); });
    const take = needed => {
      const raw = inp.value.trim(), q = Number(raw);
      if (raw === "" && !needed) return true;
      if (raw === "" || !isFinite(q) || q < 0) { box.querySelector(".nw-m-err").textContent = "Enter the quantity (0 if there is none)"; inp.focus(); return false; }
      s.groups.push({ qty: r3(q), date: dated && q > 0 ? read() : "" }); return true;
    };
    box.querySelector("[data-more]")?.addEventListener("click", () => { if (take(true)) { draft = { qty: "", date: "" }; entry(false); } });
    box.querySelector("[data-next]").onclick = () => { if (!take(!s.groups.length)) return; i++; if (i < stops.length) go(); else finish(); };
  };
  const finish = () => {
    box.innerHTML = `<div class="nw-m-in nw-m-sum"><h4>Your count</h4>
      <ul class="nw-m-tot">${stops.map(s => `<li><span>${esc(locLabel(s.loc))}</span><b class="data">${fmtN(r3(s.groups.reduce((a, g) => a + g.qty, 0)))} ${unit}</b></li>`).join("")}</ul>
      <label class="nw-m-l">Counted by</label><input class="nw-m-name" value="${esc(opts.prev?.by || counterName())}" placeholder="Your name" autocomplete="name">
      <p class="nw-m-err" role="alert"></p>
      <div class="nw-m-actions"><button type="button" class="nw-m-btn ghost" data-back>Back</button><button type="button" class="nw-m-btn" data-save>Save</button></div></div>`;
    box.querySelector("[data-back]").onclick = () => { i = stops.length - 1; entry(true); };
    box.querySelector("[data-save]").onclick = async e => {
      const by = box.querySelector(".nw-m-name").value.trim();
      if (!by) { box.querySelector(".nw-m-err").textContent = "Write your name"; return; }
      try { localStorage.setItem("noir-counter", by); } catch {}
      e.target.disabled = true; e.target.textContent = "Saving…";
      const rec = await save(p, stops, by, opts.prev).catch(err => { box.querySelector(".nw-m-err").textContent = err.message; e.target.disabled = false; e.target.textContent = "Save"; return null; });
      if (rec) result(rec);
    };
  };
  const result = rec => {
    box.innerHTML = `<div class="nw-m-in nw-m-res is-ok"><span class="nw-m-mark" aria-hidden="true"></span>
      <h4>Saved</h4>
      <ul class="nw-m-tot">${rec.stops.filter(s => stops.some(x => x.loc === s.loc)).map(s => `<li><span>${esc(locLabel(s.loc))}</span><b class="data">${fmtN(s.counted)} ${unit}</b></li>`).join("")}</ul>
      <p class="nw-m-note">Waiting on this phone. When the round is done, tap Send report to admin under the watch.</p>
      <div class="nw-m-actions"><button type="button" class="nw-m-btn" data-x>Done</button></div></div>`;
    box.querySelector("[data-x]").onclick = () => { close(); opts.onDone?.(rec); };
  };
  intro();
  return close;
}

// The stock card: one product, how many, where, and as of when — the product page, the scan page and the count row.
//   Always visible: photo (when there is one), name, code, the selected warehouse's quantity in large type with its
//   as-of time, three warehouse chips (Concession = refuel, Mini Store = mini, Main Stores = stores), the total as a
//   secondary line, and one filled action: Count this warehouse.
//   Read more (collapsed): unit cost, value, sold, last sale, category, expiry groups. Nothing else.
// Counts go through store.countStock (one field, one history row); sold comes from productHistory (Concession decreases).
import { expiryRows } from "../data/expiry-edits.js?v=106";

export const WAREHOUSES = [
  { id: "refuel", name: "Concession", note: "the floor" },
  { id: "mini", name: "Mini Store", note: "" },
  { id: "stores", name: "Main Stores", note: "" }
];
const whName = id => WAREHOUSES.find(w => w.id === id)?.name || id;
const lastWh = () => { try { const v = localStorage.getItem("noir-stock-wh"); return WAREHOUSES.some(w => w.id === v) ? v : "refuel"; } catch { return "refuel"; } };
const keepWh = id => { try { localStorage.setItem("noir-stock-wh", id); } catch {} };
const counter = () => { try { return localStorage.getItem("noir-counter") || ""; } catch { return ""; } };
const num = v => Number(v) || 0;
// "10 Oct 2026, 17:20" in this device's time; "Today, 17:20" / "Yesterday, 09:05" when close
export function asOf(iso) {
  const d = iso ? new Date(iso) : null; if (!d || isNaN(d)) return "not recorded";
  const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), day = new Date(d); day.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0); const diff = Math.round((today - day) / 864e5);
  if (diff === 0) return `Today, ${t}`; if (diff === 1) return `Yesterday, ${t}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${t}`;
}
export const whAsOf = (p, loc) => p.stockAt?.[loc] || p.stockUpdatedAt || p.updatedAt || "";
const total = p => WAREHOUSES.reduce((a, w) => a + num(p.stock?.[w.id]), 0);
// expiry dates arrive as 2028-02-18 or 18/2/2028 (the monthly sheet)
export const toIso = v => { const s = String(v || "").trim(); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; };
export const fmtDate = v => { const i = toIso(v); return i ? new Date(i + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : String(v || ""); };
export const daysTo = v => { const i = toIso(v); if (!i) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(i + "T00:00:00") - t) / 864e5); };

// sold = every Concession decrease in the history; last sale = the newest of them
export function soldFrom(rows) {
  const sales = rows.filter(r => r.sale && r.warehouse === "refuel");
  return { qty: Math.round(sales.reduce((a, r) => a + num(r.sold || -r.delta), 0) * 1000) / 1000, last: sales.map(r => r.at).sort().at(-1) || "" };
}

function moreHtml(p, H, hist) {
  const esc = H.esc, unit = esc(H.UNITS[p.unit] || p.unit || ""), rate = num(p.rate), T = total(p);
  const groups = expiryRows(p.id).flatMap(r => r.batches.filter(b => num(String(b.qty ?? "").replace(/[^\d.]/g, "")) > 0 && b.date)
    .map(b => ({ loc: r.loc, n: b.n, qty: b.qty, date: b.date, left: daysTo(b.date) })))
    .sort((a, b) => (toIso(a.date) || String(a.date)).localeCompare(toIso(b.date) || String(b.date)));
  const s = hist ? soldFrom(hist) : null;
  return `<dl class="sk-facts">
      <div><dt>Unit cost</dt><dd class="data">${rate ? `${H.sar(rate)} SAR / ${unit}` : "—"}</dd></div>
      <div><dt>Value</dt><dd class="data">${rate ? `${H.sar(T * rate)} SAR` : "—"}</dd></div>
      <div><dt>Sold</dt><dd class="data" data-sold>${s ? `${H.qty(s.qty)} ${unit}` : "…"}</dd></div>
      <div><dt>Last sale</dt><dd data-last>${s ? (s.last ? asOf(s.last) : "none recorded") : "…"}</dd></div>
      <div><dt>Category</dt><dd>${esc(H.catName ? H.catName(p.category) : p.category || "—")}</dd></div>
    </dl>
    <p class="sk-note">Sold counts Concession decreases only; Mini Store and Main Stores decreases are transfers or waste.</p>
    <h4 class="sk-sub">Expiry groups${groups.length ? ` · ${groups.length}` : ""}</h4>
    ${groups.length ? `<ul class="sk-groups">${groups.map(g => `<li class="${g.left != null && g.left < 0 ? "is-exp" : g.left != null && g.left <= 30 ? "is-soon" : ""}">
        <span>${esc(whName(g.loc))} · Group ${g.n}</span><span class="data">${esc(String(g.qty))} ${unit}</span>
        <span class="data">${esc(fmtDate(g.date))}${g.left != null ? ` · ${g.left < 0 ? "expired" : `${g.left} days`}` : ""}</span></li>`).join("")}</ul>`
      : `<p class="sk-note">No dated groups on file.</p>`}`;
}

export function stockCardHtml(p, H, sel = lastWh()) {
  const esc = H.esc, unit = esc(H.UNITS[p.unit] || p.unit || ""), here = num(p.stock?.[sel]);
  const code = [p.code, p.sku].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(esc).join(" · ");
  return `<article class="sk" data-id="${esc(p.id)}" data-sel="${sel}">
    <header class="sk-head">
      ${p.image ? `<div class="sk-photo">${H.pic(p, "sk-img")}</div>` : ""}
      <div class="sk-id"><h2 class="sk-name">${esc(p.name)}</h2>${code ? `<p class="sk-code data">${code}</p>` : ""}</div>
    </header>
    <div class="sk-now" aria-live="polite">
      <span class="sk-where">${esc(whName(sel))}</span>
      <b class="sk-qty data">${H.qty(here)}<small>${unit}</small></b>
      <span class="sk-asof">${whAsOf(p, sel) ? `As of ${esc(asOf(whAsOf(p, sel)))}` : "No count or upload recorded yet"}</span>
    </div>
    <div class="sk-chips" role="radiogroup" aria-label="Warehouse">${WAREHOUSES.map(w => `<button type="button" class="sk-chip" role="radio" aria-checked="${w.id === sel}" data-loc="${w.id}">
        <span>${w.name}</span><b class="data">${H.qty(num(p.stock?.[w.id]))}</b></button>`).join("")}</div>
    <p class="sk-total">Total <b class="data">${H.qty(total(p))} ${unit}</b> in the three warehouses</p>
    <div class="sk-act">
      <button type="button" class="btn hot sk-go" data-count>Count this warehouse</button>
      <form class="sk-count" hidden>
        <label for="skq-${esc(p.id)}">Counted in ${esc(whName(sel))} <small>${unit}</small></label>
        <div class="sk-count-row"><input class="input data" id="skq-${esc(p.id)}" name="qty" type="number" inputmode="decimal" min="0" step="any" required placeholder="${H.qty(here)}">
          <button type="submit" class="btn hot">Save</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>
        <p class="sk-err" role="alert"></p>
      </form>
    </div>
    <details class="sk-more"><summary>Read more</summary><div class="sk-more-in">${moreHtml(p, H, null)}</div></details>
  </article>`;
}

// H: { esc, qty, sar, pic, UNITS, catName?, data(), toast, countStock(id, loc, qty, opts), productHistory(id) }
export function mountStockCard(root, p0, H, { sel } = {}) {
  let p = p0, at = sel || lastWh(), hist = null;
  const fresh = () => H.data().products.find(x => x.id === p.id) || p;
  const paint = keepOpen => {
    const wasOpen = keepOpen && root.querySelector(".sk-more")?.open;
    root.innerHTML = stockCardHtml(p, H, at);
    const more = root.querySelector(".sk-more");
    if (wasOpen) { more.open = true; if (hist) more.querySelector(".sk-more-in").innerHTML = moreHtml(p, H, hist); }
    wire();
  };
  const loadMore = async () => {
    hist = await H.productHistory(p.id).catch(() => []);
    const box = root.querySelector(".sk-more-in"); if (box) box.innerHTML = moreHtml(p, H, hist);
  };
  const wire = () => {
    root.querySelectorAll("[data-loc]").forEach(b => b.onclick = () => { at = b.dataset.loc; keepWh(at); paint(true); });
    const go = root.querySelector("[data-count]"), form = root.querySelector(".sk-count"), inp = form.querySelector("input");
    go.onclick = () => { go.hidden = true; form.hidden = false; inp.focus(); };
    form.querySelector("[data-cancel]").onclick = () => { form.hidden = true; go.hidden = false; };
    form.onsubmit = async e => {
      e.preventDefault();
      const v = inp.value.trim(), err = form.querySelector(".sk-err");
      if (v === "" || !(Number(v) >= 0)) { err.textContent = "Enter the quantity you counted (0 if none)."; inp.focus(); return; }
      const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
      try {
        const row = await H.countStock(p.id, at, Number(v), { by: counter() });
        // show the saved figure at once; the live data catches up on its own
        p = { ...fresh(), stock: { ...(fresh().stock || {}), [at]: row.after }, stockAt: { ...(fresh().stockAt || {}), [at]: row.at } };
        if (hist) hist = [row, ...hist];
        H.toast(`${whName(at)} · ${H.qty(row.before)} → ${H.qty(row.after)}${row.delta ? ` (${row.delta > 0 ? "+" : "−"}${H.qty(Math.abs(row.delta))})` : " · confirmed"}`);
        paint(true);
      } catch (x) { err.textContent = x.message || "Could not save"; btn.disabled = false; btn.textContent = "Save"; }
    };
    root.querySelector(".sk-more").addEventListener("toggle", e => { if (e.target.open && !hist) loadMore(); });
  };
  paint(false);
  // live data from other phones: repaint when this product changes, unless someone is typing a count
  const off = H.onChange?.(() => {
    if (!root.isConnected) { off?.(); return; }
    const f = fresh(); if (JSON.stringify(f.stock) === JSON.stringify(p.stock) && JSON.stringify(f.stockAt) === JSON.stringify(p.stockAt)) return;
    if (root.querySelector(".sk-count:not([hidden])")) return;
    p = f; paint(true);
  });
}

// The product page as a sheet over the current page (the Stock list, alerts, the showcase).
export function openStockCard(p, H) {
  H.openModal(`<div class="sk-host"></div>`, "narrow sk-sheet");
  mountStockCard(document.querySelector("#modal-root .sk-host"), p, H);
}

// ── the count screen's row: the same card, one warehouse, one number ──
export function countRowHtml(p, H, loc) {
  const esc = H.esc, unit = esc(H.UNITS[p.unit] || p.unit || ""), here = num(p.stock?.[loc]);
  return `<li class="sk-row" data-id="${esc(p.id)}">
    ${p.image ? `<div class="sk-row-photo">${H.pic(p, "sk-img")}</div>` : `<div class="sk-row-photo"></div>`}
    <div class="sk-row-id"><b>${esc(p.name)}</b><small class="data">${esc(p.sku || p.code || "")}</small></div>
    <div class="sk-row-now"><b class="data">${H.qty(here)} <small>${unit}</small></b><small>${whAsOf(p, loc) ? `As of ${esc(asOf(whAsOf(p, loc)))}` : "Not counted yet"}</small></div>
    <form class="sk-row-form"><input class="input data" name="qty" type="number" inputmode="decimal" min="0" step="any" aria-label="Counted ${esc(p.name)}" placeholder="Count">
      <button type="submit" class="btn">Save</button></form>
    <p class="sk-row-msg" role="status"></p>
  </li>`;
}

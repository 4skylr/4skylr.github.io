// Shop → Levels: how much each product has in the Concession, red under 5, what to bring from Mini Store / Main Stores;
// what the last stock file fixed; and where the dates file disagrees with the stock on file.
import { SEED_PRODUCTS } from "../data/seed-data.js?v=106";
import { expiryRows } from "../data/expiry-edits.js?v=106";
import { noDate, same } from "./watch-count.js?v=112";
import { putDoc, localDocs } from "../core/store.js?v=115";

export const LOW = 5;
const SEED = new Map(SEED_PRODUCTS.map(p => [p.id, p]));
const n = v => Number(v) || 0;
const r2 = v => Math.round(v * 100) / 100;
// a Concession product: it ships in the Concession, holds stock there now, or has a Concession row in the dates file
export function inConcession(p) {
  return n(SEED.get(p.id)?.stock?.refuel) > 0 || n(p.stock?.refuel) > 0 || expiryRows(p.id).some(r => r.loc === "refuel");
}
export const lowList = products => products.filter(p => inConcession(p) && n(p.stock?.refuel) < LOW);

// ── the last stock file: was each low item put right? ──
const CHECKS = "levelChecks";
export function lastCheck() { return localDocs(CHECKS).find(d => d.id === "last") || null; }
export function lowSnapshot(products) { return Object.fromEntries(lowList(products).map(p => [p.id, n(p.stock?.refuel)])); }
export async function saveCheck(before, products, source) {
  const now = new Map(products.map(p => [p.id, p])), rows = [];
  for (const [id, was] of Object.entries(before)) {
    const p = now.get(id); if (!p) continue;
    const after = n(p.stock?.refuel); rows.push({ id, name: p.name, unit: p.unit || "", before: was, after, fixed: after >= LOW });
  }
  const fresh = lowList(products).filter(p => !(p.id in before)).map(p => ({ id: p.id, name: p.name, unit: p.unit || "", before: null, after: n(p.stock?.refuel), fixed: false }));
  const check = { at: new Date().toISOString(), source: source || "", rows: [...rows, ...fresh] };
  await putDoc(CHECKS, "last", check).catch(() => {});
  return check;
}

// ── the dates file against the stock: per product and warehouse ──
export function dateConflicts(products) {
  const out = [];
  for (const p of products) {
    if (noDate(p)) continue;
    const rows = expiryRows(p.id); if (!rows.length) continue;
    const byLoc = {};
    for (const r of rows) if (r.loc) byLoc[r.loc] = (byLoc[r.loc] || 0) + r.batches.reduce((a, b) => a + n(String(b.qty ?? "").replace(/[^\d.]/g, "")), 0);
    for (const [loc, dated] of Object.entries(byLoc)) {
      const stock = n(p.stock?.[loc]);
      if (!dated && !stock) continue;
      if (same(p, dated, stock)) continue;
      out.push({ id: p.id, name: p.name, unit: p.unit || "", loc, dated: r2(dated), stock: r2(stock), diff: r2(dated - stock) });
    }
  }
  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

const LOC = { refuel: "Concession", mini: "Mini Store", stores: "Main Stores" };
export const locName = id => LOC[id] || id;
const when = iso => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export function checkHtml(c, H) {
  if (!c?.rows?.length) return "";
  const fixed = c.rows.filter(r => r.fixed), still = c.rows.filter(r => !r.fixed && r.before != null), fresh = c.rows.filter(r => r.before == null);
  const li = r => `<li class="${r.fixed ? "is-ok" : "is-low"}"><span><b>${H.esc(r.name)}</b><small>Concession</small></span>
    <span class="data">${r.before == null ? "new" : `${H.qty(r.before)} → ${H.qty(r.after)}`}</span><b class="lv-tag">${r.fixed ? "Fixed" : r.before == null ? "Now low" : "Still low"}</b></li>`;
  return `<section class="lv-block" aria-labelledby="lv-check-h">
    <h3 id="lv-check-h">After the last stock file</h3>
    <p class="note">${H.esc(c.source || "Stock file")} · ${when(c.at)} · <b class="lv-ok">${fixed.length} fixed</b> · <b class="lv-bad">${still.length + fresh.length} still low</b></p>
    <ul class="lv-list lv-check">${[...still, ...fresh, ...fixed].map(li).join("")}</ul></section>`;
}
export function conflictsHtml(list, H, { title = "Dates file against stock" } = {}) {
  return `<section class="lv-block" aria-labelledby="lv-dates-h">
    <h3 id="lv-dates-h">${H.esc(title)} · ${list.length}</h3>
    ${list.length ? `<p class="note">The dated quantity in the dates file, against the stock on file for the same warehouse. Count it, or fix the dates file.</p>
    <ul class="lv-list lv-dates">${list.map(c => `<li data-open="${H.esc(c.id)}" tabindex="0" role="button"><span><b>${H.esc(c.name)}</b><small>${locName(c.loc)}</small></span>
      <span class="data">dates ${H.qty(c.dated)} · stock ${H.qty(c.stock)}</span>
      <b class="lv-tag ${c.diff > 0 ? "is-up" : "is-down"}">${c.diff > 0 ? `Dates higher +${H.qty(c.diff)}` : `Dates lower −${H.qty(-c.diff)}`}</b></li>`).join("")}</ul>`
    : `<p class="note lv-ok">Every dated item matches its stock.</p>`}</section>`;
}

export function renderLevels(host, H, products) {
  const conc = products.filter(inConcession), low = conc.filter(p => n(p.stock?.refuel) < LOW).sort((a, b) => n(a.stock?.refuel) - n(b.stock?.refuel));
  const okList = conc.filter(p => n(p.stock?.refuel) >= LOW).sort((a, b) => n(a.stock?.refuel) - n(b.stock?.refuel));
  const unit = p => H.UNITS?.[p.unit] || p.unit || "";
  const from = p => { const mini = n(p.stock?.mini), main = n(p.stock?.stores);
    return mini > 0 ? `Bring from Mini Store · ${H.qty(mini)} there` : main > 0 ? `Bring from Main Stores · ${H.qty(main)} there` : "None in Mini Store or Main Stores · reorder"; };
  const row = (p, bad) => `<li class="${bad ? "is-low" : ""}" data-open="${H.esc(p.id)}" tabindex="0" role="button">
      <span class="lv-pic">${H.pic(p, "pic")}</span>
      <span class="lv-id"><b>${H.esc(p.name)}</b><small>${bad ? H.esc(from(p)) : `Mini ${H.qty(n(p.stock?.mini))} · Main ${H.qty(n(p.stock?.stores))}`}</small></span>
      <span class="lv-qty"><b class="data">${H.qty(n(p.stock?.refuel))}</b><small>${H.esc(unit(p))}</small></span></li>`;
  const conflicts = dateConflicts(products);
  host.innerHTML = `<div class="lv">
    <section class="lv-head" aria-label="Concession">
      <div><span class="lv-k">Concession</span><b class="data ${low.length ? "lv-bad" : "lv-ok"}">${low.length}</b><span>under ${LOW}</span></div>
      <div><span class="lv-k">Stocked</span><b class="data">${okList.length}</b><span>${LOW} or more</span></div>
      <div><span class="lv-k">Dates vs stock</span><b class="data ${conflicts.length ? "lv-bad" : "lv-ok"}">${conflicts.length}</b><span>${conflicts.length === 1 ? "conflict" : "conflicts"}</span></div>
    </section>
    <section class="lv-block" aria-labelledby="lv-low-h">
      <h3 id="lv-low-h">Under ${LOW} in the Concession · ${low.length}</h3>
      ${low.length ? `<ul class="lv-list">${low.map(p => row(p, true)).join("")}</ul>` : `<p class="note lv-ok">Every Concession item has ${LOW} or more.</p>`}
    </section>
    <details class="lv-block lv-more" open><summary>Stocked in the Concession · ${okList.length}</summary><ul class="lv-list">${okList.map(p => row(p, false)).join("")}</ul></details>
    ${checkHtml(lastCheck(), H)}
    ${conflictsHtml(conflicts, H)}
  </div>`;
  host.querySelectorAll("[data-open]").forEach(el => {
    const open = () => { const p = products.find(x => x.id === el.dataset.open); if (p) H.openCard(p); };
    el.onclick = open; el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
  });
}

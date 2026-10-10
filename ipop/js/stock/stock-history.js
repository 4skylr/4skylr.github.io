// Stock files (the "Current Stock Position" report, the expiry/dates sheet): every upload is compared with the stock on
// file per product and warehouse. Each change is one productHistory row (store.applyStockChanges); this collection keeps
// one summary per upload for the Ledger. A decrease counts as sold only in the Concession (refuel).
export const COL = "stockHistory";

// Quantities only: stock.stores, stock.mini and stock.refuel. Name, price, cost, image, recipe, barcode and par are never
// written. An item the file has but the catalog does not is listed (found.unmatched), never created.
// A full report lists everything the branch holds, so a place it leaves out for a product is 0 there; nothing is deleted.
export async function applyStockReport(found, H, source = "", reason = "stock-file") {
  const products = H.data().products, next = {};
  found.forEach(row => {
    const p = products.find(x => x.id === row.id); if (!p) return;
    (next[row.id] ??= {})[row.loc] = Number(row.qty) || 0;
  });
  const listed = new Set(Object.keys(next)), full = reason === "stock-file" && listed.size >= Math.max(10, products.length * .4);
  if (full) for (const p of products) for (const loc of ["stores", "mini", "refuel"]) {
    if (next[p.id]?.[loc] == null && Number(p.stock?.[loc])) (next[p.id] ??= {})[loc] = 0;
  }
  // diffed against the stock on file; each change becomes one productHistory row
  const res = await H.applyStockChanges(Object.entries(next).flatMap(([id, locs]) => Object.entries(locs).map(([loc, qty]) => ({ id, loc, qty }))), { reason, source });
  const name = id => products.find(x => x.id === id), lines = res.rows.map(r => ({ id: r.productId, name: name(r.productId)?.name || r.productId, unit: name(r.productId)?.unit || "",
    loc: r.warehouse, from: r.before, to: r.after, delta: r.delta, sale: r.sale }));
  // one net figure per product, for the upload summary
  const net = {};
  lines.forEach(l => { (net[l.id] ??= { id: l.id, name: l.name, unit: l.unit, delta: 0 }).delta += l.delta; });
  const at = new Date().toISOString(), unmatched = [...new Set((found.unmatched || []).map(u => u.trim()).filter(Boolean))];
  const entry = { id: "rep-" + at.replace(/\D/g, "").slice(0, 14), at, source, reason, products: listed.size, lines, unmatched, historyOk: res.historyOk,
    net: Object.values(net).map(n => ({ ...n, delta: Math.round(n.delta * 1000) / 1000 })).filter(n => Math.abs(n.delta) > 1e-9) };
  await H.putDoc(COL, entry.id, entry);
  const down = lines.filter(l => l.delta < 0).length, up = lines.filter(l => l.delta > 0).length;
  await H.log("report", `${reason === "date-file" ? "Dates file" : "Stock report"} · ${source} · ${up} up · ${down} down${unmatched.length ? ` · ${unmatched.length} not in the catalog` : ""}`);
  return entry;
}

export function historyOf(entries, id) {
  return entries.filter(e => (e.lines || []).some(l => l.id === id)).sort((a, b) => b.at.localeCompare(a.at))
    .map(e => ({ at: e.at, source: e.source, lines: e.lines.filter(l => l.id === id) }));
}

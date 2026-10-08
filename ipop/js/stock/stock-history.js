// Stock history from "Current Stock Position" reports.
// A product has no history of its own: every uploaded report is compared with the stock on file,
// and the difference is saved. Less than before = sold, more than before = added (delivery or transfer in).
export const COL = "stockHistory";

// Quantities only: stock.stores, stock.mini and stock.refuel. Name, price, cost, image, recipe, barcode and par are never
// written. An item the file has but the catalog does not is listed (found.unmatched), never created.
// A full report lists everything the branch holds, so a place it leaves out for a product is 0 there; nothing is deleted.
export async function applyStockReport(found, H, source = "") {
  const products = H.data().products, next = {}, lines = [];
  found.forEach(row => {
    const p = products.find(x => x.id === row.id); if (!p) return;
    (next[row.id] ??= {})[row.loc] = Number(row.qty) || 0;
  });
  const listed = new Set(Object.keys(next)), full = listed.size >= Math.max(10, products.length * .4);
  if (full) for (const p of products) for (const loc of ["stores", "mini", "refuel"]) {
    if (next[p.id]?.[loc] == null && Number(p.stock?.[loc])) (next[p.id] ??= {})[loc] = 0;
  }
  for (const [id, locs] of Object.entries(next)) {
    const p = products.find(x => x.id === id);
    for (const [loc, to] of Object.entries(locs)) { const from = Number(p.stock?.[loc]) || 0;
      if (Math.abs(to - from) > 1e-9) lines.push({ id, name: p.name, unit: p.unit, loc, from, to, delta: Math.round((to - from) * 1000) / 1000 }); }
  }
  await H.setStockMany(next);
  // one net figure per product, for the upload summary
  const net = {};
  lines.forEach(l => { (net[l.id] ??= { id: l.id, name: l.name, unit: l.unit, delta: 0 }).delta += l.delta; });
  const at = new Date().toISOString(), unmatched = [...new Set((found.unmatched || []).map(u => u.trim()).filter(Boolean))];
  const entry = { id: "rep-" + at.replace(/\D/g, "").slice(0, 14), at, source, products: listed.size, lines, unmatched,
    net: Object.values(net).map(n => ({ ...n, delta: Math.round(n.delta * 1000) / 1000 })).filter(n => Math.abs(n.delta) > 1e-9) };
  await H.putDoc(COL, entry.id, entry);
  const sold = entry.net.filter(n => n.delta < 0).length, added = entry.net.filter(n => n.delta > 0).length;
  await H.log("report", `Stock report · ${entry.products} products · ${sold} down · ${added} up${unmatched.length ? ` · ${unmatched.length} not in the catalog` : ""}`);
  return entry;
}

export function historyOf(entries, id) {
  return entries.filter(e => (e.lines || []).some(l => l.id === id)).sort((a, b) => b.at.localeCompare(a.at))
    .map(e => ({ at: e.at, source: e.source, lines: e.lines.filter(l => l.id === id) }));
}

// Stock history from "Current Stock Position" reports.
// A product has no history of its own: every uploaded report is compared with the stock on file,
// and the difference is saved. Less than before = sold, more than before = added (delivery or transfer in).
export const COL = "stockHistory";

export async function applyStockReport(found, H, source = "") {
  const products = H.data().products, byId = {}, lines = [];
  found.forEach(row => {
    const p = products.find(x => x.id === row.id); if (!p) return;
    const doc = (byId[row.id] ??= { ...p, stock: { ...(p.stock || {}) } });
    const from = Number(p.stock?.[row.loc]) || 0, to = Number(row.qty) || 0;
    doc.stock[row.loc] = to;
    if (Math.abs(to - from) > 1e-9) lines.push({ id: p.id, name: p.name, unit: p.unit, loc: row.loc, from, to, delta: Math.round((to - from) * 1000) / 1000 });
  });
  // A full report lists everything the branch holds. A product it does not list (sold out, expired and written off …) is
  // kept and marked out of stock, never deleted; a listed product no longer shows a place the report leaves out.
  const listed = new Set(found.map(r => r.id)), full = listed.size >= Math.max(10, products.length * .4), at0 = new Date().toISOString();
  if (full) {
    for (const p of products) {
      const doc = byId[p.id] || (listed.has(p.id) ? null : (byId[p.id] = { ...p, stock: { ...(p.stock || {}) } })); if (!doc) continue;
      const here = new Set(found.filter(r => r.id === p.id).map(r => r.loc));
      for (const loc of Object.keys(doc.stock)) if (!here.has(loc) && Number(doc.stock[loc])) {
        const from = Number(p.stock?.[loc]) || 0; doc.stock[loc] = 0; lines.push({ id: p.id, name: p.name, unit: p.unit, loc, from, to: 0, delta: -from });
      }
      if (listed.has(p.id)) { if (doc.outOfStock) delete doc.outOfStock; }
      else if (!p.outOfStock) doc.outOfStock = { at: at0, source };
    }
  } else for (const doc of Object.values(byId)) if (doc.outOfStock) delete doc.outOfStock;
  for (const doc of Object.values(byId)) await H.saveProduct(doc, { silent: true });
  // one net figure per product, for the upload summary
  const net = {};
  lines.forEach(l => { (net[l.id] ??= { id: l.id, name: l.name, unit: l.unit, delta: 0 }).delta += l.delta; });
  const at = new Date().toISOString();
  const entry = { id: "rep-" + at.replace(/\D/g, "").slice(0, 14), at, source, products: Object.keys(byId).length, lines,
    net: Object.values(net).map(n => ({ ...n, delta: Math.round(n.delta * 1000) / 1000 })).filter(n => Math.abs(n.delta) > 1e-9) };
  await H.putDoc(COL, entry.id, entry);
  const sold = entry.net.filter(n => n.delta < 0).length, added = entry.net.filter(n => n.delta > 0).length;
  await H.log("report", `Stock report · ${entry.products} products · ${sold} sold · ${added} added`);
  return entry;
}

export function historyOf(entries, id) {
  return entries.filter(e => (e.lines || []).some(l => l.id === id)).sort((a, b) => b.at.localeCompare(a.at))
    .map(e => ({ at: e.at, source: e.source, lines: e.lines.filter(l => l.id === id) }));
}

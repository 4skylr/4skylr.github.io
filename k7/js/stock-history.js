// Stock history from "Current Stock Position" reports.
// A product has no history of its own: every uploaded report is compared with the stock on file,
// and the difference is saved. Less than before = sold, more than before = added (delivery or transfer in).
export const COL = "stockHistory";
const LOC = { refuel: ["CON", "الكونسيشن"], mini: ["MNI", "الميني ستور"], stores: ["STR", "المستودع"] };
export const locLabel = (id, ar) => (LOC[id] || [id, id])[ar ? 1 : 0];

export async function applyStockReport(found, H, source = "") {
  const products = H.data().products, byId = {}, lines = [];
  found.forEach(row => {
    const p = products.find(x => x.id === row.id); if (!p) return;
    const doc = (byId[row.id] ??= { ...p, stock: { ...(p.stock || {}) } });
    const from = Number(p.stock?.[row.loc]) || 0, to = Number(row.qty) || 0;
    doc.stock[row.loc] = to;
    if (Math.abs(to - from) > 1e-9) lines.push({ id: p.id, name: p.name, unit: p.unit, loc: row.loc, from, to, delta: Math.round((to - from) * 1000) / 1000 });
  });
  for (const doc of Object.values(byId)) await H.saveProduct(doc, { silent: true });
  // one net figure per product for the alerts
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

// newest changes first, for the top ticker
export function recentMoves(entries, hours = 72) {
  const since = Date.now() - hours * 3600000;
  return entries.filter(e => Date.parse(e.at) >= since).sort((a, b) => b.at.localeCompare(a.at))
    .flatMap(e => (e.net || []).map(n => ({ ...n, at: e.at })));
}
export function historyOf(entries, id) {
  return entries.filter(e => (e.lines || []).some(l => l.id === id)).sort((a, b) => b.at.localeCompare(a.at))
    .map(e => ({ at: e.at, source: e.source, lines: e.lines.filter(l => l.id === id) }));
}

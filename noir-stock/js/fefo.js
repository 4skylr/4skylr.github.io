// First-expiry-first-out and riyal at risk. Quantities use decimal.js (github.com/MikeMcl/decimal.js).
const LIB = "vendor/decimal.min.js";
let ready = null;
function loadDecimal() {
  ready ??= new Promise((res, rej) => {
    if (window.Decimal) return res(window.Decimal);
    const s = document.createElement("script"); s.src = LIB; s.onload = () => res(window.Decimal); s.onerror = rej;
    document.head.append(s);
  });
  return ready;
}
export function qtyNum(v) {
  if (v == null || v === "") return 0;
  const s = String(v).trim().toLowerCase();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  if (s.endsWith("g") && !s.endsWith("kg")) return n / 1000;
  return n;
}
function asDate(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) return new Date(String(v).slice(0, 10) + "T00:00:00");
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(v))) { const [d, m, y] = String(v).split("/"); return new Date(`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}T00:00:00`); }
  return null;
}
export async function fefoReport(rows, rate) {
  const D = await loadDecimal();
  const lines = [];
  rows.forEach(r => r.batches.forEach(b => {
    const qty = qtyNum(b.qty);
    if (!qty) return;
    const dt = asDate(b.date);
    const left = dt ? Math.round((dt - new Date()) / 86400000) : null;
    lines.push({ ...b, location: r.location, loc: r.loc, qty, left, dt });
  }));
  lines.sort((a, b) => (a.left ?? 9999) - (b.left ?? 9999));
  const money = days => lines.filter(l => l.left != null && l.left <= days).reduce((a, l) => a.plus(new D(l.qty).times(rate || 0)), new D(0));
  return {
    first: lines[0] || null,
    expired: money(0).toFixed(2),
    d7: money(7).toFixed(2),
    d14: money(14).toFixed(2),
    d30: money(30).toFixed(2),
    lines
  };
}

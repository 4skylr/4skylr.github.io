// Reads a Monthly Expiry Monitoring Sheet (any branch's): the header row "Raw Material Name", section rows ("DRINKS:"),
// then one row per item and place with up to five quantity/date pairs. Columns are found from the header, not assumed.
import { HOME_SHEET } from "./expiry-data.js?v=114";

const text = v => String(v?.result ?? v?.richText?.map(t => t.text).join("") ?? v?.text ?? v ?? "").trim();
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
const pad = n => String(n).padStart(2, "0");
export function isoDate(v) {
  if (v instanceof Date && !isNaN(v)) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === "number" && v > 20000 && v < 80000) return isoDate(new Date(Math.round((v - 25569) * 864e5)));
  const t = text(v); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t))) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return "";
}
export function locOf(s) {
  const t = norm(s);
  return /refuel|concession/.test(t) ? "refuel" : /mini/.test(t) ? "mini" : /store|main/.test(t) ? "stores" : "";
}
// a sheet name → product: Unaizah's sheet names first, then the product's SKU or name
export function productMatcher(products = []) {
  const map = new Map();
  for (const p of products) for (const k of [p.name, p.sku, p.code]) if (k && !map.has(norm(k))) map.set(norm(k), p.id);
  for (const r of HOME_SHEET.rows) if (r.productId) map.set(norm(r.name), r.productId);
  return name => map.get(norm(name)) || null;
}
// → { sheet, rows: [{ row, sr, name, section, location, loc, productId, batches: [{ n, qty, date, qtyCol, dateCol }] }] }
export function readSheet(wb, products = []) {
  const ws = wb.worksheets.find(w => /monitor/i.test(w.name)) || wb.worksheets[0];
  let head = 0, cName = 0, cLoc = 0, cSr = 0, firstQty = 0;
  ws.eachRow((row, n) => {
    if (head) return;
    row.eachCell((c, i) => { const t = norm(text(c.value)); if (/raw material|item name/.test(t)) cName = i; else if (/sr no|^sr$|^no$/.test(t)) cSr = i; else if (/mini store|refuel|location/.test(t)) cLoc = i; else if (!firstQty && /pcs|kg|qty/.test(t)) firstQty = i; });
    if (cName) head = n;
  });
  if (!head) throw new Error("This is not the expiry sheet: no \"Raw Material Name\" column.");
  cLoc ||= cName + 1; firstQty ||= cLoc + 1;
  const match = productMatcher(products), rows = [];
  let section = "";
  ws.eachRow((row, n) => {
    if (n <= head) return;
    const name = text(row.getCell(cName).value), sr = text(row.getCell(cSr || cName - 1).value);
    if (!name) { if (/:\s*$/.test(sr) || (sr && isNaN(+sr))) section = sr.replace(/:\s*$/, "").trim(); return; }
    if (/:\s*$/.test(name) && !text(row.getCell(cLoc).value)) { section = name.replace(/:\s*$/, ""); return; }
    const location = text(row.getCell(cLoc).value), batches = [];
    for (let g = 1; g <= 5; g++) {
      const qtyCol = firstQty + 2 * (g - 1), dateCol = qtyCol + 1;
      const q = row.getCell(qtyCol).value, qty = q == null || text(q) === "" ? "" : Number(text(q)) || 0, date = isoDate(row.getCell(dateCol).value);
      if (qty !== "" || date) batches.push({ n: g, qty, date, qtyCol, dateCol });
    }
    rows.push({ row: n, sr: Number(sr) || sr, name, section, location, loc: locOf(location), productId: match(name), batches });
  });
  return { sheet: ws.name, rows };
}

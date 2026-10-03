// DCS workbook (Daily Cash Sheet) → ledger days. The browser twin of unaizah/build.py.
// One sheet per business day: a header row starting with "User", one row per cashier, then totals.
// Reads .xls / .xlsx / .ods with SheetJS (github.com/SheetJS/sheetjs), passed in as XLSX.
export const TENDERS = ["cash", "card", "online", "prepaid", "voucher", "other", "jahez", "hunger", "bogo", "comp"];
const FIELDS = [...TENDERS, "total", "report", "excess", "shortage"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const RULES = [["as per report", "report"], ["excess", "excess"], ["shortage", "shortage"], ["credit", "card"], ["online", "online"],
  ["pre-paid", "prepaid"], ["prepaid", "prepaid"], ["voucher", "voucher"], ["jahez", "jahez"], ["hunger", "hunger"], ["buy one", "bogo"],
  ["bogo", "bogo"], ["comp", "comp"], ["lucky seat", "other"], ["found", "other"], ["other", "other"], ["cash", "cash"], ["total", "total"]];
const ALIASES = { "waleed alotaibi": "Waleed Hammed Alotaibi", "ghonim alghonim": "Ghonim Abdulrahman Alghonim", "walid alanaz": "Walid Alanazi", "mohamed alrouqyi": "Mohamed Fahad Alrouqayi", unpunch: "Unpunched" };

const r2 = n => Math.round(n * 100) / 100;
const num = v => typeof v === "number" && Number.isFinite(v) ? v : 0;
const clean = s => String(s ?? "").replace(/\s+/g, " ").trim();
const title = s => clean(s).toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
export const nameKey = n => { const t = String(n).toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean); return t.length > 1 ? `${t[0]} ${t[1].slice(0, 5)}` : t.join(" "); };

function columnKey(name) {
  const n = clean(name).toLowerCase();
  if (!n || n === "nan") return null;
  for (const [needle, key] of RULES) if (n.includes(needle)) return key;
  return null;
}
function sheetDate(name) {
  const m = String(name).match(/^\s*(\d{1,2})\s*[._-]+\s*(\d{1,2})\s*[._-]+\s*(\d{2,4})\s*$/);
  if (!m) return null;
  let [d, mo, y] = m.slice(1).map(Number);
  if (y < 100) y += 2000; if (y === 205) y = 2025;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
}
const iso = d => d.toISOString().slice(0, 10);
const addDay = d => new Date(d.getTime() + 864e5);
export function fileMonth(fileName) {
  const base = fileName.toLowerCase(), y = base.match(/20\d\d/);
  const m = MONTHS.findIndex(w => base.includes(w));
  return { year: y ? Number(y[0]) : null, month: m >= 0 ? m + 1 : null };
}
function rowsOf(XLSX, ws) {
  if (!ws || !ws["!ref"]) return [];
  const r = XLSX.utils.decode_range(ws["!ref"]); r.s.c = 0; r.s.r = 0;
  ws["!ref"] = XLSX.utils.encode_range(r);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
}
function firstNumber(rows, i, span = 4) {
  for (let r = i; r < Math.min(i + span, rows.length); r++) for (let j = 1; j < (rows[r] || []).length; j++) { const v = rows[r][j]; if (typeof v === "number" && Number.isFinite(v)) return r2(v); }
  return null;
}
function parseCash(rows) {
  const out = {};
  rows.forEach((row, i) => {
    const label = clean(row?.[0]).toLowerCase();
    if (label.startsWith("final deposit") && !("safe" in out)) out.safe = firstNumber(rows, i, 1);
    else if (label.startsWith("cash balance") && !("on_hand" in out)) out.on_hand = firstNumber(rows, i);
    else if (label === "deposit") { const t = (row || []).find(x => typeof x === "string" && /\d\/\d/.test(x)); if (t) out.bank_period = t.trim(); }
  });
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null));
}
function parseSheet(rows) {
  let hdr = -1;
  for (let i = 0; i < Math.min(12, rows.length); i++) if (clean(rows[i]?.[0]).toLowerCase() === "user") { hdr = i; break; }
  if (hdr < 0) return null;
  const cols = {};
  (rows[hdr] || []).forEach((v, j) => { const k = columnKey(v); if (k && j > 0) (cols[k] ??= []).push(j); });
  const cashiers = [];
  for (let i = hdr + 1; i < rows.length; i++) {
    const user = rows[i]?.[0];
    if (user == null || clean(user) === "") break;
    const row = { user: title(user) };
    if (row.user.toLowerCase().startsWith("denomination")) break;
    FIELDS.forEach(k => { row[k] = r2((cols[k] || []).reduce((a, j) => a + num(rows[i][j]), 0)); });
    cashiers.push(row);
  }
  return cashiers;
}

// → { days: [...], year, month } ; days use the same shape as unaizah/ledger.json
export function parseDcsWorkbook(XLSX, wb, fileName, knownNames = []) {
  const fm = fileMonth(fileName), days = new Map();
  let prev = null;
  for (const name of wb.SheetNames) {
    const rows = rowsOf(XLSX, wb.Sheets[name]);
    const cashiers = parseSheet(rows);
    if (!cashiers?.length) continue;
    let d = sheetDate(name);
    // sheet names carry typos; trust a name that moves forward 1-3 days, else take the next day
    if (prev && (!d || !((d - prev) / 864e5 > 0 && (d - prev) / 864e5 <= 3))) d = addDay(prev);
    if (!d) continue;
    prev = d;
    const tot = Object.fromEntries(FIELDS.map(k => [k, r2(cashiers.reduce((a, c) => a + c[k], 0))]));
    if (!tot.total) tot.total = r2(TENDERS.reduce((a, t) => a + tot[t], 0));
    const own = fm.month != null && d.getUTCFullYear() === (fm.year ?? d.getUTCFullYear()) && d.getUTCMonth() + 1 === fm.month;
    const key = iso(d);
    if (days.has(key) && days.get(key)._own && !own) continue;
    days.set(key, { date: key, ...tot, ...parseCash(rows), cashiers: cashiers.filter(c => FIELDS.some(k => c[k])), source: `upload/${fileName}`, _own: own });
  }
  const out = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  unifyNames(out, knownNames);
  out.forEach(day => {
    delete day._own;
    if (!day.safe && day.cash) delete day.safe; // a blank formula cell is "not counted", not "counted zero"
    day.cashiers = day.cashiers.map(c => Object.fromEntries(Object.entries(c).filter(([k, v]) => k === "user" || v)));
  });
  return { days: out, ...fm };
}

// cashier names are typed by hand; fold spellings onto the names already in the ledger
function unifyNames(days, knownNames) {
  const known = new Map();
  knownNames.forEach(n => { const k = nameKey(n); if (!known.has(k) || n.length > known.get(k).length) known.set(k, n); });
  days.forEach(day => {
    const merged = new Map();
    day.cashiers.forEach(c => {
      const alias = ALIASES[c.user.toLowerCase()];
      const u = alias || known.get(nameKey(c.user)) || c.user.replace(/[^A-Za-z ]/g, "").trim();
      if (merged.has(u)) { const m = merged.get(u); FIELDS.forEach(k => { m[k] = r2(m[k] + c[k]); }); }
      else merged.set(u, { ...c, user: u });
    });
    day.cashiers = [...merged.values()];
  });
}

// merge uploaded months over the built ledger: a month's own file wins for its days
export function mergeLedger(base, uploads) {
  const byDate = new Map(base.days.map(d => [d.date, d]));
  uploads.slice().sort((a, b) => (a.at || "").localeCompare(b.at || "")).forEach(u => u.days.forEach(d => {
    const own = u.month && Number(d.date.slice(5, 7)) === u.month;
    if (own || !byDate.has(d.date)) byDate.set(d.date, d);
  }));
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const have = new Set(days.map(d => d.date)), missing = [];
  for (let d = new Date(days[0].date + "T00:00:00Z"), end = new Date(days[days.length - 1].date + "T00:00:00Z"); d <= end; d = addDay(d)) if (!have.has(iso(d))) missing.push(iso(d));
  return { ...base, days, missing_days: missing };
}

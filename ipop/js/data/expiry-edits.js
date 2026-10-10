// Changes people make to the expiry sheet (quantities and dates per row and group), kept on this device.
// Shape: { "<sheet row>": { q1: 12, d1: "2026-12-31", q2: … } }. One reader and one writer for every page.
import { EXPIRY_SHEET } from "./expiry-data.js?v=114";
import { isHome, branchId } from "../core/session.js?v=106";
export const EDITS_KEY = isHome() ? "noir-expiry-edits-v1" : `noir-expiry-edits-v1:${branchId()}`;
export function readEdits() { try { return JSON.parse(localStorage.getItem(EDITS_KEY) || "{}") || {}; } catch { return {}; } }
export function writeEdits(all) { try { localStorage.setItem(EDITS_KEY, JSON.stringify(all)); } catch {} }
// merge row by row, so a new q1/d1 keeps the q2/d2 already saved for that row
export function mergeEdits(rows) {
  const all = readEdits();
  for (const [row, v] of Object.entries(rows)) all[row] = { ...(all[row] || {}), ...v };
  writeEdits(all); return all;
}

// ── the sheet as it stands now: the uploaded monitoring sheet + every saved change ──
// A row can carry up to 5 groups (the sheet's BATCH 1–5 columns). A location the sheet has no row for (a product found in a
// new place by a watch count) gets an added row, keyed "x:<product>:<location>", written under the sheet's last row.
export const MAX_GROUPS = 5;
export const colsOf = n => ({ qtyCol: 5 + 2 * (n - 1), dateCol: 6 + 2 * (n - 1) });
const LOC_LABEL = { stores: "Store", mini: "Mini Store", refuel: "Refuel" };
export const addedKey = (pid, loc) => `x:${pid}:${loc}`;
export function expiryRows(pid, all = readEdits()) {
  const merge = (r, o) => {
    const ns = new Set(r.batches.map(b => b.n));
    for (const k of Object.keys(o)) { const m = /^[qd](\d)$/.exec(k); if (m && +m[1] <= MAX_GROUPS) ns.add(+m[1]); }
    return [...ns].sort((a, b) => a - b).map(n => { const b = r.batches.find(x => x.n === n) || { n, qty: "", date: "", ...colsOf(n) };
      return { ...b, qty: o[`q${n}`] ?? b.qty, date: o[`d${n}`] ?? b.date }; });
  };
  const rows = EXPIRY_SHEET.rows.filter(r => !pid || r.productId === pid).map(r => ({ ...r, batches: merge(r, all[String(r.row)] || {}) }));
  for (const [key, o] of Object.entries(all)) {
    if (!key.startsWith("x:")) continue;
    const [, id, loc] = key.split(":"); if (pid && id !== pid) continue;
    if (rows.some(r => r.productId === id && r.loc === loc)) continue;
    rows.push({ row: key, sr: "", name: o.name || id, section: "", location: LOC_LABEL[loc] || loc, loc, productId: id, added: true, batches: merge({ batches: [] }, o) });
  }
  return rows;
}
export const hasExpiry = pid => EXPIRY_SHEET.rows.some(r => r.productId === pid) || Object.keys(readEdits()).some(k => k.startsWith(`x:${pid}:`));
// a count at one location replaces that location's groups: group 1…k from the count, the rest emptied
export function countToEdits(p, loc, groups) {
  const all = readEdits();
  const row = EXPIRY_SHEET.rows.find(r => r.productId === p.id && r.loc === loc);
  const key = row ? String(row.row) : addedKey(p.id, loc);
  const before = all[key] || {}, o = row ? {} : { name: p.name };
  const old = row ? Math.max(row.batches.length, ...Object.keys(before).map(k => +(/^[qd](\d)$/.exec(k)?.[1] || 0))) : 0;
  groups.slice(0, MAX_GROUPS).forEach((g, i) => { o[`q${i + 1}`] = g.qty; o[`d${i + 1}`] = g.date || ""; });
  for (let n = groups.length + 1; n <= Math.min(old, MAX_GROUPS); n++) { o[`q${n}`] = 0; o[`d${n}`] = ""; }
  all[key] = o; writeEdits(all); return key;
}

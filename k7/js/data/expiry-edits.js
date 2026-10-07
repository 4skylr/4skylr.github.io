// Changes people make to the expiry sheet (quantities and dates per row and group), kept on this device.
// Shape: { "<sheet row>": { q1: 12, d1: "2026-12-31", q2: … } }. One reader and one writer for every page.
export const EDITS_KEY = "noir-expiry-edits-v1";
export function readEdits() { try { return JSON.parse(localStorage.getItem(EDITS_KEY) || "{}") || {}; } catch { return {}; } }
export function writeEdits(all) { try { localStorage.setItem(EDITS_KEY, JSON.stringify(all)); } catch {} }
// merge row by row, so a new q1/d1 keeps the q2/d2 already saved for that row
export function mergeEdits(rows) {
  const all = readEdits();
  for (const [row, v] of Object.entries(rows)) all[row] = { ...(all[row] || {}), ...v };
  writeEdits(all); return all;
}

// Where each expiry group sits, and whether it sits in the right place.
// Pick order is first-expiry-first-out, and the front of house must hold the earliest groups:
//   items sold by the piece (cans, bags, cups):  Concession → Mini Store → Store
//   group items sold by weight/volume (kg, L):   Concession = Mini Store (one front tier) → Store
// A group is flagged when it expires at least a week sooner than a group that sits further forward.
import { EXPIRY_SHEET } from "./expiry-data.js?v=69";

const GAP = 7; // days; smaller gaps are the same delivery
export const isBulk = p => p && (p.unit === "kg" || p.unit === "ltr");
const TIER_PCS = { refuel: 0, mini: 1, stores: 2 };
export const tierOf = (p, loc) => isBulk(p) ? (loc === "stores" ? 1 : 0) : (TIER_PCS[loc] ?? 3);
export const FRONT = ["refuel", "mini", "stores"]; // display order: Concession, Mini Store, Store

function edits() { try { return JSON.parse(localStorage.getItem("noir-expiry-edits-v1") || "{}"); } catch { return {}; } }
export function asDate(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10) + "T00:00:00");
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) { const [d, m, y] = s.split("/"); return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`); }
  return null;
}
const daysTo = d => d ? Math.round((d - new Date()) / 86400000) : null;
const num = v => { const s = String(v ?? "").trim().toLowerCase(), n = parseFloat(s); if (!Number.isFinite(n)) return 0; return s.endsWith("g") && !s.endsWith("kg") ? n / 1000 : n; };

// every dated group of a product, with its location
export function groupsOf(p) {
  const over = edits();
  return EXPIRY_SHEET.rows.filter(r => r.productId === p.id).flatMap(r => {
    const o = over[String(r.row)] || {};
    return r.batches.map(b => {
      const date = o[`d${b.n}`] ?? b.date, qty = o[`q${b.n}`] ?? b.qty, at = asDate(date);
      return { n: b.n, row: r.row, loc: r.loc, location: r.location, qty: num(qty), date, at, left: daysTo(at) };
    });
  }).filter(g => g.at && !isNaN(g.at) && g.qty > 0);
}

// place = { groups (sorted by expiry, with pick + flag), ok, locs, flagged, expired }
export function placement(p, groups = groupsOf(p)) {
  const G = groups.map(g => ({ ...g, tier: tierOf(p, g.loc), flag: null })).sort((a, b) => a.left - b.left);
  G.forEach((g, i) => { g.pick = i + 1; });
  for (const g of G) {
    if (g.left < 0) { g.flag = { kind: "expired" }; continue; }
    // a group further forward that lasts longer than this one → this one should be in front
    const ahead = G.filter(c => c !== g && c.left >= 0 && c.tier < g.tier && c.left - g.left >= GAP).sort((a, b) => a.tier - b.tier)[0];
    if (ahead) g.flag = { kind: "move", to: ahead.loc, toLocation: ahead.location, vs: ahead.n, gap: ahead.left - g.left };
  }
  const flagged = G.filter(g => g.flag?.kind === "move"), expired = G.filter(g => g.flag?.kind === "expired");
  return { groups: G, ok: !flagged.length && !expired.length, flagged, expired, locs: new Set(G.map(g => g.loc)).size, bulk: isBulk(p) };
}

// every flagged group across the catalog, worst first (used by the stock analysis page)
export function placementAlerts(products) {
  return products.flatMap(p => {
    const pl = placement(p);
    return pl.groups.filter(g => g.flag || g.left <= 30).map(g => ({ p, g, value: g.qty * (Number(p.rate) || 0) }));
  }).sort((a, b) => (a.g.flag?.kind === "expired" ? -1 : 0) - (b.g.flag?.kind === "expired" ? -1 : 0) || (b.g.flag ? 1 : 0) - (a.g.flag ? 1 : 0) || a.g.left - b.g.left);
}

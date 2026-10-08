// What a product is worth on the menu, for its photo: one full serving (the tub with the corn, oil, salt or flavour and
// everything else its recipe uses), what it sells for, and the profit, flavour by flavour. Costs come from costing.js
// (supplier price list, else the system rate); prices from the menu boards (VAT included, profit is on the net price).
// A product that is an ingredient rather than a serving (corn, oil, caramel …) shows what one stock unit costs.
import { MENU, VAT } from "../data/menu-data.js?v=102";
import { RECIPES } from "../data/recipes-data.js?v=102";
import { unitCost, recipeCost } from "./costing.js?v=102";

const low = s => String(s || "").toLowerCase();
export const FLAVOUR_AR = { salted: "مملح", cheese: "جبن", caramel: "كراميل", "pizza savory": "بيتزا", coke: "كوكاكولا", "coke zero": "كوكاكولا زيرو", fanta: "فانتا",
  sprite: "سبرايت", strawberry: "فراولة", "blue raspberry": "توت أزرق", pomegranate: "رمان", chicken: "دجاج", beef: "لحم", malt: "شعير", raspberry: "توت",
  pineapple: "أناناس", peach: "خوخ", pom: "رمان", blue: "أزرق", pink: "وردي" };
export function optionLabel(name) {
  const s = name.replace(/\b(Regular|Medium|Large|Xtra Large|Family)\b( Tub)?/gi, "").replace(/\bPopcorn\b/gi, "").replace(/-?\s*\d+\s*oz\b/gi, "")
    .replace(/^SLUSH\s*-\s*/i, "").replace(/^HOT DOG\s*/i, "").replace(/^BARBICAN\s*/i, "").replace(/\s+-\s*$/, "").replace(/\s{2,}/g, " ").trim();
  const en = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || name;
  return { en, ar: FLAVOUR_AR[s.toLowerCase()] || en };
}
const memo = new Map();
export function servingOf(p) {
  if (!p) return null;
  if (memo.has(p.id)) return memo.get(p.id);
  const keys = new Set([low(p.sku), low(p.name)].filter(Boolean));
  const m = MENU.find(x => x.stock === p.id) || MENU.find(x => (x.sold || []).includes(p.id));
  let out = null;
  if (m) {
    const net = m.price / (1 + VAT);
    let opts = m.recipes.map(recipeCost).filter(Boolean);
    // one board item, several products (Arwa / Arwa Zero, M&M's chocolate / peanut): keep the recipes that use this one
    const own = opts.filter(o => o.lines.some(l => keys.has(low(l.rm))));
    if (own.length && own.length < opts.length) opts = own;
    const options = opts.map(o => ({ label: optionLabel(o.name), recipe: o.name, cost: o.total, profit: net - o.total, margin: net ? (net - o.total) / net : 0, lines: o.lines.length }))
      .sort((a, b) => a.cost - b.cost);
    if (options.length) out = { kind: "serving", id: m.id, en: m.en, ar: m.ar, price: m.price, net, options };
  }
  if (!out) {
    const u = [p.sku, p.name].map(k => k && unitCost(k)).find(x => x && x.src !== "none");
    const uses = new Set(RECIPES.filter(r => !r.ta && r.lines.some(l => keys.has(low(l.rm)))).map(r => r.name)).size;
    const cost = u?.cost || Number(p.rate) || 0;
    if (cost || uses) out = { kind: "part", cost, unit: u?.unit || p.unit || "", uses };
  }
  memo.set(p.id, out);
  return out;
}

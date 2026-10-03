// How much of each raw material went out with the year's sales.
// The sales report counts containers per size (tubs, nachos trays, hot dog trays, slush glasses, floss tubs);
// the recipe for each size says what goes in it. Consumption = Σ size sold × recipe amount.
// When a size has several flavours (caramel / cheese / salted / pizza) the report can't tell them apart, so the
// figure is the average across flavours, with the low–high range shown; one recipe per size means an exact figure.
import { RECIPES, RAW_MATERIALS } from "./recipes-data.js?v=78";
import { SALES_YTD, SALES_DAYS } from "./sales-data.js?v=78";

const CARRIERS = ["tub-46", "tub-64", "tub-85", "tub-130", "nachos-tray-3", "nachos-tray-4", "hotdog-tray", "slush-glass-12", "slush-glass-16", "cotton-candy-tub"];
const BASE_CATS = new Set(["popcorn", "nachos", "hotdog", "floss", "slush", "mocktail"]);
const SIZE = {
  "tub-46": ["Regular 46 oz", "عادي ٤٦"], "tub-64": ["Medium 64 oz", "وسط ٦٤"], "tub-85": ["Large 85 oz", "كبير ٨٥"], "tub-130": ["X-Large 130 oz", "كبير جداً ١٣٠"],
  "nachos-tray-3": ["Regular", "عادي"], "nachos-tray-4": ["Family", "عائلي"], "hotdog-tray": ["Hot dog", "هوت دوق"],
  "slush-glass-12": ["12 oz", "١٢ أونصة"], "slush-glass-16": ["16 oz", "١٦ أونصة"], "cotton-candy-tub": ["Floss tub", "علبة غزل"]
};
const low = s => String(s || "").toLowerCase();
// BIB syrups and CO2 are counted in cups, napkins in order items, straw-spoons one per glass (sales-data.js)
const SKIP = new Set(["bib-coke", "bib-coke-zero", "bib-fanta", "bib-sprite", "co2", "napkin", "straw-spoon"]);
let cache = null;

function build(products) {
  const bySku = new Map(products.filter(p => p.sku).map(p => [low(p.sku), p]));
  const carrierSku = new Map(CARRIERS.map(id => [id, low(products.find(p => p.id === id)?.sku)]));
  const out = new Map(); // productId → usage
  for (const c of CARRIERS) {
    const sold = Number(SALES_YTD[c]) || 0, sku = carrierSku.get(c);
    if (!sold || !sku) continue;
    // the plain menu items for this size: no take-away duplicates, add-ons or combos
    const seen = new Set();
    const recipes = RECIPES.filter(r => BASE_CATS.has(r.cat) && !r.ta && !/add on|wed /i.test(r.name) && r.lines.some(l => low(l.rm) === sku))
      .filter(r => { const sig = r.lines.map(l => low(l.rm) + l.qty).sort().join("|"); if (seen.has(sig)) return false; seen.add(sig); return true; });
    if (!recipes.length) continue;
    const rms = new Set(recipes.flatMap(r => r.lines.map(l => low(l.rm))));
    rms.delete(sku);
    for (const rm of rms) {
      const p = bySku.get(rm); if (!p || SKIP.has(p.id)) continue;
      const key = Object.keys(RAW_MATERIALS).find(k => low(k) === rm);
      const conv = (key && RAW_MATERIALS[key].conv) || 1;
      const qtys = recipes.map(r => r.lines.find(l => low(l.rm) === rm)?.qty || 0);
      const uom = recipes.flatMap(r => r.lines).find(l => low(l.rm) === rm)?.uom || "";
      const mean = qtys.reduce((a, q) => a + q, 0) / qtys.length;
      const part = { carrier: c, size: SIZE[c], sold, per: mean, min: Math.min(...qtys), max: Math.max(...qtys), uom, flavours: recipes.length, uses: qtys.filter(q => q > 0).length, conv };
      const u = out.get(p.id) || { id: p.id, parts: [], total: 0, lo: 0, hi: 0, exact: true };
      u.parts.push(part);
      u.total += sold * mean / conv; u.lo += sold * part.min / conv; u.hi += sold * part.max / conv;
      if (part.min !== part.max) u.exact = false;
      out.set(p.id, u);
    }
  }
  return out;
}

export function usageOf(p, products) {
  if (!cache || cache.n !== products.length) cache = { n: products.length, map: build(products) };
  return cache.map.get(p.id) || null;
}
export const usagePerDay = (p, products) => { const u = usageOf(p, products); return u ? u.total / SALES_DAYS : 0; };

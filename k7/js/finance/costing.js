// Costing shared by the Profit page and the recipe theater: what one serving of a recipe costs, line by line.
// Stock-unit cost from the supplier price list (case price ÷ what the case holds); materials it does not sell fall back to
// the system's purchase rate. Cost of a line = recipe qty ÷ recipe-units-per-stock-unit × stock-unit cost.
import { PRICE_LIST } from "../data/price-list.js?v=94";
import { RECIPES, RAW_MATERIALS } from "../data/recipes-data.js?v=94";
import { recipeKcal } from "../data/nutrition.js?v=94";

const low = s => String(s || "").toLowerCase();
export const RM = new Map(Object.entries(RAW_MATERIALS).map(([k, v]) => [low(k), { key: k, ...v }]));
const RECIPE = new Map(RECIPES.filter(r => !r.ta).map(r => [low(r.name), r]));
const ANY = new Map(RECIPES.map(r => [low(r.name), r]));
// first priced line per raw material wins (the list repeats a material for each flavour of Rani, Barbican, …)
export const LIST = new Map();
PRICE_LIST.forEach(l => { if (l.rm && l.per != null && !LIST.has(low(l.rm))) LIST.set(low(l.rm), l); });

export function unitCost(rm) {
  const m = RM.get(low(rm)), l = LIST.get(low(rm));
  if (l) return { cost: l.per, src: "list", line: l, sys: m?.rate ?? null, unit: m?.stock || l.unit };
  return { cost: m ? Number(m.rate) || 0 : 0, src: m ? "system" : "none", sys: m?.rate ?? null, unit: m?.stock || "" };
}
export function recipeCost(name) {
  const r = RECIPE.get(low(name)) || ANY.get(low(name)); if (!r) return null;
  const lines = r.lines.map(l => {
    const m = RM.get(low(l.rm)), u = unitCost(l.rm), conv = m?.conv || 1;
    const cost = l.qty / conv * u.cost, was = l.qty / conv * (u.sys ?? u.cost);
    return { rm: m?.key || l.rm, qty: l.qty, unit: m?.recipe || "", cost, was, src: u.src, per: u.cost, stock: u.unit };
  });
  const total = lines.reduce((a, l) => a + l.cost, 0), was = lines.reduce((a, l) => a + l.was, 0);
  return { name: r.name, cat: r.cat, lines, total, was, kcal: recipeKcal(r, RAW_MATERIALS) };
}


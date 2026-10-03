import { RAW_MATERIALS } from "./recipes-data.js?v=78";
import { usesOf, evaluate } from "./analytics.js?v=78";
export function servingsFor(p) {
  const key = Object.keys(RAW_MATERIALS).find(k => k.toLowerCase() === String(p.sku || "").toLowerCase());
  if (!key) return [];
  return usesOf(key).filter(u => !u.recipe.ta).slice(0, 4).map(u => ({
    name: u.recipe.name,
    sellable: evaluate(u.recipe).sellable
  }));
}

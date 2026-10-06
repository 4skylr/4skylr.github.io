// Energy per raw material, per RECIPE unit (kcal per g, per ml, or per piece), so a serving's calories follow its recipe
// line by line. Ingredient values are typical figures for that kind of ingredient (USDA FoodData Central style);
// packs use the brand's label per 100 g. Packaging is 0. A material missing here makes the serving "unknown"
// rather than wrong — shown as no figure. All results are estimates and are labelled that way.
export const KCAL = {
  "corn butterfly": 3.75, "corn mushroom": 3.75,            // unpopped popcorn kernels
  "popcorn oil": 8.13,                                        // coconut/canola blend, per ml
  "salt": 0, "caramel": 3.9, "cheese masala": 4.6, "pizza savory mix": 3.3,
  "nachos - senorah chips": 4.89, "cheese sauce": 1.8, "nachos - ricos chunky salsa": 0.36, "nachos - jalapeno": 0.27,
  "beef frankfurt": 232, "chicken frankfurt": 176, "hot dog bun": 140,   // per piece (80 g sausage, 50 g bun)
  "tomato ketchup": 1.12, "mayonnaise": 6.8, "mustard sauce": 0.6,
  "bib coke": 2.52, "bib coke zero": 0, "bib fanta": 2.7, "bib sprite": 2.4,   // syrup per ml, served 1 + 5 water
  "slush - blue raspberry": 2.7, "slush - strawberry": 2.7, "slush - pomegranate": 2.7,
  "lemonade syrup": 2.6, "mojito syrup": 2.6, "sugar": 4, "lemon whole": .29, "mint leaves": .44,
  "blue raspberry flossine": 3.9, "vanilla pink flossine": 3.9,
  "sugar sachet": 20, "sugar sachets - brown": 20, "sugar sachets - sweet & low": 0,
  "m&m choco 45gm": 217, "m&m choco 150 gm": 723, "m&m peanut 45gm": 231, "m&m peanut 150 gm": 770,   // per pack
  "maltesers 37gm": 185, "maltesers 175gm": 877,
  "arwa - 500 ml": 0, "arwa zero - 500ml": 0, "co2": 0
};
// containers and disposables: no energy
const PACKAGING = /tub|cup|lid|napkin|straw|stirrer|tray|glass|dip cup|coffee/i;

// kcal of one serving of a recipe; null when any edible line has no known value
export function recipeKcal(recipe, RAW) {
  if (!recipe) return null;
  let sum = 0;
  for (const l of recipe.lines) {
    const k = String(l.rm || "").toLowerCase();
    if (k in KCAL) { sum += (Number(l.qty) || 0) * KCAL[k]; continue; }
    if (PACKAGING.test(k)) continue;
    return null;
  }
  return Math.round(sum / 5) * 5; // to the nearest 5: it is an estimate
}

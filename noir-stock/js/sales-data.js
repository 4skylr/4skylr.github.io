// YTD sales from Sales RM Consumed, 1 Jan 2026 to 1 Oct 2026.
export const SALES_YTD = {
  "tub-130": 2565, "tub-46": 1406, "tub-64": 2545, "tub-85": 3540,
  "arwa-500": 1687, "arwa-zero": 318, "barbican": 212, "cotton-candy-tub": 286,
  "cups-16": 469, "cups-24": 671, "cups-30": 1243, "dip-cup-4": 27,
  "hotdog-tray": 269, "mm-choco-150": 33, "mm-choco-45": 471, "mm-peanut-150": 58,
  "mm-peanut-45": 222, "maltesers-175": 60, "maltesers-37": 258, "monster": 167,
  "nachos-tray-3": 675, "nachos-tray-4": 232, "rani": 692, "schweppes": 288,
  "slush-glass-12": 1237, "slush-glass-16": 1145, "vimto-can": 259, "vimto-pet": 232
};
export const SALES_FROM = "2026-01-01";
export const SALES_TO = "2026-10-01";
// Items that are not rung up on their own move with something that is.
// exact: one-for-one (every 30 oz cup gets a 30 oz lid). shared: the count is the drinks/tubs/orders they went
// into, split across flavours we can't tell apart (every fountain cup used some BIB syrup and CO2).
const FOUNTAIN = ["cups-16", "cups-24", "cups-30"], TUBS = ["tub-46", "tub-64", "tub-85", "tub-130"],
  SLUSH = ["slush-glass-12", "slush-glass-16"], NACHOS = ["nachos-tray-3", "nachos-tray-4"], HOTDOG = ["hotdog-tray"], FLOSS = ["cotton-candy-tub"];
const ALL = Object.keys(SALES_YTD);
const U = { cup: ["cups", "كوب"], drink: ["drinks", "مشروب"], tub: ["tubs", "علبة فشار"], glass: ["glasses", "كوب سلاش"], tray: ["trays", "صحن"],
  hotdog: ["hot dogs", "هوت دوق"], floss: ["floss tubs", "علبة غزل"], order: ["order items", "صنف بالطلبات"], lid: ["lids", "غطاء"], straw: ["straws", "شفاط"] };
const mv = (src, u, shared = true) => ({ src, unit: U[u], shared });
export const MOVES = {
  "lids-16": mv(["cups-16"], "lid", false), "lids-24": mv(["cups-24"], "lid", false), "lids-30": mv(["cups-30"], "lid", false),
  "straw": mv(FOUNTAIN, "straw", false), "straw-spoon": mv(SLUSH, "straw", false),
  "bib-coke": mv(FOUNTAIN, "cup"), "bib-coke-zero": mv(FOUNTAIN, "cup"), "bib-fanta": mv(FOUNTAIN, "cup"), "bib-sprite": mv(FOUNTAIN, "cup"),
  "co2": mv(FOUNTAIN, "drink"), "napkin": mv(ALL, "order"),
  "popcorn-oil": mv(TUBS, "tub"), "corn-butterfly": mv(TUBS, "tub"), "corn-mushroom": mv(TUBS, "tub"), "caramel": mv(TUBS, "tub"),
  "salt": mv(TUBS, "tub"), "cheese-masala": mv(TUBS, "tub"), "pizza-mix": mv(TUBS, "tub"),
  "slush-blue": mv(SLUSH, "glass"), "slush-pom": mv(SLUSH, "glass"), "slush-straw": mv(SLUSH, "glass"),
  "lemon": mv(["slush-glass-16"], "glass"), "mint": mv(["slush-glass-16"], "glass"), "lemonade-syrup": mv(["slush-glass-16"], "glass"), "mojito-syrup": mv(["slush-glass-16"], "glass"),
  "nachos-chips": mv(NACHOS, "tray"), "cheese-sauce": mv(NACHOS, "tray"), "jalapeno": mv(NACHOS, "tray"), "salsa": mv(NACHOS, "tray"),
  "hotdog": mv(HOTDOG, "hotdog"), "hotdog-bun": mv(HOTDOG, "hotdog"), "ketchup": mv(HOTDOG, "hotdog"), "mustard": mv(HOTDOG, "hotdog"),
  "flossine-blue": mv(FLOSS, "floss"), "flossine-pink": mv(FLOSS, "floss"), "sugar": mv(FLOSS, "floss")
};
export const LINKED = Object.fromEntries(Object.entries(MOVES).filter(([, m]) => !m.shared).map(([k, m]) => [k, m.src]));
export const linkedTo = id => Object.entries(LINKED).filter(([, src]) => src.includes(id)).map(([k]) => k);
function direct(id) {
  let over = {};
  try { over = JSON.parse(localStorage.getItem("noir-sales-ytd") || "{}"); } catch {}
  const v = over[id] ?? SALES_YTD[id];
  return v == null ? null : Number(v) || 0;
}
export function soldOf(id) {
  const d = direct(id);
  if (d != null) return d;
  return MOVES[id] ? MOVES[id].src.reduce((a, s) => a + (direct(s) || 0), 0) : 0;
}
// how an item's figure was worked out: null when it is rung up itself
export const moveOf = id => direct(id) == null && MOVES[id] ? MOVES[id] : null;
export const soldSource = id => moveOf(id)?.src || null;
export const SALES_DAYS = Math.round((new Date(SALES_TO) - new Date(SALES_FROM)) / 86400000);
// usage per day in the item's own unit; shared counts (cups of mixed flavours) are not a usage rate
export const dailyUse = id => { const m = moveOf(id); return m && m.shared ? 0 : soldOf(id) / SALES_DAYS; };

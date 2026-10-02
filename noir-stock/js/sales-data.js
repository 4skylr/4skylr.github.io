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
// Items that are used one-for-one with a sold item: every 30 oz cup gets a 30 oz lid, every
// fountain cup gets a straw, every slush glass gets a straw-spoon. Their "sold" follows the source.
export const LINKED = {
  "lids-16": ["cups-16"], "lids-24": ["cups-24"], "lids-30": ["cups-30"],
  "straw": ["cups-16", "cups-24", "cups-30"],
  "straw-spoon": ["slush-glass-12", "slush-glass-16"]
};
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
  return LINKED[id] ? LINKED[id].reduce((a, s) => a + (direct(s) || 0), 0) : 0;
}
export const soldSource = id => direct(id) == null && LINKED[id] ? LINKED[id] : null;
export const SALES_DAYS = Math.round((new Date(SALES_TO) - new Date(SALES_FROM)) / 86400000);
export const dailyUse = id => soldOf(id) / SALES_DAYS;

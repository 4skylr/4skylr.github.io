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
export function soldOf(id) {
  const over = JSON.parse(localStorage.getItem("noir-sales-ytd") || "{}");
  return Number(over[id] ?? SALES_YTD[id] ?? 0);
}

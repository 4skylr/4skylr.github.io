// Charts follow the White / Night theme and use the iOS system colours (blue, green, orange, red …). The chart code is written with the night palette; when the page is white,
// every colour in an ECharts option passes through this map on its way in. ECharts (apache/echarts) is loaded on
// demand by several pages, so the hook sits on window.echarts: the moment the library defines itself, init() is wrapped.
const LIGHT = {
  "#edf1f8": "#1c1b33", "#e6eeff": "#1c1b33", "#ffffff": "#2a2850", "#fff": "#2a2850",
  "#dce6ff": "#6a4cac", "#c9d4e6": "#9d9bc9", "#a3adbf": "#474761", "#8c95a8": "#62627a", "#808a9d": "#565670", "#7c8599": "#6b6b85",
  "#000000": "#eceef7", "#000": "#eceef7", "#161227": "#ece8f8", "#1d2a4a": "#cfc8ee", "#0a0e15": "#ffffff", "#111722": "#f5f5fc",
  "#d3dae6": "#3d3b5a", "#2b3446": "#d5d3ee", "#06090e": "#ffffff", "#747e93": "#7a7a96"
};
// the old neon accents → iOS system colours, [light, dark]
const SYS = {
  "#5b7bff": ["#007aff", "#0a84ff"], "#6ccbff": ["#30b0c7", "#40c8e0"], "#ffb547": ["#ff9500", "#ff9f0a"], "#3ed69e": ["#34c759", "#30d158"],
  "#ff5468": ["#ff3b30", "#ff453a"], "#ff3b5c": ["#ff3b30", "#ff453a"], "#ffd400": ["#ffcc00", "#ffd60a"], "#ff8a5c": ["#ff9500", "#ff9f0a"],
  "#8fa6ff": ["#5856d6", "#5e5ce6"], "#7f95ff": ["#5856d6", "#5e5ce6"], "#33427a": ["#c7c7cc", "#3a3a3c"],
  "#a3adbf": [null, "#98989f"], "#808a9d": [null, "#8e8e93"], "#7c8599": [null, "#8e8e93"], "#8c95a8": [null, "#98989f"], "#edf1f8": [null, "#ffffff"], "#dce6ff": [null, "#ebebf5"]
};
const RGB = [[/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/g, "rgba(60,60,120,"], [/rgba\(\s*(8|6|10|0)\s*,\s*(11|8|14|0)\s*,\s*(16|12|21|0)\s*,\s*\.9\d?\)/g, "rgba(255,255,255,.96)"],
  [/rgba\(\s*150\s*,\s*170\s*,\s*210\s*,/g, "rgba(90,90,150,"], [/rgba\(\s*160\s*,\s*180\s*,\s*220\s*,/g, "rgba(90,90,150,"]];
export const isLight = () => document.documentElement.dataset.theme !== "dark";
export function tone(c) {
  if (typeof c !== "string") return c;
  const k = c.trim().toLowerCase(), light = isLight(), sys = SYS[k]?.[light ? 0 : 1];
  if (sys) return sys;
  if (!light) return c;
  if (LIGHT[k]) return LIGHT[k];
  let out = c; for (const [re, to] of RGB) out = out.replace(re, to);
  return out;
}
function walk(o, depth = 0) {
  if (!o || typeof o !== "object" || depth > 12) return o;
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (typeof v === "string") o[i] = tone(v); else if (v && typeof v === "object") walk(v, depth + 1); } return o; }
  for (const k of Object.keys(o)) {
    if (k === "data" && Array.isArray(o[k]) && o[k].length > 400) continue; // long numeric series: nothing to recolour
    const v = o[k];
    if (typeof v === "string" && /colou?r|fill|stroke|background|border/i.test(k)) o[k] = tone(v);
    else if (typeof v === "string" && k === "extraCssText") o[k] = isLight() ? v.replace(/rgba\(0,0,0,[\d.]+\)/g, "rgba(0,0,60,.18)") : v;
    else if (v && typeof v === "object") walk(v, depth + 1);
  }
  return o;
}
function patch(ec) {
  if (!ec || ec.__toned || typeof ec.init !== "function") return;
  const init = ec.init;
  ec.init = function (...a) {
    const chart = init.apply(this, a), set = chart.setOption;
    chart.setOption = function (opt, ...rest) { return set.call(this, walk(opt), ...rest); };
    return chart;
  };
  ec.__toned = true;
}
// window.echarts is assigned as an empty object first and filled in by the rest of the script: patch right after
if (!Object.getOwnPropertyDescriptor(window, "echarts")?.set) {
  let ref = window.echarts;
  Object.defineProperty(window, "echarts", { configurable: true, get: () => ref, set: v => { ref = v; queueMicrotask(() => patch(ref)); } });
  if (ref) patch(ref);
}

// Yield analytics: how many of each menu item the current stock can sell.
// Libraries (loaded on demand from jsDelivr):
//   Apache ECharts — github.com/apache/echarts  (charts)
//   Fuse.js        — github.com/krisk/Fuse      (fuzzy menu search)
import { RAW_MATERIALS, RECIPES, RECIPE_SOURCE_DATE } from "../data/recipes-data.js?v=91";
import { wire } from "./recipe-theater.js?v=91";
const LANG = () => ((sessionStorage.getItem("noir-lang") || "en") === "ar" ? "ar" : "en");

const ECHARTS_URL = "vendor/echarts.min.js";
const FUSE_URL = "../../vendor/fuse.min.mjs"; // krisk/Fuse, vendored

export const MENU_CATS = [
  { id: "popcorn", name: "Popcorn" }, { id: "combo", name: "Combos" }, { id: "fountain", name: "Fountain drinks" },
  { id: "slush", name: "Slush" }, { id: "nachos", name: "Nachos" }, { id: "hotdog", name: "Hot dogs" },
  { id: "mocktail", name: "Mocktails" }, { id: "floss", name: "Cotton candy" }, { id: "candy", name: "Candy" },
  { id: "packaged", name: "Cans & bottles" }, { id: "refill", name: "Refills" }
];

const SIZES = [
  { oz: 46, name: "Regular", prefix: "Regular Tub" },
  { oz: 64, name: "Medium", prefix: "Medium Tub" },
  { oz: 85, name: "Large", prefix: "Large Tub" },
  { oz: 130, name: "X-Large", prefix: "Xtra Large Tub" }
];
const FLAVORS = [
  { id: "Caramel", color: "#ffb547" }, { id: "Salted", color: "#6ccbff" },
  { id: "Cheese", color: "#ff8a5c" }, { id: "Pizza Savory", color: "#dce6ff" }
];
const POPCORN_MATERIALS = ["POPCORN OIL", "CORN Mushroom", "CORN Butterfly", "CARAMEL", "SALT", "CHEESE MASALA", "Pizza Savory Mix"];

let H = null;          // helpers from app.js
let scope = "all";
let menuCat = "all", menuQ = "", fuse = null, showAll = false;
const charts = [];

// ── Library loading ──────────────────────────────────────────
let echartsP = null;
function loadECharts() {
  if (window.echarts) return Promise.resolve(window.echarts);
  echartsP ??= new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = ECHARTS_URL; s.async = true;
    s.onload = () => res(window.echarts); s.onerror = () => { echartsP = null; rej(new Error("ECharts failed to load")); };
    document.head.append(s);
  });
  return echartsP;
}
let fuseP = null;
const loadFuse = () => (fuseP ??= (window.CARD_DOOR ? Promise.reject() : import(FUSE_URL)).then(m => m.default).catch(() => null));

// ── Core maths ───────────────────────────────────────────────

// stock of a raw material in its RECIPE unit (g / ml / pcs) for the chosen scope
function stockOf(rm) {
  const p = H.data().products.find(x => (x.sku || "").toLowerCase() === rm.toLowerCase());
  const meta = RAW_MATERIALS[rm] || { conv: 1 };
  if (!p) return { amount: 0, product: null, missing: true, meta };
  const raw = scope === "all" ? H.total(p) : Number(p.stock?.[scope]) || 0;
  return { amount: raw * (meta.conv || 1), stockAmount: raw, product: p, missing: false, meta };
}

export function evaluate(recipe) {
  const lines = recipe.lines.map(l => {
    const s = stockOf(l.rm);
    return { ...l, have: s.amount, missing: s.missing, product: s.product, servings: l.qty > 0 ? Math.floor(s.amount / l.qty + 1e-9) : Infinity };
  });
  const limiting = lines.reduce((a, b) => (b.servings < a.servings ? b : a), lines[0] || { servings: 0 });
  return { recipe, lines, sellable: lines.length ? limiting.servings : 0, bottleneck: limiting };
}

const nice = n => (n === Infinity ? "∞" : H.nf0.format(n));
const rmLabel = rm => { const p = stockOf(rm).product; return p ? p.name : titleCase(rm); };
const titleCase = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bMl\b/g, "ml").replace(/\bOz\b/g, "oz");
const fmtAmt = (n, u) => {
  if (u === "g" && n >= 1000) return `${H.qty(n / 1000)} kg`;
  if (u === "ml" && n >= 1000) return `${H.qty(n / 1000)} L`;
  return `${H.qty(n)} ${u}`;
};

export function describe(rm) {
  const m = RAW_MATERIALS[rm];
  if (!m) return "";
  const uses = RECIPES.filter(r => r.lines.some(l => l.rm === rm));
  const conv = m.stock === "pcs" ? "Counted by the piece" : `Stocked in ${m.stock}, used in ${m.recipe} (1 ${m.stock} = ${H.nf0.format(m.conv)} ${m.recipe})`;
  const sup = m.suppliers.filter(s => s !== "Default vendor");
  return `${conv}. Purchase rate ${H.sar(m.rate)} SAR per ${m.stock === "pcs" ? "piece" : m.stock}. `
    + `Goes into ${uses.length} menu item${uses.length === 1 ? "" : "s"}`
    + (sup.length ? `. Supplied by ${sup.join(", ")}.` : ".");
}

// recipes that use a raw material, with how many servings the stock covers
export function usesOf(rm) {
  return RECIPES.filter(r => r.lines.some(l => l.rm === rm) && r.cat !== "refill").map(r => {
    const line = r.lines.find(l => l.rm === rm), s = stockOf(rm);
    return { recipe: r, per: line.qty, uom: line.uom, covers: Math.floor(s.amount / line.qty + 1e-9), sellable: evaluate(r).sellable };
  }).sort((a, b) => a.per - b.per);
}

// ── Page ─────────────────────────────────────────────────────
export function renderYield(root, helpers) {
  H = helpers;
  charts.splice(0).forEach(c => c.dispose());
  const L = H.LOCATIONS;
  root.innerHTML = `
    <div class="controls">
      <div class="seg" role="group" aria-label="Stock scope">
        <button data-scope="all" aria-pressed="${scope === "all"}">All locations</button>
        ${L.map(l => `<button data-scope="${l.id}" aria-pressed="${scope === l.id}">${l.short}</button>`).join("")}
      </div>
      <p class="count-line" style="margin:0">Recipes as of ${H.when(RECIPE_SOURCE_DATE)} · ${RECIPES.length} menu items · each number assumes the stock goes to that item alone</p>
    </div>
    <div class="yield">
      <section class="slab pop-board" id="pop-board"></section>
      <section class="slab" id="runway"></section>
      <section class="slab span-7" id="chart-pop-wrap"><div class="slab-h"><h2>Popcorn you can sell</h2><span class="voice">by size and flavour</span></div><div class="chart" id="chart-pop"></div></section>
      <section class="slab span-5" id="chart-bn-wrap"><div class="slab-h"><h2>What runs out first</h2><span class="voice">items each ingredient caps</span></div><div class="chart" id="chart-bn"></div></section>
      <section class="slab" id="menu"></section>
    </div>`;
  root.querySelectorAll("[data-scope]").forEach(b => b.onclick = () => { scope = b.dataset.scope; renderYield(root, H); });
  renderPopBoard(); renderRunway(); renderMenu(); renderCharts();
  loadFuse().then(F => { if (F) { fuse = new F(RECIPES, { keys: ["name", "lines.rm"], threshold: 0.38, ignoreLocation: true }); } });
}

function popRecipe(size, flavor) {
  return RECIPES.find(r => r.name.startsWith(size.prefix + " " + flavor + " Popcorn"));
}

function renderPopBoard() {
  const el = document.getElementById("pop-board");
  el.innerHTML = `<div class="slab-h"><h2>Popcorn board</h2><span class="voice">tubs you can fill right now</span></div>
    <div class="pop-grid" data-rt-list>
      <span></span>${SIZES.map(s => `<span class="pop-size"><b>${s.oz}</b> oz<em>${s.name}</em></span>`).join("")}
      ${FLAVORS.map(f => `<span class="pop-flavor" style="--fc:${f.color}">${f.id}</span>${SIZES.map(s => {
        const r = popRecipe(s, f.id); if (!r) return `<div class="pop-cell na">—</div>`;
        const e = evaluate(r), max = Math.max(...e.lines.filter(l => l.uom !== "pcs" || /TUB/.test(l.rm)).map(l => l.servings), 1);
        const bars = e.lines.filter(l => !/NAPKIN/.test(l.rm)).map(l =>
          `<div class="pc-bar ${l === e.bottleneck ? "lim" : ""}"><span>${H.esc(short(l.rm))}</span><i style="width:${Math.min(100, l.servings / max * 100).toFixed(1)}%"></i><b>${nice(l.servings)}</b></div>`).join("");
        return `<button class="pop-cell" data-rt="${H.esc(r.name)}" style="--fc:${f.color}">
          <span class="pc-size">${s.oz} oz · ${s.name}</span>
          <span class="pc-num" data-count="${e.sellable}">${nice(e.sellable)}</span>
          <span class="pc-lim">limited by <b>${H.esc(short(e.bottleneck.rm))}</b></span>
          <div class="pc-bars">${bars}</div></button>`;
      }).join("")}`).join("")}
    </div>`;
  wire(el, H, { lang: LANG() });
  countUp(el);
}
const short = rm => ({ "POPCORN OIL": "Oil", "CORN Mushroom": "Mushroom corn", "CORN Butterfly": "Butterfly corn", "CARAMEL": "Caramel", "SALT": "Salt", "CHEESE MASALA": "Cheese masala", "Pizza Savory Mix": "Pizza mix", "PAPER NAPKIN": "Napkins" }[rm] || rm.replace(/ TUB$/, " tub").replace(/^(\d+) Oz/, "$1 oz"));

function renderRunway() {
  const el = document.getElementById("runway");
  el.innerHTML = `<div class="slab-h"><h2>Oil, corn &amp; flavourings</h2><span class="voice">how far each one stretches</span></div>
    <div class="runway">${POPCORN_MATERIALS.map(rm => {
      const s = stockOf(rm), p = s.product;
      const uses = usesOf(rm).filter(u => u.recipe.cat === "popcorn" && !u.recipe.ta && !/^Wed /.test(u.recipe.name));
      const bySize = SIZES.map(sz => {
        const u = uses.filter(u => u.recipe.name.startsWith(sz.prefix + " "));
        if (!u.length) return null;
        const per = Math.max(...u.map(x => x.per));   // heaviest recipe of that size = safe estimate
        return { sz, per, uom: u[0].uom, covers: Math.floor(s.amount / per + 1e-9) };
      }).filter(Boolean);
      return `<article class="rw">
        <div class="rw-head">${p ? H.pic(p, "pic") : `<div class="pic ph">${H.esc(rm.slice(0, 2))}</div>`}
          <div><h3>${H.esc(p ? p.name : titleCase(rm))}</h3><span class="data rw-stock">${fmtAmt(s.amount, s.meta.recipe)} on hand${s.missing ? " · not on the site" : ""}</span></div></div>
        <div class="rw-sizes">${bySize.map(b => `<div><span class="data">${b.sz.oz} oz</span><b class="data" data-count="${b.covers}">${nice(b.covers)}</b><em>${fmtAmt(b.per, b.uom)} each</em></div>`).join("")}</div>
        <p class="desc">${H.esc(describe(rm))}</p>
      </article>`;
    }).join("")}</div>`;
  countUp(el);
}

function renderMenu() {
  const el = document.getElementById("menu");
  let L = RECIPES;
  if (menuQ.trim()) L = fuse ? fuse.search(menuQ.trim()).map(x => x.item) : L.filter(r => r.name.toLowerCase().includes(menuQ.toLowerCase()));
  if (menuCat !== "all") L = L.filter(r => r.cat === menuCat);
  const E = L.map(evaluate);
  if (!menuQ.trim()) E.sort((a, b) => a.sellable - b.sellable || a.recipe.name.localeCompare(b.recipe.name));
  const counts = Object.fromEntries(MENU_CATS.map(c => [c.id, RECIPES.filter(r => r.cat === c.id).length]));
  const zero = RECIPES.map(evaluate).filter(e => e.sellable === 0).length;
  el.innerHTML = `<div class="slab-h"><h2>Menu explorer</h2><span class="tag">${zero} items can't be made right now</span></div>
    <div class="controls" style="margin-bottom:10px">
      <div class="seek"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="mq" type="search" placeholder="Search a menu item or ingredient, typos are fine" value="${H.esc(menuQ)}" aria-label="Search menu"></div>
    </div>
    <div class="cats" role="group" aria-label="Menu categories">
      <button class="cat" data-mcat="all" aria-pressed="${menuCat === "all"}">All<sup>${RECIPES.length}</sup></button>
      ${MENU_CATS.map(c => `<button class="cat" data-mcat="${c.id}" aria-pressed="${menuCat === c.id}">${c.name}<sup>${counts[c.id] || 0}</sup></button>`).join("")}
    </div>
    <div class="mlist" data-rt-list>${(showAll || menuQ.trim() || menuCat !== "all" ? E : E.slice(0, 24)).map(e => menuRow(e)).join("") || '<p class="empty">No menu item matches.</p>'}</div>
    ${!showAll && !menuQ.trim() && menuCat === "all" && E.length > 24 ? `<button class="btn ghost" id="m-more" style="margin-top:12px;width:100%">Show all ${E.length} menu items</button>` : ""}`;
  el.querySelector("#m-more")?.addEventListener("click", () => { showAll = true; renderMenu(); });
  const q = el.querySelector("#mq");
  q.oninput = () => { menuQ = q.value; const pos = q.selectionStart; renderMenu(); const n = document.getElementById("mq"); n.focus(); n.setSelectionRange(pos, pos); };
  el.querySelectorAll("[data-mcat]").forEach(b => b.onclick = () => { menuCat = b.dataset.mcat; renderMenu(); });
  wire(el, H, { lang: LANG() });
}

function menuRow(e) {
  const r = e.recipe, st = e.sellable === 0 ? "zero" : e.sellable < 20 ? "low" : "ok";
  return `<div class="mrow s-${st}">
    <button class="mrow-head" data-rt="${H.esc(r.name)}" aria-haspopup="dialog">
      <span class="m-name">${H.esc(r.name)}${r.ta ? '<i class="ta">TA</i>' : ""}</span>
      <span class="m-lim">${e.sellable === 0 ? "blocked by" : "limited by"} <b>${H.esc(rmLabel(e.bottleneck.rm || ""))}</b></span>
      <span class="m-cost data">${H.sar(r.cost)} SAR</span>
      <span class="m-num data">${nice(e.sellable)}</span>
    </button>
  </div>`;
}

// ── Charts (ECharts) ─────────────────────────────────────────
async function renderCharts() {
  let ec;
  try { ec = await loadECharts(); } catch {
    ["chart-pop", "chart-bn"].forEach(id => { const n = document.getElementById(id); if (n) n.innerHTML = '<p class="empty">Charts need an internet connection to load.</p>'; });
    return;
  }
  const popEl = document.getElementById("chart-pop"), bnEl = document.getElementById("chart-bn");
  if (!popEl || !bnEl) return;
  const css = getComputedStyle(document.documentElement);
  const ink2 = css.getPropertyValue("--ink-2").trim() || "#a3adbf", muted = css.getPropertyValue("--muted").trim() || "#808a9d", line = "rgba(150,170,210,.12)";
  const font = "Geist Mono, ui-monospace, monospace";
  const base = { backgroundColor: "transparent", textStyle: { fontFamily: font, color: ink2 }, animationDuration: 1100, animationEasing: "cubicOut" };
  const tip = { backgroundColor: "rgba(8,11,17,.95)", borderColor: "rgba(160,180,220,.3)", textStyle: { color: "#edf1f8", fontFamily: font, fontSize: 11 } };

  const pop = ec.init(popEl, null, { renderer: "canvas" }); charts.push(pop);
  pop.setOption({
    ...base, tooltip: { ...tip, trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 0, textStyle: { color: ink2, fontFamily: font, fontSize: 10 }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
    grid: { left: 8, right: 8, top: 36, bottom: 4, containLabel: true },
    xAxis: { type: "category", data: SIZES.map(s => `${s.oz} oz`), axisLine: { lineStyle: { color: line } }, axisLabel: { color: ink2 }, axisTick: { show: false } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: line } }, axisLabel: { color: muted, fontSize: 10 } },
    series: FLAVORS.map(f => ({
      name: f.id, type: "bar", barMaxWidth: 26, itemStyle: { color: f.color, borderRadius: [6, 6, 0, 0] },
      emphasis: { focus: "series" },
      data: SIZES.map(s => { const r = popRecipe(s, f.id); return r ? evaluate(r).sellable : 0; })
    }))
  });

  const tally = new Map();
  RECIPES.filter(r => r.cat !== "refill").forEach(r => { const e = evaluate(r); if (!e.bottleneck?.rm || /NAPKIN/.test(e.bottleneck.rm)) return; const k = rmLabel(e.bottleneck.rm); const t = tally.get(k) || { n: 0, zero: 0 }; t.n++; if (e.sellable === 0) t.zero++; tally.set(k, t); });
  const rows = [...tally.entries()].sort((a, b) => b[1].zero - a[1].zero || b[1].n - a[1].n).slice(0, 10).reverse();
  const clip = t => (t.length > 16 ? t.slice(0, 15) + "…" : t);
  const bn = ec.init(bnEl, null, { renderer: "canvas" }); charts.push(bn);
  bn.setOption({
    ...base, tooltip: { ...tip, trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 0, itemGap: 18, textStyle: { color: ink2, fontFamily: font, fontSize: 10 }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
    grid: { left: 24, right: 16, top: 36, bottom: 4, containLabel: true },
    xAxis: { type: "value", splitLine: { lineStyle: { color: line } }, axisLabel: { color: muted, fontSize: 10 }, minInterval: 1 },
    yAxis: { type: "category", data: rows.map(r => r[0]), axisLine: { lineStyle: { color: line } }, axisTick: { show: false }, axisLabel: { color: ink2, fontSize: 10, formatter: clip } },
    series: [
      { name: "Out of stock", type: "bar", stack: "t", data: rows.map(r => r[1].zero), itemStyle: { color: "#ff5468", borderRadius: 0 }, barMaxWidth: 16 },
      { name: "Limits the item", type: "bar", stack: "t", data: rows.map(r => r[1].n - r[1].zero), itemStyle: { color: "#5b7bff", borderRadius: [0, 6, 6, 0] }, barMaxWidth: 16 }
    ]
  });
  const ro = new ResizeObserver(() => charts.forEach(c => c.resize()));
  ro.observe(popEl); ro.observe(bnEl);
}

// ── Count-up for big numbers ─────────────────────────────────
function countUp(root) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll("[data-count]").forEach(el => {
    const to = Number(el.dataset.count); if (!isFinite(to) || to <= 0) return;
    const t0 = performance.now(), d = 900;
    const step = t => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = H.nf0.format(Math.round(to * e)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

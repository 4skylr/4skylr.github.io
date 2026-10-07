// Product profit — every menu item costed from the supplier price list (Golden Fist, 15 Jun 2026), line by line.
// Cost of a serving = Σ recipe qty ÷ recipe-units-per-stock-unit × cost of one stock unit. The stock-unit cost comes from
// the price list (case price ÷ what the case holds); materials the list does not sell fall back to the system's rate.
// Profit = menu price net of 15% VAT − serving cost. Group items (one price, several flavours) are costed per option.
import { PRICE_LIST, PRICE_LIST_DATE, SUPPLIER } from "../data/price-list.js?v=98";
import { MENU, COMBOS, GROUPS, VAT } from "../data/menu-data.js?v=98";
import { SALES_YTD, SALES_FROM, SALES_TO } from "../data/sales-data.js?v=98";
import { wire } from "../stock/recipe-theater.js?v=98";
import { unitCost, recipeCost, RM, LIST } from "./costing.js?v=98";
export { unitCost, recipeCost };

const low = s => String(s || "").toLowerCase();
// what one option of a group item is: its flavour, and the ingredients that make it different
const FLAVOUR_AR = { salted: "مملح", cheese: "جبن", caramel: "كراميل", "pizza savory": "بيتزا", coke: "كوكاكولا", "coke zero": "كوكاكولا زيرو", fanta: "فانتا",
  sprite: "سبرايت", strawberry: "فراولة", "blue raspberry": "توت أزرق", pomegranate: "رمان", chicken: "دجاج", beef: "لحم", malt: "شعير", raspberry: "توت",
  pineapple: "أناناس", peach: "خوخ", pom: "رمان", blue: "أزرق", pink: "وردي" };
const KEY_RM = { "corn butterfly": ["Butterfly corn", "ذرة بترفلاي"], "corn mushroom": ["Mushroom corn", "ذرة ماشروم"], "popcorn oil": ["Oil", "زيت"], salt: ["Salt", "ملح"],
  caramel: ["Caramel", "كراميل"], "cheese masala": ["Cheese", "جبن"], "pizza savory mix": ["Pizza mix", "خلطة بيتزا"], "chicken frankfurt": ["Chicken", "دجاج"],
  "beef frankfurt": ["Beef", "لحم"], "blue raspberry flossine": ["Blue floss", "سكر أزرق"], "vanilla pink flossine": ["Pink floss", "سكر وردي"] };
function optionLabel(name) {
  const s = name.replace(/\b(Regular|Medium|Large|Xtra Large|Family)\b( Tub)?/gi, "").replace(/\bPopcorn\b/gi, "").replace(/-?\s*\d+\s*oz\b/gi, "")
    .replace(/^SLUSH\s*-\s*/i, "").replace(/^HOT DOG\s*/i, "").replace(/^BARBICAN\s*/i, "").replace(/\s+-\s*$/, "").replace(/\s{2,}/g, " ").trim();
  const en = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || name;
  return { en, ar: FLAVOUR_AR[s.toLowerCase()] || en };
}
const chipsOf = rc => rc.lines.map(l => KEY_RM[low(l.rm)]).filter(Boolean);

function itemOf(m) {
  const net = m.price / (1 + VAT);
  const options = m.recipes.map(n => recipeCost(n)).filter(Boolean).map(rc => ({ ...rc, label: optionLabel(rc.name), chips: chipsOf(rc), profit: net - rc.total, margin: net ? (net - rc.total) / net : 0 }));
  const costs = options.map(o => o.total), mean = costs.length ? costs.reduce((a, c) => a + c, 0) / costs.length : 0;
  const was = options.length ? options.reduce((a, o) => a + o.was, 0) / options.length : 0;
  const units = (m.sold || []).reduce((a, id) => a + (Number(SALES_YTD[id]) || 0), 0);
  return { ...m, net, options, cost: mean, was, min: Math.min(...costs), max: Math.max(...costs), profit: net - mean, margin: net ? (net - mean) / net : 0,
    units, total: units * (net - mean), group: m.group };
}
function comboOf(cb, byId) {
  const net = cb.price / (1 + VAT), rc = cb.recipe ? recipeCost(cb.recipe) : null;
  const parts = cb.parts.map(pid => byId[pid] || (() => { const x = cb.extra?.[pid]; const o = (x?.recipes || []).map(recipeCost).filter(Boolean); const c = o.length ? o.reduce((a, r) => a + r.total, 0) / o.length : 0; return { id: pid, en: "Small popcorn", ar: "فشار صغير", cost: c, price: x?.price || 0 }; })());
  const cost = rc ? rc.total : parts.reduce((a, p) => a + p.cost, 0), alc = parts.reduce((a, p) => a + (p.price || 0), 0);
  return { ...cb, net, cost, profit: net - cost, margin: net ? (net - cost) / net : 0, parts, alc, recipe: rc };
}
export function analyseProfit() {
  const items = MENU.map(itemOf), byId = Object.fromEntries(items.map(i => [i.id, i]));
  const combos = COMBOS.map(c => comboOf(c, byId));
  const units = items.reduce((a, i) => a + i.units, 0), revenue = items.reduce((a, i) => a + i.units * i.net, 0), gross = items.reduce((a, i) => a + i.total, 0);
  // where the list and the system disagree, and which menu items that moves
  const changes = [...LIST.values()].map(l => { const m = RM.get(low(l.rm)); return m && Math.abs(l.per - m.rate) > 0.005 && Math.abs(l.per / (m.rate || 1) - 1) > 0.01 ? { rm: m.key, list: l.per, sys: m.rate, unit: m.stock, line: l } : null; }).filter(Boolean)
    .map(c => ({ ...c, hits: items.filter(i => i.options.some(o => o.lines.some(x => low(x.rm) === low(c.rm)))).map(i => ({ i, delta: i.was - i.cost })) }));
  return { items, combos, units, revenue, gross, margin: revenue ? gross / revenue : 0, changes };
}

// ── view ─────────────────────────────────────────────────────
const state = { tab: "items", group: "all", sort: "profit", open: new Set() };
export function renderProfit(host, H) {
  const ar = (sessionStorage.getItem("noir-lang") || "en") === "ar", T = (en, a) => ar ? a : en, esc = H.esc;
  const A = analyseProfit(), n0 = v => H.nf0.format(Math.round(v)), pct = v => `${Math.round(v * 100)}%`;
  const nm = i => esc(ar ? i.ar : i.en);
  const tone = m => m >= .7 ? "good" : m >= .5 ? "ok" : m >= .3 ? "warn" : "bad";
  const bar = m => `<span class="pf-bar t-${tone(m)}"><i style="width:${Math.max(2, Math.min(100, m * 100)).toFixed(1)}%"></i></span>`;
  const best = [...A.items].sort((a, b) => b.profit - a.profit)[0], thin = [...A.items].sort((a, b) => a.margin - b.margin)[0];

  // the line-by-line recipe lives in the recipe theater; here: where the cost goes, and the door to it
  const DNA = ["#6ccbff", "#ffb547", "#3ed69e", "#5b7bff", "#ff8a5c", "#dce6ff", "#b18cff", "#ff6fb0", "#7de3d0", "#ffd36b", "#8fb4ff", "#c6f36b"];
  const breakdown = o => `<div class="pf-dna">${o.lines.map((l, k) => ({ l, c: DNA[k % DNA.length] })).filter(x => x.l.cost > 0).sort((a, b) => b.l.cost - a.l.cost)
      .map(x => `<i style="--w:${Math.max(.8, x.l.cost / (o.total || 1) * 100).toFixed(2)}%;--c:${x.c}" title="${esc(x.l.rm)} · ${x.l.cost.toFixed(2)} (${Math.round(x.l.cost / (o.total || 1) * 100)}%)"></i>`).join("")}</div>
    <button type="button" class="btn sm ghost pf-rt" data-rt="${esc(o.name)}">${T("Open the recipe", "افتح الوصفة")} · ${o.lines.length} ${T("ingredients", "مكوّن")}</button>`;
  const itemRow = i => {
    const multi = i.options.length > 1, open = state.open.has(i.id);
    const costTxt = multi && i.max - i.min > 0.005 ? `${i.min.toFixed(2)}–${i.max.toFixed(2)}` : i.cost.toFixed(2);
    return `<details class="pf-item" data-id="${i.id}" ${open ? "open" : ""}><summary>
      <span class="pf-name"><b>${nm(i)}</b>${multi ? `<small>${i.options.length} ${T("options", "خيارات")}</small>` : ""}</span>
      <span class="pf-num" data-l="${T("Price", "السعر")}"><b class="data">${i.price}</b><small class="data">${i.net.toFixed(2)} ${T("net", "صافي")}</small></span>
      <span class="pf-num" data-l="${T("Cost", "التكلفة")}"><b class="data">${costTxt}</b></span>
      <span class="pf-num pf-p" data-l="${T("Profit", "الربح")}"><b class="data">${i.profit.toFixed(2)}</b>${bar(i.margin)}<small class="data">${pct(i.margin)}</small></span>
      <span class="pf-num" data-l="${T("This year", "هذي السنة")}"><b class="data">${n0(i.total)}</b><small class="data">${n0(i.units)} ${T("sold", "مباع")}</small></span>
    </summary>
    <div class="pf-opts">${i.options.map(o => `<section class="pf-opt">
      <header><b>${esc(ar ? o.label.ar : o.label.en)}</b><span class="pf-chips">${o.chips.map(c => `<em>${esc(c[ar ? 1 : 0])}</em>`).join("")}</span>
        <span class="pf-o-num data">${T("cost", "تكلفة")} ${o.total.toFixed(2)} · ${T("profit", "ربح")} <b>${o.profit.toFixed(2)}</b> · ${pct(o.margin)}${o.kcal != null ? ` · <i class="pf-kcal">≈ ${o.kcal} ${T("kcal", "سعرة")}</i>` : ""}</span></header>
      ${breakdown(o)}</section>`).join("")}</div></details>`;
  };
  const groups = Object.keys(GROUPS).filter(g => state.group === "all" || state.group === g);
  const sorter = { profit: (a, b) => b.profit - a.profit, margin: (a, b) => b.margin - a.margin, total: (a, b) => b.total - a.total }[state.sort];

  const tabItems = () => `<div class="pf-tools"><div class="seg" role="group">${["all", ...Object.keys(GROUPS)].map(g => `<button data-g="${g}" aria-pressed="${state.group === g}">${g === "all" ? T("All", "الكل") : esc(GROUPS[g][ar ? 1 : 0])}</button>`).join("")}</div>
      <label class="pf-sort">${T("Sort by", "ترتيب حسب")} <select class="select" id="pf-sort">${[["profit", T("Profit per item", "ربح الحبة")], ["margin", T("Margin", "الهامش")], ["total", T("Profit this year", "ربح السنة")]].map(([k, l]) => `<option value="${k}" ${state.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <div class="pf-head" aria-hidden="true"><span>${T("Item", "الصنف")}</span><span>${T("Price · net", "السعر · الصافي")}</span><span>${T("Cost", "التكلفة")}</span><span>${T("Profit · margin", "الربح · الهامش")}</span><span>${T("Profit this year", "ربح السنة")}</span></div>
    ${groups.map(g => `<h3 class="pf-g">${esc(GROUPS[g][ar ? 1 : 0])}</h3>${A.items.filter(i => i.group === g).sort(sorter).map(itemRow).join("")}`).join("")}`;

  const tabCombos = () => `<div class="pf-head" aria-hidden="true"><span>${T("Combo", "الكومبو")}</span><span>${T("Price · net", "السعر · الصافي")}</span><span>${T("Cost", "التكلفة")}</span><span>${T("Profit · margin", "الربح · الهامش")}</span><span>${T("Bought separately", "بالمفرد")}</span></div>
    ${[...A.combos].sort((a, b) => b.profit - a.profit).map(c => `<details class="pf-item"><summary>
      <span class="pf-name"><b>${nm(c)}</b><small>${c.parts.length} ${T("items", "أصناف")}${c.recipe ? "" : ` · ${T("parts averaged", "متوسط الأصناف")}`}</small></span>
      <span class="pf-num" data-l="${T("Price", "السعر")}"><b class="data">${c.price}</b><small class="data">${c.net.toFixed(2)} ${T("net", "صافي")}</small></span>
      <span class="pf-num" data-l="${T("Cost", "التكلفة")}"><b class="data">${c.cost.toFixed(2)}</b></span>
      <span class="pf-num pf-p" data-l="${T("Profit", "الربح")}"><b class="data">${c.profit.toFixed(2)}</b>${bar(c.margin)}<small class="data">${pct(c.margin)}</small></span>
      <span class="pf-num" data-l="${T("Separately", "بالمفرد")}"><b class="data">${c.alc || "—"}</b>${c.alc ? `<small class="data">${T("guest saves", "يوفر")} ${c.alc - c.price}</small>` : ""}</span>
    </summary><div class="pf-opts">${c.recipe ? `<section class="pf-opt"><header><b>${esc(c.recipe.name)}</b></header>${breakdown(c.recipe)}</section>`
      : `<ul class="pf-parts">${c.parts.map(p => `<li><span>${esc(ar ? p.ar : p.en)}</span><b class="data">${p.cost.toFixed(2)}</b></li>`).join("")}</ul>`}</div></details>`).join("")}`;

  const tabList = () => {
    const cats = [...new Set(PRICE_LIST.map(l => l.cat))];
    return `<p class="note">${T("Case prices are turned into the cost of one unit: what the case holds is read from the description (a case of 6 × 3.78 kg oil = 22.68 kg). Tubs, trays and hot-dog boxes are priced per piece on the list.", "سعر الكرتون يتحول لتكلفة الوحدة حسب محتوى الكرتون المكتوب بالوصف (كرتون زيت 6 × 3.78 كجم = 22.68 كجم). العلب والصواني وعلب الهوت دوق مسعّرة بالحبة في القائمة.")}</p>
      ${cats.map(cat => { const L = PRICE_LIST.filter(l => l.cat === cat); return `<h3 class="pf-g">${esc(ar ? L[0].catAr : cat.charAt(0) + cat.slice(1).toLowerCase())}</h3>
      <div class="pf-tw"><table class="pf-table"><thead><tr><th>${T("Item", "الصنف")}</th><th>${T("Price", "السعر")}</th><th>${T("Holds", "المحتوى")}</th><th>${T("Per unit", "الوحدة")}</th><th>${T("Used in", "يدخل في")}</th></tr></thead><tbody>
      ${L.map(l => `<tr><td><b>${esc(l.name)}</b><small class="data">${esc(l.code)}${l.note ? ` · ${esc(l.note)}` : ""}</small></td><td class="data">${l.price.toFixed(2)}<small>${l.pack === 1 ? T("per piece", "للحبة") : T("per case", "للكرتون")}</small></td>
        <td class="data">${l.pack ? (l.pack === 1 ? "1 pcs" : `${+l.pack.toFixed(2)} ${esc(l.unit)}`) : "—"}</td><td class="data">${l.per != null ? `${l.per.toFixed(l.per < 1 ? 3 : 2)} / ${esc(l.unit)}` : "—"}</td>
        <td>${l.rm ? esc(l.rm) : `<span class="pf-mute">${T("Not in a recipe", "مو داخل بوصفة")}</span>`}</td></tr>`).join("")}</tbody></table></div>`; }).join("")}`;
  };

  const tabChanges = () => A.changes.length ? `<p class="note">${T("Where the supplier list and the system's purchase rate disagree. Profits on this page use the list.", "الأصناف اللي يختلف فيها سعر المورد عن سعر الشراء بالنظام. الأرباح بهذي الصفحة محسوبة على القائمة.")}</p>
    <div class="pf-changes">${A.changes.sort((a, b) => Math.abs(b.list - b.sys) / (b.sys || 1) - Math.abs(a.list - a.sys) / (a.sys || 1)).map(c => { const up = c.list > c.sys; return `<article class="pf-ch ${up ? "up" : "down"}">
      <header><b>${esc(c.rm)}</b><span class="data">${c.sys.toFixed(c.sys < 1 ? 3 : 2)} → <strong>${c.list.toFixed(c.list < 1 ? 3 : 2)}</strong> / ${esc(c.unit)}</span><em class="data">${up ? "+" : ""}${Math.round((c.list / c.sys - 1) * 100)}%</em></header>
      <p>${c.hits.length ? c.hits.map(h => `<span>${nm(h.i)} <b class="data">${h.delta >= 0 ? "+" : ""}${h.delta.toFixed(2)}</b></span>`).join("") : T("No menu item uses it", "ما يدخل بأي صنف بالمنيو")}</p>
      <small>${T("Profit change per item", "التغير في ربح الحبة")}</small></article>`; }).join("")}</div>` : `<p class="empty">${T("The list matches the system everywhere.", "القائمة مطابقة للنظام بالكامل.")}</p>`;

  host.innerHTML = `<div class="pf">
    <section class="slab pf-top">
      <div class="pf-k"><span>${T("Gross margin", "هامش الربح")}</span><b class="data">${pct(A.margin)}</b><small>${T("weighted by this year's sales; items inside combos count at menu price, so read it as a ceiling", "موزون بمبيعات السنة؛ أصناف الكومبو محسوبة بسعر المنيو، فاعتبره حد أعلى")}</small></div>
      <div class="pf-k"><span>${T("Gross profit", "إجمالي الربح")}</span><b class="data">${n0(A.gross)}<small> SAR</small></b><small class="data" dir="ltr">${SALES_FROM} → ${SALES_TO}</small></div>
      <div class="pf-k"><span>${T("Most per item", "أعلى ربح للحبة")}</span><b>${nm(best)}</b><small class="data">${best.profit.toFixed(2)} SAR · ${pct(best.margin)}</small></div>
      <div class="pf-k"><span>${T("Thinnest margin", "أقل هامش")}</span><b>${nm(thin)}</b><small class="data">${thin.profit.toFixed(2)} SAR · ${pct(thin.margin)}</small></div>
      <p class="pf-src-line">${T(`Costs: ${SUPPLIER} price list, ${PRICE_LIST_DATE} · ${PRICE_LIST.length} lines. Menu prices include 15% VAT; profit is on the net price.`, `التكاليف: قائمة أسعار ${SUPPLIER} بتاريخ ${PRICE_LIST_DATE} · ${PRICE_LIST.length} صنف. أسعار المنيو شاملة الضريبة 15%، والربح محسوب على السعر الصافي.`)}</p>
    </section>
    <div class="seg pf-tabs" role="group">${[["items", T("Menu items", "أصناف المنيو")], ["combos", T("Combos", "الكومبو")], ["list", T("Price list", "قائمة الأسعار")], ["changes", `${T("Price changes", "فروقات الأسعار")} <sup class="data">${A.changes.length}</sup>`]]
      .map(([k, l]) => `<button data-tab="${k}" aria-pressed="${state.tab === k}">${l}</button>`).join("")}</div>
    <section class="slab pf-body">${{ items: tabItems, combos: tabCombos, list: tabList, changes: tabChanges }[state.tab]()}</section>
  </div>`;
  const again = () => renderProfit(host, H);
  wire(host, H, { lang: ar ? "ar" : "en" });
  host.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { state.tab = b.dataset.tab; again(); });
  host.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { state.group = b.dataset.g; again(); });
  host.querySelector("#pf-sort")?.addEventListener("change", e => { state.sort = e.target.value; again(); });
  host.querySelectorAll(".pf-item[data-id]").forEach(d => d.addEventListener("toggle", () => { d.open ? state.open.add(d.dataset.id) : state.open.delete(d.dataset.id); }));
}

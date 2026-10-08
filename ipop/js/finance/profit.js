// Product profit — every menu item costed from the supplier price list (Golden Fist, 15 Jun 2026), line by line.
// Cost of a serving = Σ recipe qty ÷ recipe-units-per-stock-unit × cost of one stock unit. The stock-unit cost comes from
// the price list (case price ÷ what the case holds); materials the list does not sell fall back to the system's rate.
// Profit = menu price net of 15% VAT − serving cost. Group items (one price, several flavours) are costed per option.
import { PRICE_LIST, PRICE_LIST_DATE, SUPPLIER } from "../data/price-list.js?v=106";
import { MENU, COMBOS, GROUPS, VAT } from "../data/menu-data.js?v=106";
import { SALES_YTD, SALES_FROM, SALES_TO } from "../data/sales-data.js?v=106";
import { wire } from "../stock/recipe-theater.js?v=106";
import { unitCost, recipeCost, RM, LIST } from "./costing.js?v=106";
import { optionLabel } from "./serving.js?v=106";
export { unitCost, recipeCost };

const low = s => String(s || "").toLowerCase();
// what one option of a group item is: its flavour, and the ingredients that make it different
const KEY_RM = { "corn butterfly": ["Butterfly corn", "ذرة بترفلاي"], "corn mushroom": ["Mushroom corn", "ذرة ماشروم"], "popcorn oil": ["Oil", "زيت"], salt: ["Salt", "ملح"],
  caramel: ["Caramel", "كراميل"], "cheese masala": ["Cheese", "جبن"], "pizza savory mix": ["Pizza mix", "خلطة بيتزا"], "chicken frankfurt": ["Chicken", "دجاج"],
  "beef frankfurt": ["Beef", "لحم"], "blue raspberry flossine": ["Blue floss", "سكر أزرق"], "vanilla pink flossine": ["Pink floss", "سكر وردي"] };
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
// One product-price section (menu price, cost, profit, margin, and where the costs come from), the year's sales once
// in one sorted table, the combos, and the supplier list behind the costs. A recipe opens from its price row only.
const state = { tab: "prices", group: "all", sort: "profit", open: new Set() };
export function renderProfit(host, H) {
  const esc = H.esc, A = analyseProfit();
  const pct = x => `${(x * 100).toFixed(1)}%`, n0 = x => Math.round(x).toLocaleString("en-US");
  const tone = m => m >= .7 ? "good" : m >= .5 ? "ok" : m >= .3 ? "warn" : "bad";
  const bar = m => `<span class="pf-bar t-${tone(m)}"><i style="width:${Math.max(2, Math.min(100, m * 100)).toFixed(1)}%"></i></span>`;

  // where the cost of a serving goes, and the one door to its recipe
  const DNA = ["#6ccbff", "#ffb547", "#3ed69e", "#5b7bff", "#ff8a5c", "#dce6ff", "#b18cff", "#ff6fb0", "#7de3d0", "#ffd36b", "#8fb4ff", "#c6f36b"];
  const breakdown = o => `<div class="pf-dna">${o.lines.map((l, k) => ({ l, c: DNA[k % DNA.length] })).filter(x => x.l.cost > 0).sort((a, b) => b.l.cost - a.l.cost)
      .map(x => `<i style="--w:${Math.max(.8, x.l.cost / (o.total || 1) * 100).toFixed(2)}%;--c:${x.c}" title="${esc(x.l.rm)} · ${x.l.cost.toFixed(2)} (${Math.round(x.l.cost / (o.total || 1) * 100)}%)"></i>`).join("")}</div>
    <button type="button" class="btn sm ghost pf-rt" data-rt="${esc(o.name)}">Open the recipe · ${o.lines.length} ingredients</button>`;
  const priceRow = i => {
    const multi = i.options.length > 1, open = state.open.has(i.id);
    const costTxt = multi && i.max - i.min > 0.005 ? `${i.min.toFixed(2)}–${i.max.toFixed(2)}` : i.cost.toFixed(2);
    return `<details class="pf-item" data-id="${i.id}" ${open ? "open" : ""}><summary>
      <span class="pf-name"><b>${esc(i.en)}</b>${multi ? `<small>${i.options.length} options</small>` : ""}</span>
      <span class="pf-num" data-l="Menu price"><b class="data">${i.price}</b><small class="data">${i.net.toFixed(2)} net</small></span>
      <span class="pf-num" data-l="Cost"><b class="data">${costTxt}</b></span>
      <span class="pf-num pf-p" data-l="Profit"><b class="data">${i.profit.toFixed(2)}</b></span>
      <span class="pf-num" data-l="Margin"><b class="data">${pct(i.margin)}</b>${bar(i.margin)}</span>
    </summary>
    <div class="pf-opts">${i.options.map(o => `<section class="pf-opt">
      <header><b>${esc(o.label.en)}</b><span class="pf-chips">${o.chips.map(c => `<em>${esc(c[0])}</em>`).join("")}</span>
        <span class="pf-o-num data">cost ${o.total.toFixed(2)} · profit <b>${o.profit.toFixed(2)}</b> · ${pct(o.margin)}${o.kcal != null ? ` · <i class="pf-kcal">≈ ${o.kcal} kcal</i>` : ""}</span></header>
      ${breakdown(o)}</section>`).join("")}</div></details>`;
  };
  const groups = Object.keys(GROUPS).filter(g => state.group === "all" || state.group === g);
  const sorter = { profit: (a, b) => b.profit - a.profit, margin: (a, b) => b.margin - a.margin, price: (a, b) => b.price - a.price }[state.sort] || ((a, b) => b.profit - a.profit);
  const head = first => `<div class="pf-head" aria-hidden="true"><span>${first}</span><span>Menu price · net</span><span>Cost</span><span>Profit</span><span>Margin</span></div>`;

  const tabPrices = () => `<div class="pf-tools"><div class="seg" role="group" aria-label="Menu group">${["all", ...Object.keys(GROUPS)].map(g => `<button data-g="${g}" aria-pressed="${state.group === g}">${g === "all" ? "All" : esc(GROUPS[g][0])}</button>`).join("")}</div>
      <label class="pf-sort">Sort by <select class="select" id="pf-sort">${[["profit", "Profit per item"], ["margin", "Margin"], ["price", "Menu price"]].map(([k, l]) => `<option value="${k}" ${state.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    ${head("Item")}
    ${groups.map(g => `<h3 class="pf-g">${esc(GROUPS[g][0])}</h3>${A.items.filter(i => i.group === g).sort(sorter).map(priceRow).join("")}`).join("")}`;

  // the year's sales, once: item, units sold, profit (units × profit per item), sorted by profit
  const tabSales = () => {
    const rows = A.items.filter(i => i.units > 0).sort((a, b) => b.total - a.total || b.units - a.units), none = A.items.length - rows.length;
    return `<p class="note">Sales ${SALES_FROM} → ${SALES_TO}. Profit = units × profit per item on the net price; items sold inside combos count at menu price, so read the total as a ceiling.</p>
      <div class="pf-tw"><table class="pf-table pf-sales"><thead><tr><th>Item</th><th class="num">Units sold this year</th><th class="num">Profit</th></tr></thead>
      <tbody>${rows.map(i => `<tr><td><b>${esc(i.en)}</b></td><td class="data num">${n0(i.units)}</td><td class="data num">${n0(i.total)} <small>SAR</small></td></tr>`).join("")}</tbody>
      <tfoot><tr><td>Total</td><td class="data num">${n0(A.units)}</td><td class="data num">${n0(A.gross)} <small>SAR</small></td></tr></tfoot></table></div>
      ${none ? `<p class="note">${none} menu ${none === 1 ? "item has" : "items have"} no sales figure in the report.</p>` : ""}`;
  };

  const tabCombos = () => `${head("Combo")}
    ${[...A.combos].sort((a, b) => b.profit - a.profit).map(c => `<details class="pf-item"><summary>
      <span class="pf-name"><b>${esc(c.en)}</b><small>${c.parts.length} items${c.recipe ? "" : " · parts averaged"}${c.alc ? ` · ${c.alc} separately` : ""}</small></span>
      <span class="pf-num" data-l="Menu price"><b class="data">${c.price}</b><small class="data">${c.net.toFixed(2)} net</small></span>
      <span class="pf-num" data-l="Cost"><b class="data">${c.cost.toFixed(2)}</b></span>
      <span class="pf-num pf-p" data-l="Profit"><b class="data">${c.profit.toFixed(2)}</b></span>
      <span class="pf-num" data-l="Margin"><b class="data">${pct(c.margin)}</b>${bar(c.margin)}</span>
    </summary><div class="pf-opts">${c.recipe ? `<section class="pf-opt"><header><b>${esc(c.recipe.name)}</b></header>${breakdown(c.recipe)}</section>`
      : `<ul class="pf-parts">${c.parts.map(p => `<li><span>${esc(p.en)}</span><b class="data">${p.cost.toFixed(2)}</b></li>`).join("")}</ul>`}</div></details>`).join("")}`;

  const tabList = () => {
    const cats = [...new Set(PRICE_LIST.map(l => l.cat))];
    return `<p class="note">Case prices are turned into the cost of one unit: what the case holds is read from the description (a case of 6 × 3.78 kg oil = 22.68 kg). Tubs, trays and hot-dog boxes are priced per piece on the list.</p>
      ${cats.map(cat => { const L = PRICE_LIST.filter(l => l.cat === cat); return `<h3 class="pf-g">${esc(cat.charAt(0) + cat.slice(1).toLowerCase())}</h3>
      <div class="pf-tw"><table class="pf-table"><thead><tr><th>Item</th><th>Price</th><th>Holds</th><th>Per unit</th><th>Used in</th></tr></thead><tbody>
      ${L.map(l => `<tr><td><b>${esc(l.name)}</b><small class="data">${esc(l.code)}${l.note ? ` · ${esc(l.note)}` : ""}</small></td><td class="data">${l.price.toFixed(2)}<small>${l.pack === 1 ? "per piece" : "per case"}</small></td>
        <td class="data">${l.pack ? (l.pack === 1 ? "1 pcs" : `${+l.pack.toFixed(2)} ${esc(l.unit)}`) : "—"}</td><td class="data">${l.per != null ? `${l.per.toFixed(l.per < 1 ? 3 : 2)} / ${esc(l.unit)}` : "—"}</td>
        <td>${l.rm ? esc(l.rm) : `<span class="pf-mute">Not in a recipe</span>`}</td></tr>`).join("")}</tbody></table></div>`; }).join("")}`;
  };

  const tabChanges = () => A.changes.length ? `<p class="note">Where the supplier list and the system's purchase rate disagree. Costs on this page use the list.</p>
    <div class="pf-changes">${A.changes.sort((a, b) => Math.abs(b.list - b.sys) / (b.sys || 1) - Math.abs(a.list - a.sys) / (a.sys || 1)).map(c => { const up = c.list > c.sys; return `<article class="pf-ch ${up ? "up" : "down"}">
      <header><b>${esc(c.rm)}</b><span class="data">${c.sys.toFixed(c.sys < 1 ? 3 : 2)} → <strong>${c.list.toFixed(c.list < 1 ? 3 : 2)}</strong> / ${esc(c.unit)}</span><em class="data">${up ? "+" : ""}${Math.round((c.list / c.sys - 1) * 100)}%</em></header>
      <p>${c.hits.length ? c.hits.map(h => `<span>${esc(h.i.en)} <b class="data">${h.delta >= 0 ? "+" : ""}${h.delta.toFixed(2)}</b></span>`).join("") : "No menu item uses it"}</p>
      <small>Profit change per item</small></article>`; }).join("")}</div>` : `<p class="empty">The list matches the system everywhere.</p>`;

  const TABS = [["prices", "Prices"], ["sales", "Sales this year"], ["combos", "Combos"], ["list", "Price list"], ["changes", `Price changes${A.changes.length ? ` · ${A.changes.length}` : ""}`]];
  if (!TABS.some(([k]) => k === state.tab)) state.tab = "prices";
  host.innerHTML = `<div class="pf">
    <p class="pf-src-line pf-src">Costs: ${esc(SUPPLIER)} price list, ${PRICE_LIST_DATE} · ${PRICE_LIST.length} lines (materials it does not sell use the system's purchase rate). Menu prices include ${Math.round(VAT * 100)}% VAT; profit and margin are on the net price.</p>
    <div class="seg pf-tabs" role="group" aria-label="Product profit">${TABS.map(([k, l]) => `<button data-tab="${k}" aria-pressed="${state.tab === k}">${l}</button>`).join("")}</div>
    <section class="slab pf-body">${{ prices: tabPrices, sales: tabSales, combos: tabCombos, list: tabList, changes: tabChanges }[state.tab]()}</section>
  </div>`;
  const again = () => renderProfit(host, H);
  wire(host, H, { lang: "en" });
  host.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { state.tab = b.dataset.tab; again(); });
  host.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { state.group = b.dataset.g; again(); });
  host.querySelector("#pf-sort")?.addEventListener("change", e => { state.sort = e.target.value; again(); });
  host.querySelectorAll(".pf-item[data-id]").forEach(d => d.addEventListener("toggle", () => { d.open ? state.open.add(d.dataset.id) : state.open.delete(d.dataset.id); }));
}

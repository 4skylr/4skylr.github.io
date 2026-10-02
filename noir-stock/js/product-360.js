// Product 360 — everything about one product in one sheet: where it is, how much, expiry groups,
// price and margin, sales / usage, cover and reorder, recipes, and a stock transfer between locations.
// Gauge: apache/echarts (vendored). The photo uses the app's own pic() helper unchanged.
import { placement, isBulk } from "./fefo-place.js?v=73";
import { soldOf, moveOf, SALES_DAYS, SALES_FROM, SALES_TO, dailyUse } from "./sales-data.js?v=73";
import { usageOf } from "./consumption.js?v=73";
import { MENU, VAT } from "./menu-data.js?v=73";
import { RECIPES } from "./recipes-data.js?v=73";

const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const T = {
  en: { total: "Total on hand", value: "Stock value", cost: "Unit cost", price: "Menu price", margin: "Profit / unit", where: "Where it is", groups: "Expiry groups", none: "No dated groups (quantity only).",
    days: "days", expired: "expired", move: "Move to", sales: "Sales & usage", sold: "Sold this year", moved: "Moved with", used: "Used this year", est: "estimate",
    perDay: "Per day", cover: "Days of cover", out: "Runs out", rop: "Reorder at", recipes: "Goes into", menuItems: "menu items", transfer: "Transfer stock",
    from: "From", to: "To", qty: "Quantity", doMove: "Move stock", moved2: "Stock moved", bad: "Check the quantity", card: "Product card & barcode", edit: "Edit",
    pick: "Pick order", top: "Top seller", noSales: "No sales data for this item.", lead: `Sales ${SALES_FROM} → ${SALES_TO}`,
    locs: { refuel: "Concession", mini: "Mini Store", stores: "Store" }, status: { now: "Order now", soon: "Order soon", ok: "Healthy", over: "Overstock" } },
  ar: { total: "الكمية الكلية", value: "قيمة المخزون", cost: "تكلفة الوحدة", price: "سعر المنيو", margin: "ربح الحبة", where: "وين موجود", groups: "مجموعات الصلاحية", none: "بدون تواريخ (كمية فقط).",
    days: "يوم", expired: "منتهية", move: "قدّمها إلى", sales: "المبيعات والاستهلاك", sold: "مباع من بداية السنة", moved: "تحرك مع", used: "استهلاك من بداية السنة", est: "تقدير",
    perDay: "باليوم", cover: "يكفي", out: "ينفد", rop: "اطلب عند", recipes: "يدخل في", menuItems: "صنف بالمنيو", transfer: "نقل مخزون",
    from: "من", to: "إلى", qty: "الكمية", doMove: "انقل", moved2: "تم النقل", bad: "تأكد من الكمية", card: "بطاقة المنتج والباركود", edit: "تعديل",
    pick: "ترتيب الصرف", top: "الأكثر مبيعاً", noSales: "لا توجد بيانات مبيعات لهذا الصنف.", lead: `المبيعات ${SALES_FROM} ← ${SALES_TO}`,
    locs: { refuel: "الكونسيشن", mini: "الميني ستور", stores: "المستودع" }, status: { now: "اطلب الحين", soon: "اطلب قريب", ok: "سليم", over: "زائد" } }
};
const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
const LEAD = 7, SAFETY = 7;

export function open360(p, H) {
  const ar = AR(), L = T[ar ? "ar" : "en"], esc = H.esc, q = H.qty, sar = H.sar, P = H.data().products;
  const unit = esc(H.UNITS[p.unit] || ""), total = H.total(p), rate = Number(p.rate) || 0;
  const nm = ar ? (H.namesAr?.[p.id] || p.name) : p.name, alt = ar ? p.name : (H.namesAr?.[p.id] || "");
  const menu = MENU.find(m => m.sold.includes(p.id) && m.sold.length <= 2);
  const net = menu ? menu.price / (1 + VAT) : null;
  const use = usageOf(p, P), mv = moveOf(p.id), sold = soldOf(p.id);
  const daily = dailyUse(p.id) || (use ? use.total / SALES_DAYS : 0);
  const cover = daily > 0 ? total / daily : null, rop = daily * (LEAD + SAFETY);
  const st = daily <= 0 ? null : total <= daily * LEAD ? "now" : total <= rop ? "soon" : cover > 365 ? "over" : "ok";
  const pl = placement(p), gname = n => ar ? "المجموعة " + (ORD[n - 1] || n) : "Group " + n;
  const recipes = RECIPES.filter(r => !r.ta && r.lines.some(l => String(l.rm).toLowerCase() === String(p.sku || "").toLowerCase()));
  const rank = H.topRank ? H.topRank(p.id) : 0;
  const day = n => new Date(Date.now() + n * 86400000).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const m = H.openModal(`<div class="p360" dir="${ar ? "rtl" : "ltr"}">
    <header class="p3-head">
      <div class="p3-pic">${H.pic(p, "pic")}</div>
      <div class="p3-id"><span class="p3-cat">${esc(H.catName(p.category))}${isBulk(p) ? ` · ${ar ? "صنف قروب" : "group item"}` : ""}</span>
        <h2>${esc(nm)}</h2>${alt ? `<p>${esc(alt)}</p>` : ""}<code>${esc(p.sku || "")}${p.code ? " · " + esc(p.code) : ""}</code>
        ${rank ? `<span class="top-seller"><b>★</b>${L.top} #${rank}</span>` : ""}</div>
    </header>

    <div class="p3-kpis">
      <article><span>${L.total}</span><b class="data">${q(total)} <small>${unit}</small></b></article>
      <article><span>${L.value}</span><b class="data">${sar(total * rate)} <small>SAR</small></b></article>
      <article><span>${L.cost}</span><b class="data">${rate ? sar(rate) : "—"} <small>/${unit}</small></b></article>
      ${menu ? `<article class="hl"><span>${L.price}</span><b class="data">${menu.price} <small>SR</small></b><em>${L.margin} +${sar(net - rate)}</em></article>` : ""}
    </div>

    <section class="p3-sec"><h3>${L.where}</h3>
      <div class="p3-alloc">${H.LOCATIONS.map(l => { const n = Number(p.stock?.[l.id]) || 0, pc = total ? n / total : 0;
        return `<div class="p3-loc l-${l.id}"><b>${esc(L.locs[l.id] || l.name)}</b><strong class="data">${q(n)}</strong><span class="data">${Math.round(pc * 100)}%</span><i><u style="width:${(pc * 100).toFixed(1)}%"></u></i></div>`; }).join("")}</div>
    </section>

    <section class="p3-sec"><h3>${L.groups} <i>${pl.groups.length}</i></h3>
      ${pl.groups.length ? `<div class="p3-groups">${pl.groups.map(g => `<div class="p3-g ${g.left < 0 ? "exp" : g.left <= 30 ? "soon" : ""} ${g.flag?.kind === "move" ? "flag" : ""}">
        <span class="p3-pick">#${g.pick}</span><b>${esc(gname(g.n))}</b><span class="si-loc l-${g.loc}">${esc(L.locs[g.loc] || g.location)}</span>
        <span class="data">${q(g.qty)} ${unit}</span><span class="data">${esc(String(g.date))}</span>
        <strong class="data">${g.left < 0 ? L.expired : g.left + " " + L.days}</strong>
        ${g.flag?.kind === "move" ? `<em>⚑ ${L.move} ${esc(L.locs[g.flag.to])}</em>` : ""}</div>`).join("")}</div>` : `<p class="p3-muted">${L.none}</p>`}
    </section>

    <section class="p3-sec"><h3>${L.sales} <small>${L.lead}</small></h3>
      ${use || sold ? `<div class="p3-sales">
        <div><span>${use ? L.used : mv && mv.shared ? L.moved : L.sold}</span><b class="data">${use && !use.exact ? "≈ " : ""}${q(use ? use.total : sold)}</b><small>${use ? unit : mv && mv.shared ? esc(mv.unit[ar ? 1 : 0]) : unit}${use && !use.exact ? ` · ${L.est}` : ""}</small></div>
        ${daily ? `<div><span>${L.perDay}</span><b class="data">${q(daily)}</b><small>${unit}</small></div>
        <div class="gauge-box"><div id="p3-gauge" class="p3-gauge"></div><span>${L.cover}</span></div>
        <div><span>${L.out}</span><b class="data">${cover > 999 ? "—" : day(cover)}</b><small><span class="si-pill ${st === "now" ? "bad" : st === "soon" ? "warn" : st === "over" ? "info" : "good"}">${L.status[st]}</span></small></div>
        <div><span>${L.rop}</span><b class="data">${q(Math.ceil(rop))}</b><small>${unit}</small></div>` : ""}
      </div>` : `<p class="p3-muted">${L.noSales}</p>`}
      ${recipes.length ? `<p class="p3-rec">${L.recipes} <b>${recipes.length}</b> ${L.menuItems}: ${recipes.slice(0, 4).map(r => esc(r.name)).join(" · ")}${recipes.length > 4 ? " …" : ""}</p>` : ""}
    </section>

    <section class="p3-sec"><h3>${L.transfer}</h3>
      <form class="p3-move" id="p3-move">
        <label>${L.from}<select class="select" name="from">${H.LOCATIONS.map(l => `<option value="${l.id}" ${l.id === "stores" ? "selected" : ""}>${esc(L.locs[l.id])} · ${q(Number(p.stock?.[l.id]) || 0)}</option>`).join("")}</select></label>
        <label>${L.to}<select class="select" name="to">${H.LOCATIONS.map(l => `<option value="${l.id}" ${l.id === "refuel" ? "selected" : ""}>${esc(L.locs[l.id])}</option>`).join("")}</select></label>
        <label>${L.qty}<input class="input data" name="qty" type="number" inputmode="decimal" step="any" min="0" placeholder="0"></label>
        <button class="btn hot" type="submit">${L.doMove}</button>
      </form>
    </section>

    <div class="actions"><div class="end"><button class="btn" id="p3-card">${L.card}</button></div></div>
  </div>`, "wide p360-sheet");

  m.querySelector("#p3-card").onclick = () => { H.closeModal(); H.openCard(p); };
  m.querySelector("#p3-move").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, from = f.from.value, to = f.to.value, n = Number(f.qty.value);
    const have = Number(p.stock?.[from]) || 0;
    if (!(n > 0) || from === to || n > have + 1e-9) { H.toast(L.bad, true); return; }
    // the Settings master session or the edit pin both unlock transfers
    if (sessionStorage.getItem("noir-admin") !== "1" && !H.pinUnlocked() && !await H.requirePin()) { open360(p, H); return; }
    const round = x => Math.round(x * 1000) / 1000;
    const next = { ...p, stock: { ...p.stock, [from]: round(have - n), [to]: round((Number(p.stock?.[to]) || 0) + n) } };
    try {
      await H.saveProduct(next, { silent: true });
      await H.log("move", `Moved ${n} ${H.UNITS[p.unit] || ""} ${p.name}: ${T.en.locs[from]} → ${T.en.locs[to]}`);
      H.toast(L.moved2);
      open360(H.data().products.find(x => x.id === p.id) || next, H);
    } catch (err) { H.toast(err.message || "Error", true); }
  };

  // ECharts gauge for days of cover
  const g = m.querySelector("#p3-gauge");
  if (g && cover != null) {
    const go = ec => { const c = ec.init(g); const v = Math.min(Math.round(cover), 365);
      c.setOption({ series: [{ type: "gauge", min: 0, max: 365, startAngle: 210, endAngle: -30, radius: "100%", progress: { show: true, width: 8, roundCap: true },
        axisLine: { lineStyle: { width: 8, color: [[1, "rgba(255,255,255,.08)"]] } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
        itemStyle: { color: st === "now" ? "#ff5c7a" : st === "soon" ? "#ffc857" : st === "over" ? "#3be7ff" : "#4cf0a8" },
        detail: { valueAnimation: true, offsetCenter: [0, "8%"], fontSize: 18, color: "#fff", fontFamily: "JetBrains Mono, monospace", formatter: () => cover > 999 ? "999+" : String(Math.round(cover)) },
        data: [{ value: v }] }] }); };
    if (window.echarts) go(window.echarts); else { const s = document.createElement("script"); s.src = "vendor/echarts.min.js"; s.onload = () => go(window.echarts); document.head.append(s); }
  }
}

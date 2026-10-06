// Product 360 — everything about one product in one sheet: where it is, how much, expiry groups,
// price and margin, sales / usage, cover and reorder, recipes, sales-space advice and the stock history from reports.
// Gauge: apache/echarts (vendored). The photo uses the app's own pic() helper unchanged.
import { placement, isBulk } from "./fefo-place.js?v=93";
import { soldOf, moveOf, SALES_DAYS, SALES_FROM, SALES_TO, dailyUse } from "../data/sales-data.js?v=93";
import { usageOf } from "./consumption.js?v=93";
import { MENU, VAT } from "../data/menu-data.js?v=93";
import { RECIPES } from "../data/recipes-data.js?v=93";
import { salesSpace } from "./sales-space.js?v=93";
import { historyOf } from "./stock-history.js?v=93";
import { deck, wire } from "./recipe-theater.js?v=93";

const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const T = {
  en: { total: "Total on hand", value: "Stock value", cost: "Unit cost", price: "Menu price", margin: "Profit / unit", where: "Where it is", groups: "Expiry groups", none: "No dated groups (quantity only).",
    days: "days", expired: "expired", move: "Move to", sales: "Sales & usage", sold: "Sold this year", moved: "Moved with", used: "Used this year", est: "estimate",
    perDay: "Per day", cover: "Days of cover", out: "Runs out", rop: "Reorder at", recipes: "Goes into", menuItems: "menu items", space: "Sales space", spot: "Best spot", now: "Do now", summary: "Reminder ·", history: "Stock history", noHist: "No report has changed this item yet. Upload a stock report to start its history.", soldTag: "sold", addedTag: "added",
    card: "Product card & barcode", edit: "Edit",
    pick: "Pick order", top: "Top seller", noSales: "No sales data for this item.", lead: `Sales ${SALES_FROM} → ${SALES_TO}`,
    locs: { refuel: "Concession", mini: "Mini Store", stores: "Store" }, status: { now: "Order now", soon: "Order soon", ok: "Healthy", over: "Overstock" } },
  ar: { total: "الكمية الكلية", value: "قيمة المخزون", cost: "تكلفة الوحدة", price: "سعر المنيو", margin: "ربح الحبة", where: "وين موجود", groups: "مجموعات الصلاحية", none: "بدون تواريخ (كمية فقط).",
    days: "يوم", expired: "منتهية", move: "قدّمها إلى", sales: "المبيعات والاستهلاك", sold: "مباع من بداية السنة", moved: "تحرك مع", used: "استهلاك من بداية السنة", est: "تقدير",
    perDay: "باليوم", cover: "يكفي", out: "ينفد", rop: "اطلب عند", recipes: "يدخل في", menuItems: "صنف بالمنيو", space: "نقطة البيع", spot: "أفضل مكان", now: "المطلوب الحين", summary: "تذكير ·", history: "سجل الحركة", noHist: "ما فيه تقرير غيّر هذا الصنف للحين. ارفع تقرير الجرد عشان يبدأ السجل.", soldTag: "انباع", addedTag: "انضاف",
    card: "بطاقة المنتج والباركود", edit: "تعديل",
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
  const sp = salesSpace(p, { total, daily, rank });
  const hist = historyOf(H.stockHist ? H.stockHist() : [], p.id);
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
      ${recipes.length ? `<p class="p3-rec">${L.recipes} <b>${recipes.length}</b> ${L.menuItems}</p>${deck(recipes.map(r => r.name), H, { lang: ar ? "ar" : "en" })}` : ""}
    </section>

    <section class="p3-sec p3-space t-${sp.tone}"><h3>${L.space}</h3>
      <div class="p3-sp">
        <div class="p3-sp-where"><i><svg class="ic-pin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg></i><div><small>${L.spot}</small><b>${esc(sp.space[ar ? 1 : 0])}</b></div></div>
        <div class="p3-sp-act"><small>${L.now}</small><b>${esc(sp.act[ar ? 1 : 0])}</b>
          ${sp.why.map(w => `<p>↳ ${esc(w[ar ? 1 : 0])}</p>`).join("")}${sp.tips.map(w => `<p class="tip">★ ${esc(w[ar ? 1 : 0])}</p>`).join("")}</div>
      </div>
      <p class="p3-sum"><b>${L.summary}</b> ${esc(sp.summary[ar ? 1 : 0])}</p>
    </section>

    <section class="p3-sec"><h3>${L.history} <i>${hist.length}</i></h3>
      ${hist.length ? `<div class="p3-hist">${hist.slice(0, 8).map(h => `<div class="p3-h"><span class="data">${esc(h.at.slice(0, 10))}</span>
        ${h.lines.map(l => `<em class="${l.delta < 0 ? "sold" : "added"}">${esc(L.locs[l.loc] || l.loc)} ${q(l.from)} → ${q(l.to)} <b>${l.delta < 0 ? L.soldTag : L.addedTag} ${l.delta < 0 ? "−" : "+"}${q(Math.abs(l.delta))}</b></em>`).join("")}</div>`).join("")}</div>`
        : `<p class="p3-muted">${L.noHist}</p>`}
    </section>

    <div class="actions"><div class="end"><button class="btn" id="p3-card">${L.card}</button></div></div>
  </div>`, "wide p360-sheet");

  wire(m, H, { lang: ar ? "ar" : "en" });
  m.querySelector("#p3-card").onclick = () => { H.closeModal(); H.openCard(p); };
  // ECharts gauge for days of cover
  const g = m.querySelector("#p3-gauge");
  if (g && cover != null) {
    const go = ec => { const c = ec.init(g); const v = Math.min(Math.round(cover), 365);
      c.setOption({ series: [{ type: "gauge", min: 0, max: 365, startAngle: 210, endAngle: -30, radius: "100%", progress: { show: true, width: 8, roundCap: true },
        axisLine: { lineStyle: { width: 8, color: [[1, "rgba(255,255,255,.08)"]] } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
        itemStyle: { color: st === "now" ? "#ff5468" : st === "soon" ? "#ffb547" : st === "over" ? "#6ccbff" : "#3ed69e" },
        detail: { valueAnimation: true, offsetCenter: [0, "8%"], fontSize: 18, color: "#fff", fontFamily: "Geist Mono, monospace", formatter: () => cover > 999 ? "999+" : String(Math.round(cover)) },
        data: [{ value: v }] }] }); };
    if (window.echarts) go(window.echarts); else { const s = document.createElement("script"); s.src = "vendor/echarts.min.js"; s.onload = () => go(window.echarts); document.head.append(s); }
  }
}

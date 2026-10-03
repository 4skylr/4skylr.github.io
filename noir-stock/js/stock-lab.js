// Stock Lab — the product list in the Menu Lab style: KPI strip, one glowing board per category,
// and a row per product with its level ring, ready-to-sell stock, sales and status.
import { soldOf, moveOf } from "./sales-data.js?v=78";
import { usageOf } from "./consumption.js?v=78";
import { placement } from "./fefo-place.js?v=78";

const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const HUES = ["#9b6bff", "#3be7ff", "#ff4fd8", "#ffc857", "#4cf0a8", "#ff8a5c", "#c46bd4", "#5ad1ff", "#f06a7c", "#8c7aa3", "#7c2280"];

export function renderStockLab(host, H, list) {
  const ar = AR(), P = H.data().products, esc = H.esc, q = H.qty;
  const L = ar ? { value: "قيمة المخزون", items: "صنف", ready: "جاهز للبيع (كونسيشن)", low: "منخفض", out: "نافد", exp: "مجموعات تنتهي خلال 30 يوم", sold: "مباع", used: "استهلاك",
      readyS: "جاهز", backup: "احتياط", top: "الأكثر مبيعاً", none: "لا يوجد" }
    : { value: "Stock value", items: "items", ready: "Ready to sell (Concession)", low: "Low", out: "Out", exp: "Groups expiring ≤ 30 days", sold: "Sold", used: "Used",
      readyS: "ready", backup: "backup", top: "Top seller", none: "None" };
  const rows = list.map(p => {
    const t = H.total(p), lv = H.level(p), ready = Number(p.stock?.refuel) || 0, u = usageOf(p, P), mv = moveOf(p.id);
    const soonG = placement(p).groups.filter(g => g.left <= 30).length;
    const state = t <= 0 ? "out" : lv.state === "crit" || lv.state === "low" || (Number(p.min) > 0 && t <= p.min) ? "low" : "ok";
    return { p, t, lv, ready, back: t - ready, sold: u ? u.total : soldOf(p.id), usedEst: u && !u.exact, isUse: !!u, shared: mv?.shared, val: H.value(p), state, soonG, rank: H.topRank(p.id) };
  });
  const k = { value: rows.reduce((a, r) => a + r.val, 0), ready: rows.reduce((a, r) => a + r.ready * (Number(r.p.rate) || 0), 0), low: rows.filter(r => r.state === "low").length,
    out: rows.filter(r => r.state === "out").length, exp: rows.reduce((a, r) => a + r.soonG, 0) };
  const cats = H.CATEGORIES.map((c, i) => ({ c, hue: HUES[i % HUES.length], rows: rows.filter(r => r.p.category === c.id) })).filter(g => g.rows.length);
  const ring = r => {
    const R = 17, C = 2 * Math.PI * R, v = r.lv.state === "unset" ? 0 : Math.max(0, Math.min(1, r.lv.pct));
    const col = r.state === "out" ? "#ff5c7a" : r.state === "low" ? "#ffc857" : "#4cf0a8";
    return `<svg viewBox="0 0 44 44" class="sl-ring"><circle cx="22" cy="22" r="${R}" class="t"/><circle cx="22" cy="22" r="${R}" stroke="${col}" stroke-dasharray="${(v * C).toFixed(1)} ${C}" transform="rotate(-90 22 22)"/><text x="22" y="25.5" text-anchor="middle">${r.lv.state === "unset" ? "—" : Math.round(r.lv.pct * 100) + "%"}</text></svg>`;
  };
  const catName = c => ar ? ({ syrups: "شراب BIB", drinks: "مشروبات ومياه", snacks: "حلويات وسناكات", popcorn: "فشار وغزل بنات", food: "أطعمة وصوصات", slush: "سلاش وموكتيل", icecream: "آيس كريم", hot: "مشروبات ساخنة", packaging: "التغليف", removals: "مستبعدات", other: "أخرى" }[c.id] || c.name) : c.name;
  host.innerHTML = `<div class="sl">
    <div class="ml-kpis sl-kpis">
      <article><span>${L.value}</span><b class="data">${H.sar(k.value)} <small>SAR</small></b><em>${rows.length} ${L.items}</em></article>
      <article class="good"><span>${L.ready}</span><b class="data">${H.sar(k.ready)} <small>SAR</small></b></article>
      <article class="${k.low + k.out ? "warn" : "good"}"><span>${L.low} · ${L.out}</span><b class="data">${k.low} · ${k.out}</b></article>
      <article class="${k.exp ? "warn" : "good"}"><span>${L.exp}</span><b class="data">${k.exp}</b></article>
    </div>
    <div class="sl-boards">${cats.map(g => `<section class="ml-board sl-board" style="--bh:${g.hue}">
      <header><b>${esc(catName(g.c))}</b><span class="data">${g.rows.length} · ${H.sar(g.rows.reduce((a, r) => a + r.val, 0))}</span></header>
      ${g.rows.map(r => `<button class="sl-item s-${r.state}" data-edit="${esc(r.p.id)}">
        <span class="sl-pic">${H.pic(r.p, "pic")}${ring(r)}</span>
        <span class="sl-nm"><b>${esc(ar ? (H.namesAr?.[r.p.id] || r.p.name) : r.p.name)}</b>
          <small>${r.sold ? `${r.isUse ? L.used : L.sold} ${r.usedEst ? "≈" : ""}${q(r.sold)}${r.shared ? "" : ""}` : esc(r.p.sku || "")}</small>
          <span class="sl-tags">${r.rank ? `<i class="top">★ ${L.top} #${r.rank}</i>` : ""}${r.state === "out" ? `<i class="out">${L.out}</i>` : r.state === "low" ? `<i class="low">${L.low}</i>` : ""}${r.soonG ? `<i class="exp">⏳ ${r.soonG}</i>` : ""}</span></span>
        <span class="sl-q"><b class="data">${q(r.t)}<small> ${esc(H.UNITS[r.p.unit] || "")}</small></b><em class="data"><u>${q(r.ready)}</u> ${L.readyS} · ${q(r.back)} ${L.backup}</em></span>
      </button>`).join("")}
    </section>`).join("") || `<p class="empty">${L.none}</p>`}</div>
  </div>`;
}

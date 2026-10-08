// Stock analysis — the "Analysis" view on the Stock page.
//   ECharts            github.com/apache/echarts                (Pareto, treemap, location mix)
// Usage rates come from Sales RM Consumed (1 Jan → 1 Oct 2026); linked items (lids, straws) follow their source.
import { soldOf, soldSource, moveOf, dailyUse, SALES_DAYS, SALES_FROM, SALES_TO } from "../data/sales-data.js?v=105";
import { placement, isBulk } from "./fefo-place.js?v=105";
import { usageOf } from "./consumption.js?v=105";
import { salesSpace } from "./sales-space.js?v=105";
import { AR as NAME_AR } from "../core/names-ar.js?v=105";
import { loadEcharts } from "../core/chart-theme.js?v=105";

const LEAD = 7, SAFETY = 7;
const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const T = {
  en: {
    title: "Stock intelligence", sub: `Usage from sales ${SALES_FROM} → ${SALES_TO} (${SALES_DAYS} days). Lead time ${LEAD} d + safety ${SAFETY} d.`,
    k: { value: "Stock value", tracked: "Items with a usage rate", soon: "Run out within 14 days", risk: "Value expiring ≤ 30 days", mis: "Groups in the wrong place", over: "Overstock value (> 1 year cover)" },
    cover: "Days of cover", coverSub: "how long each item lasts at its usage rate · ingredients use sales × recipe", item: "Item", have: "On hand", perDay: "Per day", days: "Cover", front: "Front cover", out: "Runs out", rop: "Reorder at", status: "Status",
    st: { now: "Order now", soon: "Order soon", ok: "Healthy", over: "Overstock" },
    moves: "Sales space", movesSub: "what to refill or bring forward on the sales floor, and why · the Concession is stock ready to sell", from: "From", to: "To", qty: "Move", none: "Nothing to move right now.",
    fefo: "Expiry & placement", fefoSub: "groups that expire within 30 days or sit behind a later-expiring group", grp: "Group", loc: "Where", left: "Days left", atRisk: "SAR at risk", note: "Action",
    act: { expired: "Expired · write off", move: l => `Move to ${l} first`, soon: "Sell first" }, clean: "Every group is in the right place.",
    abc: "ABC value classes", abcSub: "A = top 80% of value, B = next 15%, C = last 5%", tree: "Where the money sits", treeSub: "category → item, sized by value",
    mix: "Location mix", mixSub: "value held at each location by category", via: "via",
    locs: { refuel: "Concession", mini: "Mini Store", stores: "Store" }, cls: "Class", items: "items", share: "of value"
  },
  ar: {
    title: "تحليل المخزون", sub: `الاستهلاك من المبيعات ${SALES_FROM} ← ${SALES_TO} (${SALES_DAYS} يوم). مدة التوريد ${LEAD} أيام + أمان ${SAFETY} أيام.`,
    k: { value: "قيمة المخزون", tracked: "أصناف لها معدل استهلاك", soon: "تنفد خلال 14 يوم", risk: "قيمة تنتهي خلال 30 يوم", mis: "مجموعات بمكان غلط", over: "قيمة مخزون زائد (أكثر من سنة)" },
    cover: "أيام التغطية", coverSub: "كم يكفي كل صنف حسب استهلاكه · المكونات = المبيعات × الوصفة", item: "الصنف", have: "المتوفر", perDay: "باليوم", days: "يكفي", front: "تغطية الواجهة", out: "ينفد", rop: "اطلب عند", status: "الحالة",
    st: { now: "اطلب الحين", soon: "اطلب قريب", ok: "سليم", over: "زائد" },
    moves: "نقطة البيع", movesSub: "وش تعبّي أو تقدّم في نقطة البيع وليش · الكونسيشن هو المخزون الجاهز للبيع", from: "من", to: "إلى", qty: "انقل", none: "لا يوجد تحويل مطلوب الحين.",
    fefo: "الصلاحية والترتيب", fefoSub: "مجموعات تنتهي خلال 30 يوم أو موجودة خلف مجموعة تنتهي بعدها", grp: "المجموعة", loc: "الموقع", left: "باقي", atRisk: "ريال معرض", note: "الإجراء",
    act: { expired: "منتهية · اشطب", move: l => `قدّمها إلى ${l}`, soon: "تُباع أولاً" }, clean: "كل المجموعات في مكانها الصحيح.",
    abc: "تصنيف ABC للقيمة", abcSub: "A = أعلى 80% من القيمة، B = الـ 15% التالية، C = آخر 5%", tree: "أين تتركز الأموال", treeSub: "الفئة ← الصنف، الحجم حسب القيمة",
    mix: "توزيع المواقع", mixSub: "القيمة في كل موقع حسب الفئة", via: "عن طريق",
    locs: { refuel: "الكونسيشن", mini: "الميني ستور", stores: "المستودع" }, cls: "الفئة", items: "صنف", share: "من القيمة"
  }
};
const CAT_AR = { syrups: "شراب BIB", drinks: "مشروبات ومياه", snacks: "حلويات وسناكات", popcorn: "فشار وغزل بنات", food: "أطعمة وصوصات",
  slush: "سلاش وموكتيل", icecream: "آيس كريم", hot: "مشروبات ساخنة", packaging: "التغليف", removals: "مستبعدات", other: "أخرى" };
const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];

let charts = [];
const loadECharts = loadEcharts;

export function analyse(H) {
  const P = H.data().products, total = H.total;
  const rows = P.map(p => {
    const use = usageOf(p, P), have = total(p), sold = soldOf(p.id), daily = dailyUse(p.id) || (use ? use.total / SALES_DAYS : 0), est = !!use && !use.exact, rate = Number(p.rate) || 0;
    const frontIds = isBulk(p) ? ["refuel", "mini"] : ["refuel"];
    const front = frontIds.reduce((a, l) => a + (Number(p.stock?.[l]) || 0), 0);
    const cover = daily > 0 ? have / daily : null, fcover = daily > 0 ? front / daily : null;
    const rop = daily * (LEAD + SAFETY);
    const status = daily <= 0 ? null : have <= daily * LEAD ? "now" : have <= rop ? "soon" : cover > 365 ? "over" : "ok";
    return { p, have, sold, daily, cover, fcover, rop, status, rate, value: have * rate, src: moveOf(p.id) && !moveOf(p.id).shared ? soldSource(p.id) : null, est };
  });
  // sales-space advice for every item that needs action now (see sales-space.js)
  const moves = rows.filter(r => r.have > 0 || r.daily > 0).map(r => ({ r, sp: salesSpace(r.p, { total: r.have, daily: r.daily }) }))
    .filter(m => m.sp.tone === "warn" || m.sp.tone === "bad").sort((a, b) => (a.sp.fDays ?? 99) - (b.sp.fDays ?? 99));
  // expiry & placement
  const fefo = P.flatMap(p => placement(p).groups.filter(g => g.flag || g.left <= 30).map(g => ({ p, g, risk: g.qty * (Number(p.rate) || 0) })))
    .sort((a, b) => (b.g.flag?.kind === "expired") - (a.g.flag?.kind === "expired") || (b.g.flag ? 1 : 0) - (a.g.flag ? 1 : 0) || a.g.left - b.g.left);
  // ABC by value
  const byVal = rows.filter(r => r.value > 0).sort((a, b) => b.value - a.value), sum = byVal.reduce((a, r) => a + r.value, 0);
  let run = 0; byVal.forEach(r => { run += r.value; r.cum = sum ? run / sum : 0; r.abc = r.cum - r.value / sum < .8 ? "A" : r.cum - r.value / sum < .95 ? "B" : "C"; });
  return { rows, moves, fefo, byVal, sum };
}

export function renderIntel(host, H) {
  charts.forEach(c => { try { c.dispose(); } catch {} }); charts = [];
  const L = T[AR() ? "ar" : "en"], A = analyse(H), esc = H.esc, q = H.qty, sar = H.sar;
  const nm = p => AR() ? (NAME_AR[p.id] || p.name) : p.name;
  const unit = p => esc(H.UNITS[p.unit] || "");
  const gname = n => AR() ? "المجموعة " + (ORD[n - 1] || n) : "Group " + n;
  const tracked = A.rows.filter(r => r.daily > 0).sort((a, b) => a.cover - b.cover);
  const soon = tracked.filter(r => r.cover <= 14).length;
  const risk = A.fefo.filter(x => x.g.left <= 30).reduce((a, x) => a + x.risk, 0);
  const mis = A.fefo.filter(x => x.g.flag?.kind === "move").length;
  const over = A.rows.filter(r => r.status === "over").reduce((a, r) => a + r.value, 0);
  const day = n => { const d = new Date(Date.now() + n * 86400000); return d.toLocaleDateString(AR() ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "2-digit", month: "short" }); };
  const cls = { A: 0, B: 0, C: 0 }, clsV = { A: 0, B: 0, C: 0 }; A.byVal.forEach(r => { cls[r.abc]++; clsV[r.abc] += r.value; });

  host.innerHTML = `<div class="si">
    <header class="si-head"><h2>${L.title}</h2><p>${esc(L.sub)}</p></header>
    <div class="si-kpis">
      ${[["value", sar(A.sum) + " SAR", ""], ["tracked", tracked.length, ""], ["soon", soon, soon ? "bad" : "good"], ["risk", sar(risk) + " SAR", risk ? "warn" : "good"], ["mis", mis, mis ? "bad" : "good"], ["over", sar(over) + " SAR", over ? "warn" : ""]]
        .map(([k, v, c]) => `<article class="${c}"><span>${L.k[k]}</span><b class="data">${v}</b></article>`).join("")}
    </div>

    <section class="slab si-card">
      <div class="slab-h"><h2>${L.fefo}</h2><span class="tag">${A.fefo.length}</span></div><p class="si-sub">${L.fefoSub}</p>
      ${A.fefo.length ? `<div class="ledger-wrap"><table class="ledger si-t"><thead><tr><th>${L.item}</th><th>${L.grp}</th><th>${L.loc}</th><th class="r">${L.left}</th><th class="r">${L.have}</th><th class="r">${L.atRisk}</th><th>${L.note}</th></tr></thead><tbody>
        ${A.fefo.map(({ p, g, risk }) => `<tr data-edit="${esc(p.id)}" class="${g.flag ? "f-" + g.flag.kind : ""}">
          <td><div class="nm">${H.pic(p, "pic")}<div><b>${esc(nm(p))}</b><span>${isBulk(p) ? (AR() ? "قروب · كيلو/لتر" : "Group item · kg/L") : (AR() ? "بالحبة" : "By the piece")}</span></div></div></td>
          <td data-l="${L.grp}">${esc(gname(g.n))}</td><td data-l="${L.loc}"><span class="si-loc l-${g.loc}">${L.locs[g.loc] || esc(g.location)}</span></td>
          <td data-l="${L.left}" class="r data ${g.left < 0 ? "neg" : g.left <= 30 ? "warn" : ""}">${g.left}</td><td data-l="${L.have}" class="r data">${q(g.qty)} ${unit(p)}</td><td data-l="${L.atRisk}" class="r data">${sar(risk)}</td>
          <td>${g.flag?.kind === "expired" ? `<span class="si-pill bad">${L.act.expired}</span>` : g.flag?.kind === "move" ? `<span class="si-pill bad">⚑ ${L.act.move(L.locs[g.flag.to])}</span>` : `<span class="si-pill warn">${L.act.soon}</span>`}</td></tr>`).join("")}
        </tbody></table></div>` : `<p class="empty">${L.clean}</p>`}
    </section>

    <div class="si-grid">
      <section class="slab si-card">
        <div class="slab-h"><h2>${L.cover}</h2><span class="tag">${tracked.length}</span></div><p class="si-sub">${L.coverSub}</p>
        <div class="ledger-wrap"><table class="ledger si-t"><thead><tr><th>${L.item}</th><th class="r">${L.have}</th><th class="r">${L.perDay}</th><th>${L.days}</th><th class="r">${L.front}</th><th class="r">${L.out}</th><th class="r">${L.rop}</th><th>${L.status}</th></tr></thead><tbody>
        ${tracked.map(r => `<tr data-edit="${esc(r.p.id)}"><td><div class="nm">${H.pic(r.p, "pic")}<div><b>${esc(nm(r.p))}</b><span>${r.est ? `<em class="si-est">${AR() ? "تقدير من الوصفات" : "recipe estimate"}</em> ` : ""}${r.src ? `${L.via} ${r.src.map(id => esc(nm(H.data().products.find(x => x.id === id) || { id, name: id }))).join(" + ")}` : esc(r.p.sku || "")}</span></div></div></td>
          <td data-l="${L.have}" class="r data">${q(r.have)}</td><td data-l="${L.perDay}" class="r data">${q(r.daily)}</td>
          <td data-l="${L.days}"><span class="si-cover s-${r.status}"><i style="width:${Math.min(100, r.cover / 120 * 100).toFixed(1)}%"></i></span><b class="data si-cd">${r.cover > 999 ? "999+" : Math.round(r.cover)}</b></td>
          <td data-l="${L.front}" class="r data">${Math.round(r.fcover)}</td><td data-l="${L.out}" class="r data">${r.cover > 999 ? "—" : day(r.cover)}</td><td data-l="${L.rop}" class="r data">${q(Math.ceil(r.rop))}</td>
          <td><span class="si-pill ${r.status === "now" ? "bad" : r.status === "soon" ? "warn" : r.status === "over" ? "info" : "good"}">${L.st[r.status]}</span></td></tr>`).join("")}
        </tbody></table></div>
      </section>
      <section class="slab si-card">
        <div class="slab-h"><h2>${L.moves}</h2><span class="tag">${A.moves.length}</span></div><p class="si-sub">${L.movesSub}</p>
        ${A.moves.length ? `<ol class="si-moves">${A.moves.map(m => `<li data-edit="${esc(m.r.p.id)}" class="t-${m.sp.tone}">${H.pic(m.r.p, "pic")}<div><b>${esc(nm(m.r.p))}</b>
          <span class="si-act">${esc(m.sp.act[AR() ? 1 : 0])}</span>${m.sp.why[0] ? `<small class="si-why">${esc(m.sp.why[0][AR() ? 1 : 0])}</small>` : ""}<small class="si-spot"><svg class="ic-pin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg> ${esc(m.sp.space[AR() ? 1 : 0])}</small></div></li>`).join("")}</ol>` : `<p class="empty">${L.none}</p>`}
      </section>
    </div>

    <div class="si-grid">
      <section class="slab si-card"><div class="slab-h"><h2>${L.abc}</h2></div><p class="si-sub">${L.abcSub}</p>
        <div class="si-abc">${["A", "B", "C"].map(k => `<span class="abc-${k}"><b>${k}</b>${cls[k]} ${L.items}<em>${A.sum ? Math.round(clsV[k] / A.sum * 100) : 0}% ${L.share}</em></span>`).join("")}</div>
        <div class="si-chart" id="si-pareto"></div></section>
      <section class="slab si-card"><div class="slab-h"><h2>${L.tree}</h2></div><p class="si-sub">${L.treeSub}</p><div class="si-chart" id="si-tree"></div></section>
    </div>
    <section class="slab si-card"><div class="slab-h"><h2>${L.mix}</h2></div><p class="si-sub">${L.mixSub}</p><div class="si-chart" id="si-mix"></div></section>
  </div>`;

  // charts load only when scrolled near, so the phone opens the table first
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); draw(e.target.id); } }), { rootMargin: "200px" });
  host.querySelectorAll(".si-chart").forEach(el => io.observe(el));
  const ink = "#d3dae6", grid = "rgba(255,255,255,.07)";
  const base = { textStyle: { fontFamily: "Inter, Plex Arabic, sans-serif", color: ink }, tooltip: { backgroundColor: "#0a0e15", borderColor: "#2b3446", textStyle: { color: "#edf1f8" } } };
  const mk = (id, opt) => loadECharts().then(ec => { const el = document.getElementById(id); if (!el) return; const c = ec.init(el, null, { renderer: "canvas" }); c.setOption({ ...base, ...opt }); charts.push(c); new ResizeObserver(() => { if (!c.isDisposed()) c.resize(); }).observe(el); }).catch(() => {});
  function draw(id) {
    if (id === "si-pareto") {
      const top = A.byVal.slice(0, 25), col = { A: "#5b7bff", B: "#6ccbff", C: "#6b5a80" };
      mk(id, { grid: { left: 50, right: 44, top: 20, bottom: 80 },
        xAxis: { type: "category", data: top.map(r => nm(r.p)), axisLabel: { rotate: 55, color: ink, fontSize: 10, width: 90, overflow: "truncate" }, axisLine: { lineStyle: { color: grid } } },
        yAxis: [{ type: "value", axisLabel: { color: ink }, splitLine: { lineStyle: { color: grid } } }, { type: "value", max: 100, axisLabel: { formatter: "{value}%", color: ink }, splitLine: { show: false } }],
        tooltip: { ...base.tooltip, trigger: "axis" },
        series: [{ type: "bar", data: top.map(r => ({ value: +r.value.toFixed(2), itemStyle: { color: col[r.abc], borderRadius: [6, 6, 0, 0] } })) },
          { type: "line", yAxisIndex: 1, smooth: true, symbolSize: 5, data: top.map(r => +(r.cum * 100).toFixed(1)), lineStyle: { color: "#dce6ff", width: 2 }, itemStyle: { color: "#dce6ff" },
            markLine: { silent: true, symbol: "none", lineStyle: { color: "#ffb547", type: "dashed" }, data: [{ yAxis: 80 }], label: { show: false } } }] });
    }
    if (id === "si-tree") {
      const cats = H.CATEGORIES.map((c, i) => ({ name: AR() ? (CAT_AR[c.id] || c.name) : c.name,
        children: A.rows.filter(r => r.p.category === c.id && r.value > 0).map(r => ({ name: nm(r.p), value: +r.value.toFixed(2) })) })).filter(c => c.children.length);
      mk(id, { tooltip: { ...base.tooltip, formatter: i => `${i.name}<br><b>${sar(i.value)} SAR</b>` },
        series: [{ type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false }, width: "100%", height: "100%", data: cats,
          levels: [{ itemStyle: { borderColor: "#06090e", borderWidth: 3, gapWidth: 3 }, color: ["#5b7bff", "#5b7bff", "#6ccbff", "#dce6ff", "#ffb547", "#3ed69e", "#33427a", "#7f95ff", "#ff8a5c"] },
            { itemStyle: { borderColor: "rgba(0,0,0,.35)", borderWidth: 1, gapWidth: 1 }, colorSaturation: [.35, .6] }],
          label: { color: "#fff", fontSize: 11, overflow: "truncate" }, upperLabel: { show: true, height: 20, color: "#fff", fontWeight: 700 } }] });
    }
    if (id === "si-mix") {
      const cats = H.CATEGORIES.filter(c => A.rows.some(r => r.p.category === c.id && r.value > 0));
      const cols = { refuel: "#6ccbff", mini: "#5b7bff", stores: "#dce6ff" };
      mk(id, { grid: { left: 110, right: 20, top: 30, bottom: 30 }, legend: { top: 0, textStyle: { color: ink } }, tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
        xAxis: { type: "value", axisLabel: { color: ink }, splitLine: { lineStyle: { color: grid } } },
        yAxis: { type: "category", data: cats.map(c => AR() ? (CAT_AR[c.id] || c.name) : c.name), axisLabel: { color: ink } },
        series: H.LOCATIONS.map(l => ({ name: L.locs[l.id] || l.name, type: "bar", stack: "v", itemStyle: { color: cols[l.id] }, barWidth: 16,
          data: cats.map(c => +A.rows.filter(r => r.p.category === c.id).reduce((a, r) => a + (Number(r.p.stock?.[l.id]) || 0) * r.rate, 0).toFixed(2)) })) });
    }
  }
}

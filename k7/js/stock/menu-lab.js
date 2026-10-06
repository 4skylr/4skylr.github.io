// Menu Lab — the price boards joined to recipe costs, sales and stock.
//   Menu engineering (Kasavana & Smith): popularity × contribution margin → Stars / Plowhorses / Puzzles / Dogs
//   Charts: apache/echarts (vendored)
import { MENU, COMBOS, GROUPS, VAT, PROMOS } from "../data/menu-data.js?v=95";
import { RECIPES, RAW_MATERIALS } from "../data/recipes-data.js?v=95";
import { SALES_YTD, SALES_FROM, SALES_TO } from "../data/sales-data.js?v=95";

const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const T = {
  en: { title: "Menu Lab", sub: `Menu prices (incl. 15% VAT) against recipe cost, sales ${SALES_FROM} → ${SALES_TO} and the stock on hand.`,
    k: { rev: "Revenue at menu price", profit: "Gross profit", fc: "Food cost", best: "Best earner" }, note: "Upper bound: combo items count at full menu price.",
    price: "Price", net: "Net of VAT", cost: "Cost", margin: "Profit / unit", sold: "Sold", make: "Can make now", fcost: "food cost",
    matrix: "Menu engineering", matrixSub: "popularity in its group × profit per unit · bubble = profit this year",
    q: { star: "Star", horse: "Plowhorse", puzzle: "Puzzle", dog: "Dog" },
    act: { star: "Keep it visible, never run out", horse: "Popular but thin: nudge price or trim cost", puzzle: "Great margin, sells little: promote it", dog: "Rethink or bundle into a combo" },
    combos: "Combo value", combosSub: "what the guest saves and what the cinema keeps (drink size follows the popcorn size)",
    cols: ["Combo", "À la carte", "Combo price", "Guest saves", "Cost", "Profit", "Margin"],
    sim: "Price simulator", simSub: "move the price; volume held at this year's sales", item: "Item", newP: "New price", delta: "Change in yearly profit",
    range: "flavours", groupsTitle: "The boards", showcase: "Combos & offers", newTag: "NEW", blocked: "Can't be made: out of" },
  ar: { title: "مختبر المنيو", sub: `أسعار المنيو (شاملة ضريبة 15%) مقابل تكلفة الوصفة، والمبيعات من ${SALES_FROM} إلى ${SALES_TO}، والمخزون الحالي.`,
    k: { rev: "الإيراد بسعر المنيو", profit: "إجمالي الربح", fc: "نسبة التكلفة", best: "الأعلى ربحاً" }, note: "حد أعلى: أصناف الكومبو محسوبة بسعر المنيو الكامل.",
    price: "السعر", net: "بدون ضريبة", cost: "التكلفة", margin: "ربح الحبة", sold: "المباع", make: "يكفي المخزون لـ", fcost: "تكلفة",
    matrix: "هندسة المنيو", matrixSub: "الشعبية داخل المجموعة × ربح الحبة · حجم الدائرة = ربح السنة",
    q: { star: "نجم", horse: "حصان عمل", puzzle: "لغز", dog: "ضعيف" },
    act: { star: "خلّه ظاهر ولا يخلص أبد", horse: "مطلوب لكن ربحه قليل: ارفع السعر شوي أو خفّض التكلفة", puzzle: "ربحه ممتاز ومبيعه قليل: سوّ له عرض وإبراز", dog: "راجعه أو ادمجه في كومبو" },
    combos: "قيمة الكومبو", combosSub: "كم يوفّر الزبون وكم يبقى للسينما (حجم المشروب نفس حجم الفشار)",
    cols: ["الكومبو", "بالمفرد", "سعر الكومبو", "توفير الزبون", "التكلفة", "الربح", "الهامش"],
    sim: "محاكي الأسعار", simSub: "حرّك السعر، والكمية نفس مبيعات هذه السنة", item: "الصنف", newP: "السعر الجديد", delta: "التغير في ربح السنة",
    range: "نكهات", groupsTitle: "اللوحات", showcase: "الكومبو والعروض", newTag: "جديد", blocked: "ما ينسوى الحين: خلص" }
};
const QCOL = { star: "#ffb547", horse: "#6ccbff", puzzle: "#dce6ff", dog: "#747e93" };
const low = s => String(s || "").toLowerCase();
let charts = [];

const recipeByName = new Map(RECIPES.filter(r => !r.ta).map(r => [low(r.name), r]));
function costOf(names) {
  const cs = names.map(n => recipeByName.get(low(n))).filter(Boolean).map(r => Number(r.cost) || 0);
  if (!cs.length) return null;
  return { mean: cs.reduce((a, c) => a + c, 0) / cs.length, min: Math.min(...cs), max: Math.max(...cs), n: cs.length };
}
// how many of the best-stocked flavour the shelves can make, and which item runs out first
function makeInfo(names, products) {
  const bySku = new Map(products.filter(p => p.sku).map(p => [low(p.sku), p]));
  let best = { n: 0, lim: null };
  names.map(n => recipeByName.get(low(n))).filter(Boolean).forEach(r => {
    let n = Infinity, lim = null;
    r.lines.forEach(l => {
      const p = bySku.get(low(l.rm)); if (!p || !(l.qty > 0)) return;
      const key = Object.keys(RAW_MATERIALS).find(k => low(k) === low(l.rm));
      const conv = (key && RAW_MATERIALS[key].conv) || 1;
      const m = Math.floor(Object.values(p.stock || {}).reduce((a, x) => a + (Number(x) || 0), 0) * conv / l.qty + 1e-9);
      if (m < n) { n = m; lim = p; }
    });
    if (n !== Infinity && (n > best.n || !best.lim)) best = { n, lim };
  });
  return best;
}
const makeable = (names, products) => makeInfo(names, products).n;

export function analyseMenu(products) {
  const items = MENU.map(m => {
    const c = costOf(m.recipes), net = m.price / (1 + VAT), units = m.sold.reduce((a, id) => a + (Number(SALES_YTD[id]) || 0), 0);
    const cost = c ? c.mean : 0, margin = net - cost;
    return { ...m, c, net, cost, margin, fc: net ? cost / net : 0, units, revenue: units * net, profit: units * margin, make: makeable(m.recipes, products) };
  });
  // menu engineering per group
  Object.keys(GROUPS).forEach(g => {
    const G = items.filter(i => i.group === g), U = G.reduce((a, i) => a + i.units, 0) || 1;
    const avgM = G.reduce((a, i) => a + i.margin * i.units, 0) / U;
    G.forEach(i => { i.share = i.units / U; const pop = i.share >= 0.7 / G.length, hi = i.margin >= avgM; i.q = pop && hi ? "star" : pop ? "horse" : hi ? "puzzle" : "dog"; });
  });
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const combos = COMBOS.map(cb => {
    const parts = cb.parts.map(pid => byId[pid] || (() => { const x = cb.extra?.[pid]; const c = costOf(x.recipes); return { id: pid, price: x.price, cost: c ? c.mean : 0 }; })());
    const rc = cb.recipe ? costOf([cb.recipe]) : null, mk = cb.recipe ? makeInfo([cb.recipe], products) : null;
    const alc = parts.reduce((a, p) => a + p.price, 0), cost = rc ? rc.mean : parts.reduce((a, p) => a + p.cost, 0), net = cb.price / (1 + VAT);
    return { ...cb, alc, cost, net, profit: net - cost, margin: net ? (net - cost) / net : 0, save: alc ? 1 - cb.price / alc : 0, hasFree: parts.some(p => !p.price),
      make: mk ? mk.n : Math.min(...parts.map(p => p.make ?? Infinity)), lim: mk ? mk.lim : null };
  });
  const rev = items.reduce((a, i) => a + i.revenue, 0), profit = items.reduce((a, i) => a + i.profit, 0);
  return { items, combos, rev, profit, fc: rev ? 1 - profit / rev : 0, best: [...items].sort((a, b) => b.profit - a.profit)[0] };
}

export function renderMenuLab(host, H) {
  charts.forEach(c => { try { c.dispose(); } catch {} }); charts = [];
  const ar = AR(), L = T[ar ? "ar" : "en"], A = analyseMenu(H.data().products), esc = H.esc;
  const n0 = v => H.nf0.format(Math.round(v)), m2 = v => H.sar(v), pct = v => `${Math.round(v * 100)}%`;
  const name = i => ar ? i.ar : i.en;
  const ring = fc => { const R = 18, C = 2 * Math.PI * R, v = Math.min(1, fc); const col = fc < .15 ? "#3ed69e" : fc < .3 ? "#ffb547" : "#ff5468";
    return `<svg viewBox="0 0 44 44" class="ml-ring"><circle cx="22" cy="22" r="${R}" class="t"/><circle cx="22" cy="22" r="${R}" stroke="${col}" stroke-dasharray="${(v * C).toFixed(1)} ${C}" transform="rotate(-90 22 22)"/><text x="22" y="25" text-anchor="middle">${pct(fc)}</text></svg>`; };

  host.innerHTML = `<div class="ml">
    <header class="ml-head"><div><h2>${L.title}</h2><p>${esc(L.sub)}</p></div></header>
    <div class="ml-kpis">
      <article><span>${L.k.rev}</span><b class="data">${n0(A.rev)} <small>SAR</small></b><em>${L.note}</em></article>
      <article class="good"><span>${L.k.profit}</span><b class="data">${n0(A.profit)} <small>SAR</small></b></article>
      <article class="${A.fc < .2 ? "good" : "warn"}"><span>${L.k.fc}</span><b class="data">${pct(A.fc)}</b></article>
      <article><span>${L.k.best}</span><b>${esc(name(A.best))}</b><em class="data">${n0(A.best.profit)} SAR</em></article>
    </div>

    <h3 class="ml-h">${L.showcase}</h3>
    <div class="ml-show">${A.combos.filter(c => c.img).map(c => `<article class="ml-card" style="--c:${c.color}">
        <div class="ml-poster"><img src="${c.img}" alt="${esc(ar ? c.ar : c.en)}" loading="lazy">${c.isNew ? `<span class="ml-new">${L.newTag}</span>` : ""}</div>
        <div class="ml-card-b">
          <header><b>${esc(ar ? c.ar : c.en)}</b><strong class="data">${c.price}<small> SR</small></strong></header>
          <div class="ml-lines">${(c.lines || []).map(l => `<span>${esc(l[ar ? 1 : 0])}</span>`).join("")}</div>
          <div class="ml-stats">
            <div><span>${L.cost}</span><b class="data">${m2(c.cost)}</b></div>
            <div><span>${L.margin}</span><b class="data pos">${m2(c.profit)}</b></div>
            <div><span>${L.cols[6]}</span><b class="data">${pct(c.margin)}</b></div>
            <div class="${c.make ? "" : "zero"}"><span>${L.make}</span><b class="data">${Number.isFinite(c.make) ? n0(c.make) : "—"}</b></div>
          </div>
          ${!c.make && c.lim ? `<p class="ml-warn">⚑ ${L.blocked} ${esc(ar ? (H.namesAr?.[c.lim.id] || c.lim.name) : c.lim.name)}</p>` : c.hasFree ? "" : `<p class="ml-save">${L.cols[3]} <b>${pct(c.save)}</b> · ${c.alc} → ${c.price} SR</p>`}
        </div></article>`).join("")}
      ${PROMOS.map(pr => { const its = pr.items.map(id => A.items.find(i => i.id === id)).filter(Boolean); return `<article class="ml-card" style="--c:${pr.color}">
        <div class="ml-poster"><img src="${pr.img}" alt="" loading="lazy"></div>
        <div class="ml-card-b"><header><b>${esc(ar ? pr.ar : pr.en)}</b><strong class="data">${pr.price}<small> SR</small></strong></header>
          <div class="ml-stats">${its.map(i => `<div><span>${esc(name(i))}</span><b class="data pos">+${m2(i.margin)}</b></div><div class="${i.make ? "" : "zero"}"><span>${L.make}</span><b class="data">${n0(i.make)}</b></div>`).join("")}</div>
        </div></article>`; }).join("")}
    </div>

    <h3 class="ml-h">${L.groupsTitle}</h3>
    <div class="ml-boards">${Object.entries(GROUPS).map(([g, t]) => `<section class="ml-board">
      <header><b>${esc(t[ar ? 1 : 0])}</b><img src="assets/pay/noir.webp" alt=""></header>
      ${A.items.filter(i => i.group === g).map(i => `<article class="ml-item q-${i.q}">
        ${ring(i.fc)}
        <div class="ml-nm"><b>${esc(name(i))}</b><small>${L.cost} ${m2(i.cost)}${i.c && i.c.n > 1 ? ` <i>(${m2(i.c.min)}–${m2(i.c.max)} · ${i.c.n} ${L.range})</i>` : ""} · ${L.sold} ${n0(i.units)} · ${L.make} ${n0(i.make)}</small>
          <span class="ml-q" style="--q:${QCOL[i.q]}">${L.q[i.q]}</span></div>
        <div class="ml-pr"><b class="data">${i.price}<small> SR</small></b><em class="data">+${m2(i.margin)}</em></div>
      </article>`).join("")}
    </section>`).join("")}</div>

    <div class="ml-grid">
      <section class="slab"><div class="slab-h"><h2>${L.matrix}</h2></div><p class="si-sub">${L.matrixSub}</p><div id="ml-matrix" class="si-chart" style="height:380px"></div>
        <div class="ml-legend">${Object.keys(QCOL).map(q => `<p style="--q:${QCOL[q]}"><b>${L.q[q]}</b>${L.act[q]}</p>`).join("")}</div></section>
      <section class="slab"><div class="slab-h"><h2>${L.sim}</h2></div><p class="si-sub">${L.simSub}</p>
        <div class="ml-sim"><label>${L.item}<select class="select" id="ml-item">${A.items.map(i => `<option value="${i.id}">${esc(name(i))} · ${i.price} SR</option>`).join("")}</select></label>
          <label>${L.newP} <b class="data" id="ml-pv"></b><input type="range" id="ml-p" min="1" max="60" step="1"></label>
          <div class="ml-sim-out" id="ml-out"></div></div></section>
    </div>

    <section class="slab"><div class="slab-h"><h2>${L.combos}</h2></div><p class="si-sub">${L.combosSub}</p>
      <div class="ledger-wrap"><table class="ledger si-t"><thead><tr>${L.cols.map((c, i) => `<th class="${i ? "r" : ""}">${c}</th>`).join("")}</tr></thead><tbody>
      ${A.combos.map(c => `<tr style="cursor:default"><td><b>${esc(ar ? c.ar : c.en)}</b></td><td data-l="${L.cols[1]}" class="r data">${c.hasFree ? "—" : c.alc}</td><td data-l="${L.cols[2]}" class="r data"><b>${c.price}</b></td>
        <td data-l="${L.cols[3]}" class="r data">${c.hasFree ? "—" : `<span class="si-pill good">${pct(c.save)}</span>`}</td><td data-l="${L.cols[4]}" class="r data">${m2(c.cost)}</td>
        <td data-l="${L.cols[5]}" class="r data pos">${m2(c.profit)}</td><td data-l="${L.cols[6]}" class="r data">${pct(c.margin)}</td></tr>`).join("")}
      </tbody></table></div></section>
  </div>`;

  // price simulator
  const sel = host.querySelector("#ml-item"), rng = host.querySelector("#ml-p"), out = host.querySelector("#ml-out"), pv = host.querySelector("#ml-pv");
  const pick = () => { const i = A.items.find(x => x.id === sel.value); rng.value = i.price; sim(); };
  const sim = () => {
    const i = A.items.find(x => x.id === sel.value), np = Number(rng.value), net = np / (1 + VAT), m = net - i.cost, d = (m - i.margin) * i.units;
    pv.textContent = `${np} SR`;
    out.innerHTML = `<div><span>${L.margin}</span><b class="data">${m2(m)}</b></div><div><span>${L.fcost}</span><b class="data">${pct(net ? i.cost / net : 0)}</b></div>
      <div class="${d >= 0 ? "pos" : "neg"}"><span>${L.delta}</span><b class="data">${d >= 0 ? "+" : ""}${n0(d)} SAR</b></div>`;
  };
  sel.onchange = pick; rng.oninput = sim; pick();

  // matrix
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.disconnect(); draw(); }), { rootMargin: "200px" });
  io.observe(host.querySelector("#ml-matrix"));
  function draw() {
    const go = ec => {
      const el = host.querySelector("#ml-matrix"); if (!el) return;
      const c = ec.init(el); charts.push(c);
      const ink = "#d3dae6", grid = "rgba(255,255,255,.07)", maxP = Math.max(...A.items.map(i => i.profit), 1);
      c.setOption({
        textStyle: { fontFamily: "Geist, system-ui, sans-serif", color: ink },
        grid: { left: 52, right: 20, top: 20, bottom: 46 },
        tooltip: { backgroundColor: "#0a0e15", borderColor: "#2b3446", textStyle: { color: "#edf1f8" },
          formatter: p => { const i = p.data.i; return `<b>${esc(name(i))}</b><br>${L.q[i.q]} · ${pct(i.share)}<br>${L.margin}: ${m2(i.margin)} SAR<br>${L.sold}: ${n0(i.units)}`; } },
        xAxis: { type: "value", name: ar ? "الشعبية في المجموعة" : "share of group", nameLocation: "middle", nameGap: 28, axisLabel: { formatter: v => pct(v), color: ink }, splitLine: { lineStyle: { color: grid } } },
        yAxis: { type: "value", name: L.margin, axisLabel: { color: ink }, splitLine: { lineStyle: { color: grid } } },
        series: [{ type: "scatter", data: A.items.map(i => ({ value: [i.share, +i.margin.toFixed(2)], i, symbolSize: 10 + 34 * Math.sqrt(Math.max(i.profit, 0) / maxP),
          itemStyle: { color: QCOL[i.q], opacity: .85, borderColor: "#06090e" }, label: { show: i.profit > maxP * .12, formatter: name(i), position: "top", color: "#fff", fontSize: 10 } })) }]
      });
      new ResizeObserver(() => c.resize()).observe(el);
    };
    if (window.echarts) go(window.echarts);
    else { const s = document.createElement("script"); s.src = "vendor/echarts.min.js"; s.onload = () => go(window.echarts); document.head.append(s); }
  }
}

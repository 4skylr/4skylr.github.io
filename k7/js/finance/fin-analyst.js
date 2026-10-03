// Analyst layer for the two finance boards: written findings + analytical charts.
// Libraries (vendored from GitHub releases):
//   simple-statistics  github.com/simple-statistics/simple-statistics  (regression, σ, median/MAD, quantiles)
//   Apache ECharts     github.com/apache/echarts                       (already used by the boards)
const SS = "vendor/simple-statistics.min.js";
let ssP = null;
const loadSS = () => window.ss ? Promise.resolve(window.ss) : (ssP ??= new Promise((res, rej) => {
  const s = document.createElement("script"); s.src = SS; s.async = true;
  s.onload = () => res(window.ss); s.onerror = () => { ssP = null; rej(new Error(SS)); };
  document.head.append(s);
}));

const fmt = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const compact = n => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);
const pct = (n, d = 1) => `${((Number(n) || 0) * 100).toFixed(d)}%`;
const sgn = (n, d = 1) => `${n >= 0 ? "+" : "−"}${pct(Math.abs(n), d)}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const AXIS = { axisLine: { lineStyle: { color: "rgba(190,170,255,.18)" } }, axisLabel: { color: "#8f88ab", fontFamily: "JetBrains Mono Web, monospace", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(190,170,255,.07)" } } };
const TIP = { backgroundColor: "rgba(12,9,22,.95)", borderColor: "rgba(155,107,255,.45)", textStyle: { color: "#f2efff", fontSize: 12 }, extraCssText: "border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.45)" };
const LEG = { top: 0, itemGap: 16, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: "#bdb6d8", fontSize: 11 } };

const SEV = { good: "▲", warn: "◆", bad: "▼", info: "●" };
function brief(items, ar) {
  return `<ol class="an-brief">${items.map((it, i) => `<li class="an-${it.sev}">
    <span class="an-ix data">${String(i + 1).padStart(2, "0")}</span>
    <span class="an-ico" aria-hidden="true">${SEV[it.sev]}</span>
    <div><b>${it.title}</b><p>${it.text}</p></div>
    ${it.kpi ? `<em class="data" dir="ltr">${it.kpi}</em>` : ""}
  </li>`).join("")}</ol>`;
}
// each report owns its charts so the host board can dispose its own without touching these
const owned = new Map();
function makeMk(host) {
  owned.get(host)?.forEach(c => c.dispose());
  const list = []; owned.set(host, list);
  const ro = new ResizeObserver(() => list.forEach(c => c.resize()));
  ro.observe(host);
  return el => { const c = window.echarts.init(el, null, { renderer: "canvas" }); list.push(c); return c; };
}
function card(id, title, sub, extra = "") {
  return `<section class="uz-card an-card"><div class="uz-h"><div><h3>${title}</h3><p>${sub}</p></div>${extra}</div><div class="uz-chart" id="${id}"></div></section>`;
}

// ════════════════════════════════════════════════════════════
// Budget network (5 branches, weekly targets)
// ════════════════════════════════════════════════════════════
const BT = {
  en: {
    title: "Analyst report", sub: "What the numbers say this week, in plain words. Updated from the budget sheet.",
    score: "Network health", waterfall: "Where the gap comes from", waterfallSub: "YTD budget, each branch's contribution to the gap, and the actual result.",
    runrate: "Run-rate needed vs delivered", runrateSub: "Average weekly revenue over the last 8 weeks against what each branch must make per week to hit its year budget.",
    quad: "Footfall vs revenue", quadSub: "Admissions hit rate against revenue hit rate. Bubble size is YTD revenue.",
    trend: "Network trend", trendSub: "Weekly network revenue with a least-squares trend line and a 6-week projection.",
    risk: "Branch risk ranking", riskSub: "Combines hit rate, momentum, volatility and the uplift each branch still needs.",
    cols: ["#", "Branch", "Hit", "Momentum", "Volatility", "Uplift needed", "Score", "Next step"],
    budget: "Budget YTD", actual: "Actual YTD", delivered: "Last 8 wk avg", needed: "Needed / wk", trendL: "Trend", proj: "Projection", weekly: "Weekly revenue",
    q: ["Busy, spending well", "Busy, spending low", "Quiet, spending well", "Quiet, spending low"],
    act: { ok: "Hold the course", push: "Push weekday promos to lift footfall", price: "Footfall is fine; lift spend per guest (combos, upsell)", rescue: "Needs a recovery plan: footfall and spend are both short", watch: "Watch weekly; results swing a lot" }
  },
  ar: {
    title: "تقرير المحلل", sub: "ماذا تقول الأرقام هذا الأسبوع بكلام واضح. محدث من ملف الميزانية.",
    score: "صحة الشبكة", waterfall: "من أين يأتي العجز", waterfallSub: "تارجت الفترة، ومساهمة كل فرع في العجز، ثم النتيجة الفعلية.",
    runrate: "المطلوب أسبوعياً مقابل المحقق", runrateSub: "متوسط الإيراد الأسبوعي لآخر ٨ أسابيع مقابل ما يحتاجه كل فرع أسبوعياً ليصل لميزانية السنة.",
    quad: "الحضور مقابل الإيراد", quadSub: "نسبة تحقيق الحضور مقابل نسبة تحقيق الإيراد. حجم الدائرة = إيراد الفرع.",
    trend: "اتجاه الشبكة", trendSub: "الإيراد الأسبوعي للشبكة مع خط اتجاه (انحدار خطي) وتوقع ٦ أسابيع.",
    risk: "ترتيب المخاطر للفروع", riskSub: "يجمع نسبة التحقيق والزخم والتذبذب والزيادة المطلوبة لكل فرع.",
    cols: ["#", "الفرع", "التحقيق", "الزخم", "التذبذب", "الزيادة المطلوبة", "النقاط", "الخطوة التالية"],
    budget: "تارجت الفترة", actual: "الفعلي", delivered: "متوسط ٨ أسابيع", needed: "المطلوب/أسبوع", trendL: "الاتجاه", proj: "التوقع", weekly: "الإيراد الأسبوعي",
    q: ["حضور عالٍ وصرف جيد", "حضور عالٍ وصرف منخفض", "حضور قليل وصرف جيد", "حضور قليل وصرف منخفض"],
    act: { ok: "استمر على نفس الخطة", push: "عروض أيام الأسبوع لرفع الحضور", price: "الحضور جيد؛ ارفع صرف الزائر (كومبو وبيع إضافي)", rescue: "يحتاج خطة إنقاذ: الحضور والصرف كلاهما أقل", watch: "راقب أسبوعياً؛ النتائج متذبذبة" }
  }
};

export async function budgetReport(host, rows, net, ctx) {
  const ss = await loadSS().catch(() => null);
  if (!ss || !host.isConnected) return;
  const { ar, name, color } = ctx;
  const mk = makeMk(host);
  const t = BT[ar ? "ar" : "en"];

  // per-branch metrics
  const B = rows.map(b => {
    const done = b.done;
    const hits = done.filter(w => w.t > 0).map(w => w.a / w.t);
    const last4 = done.slice(-4), prev4 = done.slice(-8, -4);
    const h4 = last4.reduce((s, w) => s + w.a, 0) / (last4.reduce((s, w) => s + w.t, 0) || 1);
    const hp = prev4.reduce((s, w) => s + w.a, 0) / (prev4.reduce((s, w) => s + w.t, 0) || 1);
    const avg8 = done.slice(-8).reduce((s, w) => s + w.a, 0) / Math.max(1, done.slice(-8).length);
    const vol = hits.length > 2 ? ss.standardDeviation(hits) / (ss.mean(hits) || 1) : 0;
    const uplift = avg8 ? b.need / avg8 - 1 : 0;
    // score 0–100: hit 40, momentum 20, stability 15, uplift 25
    const score = Math.round(
      40 * Math.min(1.1, b.hit) / 1.1 +
      20 * Math.max(0, Math.min(1, .5 + (h4 - hp))) +
      15 * Math.max(0, 1 - Math.min(1, vol)) +
      25 * Math.max(0, 1 - Math.min(1, Math.max(0, uplift) / 1.5)));
    const act = b.hit >= .97 && uplift < .15 ? "ok" : (b.admHit >= .95 && b.hit < .9 ? "price" : (b.admHit < .85 && b.hit < .8 ? "rescue" : (vol > .55 ? "watch" : "push")));
    return { b, h4, hp, mom: h4 - hp, avg8, vol, uplift, score, act };
  });
  const byScore = [...B].sort((a, b) => a.score - b.score);
  const netScore = Math.round(B.reduce((s, x) => s + x.score * x.b.ytdRevActual, 0) / (net.actual || 1));
  const best = [...B].sort((a, b) => b.b.hit - a.b.hit)[0], worst = [...B].sort((a, b) => a.b.hit - b.b.hit)[0];
  const hardest = [...B].sort((a, b) => b.uplift - a.uplift)[0];
  const vola = [...B].sort((a, b) => b.vol - a.vol)[0];
  const netL4 = B.reduce((s, x) => s + x.h4 * x.b.ytdRevTarget, 0) / B.reduce((s, x) => s + x.b.ytdRevTarget, 0);
  const netP4 = B.reduce((s, x) => s + x.hp * x.b.ytdRevTarget, 0) / B.reduce((s, x) => s + x.b.ytdRevTarget, 0);
  const priceIssue = B.filter(x => x.b.admHit - x.b.hit > .12).sort((a, b) => (b.b.admHit - b.b.hit) - (a.b.admHit - a.b.hit))[0];
  const fcGap = net.forecast - net.year;

  const items = ar ? [
    { sev: net.hit >= .97 ? "good" : net.hit >= .85 ? "warn" : "bad", title: `الشبكة حققت ${pct(net.hit)} من تارجت الفترة`, text: `الفعلي ${fmt(net.actual)} ر.س مقابل ${fmt(net.target)} ر.س — العجز ${fmt(net.target - net.actual)} ر.س.`, kpi: pct(net.hit) },
    { sev: fcGap >= 0 ? "good" : "bad", title: fcGap >= 0 ? "التوقع يتجاوز ميزانية السنة" : "التوقع أقل من ميزانية السنة", text: `على وتيرة آخر ٨ أسابيع تنتهي السنة عند ${compact(net.forecast)} ر.س، أي ${pct(net.forecast / net.year)} من الميزانية (${fcGap >= 0 ? "زيادة" : "نقص"} ${compact(Math.abs(fcGap))}).`, kpi: compact(net.forecast) },
    { sev: netL4 >= netP4 ? "good" : "warn", title: netL4 >= netP4 ? "الزخم يتحسن" : "الزخم يتراجع", text: `نسبة التحقيق لآخر ٤ أسابيع ${pct(netL4)} مقابل ${pct(netP4)} للأربعة التي قبلها.`, kpi: sgn(netL4 - netP4) },
    { sev: "good", title: `الأفضل: ${name(best.b.id)}`, text: `حقق ${pct(best.b.hit)} من تارجته، بإيراد ${compact(best.b.ytdRevActual)} ر.س.`, kpi: pct(best.b.hit) },
    { sev: "bad", title: `الأضعف: ${name(worst.b.id)}`, text: `عند ${pct(worst.b.hit)} من التارجت، بعجز ${fmt(worst.b.gap)} ر.س.`, kpi: pct(worst.b.hit) },
    { sev: hardest.uplift > .5 ? "bad" : "warn", title: `${name(hardest.b.id)} يحتاج أكبر قفزة`, text: `لازم يحقق ${fmt(hardest.b.need)} ر.س أسبوعياً، بينما متوسطه الحالي ${fmt(hardest.avg8)} — أي زيادة ${pct(hardest.uplift, 0)}.`, kpi: sgn(hardest.uplift, 0) },
    priceIssue && { sev: "warn", title: `${name(priceIssue.b.id)}: الحضور جيد والصرف أقل`, text: `الحضور عند ${pct(priceIssue.b.admHit)} من التارجت لكن الإيراد ${pct(priceIssue.b.hit)} — الإيراد لكل زائر ${priceIssue.b.atp.toFixed(1)} ر.س.`, kpi: priceIssue.b.atp.toFixed(1) },
    { sev: "info", title: `الأكثر تذبذباً: ${name(vola.b.id)}`, text: `معامل التباين للتحقيق الأسبوعي ${pct(vola.vol, 0)} — النتائج تتأرجح بقوة من أسبوع لآخر.`, kpi: pct(vola.vol, 0) }
  ] : [
    { sev: net.hit >= .97 ? "good" : net.hit >= .85 ? "warn" : "bad", title: `The network is at ${pct(net.hit)} of its YTD target`, text: `${fmt(net.actual)} SAR earned against ${fmt(net.target)} SAR planned, a gap of ${fmt(net.target - net.actual)} SAR.`, kpi: pct(net.hit) },
    { sev: fcGap >= 0 ? "good" : "bad", title: fcGap >= 0 ? "Forecast beats the year budget" : "Forecast falls short of the year budget", text: `At the last 8 weeks' pace the year closes at ${compact(net.forecast)} SAR, ${pct(net.forecast / net.year)} of budget (${fcGap >= 0 ? "over" : "short"} by ${compact(Math.abs(fcGap))}).`, kpi: compact(net.forecast) },
    { sev: netL4 >= netP4 ? "good" : "warn", title: netL4 >= netP4 ? "Momentum is improving" : "Momentum is slipping", text: `Hit rate over the last 4 weeks is ${pct(netL4)}, against ${pct(netP4)} in the 4 weeks before.`, kpi: sgn(netL4 - netP4) },
    { sev: "good", title: `Best branch: ${name(best.b.id)}`, text: `${pct(best.b.hit)} of its target, with ${compact(best.b.ytdRevActual)} SAR so far.`, kpi: pct(best.b.hit) },
    { sev: "bad", title: `Weakest branch: ${name(worst.b.id)}`, text: `${pct(worst.b.hit)} of target, ${fmt(worst.b.gap)} SAR behind.`, kpi: pct(worst.b.hit) },
    { sev: hardest.uplift > .5 ? "bad" : "warn", title: `${name(hardest.b.id)} needs the biggest jump`, text: `It must make ${fmt(hardest.b.need)} SAR a week; its recent average is ${fmt(hardest.avg8)}, so it needs ${pct(hardest.uplift, 0)} more.`, kpi: sgn(hardest.uplift, 0) },
    priceIssue && { sev: "warn", title: `${name(priceIssue.b.id)}: footfall fine, spend low`, text: `Admissions are at ${pct(priceIssue.b.admHit)} of target but revenue is at ${pct(priceIssue.b.hit)}; revenue per guest is ${priceIssue.b.atp.toFixed(1)} SAR.`, kpi: priceIssue.b.atp.toFixed(1) },
    { sev: "info", title: `Most volatile: ${name(vola.b.id)}`, text: `Weekly hit rate varies by ${pct(vola.vol, 0)} (coefficient of variation), so single weeks say little.`, kpi: pct(vola.vol, 0) }
  ];

  host.innerHTML = `
    <section class="uz-card an-head">
      <div class="an-score" style="--v:${netScore}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><circle class="v" cx="60" cy="60" r="50" pathLength="100" stroke-dasharray="${netScore} 100"/></svg><b class="data">${netScore}</b><span>${t.score}</span></div>
      <div class="an-intro"><h3>${t.title}</h3><p>${t.sub}</p></div>
      ${brief(items.filter(Boolean), ar)}
    </section>
    <div class="an-grid">
      ${card("an-wf", t.waterfall, t.waterfallSub)}
      ${card("an-rr", t.runrate, t.runrateSub)}
      ${card("an-quad", t.quad, t.quadSub)}
      ${card("an-trend", t.trend, t.trendSub)}
    </div>
    <section class="uz-card an-card"><div class="uz-h"><div><h3>${t.risk}</h3><p>${t.riskSub}</p></div></div>
      <div class="an-table-wrap"><table class="fx-table an-table"><thead><tr>${t.cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>
      ${byScore.map((x, i) => `<tr><td class="data">${i + 1}</td><td><i class="an-dot" style="--c:${color(x.b.id)}"></i>${esc(name(x.b.id))}</td>
        <td class="data">${pct(x.b.hit)}</td><td class="data ${x.mom >= 0 ? "pos" : "neg"}">${sgn(x.mom)}</td><td class="data">${pct(x.vol, 0)}</td>
        <td class="data ${x.uplift > .3 ? "neg" : ""}">${x.uplift > 0 ? sgn(x.uplift, 0) : "—"}</td>
        <td><span class="an-pill" style="--s:${x.score}">${x.score}</span></td><td class="an-act">${t.act[x.act]}</td></tr>`).join("")}
      </tbody></table></div></section>`;

  // waterfall
  const gaps = rows.map(b => ({ id: b.id, v: b.ytdRevActual - b.ytdRevTarget }));
  const cats = [t.budget, ...gaps.map(g => name(g.id)), t.actual];
  let run = net.target; const base = [0], up = [net.target], down = [0];
  gaps.forEach(g => { const next = run + g.v; base.push(Math.min(run, next)); up.push(g.v > 0 ? g.v : 0); down.push(g.v < 0 ? -g.v : 0); run = next; });
  base.push(0); up.push(net.actual); down.push(0);
  mk(host.querySelector("#an-wf")).setOption({
    tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "shadow" }, formatter: ps => { const i = ps[0].dataIndex; return `<b>${cats[i]}</b><br>${i === 0 ? fmt(net.target) : i === cats.length - 1 ? fmt(net.actual) : (gaps[i - 1].v >= 0 ? "+" : "") + fmt(gaps[i - 1].v)} SAR`; } },
    grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: cats, ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: 0, rotate: 30 } }, yAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
    series: [
      { type: "bar", stack: "w", data: base, itemStyle: { color: "transparent" }, emphasis: { disabled: true } },
      { type: "bar", stack: "w", data: up.map((v, i) => ({ value: v, itemStyle: { color: i === 0 ? "#6b5ca5" : i === cats.length - 1 ? "#9b6bff" : "#4cf0a8", borderRadius: 6 } })), barMaxWidth: 34 },
      { type: "bar", stack: "w", data: down.map(v => ({ value: v, itemStyle: { color: "#ff5c7a", borderRadius: 6 } })), barMaxWidth: 34 }
    ]
  });

  // run-rate
  mk(host.querySelector("#an-rr")).setOption({
    tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "shadow" } }, legend: { ...LEG, data: [t.delivered, t.needed] },
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    yAxis: { type: "category", data: B.map(x => name(x.b.id)), ...AXIS, axisLabel: { ...AXIS.axisLabel, color: "#d9d2f2", fontSize: 11 } },
    xAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
    series: [
      { name: t.delivered, type: "bar", data: B.map(x => Math.round(x.avg8)), itemStyle: { color: "#3be7ff", borderRadius: 6 }, barGap: "20%", barMaxWidth: 14 },
      { name: t.needed, type: "bar", data: B.map(x => Math.round(x.b.need)), itemStyle: { color: "#ff4fd8", borderRadius: 6 }, barMaxWidth: 14 }
    ]
  });

  // quadrant
  mk(host.querySelector("#an-quad")).setOption({
    tooltip: { ...TIP, formatter: p => `<b>${p.data.n}</b><br>${ar ? "الحضور" : "Admissions"} ${pct(p.data.value[0])}<br>${ar ? "الإيراد" : "Revenue"} ${pct(p.data.value[1])}` },
    grid: { left: 8, right: 20, top: 16, bottom: 30, containLabel: true },
    xAxis: { type: "value", name: ar ? "تحقيق الحضور" : "Admissions hit", nameLocation: "middle", nameGap: 30, nameTextStyle: { color: "#8f88ab", fontSize: 10 }, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: v => pct(v, 0) }, min: v => Math.min(.5, v.min - .05), max: v => Math.max(1.2, v.max + .05) },
    yAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: v => pct(v, 0) }, min: v => Math.min(.3, v.min - .05), max: v => Math.max(1.15, v.max + .05) },
    series: [{
      type: "scatter", data: B.map(x => ({ n: name(x.b.id), value: [x.b.admHit, x.b.hit], symbolSize: 14 + Math.sqrt(x.b.ytdRevActual) / 45, itemStyle: { color: color(x.b.id), shadowBlur: 14, shadowColor: color(x.b.id) } })),
      label: { show: true, formatter: p => p.data.n, position: "top", color: "#e9e4ff", fontSize: 11 },
      markLine: { silent: true, symbol: "none", lineStyle: { color: "rgba(255,255,255,.25)", type: "dashed" }, data: [{ xAxis: 1 }, { yAxis: 1 }], label: { show: false } },
      markArea: { silent: true, itemStyle: { color: "rgba(76,240,168,.05)" }, data: [[{ xAxis: 1, yAxis: 1 }, { xAxis: "max", yAxis: "max" }]] }
    }]
  });

  // network trend + regression
  const weeks = rows[0].weeks.map((w, i) => ({ w: w.w, a: rows.reduce((s, b) => s + (b.weeks[i]?.a ?? 0), 0), done: rows.every(b => b.weeks[i]?.a != null) })).filter(w => w.done);
  const pts = weeks.map((w, i) => [i, w.a]);
  const reg = ss.linearRegression(pts.slice(-20)), line = ss.linearRegressionLine(reg);
  const r2 = ss.rSquared(pts.slice(-20), line);
  const labels = [...weeks.map(w => w.w.replace(/\s*\(.*\)/, "")), ...Array.from({ length: 6 }, (_, k) => `+${k + 1}`)];
  const start = Math.max(0, weeks.length - 20);
  mk(host.querySelector("#an-trend")).setOption({
    tooltip: { ...TIP, trigger: "axis" }, legend: { ...LEG, data: [t.weekly, t.trendL, t.proj] },
    grid: { left: 8, right: 12, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: labels, ...AXIS }, yAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
    graphic: [{ type: "text", right: 16, top: 30, style: { text: `R² ${r2.toFixed(2)} · ${reg.m >= 0 ? "+" : ""}${compact(reg.m)}/wk`, fill: "#8f88ab", font: "11px JetBrains Mono Web, monospace" } }],
    series: [
      { name: t.weekly, type: "bar", data: weeks.map(w => Math.round(w.a)), itemStyle: { color: "rgba(155,107,255,.55)", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 12 },
      { name: t.trendL, type: "line", data: labels.map((_, i) => i >= start && i < weeks.length ? Math.round(line(i)) : null), symbol: "none", lineStyle: { color: "#ffc857", width: 2 } },
      { name: t.proj, type: "line", data: labels.map((_, i) => i >= weeks.length - 1 ? Math.max(0, Math.round(line(i))) : null), symbol: "circle", symbolSize: 5, lineStyle: { color: "#ff4fd8", type: "dashed", width: 2 }, itemStyle: { color: "#ff4fd8" } }
    ]
  });
}

// ════════════════════════════════════════════════════════════
// Unaizah daily ledger
// ════════════════════════════════════════════════════════════
const LT = {
  en: {
    title: "Analyst report", sub: "Findings computed from every day in the ledger, with like-for-like comparisons only where both years have full data.",
    yoy: "Year on year", yoySub: "Monthly revenue 2025 vs 2026, with growth on months both years cover in full.",
    fc: "Rest-of-year forecast", fcSub: "2026 actuals, then Oct–Dec projected from last year's seasonality × this year's like-for-like growth (band = ±1σ of monthly growth).",
    anom: "Unusual days", anomSub: "Daily revenue with days flagged when they sit more than 3.5 robust z-scores from the 28-day median.",
    pareto: "Revenue concentration", paretoSub: "Share of revenue made by the best days. A steep curve means a few big days carry the year.",
    cash: "Cash control by cashier", cashSub: "Shortages and excesses per shift, from the ledger's cashier split.",
    cols: ["Cashier", "Shifts", "Revenue", "Shortage", "Excess", "Per shift", "Flag"],
    rev: "Revenue", growth: "LFL growth", actual: "Actual 2026", proj: "Projection", band: "Range", spike: "Spike", dip: "Dip", median: "28-day median", cum: "Cumulative share", even: "Even split",
    clean: "Clean", watch: "Watch", review: "Review"
  },
  ar: {
    title: "تقرير المحلل", sub: "نتائج محسوبة من كل يوم في السجل، والمقارنة السنوية فقط على الأشهر المكتملة في السنتين.",
    yoy: "مقارنة سنوية", yoySub: "إيراد كل شهر ٢٠٢٥ مقابل ٢٠٢٦، والنمو على الأشهر المكتملة في السنتين.",
    fc: "توقع باقي السنة", fcSub: "فعلي ٢٠٢٦ ثم أكتوبر–ديسمبر متوقعة من موسمية السنة الماضية × نمو هذه السنة (النطاق = ±١σ من نمو الأشهر).",
    anom: "أيام غير عادية", anomSub: "الإيراد اليومي مع تمييز الأيام البعيدة أكثر من ٣٫٥ انحراف (robust z) عن وسيط ٢٨ يوم.",
    pareto: "تركّز الإيراد", paretoSub: "نصيب أفضل الأيام من الإيراد. كلما كان المنحنى حاداً، كانت أيام قليلة تحمل السنة.",
    cash: "ضبط الكاش حسب الكاشير", cashSub: "العجز والزيادة لكل وردية، من تقسيم الكاشير في السجل.",
    cols: ["الكاشير", "الورديات", "الإيراد", "العجز", "الزيادة", "لكل وردية", "الحالة"],
    rev: "الإيراد", growth: "النمو المماثل", actual: "فعلي ٢٠٢٦", proj: "التوقع", band: "النطاق", spike: "ارتفاع", dip: "هبوط", median: "وسيط ٢٨ يوم", cum: "النصيب التراكمي", even: "توزيع متساوٍ",
    clean: "سليم", watch: "راقب", review: "مراجعة"
  }
};
const MONTHS = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"] };
const WD = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] };
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

export async function ledgerReport(host, days, ctx) {
  const ss = await loadSS().catch(() => null);
  if (!ss || !host.isConnected) return;
  const { ar } = ctx;
  const mk = makeMk(host);
  const t = LT[ar ? "ar" : "en"], MN = MONTHS[ar ? "ar" : "en"];
  const last = days[days.length - 1].date, Y = +last.slice(0, 4), PY = Y - 1;

  // monthly totals + coverage
  const mon = {};
  days.forEach(d => { const k = d.date.slice(0, 7); (mon[k] ??= { rev: 0, n: 0, digital: 0, delivery: 0 }); mon[k].rev += d.total; mon[k].n++; mon[k].digital += (d.card || 0) + (d.online || 0) + (d.prepaid || 0); mon[k].delivery += (d.jahez || 0) + (d.hunger || 0); });
  const key = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const full = (y, m) => (mon[key(y, m)]?.n || 0) >= daysIn(y, m) * .9;
  const lfl = [...Array(12).keys()].filter(m => full(Y, m) && full(PY, m));
  const lflNow = lfl.reduce((s, m) => s + mon[key(Y, m)].rev, 0), lflPrev = lfl.reduce((s, m) => s + mon[key(PY, m)].rev, 0);
  const lflG = lflPrev ? lflNow / lflPrev - 1 : null;
  const mg = lfl.map(m => mon[key(Y, m)].rev / mon[key(PY, m)].rev - 1);
  const gSd = mg.length > 1 ? ss.standardDeviation(mg) : .2;

  // last complete month vs the one before
  const lastM = +last.slice(5, 7) - 1, lastFull = full(Y, lastM) ? lastM : lastM - 1;
  const mom = mon[key(Y, lastFull)] && mon[key(Y, lastFull - 1)] ? mon[key(Y, lastFull)].rev / mon[key(Y, lastFull - 1)].rev - 1 : null;

  // forecast rest of year
  const ytd = days.filter(d => d.date.startsWith(String(Y))).reduce((s, d) => s + d.total, 0);
  const restM = [...Array(12).keys()].filter(m => m > lastM);
  const g = lflG ?? 0;
  const fcM = restM.map(m => { const base = mon[key(PY, m)]?.rev || 0; return { m, mid: base * (1 + g), lo: base * (1 + g - gSd), hi: base * (1 + g + gSd) }; });
  const fcYear = ytd + fcM.reduce((s, x) => s + x.mid, 0);

  // trend: last 90 days regression
  const recent = days.slice(-90), pts = recent.map((d, i) => [i, d.total]);
  const reg = ss.linearRegression(pts), avg90 = ss.mean(recent.map(d => d.total));
  const trendM = avg90 ? reg.m * 30 / avg90 : 0;

  // weekday effect (this year)
  const yrDays = days.filter(d => d.date.startsWith(String(Y)));
  const wd = Array.from({ length: 7 }, (_, i) => { const v = yrDays.filter(d => new Date(d.date + "T00:00:00").getDay() === i).map(d => d.total); return v.length ? ss.mean(v) : 0; });
  const wBest = wd.indexOf(Math.max(...wd)), wWorst = wd.indexOf(Math.min(...wd.filter(v => v > 0)));

  // anomalies: robust z vs rolling 28-day median
  const anomalies = [];
  const medLine = days.map((d, i) => {
    const win = days.slice(Math.max(0, i - 27), i + 1).map(x => x.total);
    const med = ss.median(win), mad = ss.medianAbsoluteDeviation(win) || 1;
    const z = .6745 * (d.total - med) / mad;
    if (i >= 14 && Math.abs(z) > 3.5) anomalies.push({ i, d, z, med });
    return med;
  });
  const yrAnom = anomalies.filter(a => a.d.date.startsWith(String(Y)));
  const topSpike = [...yrAnom].sort((a, b) => b.z - a.z)[0];

  // concentration
  const sorted = yrDays.map(d => d.total).sort((a, b) => b - a), sumY = sorted.reduce((a, b) => a + b, 0);
  const top10n = Math.max(1, Math.round(sorted.length * .1)), top10 = sorted.slice(0, top10n).reduce((a, b) => a + b, 0) / (sumY || 1);

  // digital mix shift
  const dig = (y, ms) => { const r = ms.reduce((s, m) => s + (mon[key(y, m)]?.rev || 0), 0); return r ? ms.reduce((s, m) => s + (mon[key(y, m)]?.digital || 0) + (mon[key(y, m)]?.delivery || 0), 0) / r : null; };
  const digNow = dig(Y, lfl), digPrev = dig(PY, lfl);

  const items = (ar ? [
    lflG != null && { sev: lflG >= 0 ? "good" : "bad", title: `النمو المماثل ${sgn(lflG)} عن ${PY}`, text: `على ${lfl.length} أشهر مكتملة في السنتين (${lfl.map(m => MN[m]).join("، ")}): ${compact(lflNow)} مقابل ${compact(lflPrev)} ر.س.`, kpi: sgn(lflG) },
    { sev: fcYear >= (ytd / (lastM + 1)) * 12 * .95 ? "good" : "info", title: `توقع ${Y} ≈ ${compact(fcYear)} ر.س`, text: `المحقق حتى الآن ${compact(ytd)}، والباقي متوقع ${compact(fcYear - ytd)} لـ ${restM.map(m => MN[m]).join("، ")} (نطاق ${compact(ytd + fcM.reduce((s, x) => s + x.lo, 0))}–${compact(ytd + fcM.reduce((s, x) => s + x.hi, 0))}).`, kpi: compact(fcYear) },
    mom != null && { sev: mom >= 0 ? "good" : "warn", title: `${MN[lastFull]} ${mom >= 0 ? "أعلى" : "أقل"} من ${MN[lastFull - 1]} بـ ${pct(Math.abs(mom))}`, text: `${compact(mon[key(Y, lastFull)].rev)} مقابل ${compact(mon[key(Y, lastFull - 1)].rev)} ر.س.`, kpi: sgn(mom) },
    { sev: trendM >= 0 ? "good" : "warn", title: trendM >= 0 ? "الاتجاه لآخر ٩٠ يوم صاعد" : "الاتجاه لآخر ٩٠ يوم هابط", text: `خط الانحدار يميل ${sgn(trendM)} شهرياً من متوسط ${fmt(avg90)} ر.س يومياً.`, kpi: sgn(trendM) },
    { sev: "info", title: `${WD.ar[wBest]} أقوى يوم و${WD.ar[wWorst]} الأضعف`, text: `متوسط ${WD.ar[wBest]} ${fmt(wd[wBest])} ر.س مقابل ${fmt(wd[wWorst])} — فرق ${pct(wd[wBest] / wd[wWorst] - 1, 0)}.`, kpi: `×${(wd[wBest] / wd[wWorst]).toFixed(1)}` },
    { sev: top10 > .35 ? "warn" : "info", title: `أفضل ١٠٪ من الأيام = ${pct(top10, 0)} من الإيراد`, text: `${top10n} يوم فقط صنعت ${pct(top10, 0)} من إيراد ${Y} — المواسم والأفلام الكبيرة تقود السنة.`, kpi: pct(top10, 0) },
    topSpike && { sev: "info", title: `${yrAnom.length} يوم غير عادي هذه السنة`, text: `أكبرها ${topSpike.d.date}: ${fmt(topSpike.d.total)} ر.س مقابل وسيط ${fmt(topSpike.med)}.`, kpi: String(yrAnom.length) },
    digNow != null && digPrev != null && { sev: "info", title: `الدفع الرقمي ${pct(digNow)} من الإيراد`, text: `كان ${pct(digPrev)} في نفس الأشهر من ${PY} (${sgn(digNow - digPrev)} نقطة).`, kpi: pct(digNow, 0) },
  ] : [
    lflG != null && { sev: lflG >= 0 ? "good" : "bad", title: `Like-for-like growth ${sgn(lflG)} vs ${PY}`, text: `Over the ${lfl.length} months both years cover in full (${lfl.map(m => MN[m]).join(", ")}): ${compact(lflNow)} against ${compact(lflPrev)} SAR.`, kpi: sgn(lflG) },
    { sev: "info", title: `${Y} is heading for about ${compact(fcYear)} SAR`, text: `${compact(ytd)} banked so far; ${compact(fcYear - ytd)} expected across ${restM.map(m => MN[m]).join(", ")} (range ${compact(ytd + fcM.reduce((s, x) => s + x.lo, 0))}–${compact(ytd + fcM.reduce((s, x) => s + x.hi, 0))}).`, kpi: compact(fcYear) },
    mom != null && { sev: mom >= 0 ? "good" : "warn", title: `${MN[lastFull]} was ${pct(Math.abs(mom))} ${mom >= 0 ? "above" : "below"} ${MN[lastFull - 1]}`, text: `${compact(mon[key(Y, lastFull)].rev)} against ${compact(mon[key(Y, lastFull - 1)].rev)} SAR.`, kpi: sgn(mom) },
    { sev: trendM >= 0 ? "good" : "warn", title: trendM >= 0 ? "The 90-day trend is rising" : "The 90-day trend is falling", text: `The regression line moves ${sgn(trendM)} a month from an average of ${fmt(avg90)} SAR a day.`, kpi: sgn(trendM) },
    { sev: "info", title: `${WD.en[wBest]} is the strongest day, ${WD.en[wWorst]} the weakest`, text: `${WD.en[wBest]} averages ${fmt(wd[wBest])} SAR against ${fmt(wd[wWorst])}, a ${pct(wd[wBest] / wd[wWorst] - 1, 0)} gap.`, kpi: `×${(wd[wBest] / wd[wWorst]).toFixed(1)}` },
    { sev: top10 > .35 ? "warn" : "info", title: `The best 10% of days made ${pct(top10, 0)} of revenue`, text: `${top10n} days carried ${pct(top10, 0)} of ${Y} revenue: holidays and big releases drive the year.`, kpi: pct(top10, 0) },
    topSpike && { sev: "info", title: `${yrAnom.length} unusual days this year`, text: `The biggest was ${topSpike.d.date}: ${fmt(topSpike.d.total)} SAR against a median of ${fmt(topSpike.med)}.`, kpi: String(yrAnom.length) },
    digNow != null && digPrev != null && { sev: "info", title: `Digital payments are ${pct(digNow)} of revenue`, text: `They were ${pct(digPrev)} over the same months of ${PY} (${sgn(digNow - digPrev)} points).`, kpi: pct(digNow, 0) },
  ]).filter(Boolean);

  host.innerHTML = `
    <section class="uz-card an-head">
      <div class="an-intro"><h3>${t.title}</h3><p>${t.sub}</p></div>
      ${brief(items, ar)}
    </section>
    <div class="an-grid">
      ${card("an-yoy", t.yoy, t.yoySub)}
      ${card("an-fc", t.fc, t.fcSub)}
      ${card("an-anom", t.anom, t.anomSub)}
      ${card("an-par", t.pareto, t.paretoSub)}
    </div>`;

  // YoY monthly
  const yrs = [PY, Y];
  mk(host.querySelector("#an-yoy")).setOption({
    tooltip: { ...TIP, trigger: "axis" }, legend: { ...LEG, data: [String(PY), String(Y), t.growth] },
    grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: MN, ...AXIS }, yAxis: [{ type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } }, { type: "value", ...AXIS, splitLine: { show: false }, axisLabel: { ...AXIS.axisLabel, formatter: v => pct(v, 0) } }],
    series: [
      ...yrs.map((y, k) => ({ name: String(y), type: "bar", barMaxWidth: 14, itemStyle: { color: k ? "#ff4fd8" : "rgba(155,107,255,.55)", borderRadius: [4, 4, 0, 0] }, data: MN.map((_, m) => full(y, m) ? Math.round(mon[key(y, m)].rev) : (mon[key(y, m)] ? { value: Math.round(mon[key(y, m)].rev), itemStyle: { opacity: .35 } } : null)) })),
      { name: t.growth, type: "line", yAxisIndex: 1, data: MN.map((_, m) => lfl.includes(m) ? +(mon[key(Y, m)].rev / mon[key(PY, m)].rev - 1).toFixed(3) : null), connectNulls: false, symbol: "circle", symbolSize: 7, lineStyle: { color: "#4cf0a8", width: 2 }, itemStyle: { color: "#4cf0a8" } }
    ]
  });

  // forecast fan
  const act = MN.map((_, m) => m <= lastM && mon[key(Y, m)] ? Math.round(mon[key(Y, m)].rev) : null);
  const mid = MN.map((_, m) => { const f = fcM.find(x => x.m === m); return f ? Math.round(f.mid) : (m === lastM ? act[m] : null); });
  const lo = MN.map((_, m) => { const f = fcM.find(x => x.m === m); return f ? Math.round(f.lo) : (m === lastM ? act[m] : null); });
  const hi = MN.map((_, m) => { const f = fcM.find(x => x.m === m); return f ? Math.round(f.hi - f.lo) : (m === lastM ? 0 : null); });
  mk(host.querySelector("#an-fc")).setOption({
    tooltip: { ...TIP, trigger: "axis" }, legend: { ...LEG, data: [t.actual, t.proj] },
    grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: MN, boundaryGap: false, ...AXIS }, yAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
    series: [
      { name: "lo", type: "line", data: lo, stack: "band", symbol: "none", lineStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: t.band, type: "line", data: hi, stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(255,79,216,.16)" }, tooltip: { show: false } },
      { name: t.actual, type: "line", data: act, symbol: "circle", symbolSize: 6, lineStyle: { color: "#3be7ff", width: 2.5 }, itemStyle: { color: "#3be7ff" }, areaStyle: { color: "rgba(59,231,255,.08)" } },
      { name: t.proj, type: "line", data: mid, symbol: "circle", symbolSize: 6, lineStyle: { color: "#ff4fd8", width: 2.5, type: "dashed" }, itemStyle: { color: "#ff4fd8" } }
    ]
  });

  // anomalies (this year)
  const yi = days.findIndex(d => d.date.startsWith(String(Y)));
  const sl = days.slice(yi), medS = medLine.slice(yi);
  mk(host.querySelector("#an-anom")).setOption({
    tooltip: { ...TIP, trigger: "axis" }, legend: { ...LEG, data: [t.rev, t.median, t.spike, t.dip] },
    grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: sl.map(d => d.date.slice(5)), ...AXIS }, yAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
    dataZoom: [{ type: "inside" }],
    series: [
      { name: t.rev, type: "line", data: sl.map(d => Math.round(d.total)), symbol: "none", lineStyle: { color: "rgba(190,170,255,.6)", width: 1.2 } },
      { name: t.median, type: "line", data: medS.map(Math.round), symbol: "none", lineStyle: { color: "#ffc857", width: 2 } },
      { name: t.spike, type: "scatter", symbolSize: 11, itemStyle: { color: "#4cf0a8", shadowBlur: 10, shadowColor: "#4cf0a8" }, data: yrAnom.filter(a => a.z > 0).map(a => [a.i - yi, Math.round(a.d.total)]) },
      { name: t.dip, type: "scatter", symbolSize: 11, itemStyle: { color: "#ff5c7a", shadowBlur: 10, shadowColor: "#ff5c7a" }, data: yrAnom.filter(a => a.z < 0).map(a => [a.i - yi, Math.round(a.d.total)]) }
    ]
  });

  // pareto
  let c = 0; const cum = sorted.map(v => (c += v) / (sumY || 1));
  const N = cum.length;
  mk(host.querySelector("#an-par")).setOption({
    tooltip: { ...TIP, trigger: "axis", formatter: ps => `${ar ? "أفضل" : "Top"} ${pct((ps[0].dataIndex + 1) / N, 0)} ${ar ? "من الأيام" : "of days"}<br><b>${pct(ps[0].value[1], 0)}</b> ${ar ? "من الإيراد" : "of revenue"}` },
    grid: { left: 8, right: 12, top: 34, bottom: 8, containLabel: true }, legend: { ...LEG, data: [t.cum, t.even] },
    xAxis: { type: "value", max: 1, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: v => pct(v, 0) } }, yAxis: { type: "value", max: 1, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: v => pct(v, 0) } },
    series: [
      { name: t.cum, type: "line", data: cum.map((v, i) => [(i + 1) / N, +v.toFixed(4)]), symbol: "none", lineStyle: { color: "#ff4fd8", width: 2.5 }, areaStyle: { color: "rgba(255,79,216,.12)" },
        markPoint: { symbol: "circle", symbolSize: 10, itemStyle: { color: "#ffc857" }, label: { show: true, position: "right", color: "#ffc857", fontSize: 11, formatter: `${pct(top10, 0)}` }, data: [{ coord: [top10n / N, +top10.toFixed(4)] }] } },
      { name: t.even, type: "line", data: [[0, 0], [1, 1]], symbol: "none", lineStyle: { color: "rgba(255,255,255,.25)", type: "dashed" } }
    ]
  });
}

// Cashier cash control for the locked audit panel (not shown on the open page).
export function cashierAudit(days, year) {
  const cz = new Map();
  days.filter(d => !year || d.date.startsWith(String(year))).forEach(d => {
    const shortDay = d.shortage || 0, exDay = d.excess || 0, totDay = d.total || 1;
    (d.cashiers || []).forEach(c => {
      if (/kiosk|unpunch/i.test(c.user)) return;
      const o = cz.get(c.user) || { user: c.user, shifts: 0, rev: 0, short: 0, ex: 0 };
      o.shifts++; o.rev += c.total || 0;
      o.short += c.shortage ?? shortDay * ((c.total || 0) / totDay);
      o.ex += c.excess ?? exDay * ((c.total || 0) / totDay);
      cz.set(c.user, o);
    });
  });
  return [...cz.values()].filter(c => c.shifts >= 3).sort((a, b) => b.short - a.short);
}

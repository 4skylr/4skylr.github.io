// Branch network budget. Every branch is a node; "All branches" is the root view.
// Libraries (vendored from GitHub releases): apache/echarts, inorganik/countUp.js
const LIBS = { echarts: "vendor/echarts.min.js", countup: "vendor/countUp.umd.js" };
const lang = () => sessionStorage.getItem("noir-lang") || "en";

const BRANCH = {
  hafar:   { en: "Hafar Al-Batin", ar: "حفر الباطن", code: "HFR", color: "#9b6bff" },
  khafji:  { en: "Khafji",         ar: "الخفجي",     code: "KHF", color: "#3be7ff" },
  unaizah: { en: "Unaizah",        ar: "عنيزة",      code: "UNZ", color: "#ff4fd8" },
  dammam:  { en: "Dammam",         ar: "الدمام",     code: "DMM", color: "#ffc857" },
  mithnab: { en: "Mithnab",        ar: "المذنب",     code: "MTN", color: "#4cf0a8" }
};
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const T = {
  en: {
    root: "All branches", network: "Noir network", nodes: "nodes", asOf: "as of", week: "week",
    ytd: "Network revenue · YTD", ofTarget: "of YTD target", gap: "Gap to target", ahead: "Ahead of target",
    year: "Year budget", timeUsed: "Year elapsed", revDone: "Budget earned", forecast: "Year-end forecast", forecastNote: "remaining target × hit rate of the last 8 weeks",
    hit: "Hit rate", adm: "Admissions", atp: "Revenue / admission", need: "Needed / week", lastWeek: "Last week", left: "Left this year",
    status: { ahead: "Ahead", track: "On track", behind: "Behind", risk: "At risk" },
    burn: "Burn-up", burnSub: "Cumulative revenue against the cumulative budget, with the run-rate forecast to 31 Dec.",
    pace: "Pace by branch", paceSub: "Cumulative hit rate week by week — above 100% means the branch is ahead of its plan.",
    matrix: "Performance matrix", matrixSub: "Weekly hit rate for every branch. Green beat the week's target, red missed it.",
    months: "Monthly actual vs target", monthsSub: "Budget weeks mapped to calendar months (split weeks follow their dates).",
    share: "Revenue share", shareSub: "Each branch's slice of network revenue this year.",
    table: "Branch ledger", weekly: "Weekly result", weeklySub: "Actual revenue per budget week against the week's target, with a 4-week average.",
    monthTable: "Monthly statement", actual: "Actual", target: "Target", variance: "Variance", cumulative: "Cumulative",
    cols: { branch: "Branch", hit: "Hit", actual: "Actual YTD", target: "Target YTD", gap: "Gap", adm: "Admissions", atp: "Rev/adm", need: "Need / wk", fc: "Forecast", month: "Month", weeks: "Weeks" },
    sar: "SAR", avg4: "4-wk avg", open: "Open branch"
  },
  ar: {
    root: "كل الفروع", network: "شبكة نوار", nodes: "فروع", asOf: "حتى", week: "أسبوع",
    ytd: "إيراد الشبكة · منذ بداية السنة", ofTarget: "من تارجت الفترة", gap: "العجز عن التارجت", ahead: "متقدم على التارجت",
    year: "ميزانية السنة", timeUsed: "مضى من السنة", revDone: "تحقق من الميزانية", forecast: "توقع نهاية السنة", forecastNote: "التارجت المتبقي × نسبة التحقيق لآخر ٨ أسابيع",
    hit: "نسبة التحقيق", adm: "الحضور", atp: "الإيراد لكل زائر", need: "المطلوب أسبوعياً", lastWeek: "آخر أسبوع", left: "باقي السنة",
    status: { ahead: "متقدم", track: "على المسار", behind: "متأخر", risk: "خطر" },
    burn: "منحنى الإنجاز", burnSub: "الإيراد التراكمي مقابل الميزانية التراكمية، مع توقع نهاية السنة.",
    pace: "سرعة كل فرع", paceSub: "نسبة التحقيق التراكمية أسبوعاً بأسبوع — فوق ١٠٠٪ يعني الفرع متقدم على خطته.",
    matrix: "مصفوفة الأداء", matrixSub: "نسبة تحقيق كل أسبوع لكل فرع. الأخضر تجاوز تارجت الأسبوع والأحمر لم يصل.",
    months: "الشهري: الفعلي مقابل التارجت", monthsSub: "أسابيع الميزانية موزعة على الأشهر حسب تواريخها.",
    share: "حصة الإيراد", shareSub: "نصيب كل فرع من إيراد الشبكة هذه السنة.",
    table: "سجل الفروع", weekly: "النتيجة الأسبوعية", weeklySub: "الإيراد الفعلي لكل أسبوع مقابل تارجت الأسبوع، مع متوسط ٤ أسابيع.",
    monthTable: "القائمة الشهرية", actual: "الفعلي", target: "التارجت", variance: "الفرق", cumulative: "التراكمي",
    cols: { branch: "الفرع", hit: "التحقيق", actual: "الفعلي", target: "التارجت", gap: "العجز", adm: "الحضور", atp: "إيراد/زائر", need: "مطلوب/أسبوع", fc: "التوقع", month: "الشهر", weeks: "الأسابيع" },
    sar: "ر.س", avg4: "متوسط ٤ أسابيع", open: "فتح الفرع"
  }
};

const fmt = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const compact = n => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(Number(n) || 0);
const pct = (n, d = 1) => `${((Number(n) || 0) * 100).toFixed(d)}%`;
const monthName = (m, ar) => new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", { month: "short" }).format(new Date(2026, m, 1));

const loaded = {};
const load = src => (loaded[src] ||= new Promise((res, rej) => {
  const s = document.createElement("script");
  s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error(`Could not load ${src}`)); };
  document.head.append(s);
}));

let charts = [];
let observer = null;
let renderId = 0;
function dispose() { charts.forEach(c => c.dispose()); charts = []; observer?.disconnect(); }

const AXIS = { axisLine: { lineStyle: { color: "rgba(190,170,255,.18)" } }, axisLabel: { color: "#7f789c", fontFamily: "Martian Mono, monospace", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(190,170,255,.07)" } } };
const TIP = { backgroundColor: "rgba(12,9,22,.94)", borderColor: "rgba(155,107,255,.45)", textStyle: { color: "#f2efff", fontSize: 12 }, extraCssText: "backdrop-filter:blur(10px);border-radius:12px;box-shadow:0 10px 40px rgba(155,107,255,.25)" };

const weekNo = label => parseInt(label.match(/\d+/)?.[0] || "0", 10);

// Budget weeks start on 1 Jan; split weeks name their own month, e.g. "W5 (1st to 4th Feb)".
function weekMonth(label) {
  const m = label.match(/\(([^)]*)\)/);
  if (m) {
    const words = m[1].toLowerCase().match(/[a-z]+/g) || [];
    for (let i = words.length - 1; i >= 0; i--) {
      const k = MONTH_KEYS.indexOf(words[i].slice(0, 3));
      if (k >= 0) return k;
    }
  }
  const n = weekNo(label) || 1;
  const d = new Date(2026, 0, 1 + (n - 1) * 7);
  return d.getFullYear() > 2026 ? 11 : d.getMonth();
}

function model(b) {
  const weeks = b.weeks.map((w, i) => ({ ...w, i, n: weekNo(w.w), m: weekMonth(w.w) }));
  const done = weeks.filter(w => w.a != null);
  const rest = weeks.filter(w => w.a == null);
  let ca = 0, ct = 0;
  done.forEach(w => { ca += w.a; ct += w.t; w.ca = ca; w.ct = ct; });
  const recent = done.slice(-8);
  const recentHit = recent.reduce((s, w) => s + w.a, 0) / (recent.reduce((s, w) => s + w.t, 0) || 1);
  const restTarget = rest.reduce((s, w) => s + w.t, 0);
  const restWeeks = new Set(rest.map(w => w.n)).size || 1;
  const forecast = b.ytdRevActual + restTarget * recentHit;
  const hit = b.ytdRevActual / (b.ytdRevTarget || 1);
  const last = done[done.length - 1];
  const status = hit >= 1 ? "ahead" : hit >= .9 ? "track" : hit >= .7 ? "behind" : "risk";
  return {
    ...b, weeks, done, rest, recentHit, forecast, hit, status, last,
    gap: b.ytdRevTarget - b.ytdRevActual,
    left: b.yearRev - b.ytdRevActual,
    need: Math.max(0, (b.yearRev - b.ytdRevActual) / restWeeks),
    atp: b.ytdAdmActual ? b.ytdRevActual / b.ytdAdmActual : 0,
    admHit: b.ytdAdmActual / (b.ytdAdmTarget || 1),
    months: MONTH_KEYS.map((_, m) => {
      const ws = weeks.filter(w => w.m === m);
      const d = ws.filter(w => w.a != null);
      return { m, t: ws.reduce((s, w) => s + w.t, 0), a: d.length ? d.reduce((s, w) => s + w.a, 0) : null, tDone: d.reduce((s, w) => s + w.t, 0), weeks: ws.length };
    })
  };
}

function ring(value, color, size = 84) {
  const r = 34, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return `<svg class="fx-ring" viewBox="0 0 84 84" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="7"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)" style="filter:drop-shadow(0 0 6px ${color})"/>
    ${value > 1 ? `<circle cx="42" cy="42" r="${r - 10}" fill="none" stroke="${color}" stroke-opacity=".5" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * (r - 10) * Math.min(1, value - 1)).toFixed(1)} 999" transform="rotate(-90 42 42)"/>` : ""}
  </svg>`;
}

export async function renderFinance(root) {
  const id = ++renderId;
  dispose();
  const ar = lang() === "ar", t = T[ar ? "ar" : "en"];
  const name = id => BRANCH[id]?.[ar ? "ar" : "en"] || id;
  root.innerHTML = `<div class="uz-loading"><i></i><span>${ar ? "مزامنة الفروع…" : "Syncing branches…"}</span></div>`;
  let data;
  try {
    [data] = await Promise.all([
      fetch("finance/budget-2026.json?v=64").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      load(LIBS.echarts), load(LIBS.countup)
    ]);
  } catch (e) {
    root.innerHTML = `<div class="uz-error">${ar ? "تعذر تحميل الميزانية." : "Could not load the budget."} <small>${e.message}</small></div>`;
    return;
  }
  if (id !== renderId || !root.isConnected) return; // a newer render took over while this one was loading
  const echarts = window.echarts;
  const rows = data.branches.map(model);
  const net = {
    actual: rows.reduce((s, b) => s + b.ytdRevActual, 0), target: rows.reduce((s, b) => s + b.ytdRevTarget, 0),
    year: rows.reduce((s, b) => s + b.yearRev, 0), forecast: rows.reduce((s, b) => s + b.forecast, 0),
    adm: rows.reduce((s, b) => s + b.ytdAdmActual, 0), admT: rows.reduce((s, b) => s + b.ytdAdmTarget, 0),
    need: rows.reduce((s, b) => s + b.need, 0), left: rows.reduce((s, b) => s + b.left, 0)
  };
  net.hit = net.actual / net.target;
  const asOf = rows[0]?.asOf || "";
  const timeUsed = net.target / net.year;
  let pick = sessionStorage.getItem("fx-branch") || "all";
  if (pick !== "all" && !rows.some(b => b.id === pick)) pick = "all";

  root.innerHTML = `
  <section class="uz fx" dir="${ar ? "rtl" : "ltr"}">
    <header class="uz-hero fx-hero">
      <div class="fx-hero-top">
        <div class="uz-id">
          <div class="fx-root-node"><span></span><i></i><i></i><i></i><i></i><i></i></div>
          <div>
            <p class="uz-net"><i></i>${t.network} · ${rows.length} ${t.nodes} · ${asOf}</p>
            <p class="uz-addr data">${t.asOf} ${data.asOf}</p>
          </div>
        </div>
        <nav class="fx-chips" id="fx-chips">
          <button type="button" data-b="all" class="root">${t.root}</button>
          ${rows.map(b => `<button type="button" data-b="${b.id}" style="--c:${BRANCH[b.id]?.color}"><i></i>${name(b.id)}</button>`).join("")}
        </nav>
      </div>
      <div id="fx-hero-body"></div>
    </header>
    <div id="fx-analyst" class="an-host"></div>
    <div id="fx-body"></div>
  </section>`;

  const $ = s => root.querySelector(s);
  observer = new ResizeObserver(() => charts.forEach(c => c.resize()));
  observer.observe(root);
  const mk = el => { const c = echarts.init(el, null, { renderer: "canvas" }); charts.push(c); return c; };

  function heroHtml(o) {
    const over = o.actual >= o.target;
    return `
      <div class="fx-hero-grid">
        <div class="uz-vault">
          <p>${o.label}</p>
          <div class="uz-vault-row"><b class="data" id="fx-total">0</b><span class="uz-cur">${t.sar}</span>
            <span class="uz-delta ${over ? "up" : "down"}">${pct(o.hit)} ${t.ofTarget}</span></div>
          <div class="fx-progress">
            <div><span>${t.revDone}</span><b class="data">${pct(o.actual / o.year)}</b></div>
            <div class="fx-track"><i class="rev" style="width:${Math.min(100, o.actual / o.year * 100)}%"></i><em style="inset-inline-start:${Math.min(100, o.timeUsed * 100)}%" title="${t.timeUsed}"></em></div>
            <div class="fx-progress-foot"><span><i class="dot rev"></i>${t.revDone}</span><span><i class="dot time"></i>${t.timeUsed} ${pct(o.timeUsed)}</span><span class="data">${t.year}: ${compact(o.year)}</span></div>
          </div>
        </div>
        <div class="fx-hero-side">
          <article><p>${over ? t.ahead : t.gap}</p><b class="data ${over ? "pos" : "neg"}">${fmt(Math.abs(o.target - o.actual))}</b></article>
          <article><p>${t.forecast}</p><b class="data">${compact(o.forecast)}</b><small>${pct(o.forecast / o.year)} · ${t.forecastNote}</small></article>
          <article><p>${t.need}</p><b class="data">${fmt(o.need)}</b><small>${t.left}: ${compact(o.left)}</small></article>
          <article><p>${t.adm}</p><b class="data">${fmt(o.adm)}</b><small>${pct(o.adm / (o.admT || 1))} · ${t.atp} ${o.adm ? (o.actual / o.adm).toFixed(1) : "—"}</small></article>
        </div>
      </div>`;
  }

  function count(total) {
    const CU = window.countUp?.CountUp;
    const el = $("#fx-total");
    if (!CU || !el) { if (el) el.textContent = fmt(total); return; }
    const c = new CU(el, Math.round(total), { duration: 1.3, separator: "," });
    c.error ? (el.textContent = fmt(total)) : c.start();
  }

  // ── root: whole network ──
  function paintAll() {
    $("#fx-hero-body").innerHTML = heroHtml({ label: t.ytd, actual: net.actual, target: net.target, year: net.year, hit: net.hit, forecast: net.forecast, need: net.need, left: net.left, adm: net.adm, admT: net.admT, timeUsed });
    count(net.actual);
    const ranked = rows.slice().sort((a, b) => b.hit - a.hit);
    $("#fx-body").innerHTML = `
      <div class="fx-nodes">${ranked.map((b, i) => {
        const c = BRANCH[b.id]?.color || "#9b6bff";
        const lw = b.last ? b.last.a / (b.last.t || 1) : 0;
        return `<button type="button" class="fx-node" data-b="${b.id}" style="--c:${c}" aria-label="${t.open}: ${name(b.id)}">
          <div class="fx-node-top"><span class="fx-rank data">#${i + 1}</span><span class="fx-code data">${BRANCH[b.id]?.code || b.id}</span><span class="fx-status s-${b.status}">${t.status[b.status]}</span></div>
          <div class="fx-node-mid">${ring(b.hit, c)}<div class="fx-ring-label"><b class="data">${pct(b.hit, 0)}</b><small>${t.hit}</small></div>
            <div class="fx-node-id"><h4>${name(b.id)}</h4><b class="data">${compact(b.ytdRevActual)}</b><small class="data">/ ${compact(b.ytdRevTarget)}</small></div></div>
          <dl class="fx-node-stats">
            <div><dt>${b.gap > 0 ? t.gap : t.ahead}</dt><dd class="data ${b.gap > 0 ? "neg" : "pos"}">${compact(Math.abs(b.gap))}</dd></div>
            <div><dt>${t.lastWeek}</dt><dd class="data ${lw >= 1 ? "pos" : "neg"}">${pct(lw, 0)}</dd></div>
            <div><dt>${t.forecast}</dt><dd class="data">${pct(b.forecast / b.yearRev, 0)}</dd></div>
            <div><dt>${t.atp}</dt><dd class="data">${b.atp.toFixed(1)}</dd></div>
          </dl>
        </button>`;
      }).join("")}</div>

      <section class="uz-card"><div class="uz-h"><div><h3>${t.burn}</h3><p>${t.burnSub}</p></div></div><div class="uz-chart xl" id="fx-burn"></div></section>
      <div class="uz-two">
        <section class="uz-card"><div class="uz-h"><div><h3>${t.pace}</h3><p>${t.paceSub}</p></div></div><div class="uz-chart" id="fx-pace"></div></section>
        <section class="uz-card"><div class="uz-h"><div><h3>${t.share}</h3><p>${t.shareSub}</p></div></div><div class="uz-chart" id="fx-share"></div></section>
      </div>
      <section class="uz-card"><div class="uz-h"><div><h3>${t.matrix}</h3><p>${t.matrixSub}</p></div></div><div class="uz-chart" id="fx-matrix" style="height:300px"></div></section>
      <section class="uz-card"><div class="uz-h"><div><h3>${t.months}</h3><p>${t.monthsSub}</p></div></div><div class="uz-chart" id="fx-months"></div></section>
      <section class="uz-card"><div class="uz-h"><div><h3>${t.table}</h3></div></div><div class="fx-table-wrap"><table class="fx-table">
        <thead><tr><th>${t.cols.branch}</th><th>${t.cols.hit}</th><th>${t.cols.actual}</th><th>${t.cols.target}</th><th>${t.cols.gap}</th><th>${t.cols.adm}</th><th>${t.cols.atp}</th><th>${t.cols.need}</th><th>${t.cols.fc}</th></tr></thead>
        <tbody>${ranked.map(b => `<tr data-b="${b.id}"><td><i class="fx-dot" style="background:${BRANCH[b.id]?.color}"></i>${name(b.id)}</td><td><span class="fx-hitbar"><i style="width:${Math.min(100, b.hit * 100)}%;background:${BRANCH[b.id]?.color}"></i></span><b class="data">${pct(b.hit)}</b></td>
          <td class="data">${fmt(b.ytdRevActual)}</td><td class="data">${fmt(b.ytdRevTarget)}</td><td class="data ${b.gap > 0 ? "neg" : "pos"}">${b.gap > 0 ? "−" : "+"}${fmt(Math.abs(b.gap))}</td>
          <td class="data">${fmt(b.ytdAdmActual)} <small>/ ${fmt(b.ytdAdmTarget)}</small></td><td class="data">${b.atp.toFixed(1)}</td><td class="data">${fmt(b.need)}</td><td class="data">${pct(b.forecast / b.yearRev, 0)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>${t.root}</td><td><b class="data">${pct(net.hit)}</b></td><td class="data">${fmt(net.actual)}</td><td class="data">${fmt(net.target)}</td><td class="data ${net.target > net.actual ? "neg" : "pos"}">${net.target > net.actual ? "−" : "+"}${fmt(Math.abs(net.target - net.actual))}</td><td class="data">${fmt(net.adm)} <small>/ ${fmt(net.admT)}</small></td><td class="data">${(net.actual / (net.adm || 1)).toFixed(1)}</td><td class="data">${fmt(net.need)}</td><td class="data">${pct(net.forecast / net.year, 0)}</td></tr></tfoot>
      </table></div></section>`;

    // burn-up (network)
    const weeks = rows[0].weeks;
    const labels = weeks.map(w => w.w.replace(/\s*\(.*\)/, "").trim() + (w.w.includes("(") ? `·${monthName(w.m, ar)}` : ""));
    let cT = 0, cA = 0;
    const cumT = [], cumA = [], cumF = [];
    const doneCount = rows[0].done.length;
    const netRecent = rows.reduce((s, b) => s + b.done.slice(-8).reduce((x, w) => x + w.a, 0), 0) / (rows.reduce((s, b) => s + b.done.slice(-8).reduce((x, w) => x + w.t, 0), 0) || 1);
    weeks.forEach((w, i) => {
      const tw = rows.reduce((s, b) => s + (b.weeks[i]?.t || 0), 0);
      cT += tw; cumT.push(Math.round(cT));
      if (i < doneCount) { cA += rows.reduce((s, b) => s + (b.weeks[i]?.a || 0), 0); cumA.push(Math.round(cA)); cumF.push(i === doneCount - 1 ? Math.round(cA) : null); }
      else { cumA.push(null); cumF.push(Math.round((cumF.filter(v => v != null).pop() ?? cA) + tw * netRecent)); }
    });
    mk($("#fx-burn")).setOption({
      tooltip: { ...TIP, trigger: "axis", valueFormatter: v => (v == null ? "—" : `${fmt(v)} ${t.sar}`) },
      legend: { top: 0, textStyle: { color: "#bdb6d8", fontSize: 11 }, itemWidth: 12, itemHeight: 4 },
      grid: { left: 8, right: 12, top: 36, bottom: 40, containLabel: true },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 14, bottom: 4, borderColor: "transparent", backgroundColor: "rgba(155,107,255,.06)", fillerColor: "rgba(155,107,255,.18)", handleStyle: { color: "#9b6bff" }, textStyle: { color: "#7f789c" } }],
      xAxis: { type: "category", data: labels, boundaryGap: false, ...AXIS, splitLine: { show: false } },
      yAxis: { ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
      series: [
        { name: t.target, type: "line", data: cumT, showSymbol: false, lineStyle: { color: "rgba(242,239,255,.55)", width: 1.5, type: "dashed" } },
        { name: t.actual, type: "line", data: cumA, showSymbol: false, smooth: .2, lineStyle: { width: 2.5, color: "#ff4fd8" },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(255,79,216,.35)" }, { offset: 1, color: "rgba(155,107,255,0)" }]) },
          markLine: { silent: true, symbol: "none", lineStyle: { color: "rgba(59,231,255,.5)" }, label: { color: "#3be7ff", fontSize: 10, formatter: asOf }, data: [{ xAxis: doneCount - 1 }] } },
        { name: t.forecast, type: "line", data: cumF, showSymbol: false, lineStyle: { width: 2, color: "#3be7ff", type: "dotted" } }
      ]
    });

    // pace by branch (cumulative hit %)
    mk($("#fx-pace")).setOption({
      tooltip: { ...TIP, trigger: "axis", valueFormatter: v => (v == null ? "—" : `${v}%`) },
      legend: { bottom: 0, textStyle: { color: "#bdb6d8", fontSize: 10 }, itemWidth: 10, itemHeight: 4 },
      grid: { left: 8, right: 12, top: 14, bottom: 32, containLabel: true },
      xAxis: { type: "category", data: labels.slice(0, doneCount), boundaryGap: false, ...AXIS, splitLine: { show: false } },
      yAxis: { ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: v => `${v}%` }, min: v => Math.max(0, Math.floor(v.min / 10) * 10) },
      series: rows.map(b => ({ name: name(b.id), type: "line", smooth: true, showSymbol: false, lineStyle: { width: 2, color: BRANCH[b.id]?.color }, itemStyle: { color: BRANCH[b.id]?.color },
        data: b.done.map(w => +(w.ca / (w.ct || 1) * 100).toFixed(1)),
        markLine: b === rows[0] ? { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: "rgba(242,239,255,.35)", type: "dashed" }, data: [{ yAxis: 100 }] } : undefined }))
    });

    // share
    mk($("#fx-share")).setOption({
      tooltip: { ...TIP, valueFormatter: v => `${fmt(v)} ${t.sar}` },
      series: [{ type: "pie", radius: ["48%", "78%"], center: ["50%", "52%"], padAngle: 2, itemStyle: { borderRadius: 8, borderColor: "#05040a", borderWidth: 2 },
        label: { color: "#f2efff", fontSize: 11, formatter: p => `${p.name}\n{b|${p.percent.toFixed(1)}%}`, rich: { b: { color: "#bdb6d8", fontFamily: "Martian Mono, monospace", fontSize: 10, padding: [3, 0, 0, 0] } } },
        labelLine: { lineStyle: { color: "rgba(190,170,255,.35)" } },
        data: rows.map(b => ({ name: name(b.id), value: Math.round(b.ytdRevActual), itemStyle: { color: BRANCH[b.id]?.color } })) }],
      graphic: [{ type: "text", left: "center", top: "46%", style: { text: compact(net.actual), fill: "#f2efff", font: "600 18px Martian Mono, monospace", textAlign: "center" } },
                { type: "text", left: "center", top: "55%", style: { text: t.sar, fill: "#7f789c", font: "11px sans-serif", textAlign: "center" } }]
    });

    // matrix
    const mData = [];
    rows.forEach((b, y) => b.done.forEach(w => mData.push([w.i, y, w.t ? +(w.a / w.t * 100).toFixed(0) : 0])));
    mk($("#fx-matrix")).setOption({
      tooltip: { ...TIP, formatter: p => `<b>${name(rows[p.value[1]].id)}</b> · ${labels[p.value[0]]}<br>${p.value[2]}% · ${fmt(rows[p.value[1]].weeks[p.value[0]].a)} / ${fmt(rows[p.value[1]].weeks[p.value[0]].t)}` },
      grid: { left: 8, right: 8, top: 6, bottom: 52, containLabel: true },
      xAxis: { type: "category", data: labels.slice(0, doneCount), ...AXIS, splitLine: { show: false }, axisLabel: { ...AXIS.axisLabel, interval: 3 } },
      yAxis: { type: "category", data: rows.map(b => name(b.id)), ...AXIS, axisLabel: { ...AXIS.axisLabel, color: "#bdb6d8", fontSize: 11 } },
      visualMap: { type: "piecewise", orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#7f789c", fontSize: 10 }, itemWidth: 12, itemHeight: 8,
        pieces: [{ lt: 50, color: "#ff3b5c", label: "<50%" }, { gte: 50, lt: 80, color: "#a3304f", label: "50–80" }, { gte: 80, lt: 100, color: "#5b3a7a", label: "80–100" }, { gte: 100, lt: 130, color: "#2f9e7a", label: "100–130" }, { gte: 130, color: "#4cf0a8", label: "130%+" }] },
      series: [{ type: "heatmap", data: mData, itemStyle: { borderColor: "#05040a", borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: "#fff" } } }]
    });

    // months
    const months = MONTH_KEYS.map((_, m) => ({ m, t: rows.reduce((s, b) => s + b.months[m].t, 0), a: rows.some(b => b.months[m].a != null) ? rows.reduce((s, b) => s + (b.months[m].a || 0), 0) : null, td: rows.reduce((s, b) => s + b.months[m].tDone, 0) }));
    mk($("#fx-months")).setOption({
      tooltip: { ...TIP, trigger: "axis", valueFormatter: v => (v == null ? "—" : `${fmt(v)} ${t.sar}`) },
      legend: { top: 0, textStyle: { color: "#bdb6d8", fontSize: 11 }, itemWidth: 10, itemHeight: 6 },
      grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: months.map(m => monthName(m.m, ar)), ...AXIS, splitLine: { show: false } },
      yAxis: { ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
      series: [
        { name: t.target, type: "bar", data: months.map(m => Math.round(m.t)), itemStyle: { color: "rgba(242,239,255,.14)", borderRadius: [6, 6, 0, 0] }, barGap: "-100%", barMaxWidth: 34 },
        ...rows.map(b => ({ name: name(b.id), type: "bar", stack: "a", data: b.months.map(x => (x.a == null ? null : Math.round(x.a))), itemStyle: { color: BRANCH[b.id]?.color }, barMaxWidth: 34, emphasis: { focus: "series" } }))
      ]
    });

    root.querySelectorAll(".fx-node, .fx-table tbody tr").forEach(el => { el.onclick = () => select(el.dataset.b); });
  }

  // ── single branch ──
  function paintOne(b) {
    const c = BRANCH[b.id]?.color || "#9b6bff";
    $("#fx-hero-body").innerHTML = heroHtml({ label: `${name(b.id)} · ${t.ytd.split("·").pop().trim()}`, actual: b.ytdRevActual, target: b.ytdRevTarget, year: b.yearRev, hit: b.hit, forecast: b.forecast, need: b.need, left: b.left, adm: b.ytdAdmActual, admT: b.ytdAdmTarget, timeUsed: b.ytdRevTarget / b.yearRev });
    count(b.ytdRevActual);
    const lw = b.last ? b.last.a / (b.last.t || 1) : 0;
    $("#fx-body").innerHTML = `
      <div class="uz-kpis">
        <article><span class="uz-glyph">◎</span><p>${t.hit}</p><b class="data">${pct(b.hit)}</b><div><span class="fx-status s-${b.status}">${t.status[b.status]}</span></div></article>
        <article><span class="uz-glyph">▲</span><p>${t.lastWeek} · ${b.last?.w || ""}</p><b class="data">${compact(b.last?.a)}</b><div><span class="uz-delta ${lw >= 1 ? "up" : "down"}">${pct(lw, 0)}</span></div></article>
        <article><span class="uz-glyph">◆</span><p>${t.adm}</p><b class="data">${fmt(b.ytdAdmActual)}</b><div><small>${pct(b.admHit)} ${t.ofTarget}</small></div></article>
        <article><span class="uz-glyph">✦</span><p>${t.atp}</p><b class="data">${b.atp.toFixed(1)}</b><div><small>${t.sar}</small></div></article>
        <article><span class="uz-glyph">⬡</span><p>${t.need}</p><b class="data">${compact(b.need)}</b><div><small>${t.left} ${compact(b.left)}</small></div></article>
        <article><span class="uz-glyph">✓</span><p>${t.forecast}</p><b class="data">${compact(b.forecast)}</b><div><small>${pct(b.forecast / b.yearRev, 0)} · ${t.year}</small></div></article>
      </div>
      <section class="uz-card"><div class="uz-h"><div><h3>${t.weekly}</h3><p>${t.weeklySub}</p></div></div><div class="uz-chart xl" id="fx-weekly"></div></section>
      <div class="uz-two">
        <section class="uz-card"><div class="uz-h"><div><h3>${t.burn}</h3><p>${t.burnSub}</p></div></div><div class="uz-chart" id="fx-burn1"></div></section>
        <section class="uz-card"><div class="uz-h"><div><h3>${t.monthTable}</h3></div></div><div class="fx-table-wrap"><table class="fx-table">
          <thead><tr><th>${t.cols.month}</th><th>${t.actual}</th><th>${t.target}</th><th>${t.variance}</th><th>${t.cols.hit}</th></tr></thead>
          <tbody>${b.months.filter(m => m.t).map(m => { const v = m.a == null ? null : m.a - m.tDone; return `<tr class="${m.a == null ? "future" : ""}"><td>${monthName(m.m, ar)}</td><td class="data">${m.a == null ? "—" : fmt(m.a)}</td><td class="data">${fmt(m.t)}</td><td class="data ${v == null ? "" : v >= 0 ? "pos" : "neg"}">${v == null ? "—" : `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`}</td><td>${m.a == null ? "—" : `<span class="fx-hitbar"><i style="width:${Math.min(100, m.a / (m.tDone || 1) * 100)}%;background:${c}"></i></span><b class="data">${pct(m.a / (m.tDone || 1), 0)}</b>`}</td></tr>`; }).join("")}</tbody>
        </table></div></section>
      </div>`;
    const labels = b.weeks.map(w => w.w.replace(/\s*\(.*\)/, "").trim() + (w.w.includes("(") ? `·${monthName(w.m, ar)}` : ""));
    const avg4 = b.weeks.map((w, i) => { if (w.a == null || i < 3) return null; const s = b.weeks.slice(i - 3, i + 1); return s.every(x => x.a != null) ? Math.round(s.reduce((a, x) => a + x.a, 0) / 4) : null; });
    mk($("#fx-weekly")).setOption({
      tooltip: { ...TIP, trigger: "axis", valueFormatter: v => (v == null ? "—" : `${fmt(v)} ${t.sar}`) },
      legend: { top: 0, textStyle: { color: "#bdb6d8", fontSize: 11 }, itemWidth: 10, itemHeight: 6 },
      grid: { left: 8, right: 8, top: 36, bottom: 40, containLabel: true },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 14, bottom: 4, borderColor: "transparent", backgroundColor: "rgba(155,107,255,.06)", fillerColor: "rgba(155,107,255,.18)", handleStyle: { color: c }, textStyle: { color: "#7f789c" } }],
      xAxis: { type: "category", data: labels, ...AXIS, splitLine: { show: false } },
      yAxis: { ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
      series: [
        { name: t.actual, type: "bar", barMaxWidth: 16, data: b.weeks.map(w => (w.a == null ? null : { value: Math.round(w.a), itemStyle: { color: w.a >= w.t ? "#4cf0a8" : "#ff5c7a", borderRadius: [4, 4, 0, 0] } })) },
        { name: t.target, type: "line", step: "middle", data: b.weeks.map(w => Math.round(w.t)), showSymbol: false, lineStyle: { color: "rgba(242,239,255,.6)", width: 1.4, type: "dashed" } },
        { name: t.avg4, type: "line", data: avg4, smooth: true, showSymbol: false, lineStyle: { color: c, width: 2.2 } }
      ]
    });
    let cT = 0;
    const cumT = b.weeks.map(w => Math.round(cT += w.t));
    const recent = b.recentHit;
    let lastA = 0;
    const cumA = b.weeks.map(w => (w.ca != null ? (lastA = Math.round(w.ca)) : null));
    let f = null;
    const cumF = b.weeks.map((w, i) => { if (w.a != null) { if (i === b.done.length - 1) f = lastA; return i === b.done.length - 1 ? lastA : null; } f = (f ?? lastA) + w.t * recent; return Math.round(f); });
    mk($("#fx-burn1")).setOption({
      tooltip: { ...TIP, trigger: "axis", valueFormatter: v => (v == null ? "—" : `${fmt(v)} ${t.sar}`) },
      legend: { bottom: 0, textStyle: { color: "#bdb6d8", fontSize: 10 }, itemWidth: 10, itemHeight: 4 },
      grid: { left: 8, right: 12, top: 14, bottom: 32, containLabel: true },
      xAxis: { type: "category", data: labels, boundaryGap: false, ...AXIS, splitLine: { show: false } },
      yAxis: { ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
      series: [
        { name: t.target, type: "line", data: cumT, showSymbol: false, lineStyle: { color: "rgba(242,239,255,.5)", type: "dashed" } },
        { name: t.actual, type: "line", data: cumA, showSymbol: false, lineStyle: { color: c, width: 2.5 }, areaStyle: { color: c, opacity: .14 } },
        { name: t.forecast, type: "line", data: cumF, showSymbol: false, lineStyle: { color: "#3be7ff", type: "dotted", width: 2 } }
      ]
    });
  }

  let first = true;
  function select(id) {
    pick = id;
    sessionStorage.setItem("fx-branch", id);
    charts.forEach(c => c.dispose()); charts = [];
    root.querySelectorAll("#fx-chips button").forEach(b => b.classList.toggle("on", b.dataset.b === id));
    id === "all" ? paintAll() : paintOne(rows.find(b => b.id === id));
    if (!first && id !== "all") root.scrollIntoView({ behavior: "smooth", block: "start" });
    first = false;
  }
  $("#fx-chips").onclick = e => { const b = e.target.closest("button"); if (b) select(b.dataset.b); };
  select(pick);
  import("./fin-analyst.js?v=81").then(m => m.budgetReport($("#fx-analyst"), rows, net, { ar, name, color: id => BRANCH[id]?.color || "#9b6bff" }))
    .catch(e => console.warn("Analyst report unavailable", e));
}

// Unaizah treasury — daily DCS ledger rebuilt by unaizah/build.py.
// Libraries (all open source on GitHub):
//   charts      github.com/apache/echarts
//   indicators  github.com/anandanand84/technicalindicators  (SMA · Bollinger · RSI · MACD)
//   counters    github.com/inorganik/countUp.js
//   data grid   github.com/grid-js/gridjs
// Vendored copies of the npm releases live in vendor/ so the board works offline.
const CDN = {
  echarts: "vendor/echarts.min.js",
  ta: "vendor/technicalindicators.min.js",
  countup: "vendor/countUp.umd.js",
  grid: "vendor/gridjs.umd.js"
};
const lang = () => sessionStorage.getItem("noir-lang") || "en";

const TENDERS = {
  cash:    { en: "Cash",        ar: "كاش",          icon: "assets/pay/cash.png",    color: "#4cf0a8", group: "cash" },
  card:    { en: "Credit card", ar: "شبكة",         icon: "assets/pay/card.png",    color: "#3be7ff", group: "digital" },
  online:  { en: "Online",      ar: "أونلاين",      icon: "assets/pay/online.png",  color: "#9b6bff", group: "digital" },
  prepaid: { en: "Pre-paid",    ar: "مسبق الدفع",   icon: "assets/pay/prepaid.png", color: "#ffc857", group: "digital" },
  jahez:   { en: "Jahez",       ar: "جاهز",         icon: "assets/pay/jahez.png",   color: "#ff3b5c", group: "delivery" },
  hunger:  { en: "HungerStation", ar: "هنقرستيشن",  icon: "assets/pay/hunger.png",  color: "#ffd400", group: "delivery" },
  voucher: { en: "Voucher",     ar: "قسيمة",        icon: "assets/pay/voucher.png", color: "#ff7a59", group: "promo" },
  bogo:    { en: "Buy 1 get 1", ar: "اشتر ١ واحصل ١", icon: "assets/pay/bogo.png",  color: "#ff4fd8", group: "promo" },
  comp:    { en: "Comp",        ar: "ضيافة",        icon: "assets/pay/noir.png",    color: "#a78bfa", group: "promo" },
  other:   { en: "Other",       ar: "أخرى",         icon: null,                     color: "#bdb6d8", group: "promo" }
};
const KEYS = Object.keys(TENDERS);
const GROUPS = {
  cash:     { en: "Cash vault",      ar: "خزنة الكاش",   color: "#4cf0a8" },
  digital:  { en: "Digital rails",   ar: "الدفع الرقمي", color: "#3be7ff" },
  delivery: { en: "Delivery apps",   ar: "تطبيقات التوصيل", color: "#ffd400" },
  promo:    { en: "Promo & vouchers", ar: "العروض والقسائم", color: "#ff4fd8" }
};

const T = {
  en: {
    chain: "Unaizah mainnet", synced: "synced", blocks: "blocks", vault: "Treasury inflow",
    vs: "vs previous", periods: { "30d": "30D", "90d": "90D", "ytd": "YTD", "2026": "2026", "2025": "2025", "all": "All" },
    avg: "Avg / day", best: "Peak day", digital: "Digital share", accuracy: "Cash accuracy", promo: "Promo burn", validators: "Active cashiers",
    tokens: "Tender pools", tokensSub: "Each payment rail as a pool — share of inflow and change vs the previous period.",
    price: "Revenue price action", priceSub: "Daily revenue with SMA 7 / SMA 30 and Bollinger bands (20, 2σ), or weekly candles.",
    daily: "Daily", weekly: "Weekly candles", rsi: "RSI 14", macd: "MACD 12·26·9",
    heat: "Activity graph", heatSub: "One square per business day, GitHub contribution style.",
    flow: "Money flow", flowSub: "Where each riyal came from — tender → rail → treasury.",
    week: "Weekday rhythm", weekSub: "Average revenue by day of week.",
    mix: "Liquidity mix", mixSub: "Monthly inflow stacked by tender.",
    recon: "Reconciliation", reconSub: "Drawer excess and shortage against the POS report, with accuracy.",
    board: "Validator board", boardSub: "Cashiers ranked by revenue handled; accuracy = 1 − |variance| ÷ handled.",
    ledger: "Block explorer", ledgerSub: "Every business day is a block. Search, sort, export.",
    tabDays: "Daily blocks", tabMonths: "Monthly statement", export: "Export CSV",
    integrity: "Data integrity", built: "Ledger built", sources: "Source workbooks", coverage: "Coverage", gaps: "Missing days",
    noFile: "No DCS sheet in the repo for these dates",
    cols: { block: "Block", hash: "Hash", date: "Date", total: "Revenue", cash: "Cash", card: "Card", online: "Online", delivery: "Delivery", promo: "Promo", variance: "Variance", status: "Status", month: "Month", days: "Days", mom: "MoM", excess: "Excess", shortage: "Shortage", acc: "Accuracy", shifts: "Shifts", handled: "Handled", per: "Per shift" },
    ok: "Balanced", over: "Excess", short: "Short", sar: "SAR",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    rail: "Treasury", empty: "No days in this period."
  },
  ar: {
    chain: "شبكة عنيزة", synced: "متزامن", blocks: "بلوك", vault: "تدفق الخزينة",
    vs: "مقارنة بالفترة السابقة", periods: { "30d": "٣٠ يوم", "90d": "٩٠ يوم", "ytd": "منذ بداية السنة", "2026": "2026", "2025": "2025", "all": "الكل" },
    avg: "المتوسط اليومي", best: "أعلى يوم", digital: "حصة الرقمي", accuracy: "دقة الكاش", promo: "تكلفة العروض", validators: "الكاشيرية النشطين",
    tokens: "مجمّعات الدفع", tokensSub: "كل وسيلة دفع كمجمّع سيولة — حصتها من الإيراد والتغير عن الفترة السابقة.",
    price: "حركة الإيراد", priceSub: "الإيراد اليومي مع متوسط ٧ و٣٠ يوم ونطاقات بولنجر (٢٠، ٢σ)، أو شموع أسبوعية.",
    daily: "يومي", weekly: "شموع أسبوعية", rsi: "RSI 14", macd: "MACD 12·26·9",
    heat: "خريطة النشاط", heatSub: "مربع لكل يوم عمل بأسلوب مساهمات GitHub.",
    flow: "تدفق الأموال", flowSub: "من أين جاء كل ريال — وسيلة الدفع ← القناة ← الخزينة.",
    week: "إيقاع الأسبوع", weekSub: "متوسط الإيراد حسب يوم الأسبوع.",
    mix: "مزيج السيولة", mixSub: "الإيراد الشهري مكدّس حسب وسيلة الدفع.",
    recon: "المطابقة", reconSub: "الزيادة والعجز في الدرج مقابل تقرير نقاط البيع، مع نسبة الدقة.",
    board: "لوحة المدققين", boardSub: "الكاشيرية مرتبين حسب المبالغ المستلمة؛ الدقة = ١ − |الفرق| ÷ المستلم.",
    ledger: "مستكشف البلوكات", ledgerSub: "كل يوم عمل بلوك مستقل. ابحث، رتّب، صدّر.",
    tabDays: "البلوكات اليومية", tabMonths: "القائمة الشهرية", export: "تصدير CSV",
    integrity: "سلامة البيانات", built: "آخر بناء", sources: "ملفات المصدر", coverage: "التغطية", gaps: "أيام مفقودة",
    noFile: "لا يوجد ملف DCS في الريبو لهذه التواريخ",
    cols: { block: "البلوك", hash: "الهاش", date: "التاريخ", total: "الإيراد", cash: "كاش", card: "شبكة", online: "أونلاين", delivery: "توصيل", promo: "عروض", variance: "الفرق", status: "الحالة", month: "الشهر", days: "الأيام", mom: "التغير الشهري", excess: "زيادة", shortage: "عجز", acc: "الدقة", shifts: "الورديات", handled: "المستلم", per: "لكل وردية" },
    ok: "مطابق", over: "زيادة", short: "عجز", sar: "ر.س",
    weekdays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
    rail: "الخزينة", empty: "لا توجد أيام في هذه الفترة."
  }
};

// ── helpers ─────────────────────────────────────────────────────────
const fmt = (n, d = 0) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n) || 0);
const compact = n => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);
const pct = (n, d = 1) => `${(Number(n) * 100 || 0).toFixed(d)}%`;
const sum = (rows, k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hash = s => { let h = 0x811c9dc5; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const txHash = d => `0x${hash(d.date + d.total)}${hash(d.total + d.date)}`;
const short = h => `${h.slice(0, 6)}…${h.slice(-4)}`;
const pad = (arr, len) => Array(Math.max(0, len - arr.length)).fill(null).concat(arr);
const delivery = r => (r.jahez || 0) + (r.hunger || 0);
const promo = r => (r.bogo || 0) + (r.comp || 0) + (r.voucher || 0) + (r.other || 0);
const digital = r => (r.card || 0) + (r.online || 0) + (r.prepaid || 0);
const day = iso => new Date(`${iso}T00:00:00`);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = day(s); d.setDate(d.getDate() + n); return iso(d); };
const monthLabel = (ym, ar) => new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", { month: "short", year: "numeric" }).format(day(`${ym}-01`));

const loaded = {};
function load(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error(`Could not load ${src}`)); };
    document.head.append(s);
  });
  return loaded[src];
}

let charts = [];
let observer = null;
const chart = el => { const c = window.echarts.init(el, null, { renderer: "canvas" }); charts.push(c); return c; };
function dispose() { charts.forEach(c => c.dispose()); charts = []; observer?.disconnect(); }

const AXIS = { axisLine: { lineStyle: { color: "rgba(190,170,255,.18)" } }, axisLabel: { color: "#7f789c", fontFamily: "Martian Mono, monospace", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(190,170,255,.07)" } } };
const TIP = { backgroundColor: "rgba(12,9,22,.94)", borderColor: "rgba(155,107,255,.45)", textStyle: { color: "#f2efff", fontFamily: "Bricolage Grotesque, system-ui", fontSize: 12 }, extraCssText: "backdrop-filter:blur(10px);border-radius:12px;box-shadow:0 10px 40px rgba(155,107,255,.25)" };

// ── period filter ───────────────────────────────────────────────────
function window_(days, period) {
  const last = days[days.length - 1].date;
  let from = days[0].date, to = last;
  if (period === "30d") from = addDays(last, -29);
  else if (period === "90d") from = addDays(last, -89);
  else if (period === "ytd") from = `${last.slice(0, 4)}-01-01`;
  else if (/^\d{4}$/.test(period)) { from = `${period}-01-01`; to = `${period}-12-31`; }
  const span = Math.round((day(to > last ? last : to) - day(from)) / 864e5) + 1;
  const prevTo = addDays(from, -1), prevFrom = addDays(from, -span);
  return {
    rows: days.filter(d => d.date >= from && d.date <= to),
    prev: period === "all" ? [] : days.filter(d => d.date >= prevFrom && d.date <= prevTo),
    from, to: to > last ? last : to
  };
}

function stats(rows) {
  const total = sum(rows, "total");
  const report = sum(rows, "report") || total;
  const excess = sum(rows, "excess"), shortage = sum(rows, "shortage");
  const best = rows.reduce((b, r) => (r.total > (b?.total ?? -1) ? r : b), null);
  const people = new Set(rows.flatMap(r => r.cashiers.map(c => c.user)).filter(u => !/kiosk|unpunch/i.test(u)));
  return {
    total, days: rows.length, avg: rows.length ? total / rows.length : 0, best,
    digital: total ? rows.reduce((s, r) => s + digital(r) + delivery(r), 0) / total : 0,
    promo: rows.reduce((s, r) => s + promo(r), 0),
    accuracy: report ? 1 - (excess + shortage) / report : 1,
    excess, shortage, validators: people.size
  };
}

const delta = (a, b) => (b ? (a - b) / b : null);
function chip(d, invert = false) {
  if (d == null || !isFinite(d)) return `<span class="uz-delta flat">—</span>`;
  const up = d >= 0, good = invert ? !up : up;
  return `<span class="uz-delta ${good ? "up" : "down"}">${up ? "▲" : "▼"} ${pct(Math.abs(d))}</span>`;
}

function spark(values, color) {
  if (values.length < 2) return "";
  const max = Math.max(...values, 1), w = 120, h = 34;
  const pts = values.map((v, i) => [i / (values.length - 1) * w, h - (v / max) * (h - 4) - 2]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const id = `g${hash(color + values.length)}`;
  return `<svg class="uz-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${line}L${w},${h}L0,${h}Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

function byMonth(rows) {
  const m = new Map();
  rows.forEach(r => {
    const k = r.date.slice(0, 7);
    if (!m.has(k)) m.set(k, { month: k, days: 0, total: 0, report: 0, excess: 0, shortage: 0, ...Object.fromEntries(KEYS.map(t => [t, 0])) });
    const o = m.get(k);
    o.days++;
    ["total", "report", "excess", "shortage", ...KEYS].forEach(t => { o[t] += Number(r[t]) || 0; });
  });
  return [...m.values()];
}

function byWeek(rows) {
  const m = new Map();
  rows.forEach(r => {
    const d = day(r.date); d.setDate(d.getDate() - d.getDay());
    const k = iso(d);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r.total);
  });
  return [...m.entries()].map(([k, v]) => ({ week: k, o: v[0], c: v[v.length - 1], l: Math.min(...v), h: Math.max(...v), sum: v.reduce((a, b) => a + b, 0), avg: v.reduce((a, b) => a + b, 0) / v.length }));
}

function gapRanges(missing) {
  const out = [];
  missing.forEach(d => {
    const last = out[out.length - 1];
    if (last && addDays(last[1], 1) === d) last[1] = d; else out.push([d, d]);
  });
  return out;
}

// ── render ──────────────────────────────────────────────────────────
export async function renderUnaizah(root) {
  dispose();
  const ar = lang() === "ar", t = T[ar ? "ar" : "en"];
  root.innerHTML = `<div class="uz-loading"><i></i><span>${ar ? "مزامنة البلوكات…" : "Syncing blocks…"}</span></div>`;
  let data;
  try {
    [data] = await Promise.all([
      fetch("unaizah/ledger.json?v=63").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      load(CDN.echarts), load(CDN.ta), load(CDN.countup), load(CDN.grid)
    ]);
  } catch (e) {
    root.innerHTML = `<div class="uz-error">${ar ? "تعذر تحميل بيانات عنيزة." : "Could not load the Unaizah ledger."} <small>${esc(e.message)}</small></div>`;
    return;
  }
  const days = data.days;
  const ui = { period: sessionStorage.getItem("uz-period") || "ytd", mode: "daily", osc: "rsi", tab: "days" };
  const years = [...new Set(days.map(d => d.date.slice(0, 4)))];
  const periods = ["30d", "90d", "ytd", ...years.slice().reverse().filter(y => y !== days[days.length - 1].date.slice(0, 4)), "all"];
  const sources = new Set(days.map(d => d.source)).size;
  const latest = days[days.length - 1];

  root.innerHTML = `
  <section class="uz" dir="${ar ? "rtl" : "ltr"}">
    <header class="uz-hero">
      <div class="uz-id">
        <div class="uz-logo"><img src="assets/pay/noir.png" alt="Noir Cinema"></div>
        <div>
          <p class="uz-net"><i></i>${t.chain} · ${t.synced} · <span class="data">#${fmt(days.length)}</span> ${t.blocks}</p>
          <p class="uz-addr data" title="${txHash(latest)}">${short(txHash(latest))} · ${latest.date}</p>
        </div>
      </div>
      <div class="uz-periods" role="tablist">${periods.map(p => `<button type="button" role="tab" data-p="${p}">${t.periods[p] || p}</button>`).join("")}</div>
      <div class="uz-vault">
        <p>${t.vault} <span class="uz-range data" id="uz-range"></span></p>
        <div class="uz-vault-row"><b class="data" id="uz-total">0</b><span class="uz-cur">${t.sar}</span><span id="uz-total-d"></span></div>
        <div class="uz-rails" id="uz-rails"></div>
      </div>
    </header>

    <div class="uz-kpis" id="uz-kpis"></div>

    <section class="uz-card">
      <div class="uz-h"><div><h3>${t.tokens}</h3><p>${t.tokensSub}</p></div></div>
      <div class="uz-tokens" id="uz-tokens"></div>
    </section>

    <section class="uz-card">
      <div class="uz-h"><div><h3>${t.price}</h3><p>${t.priceSub}</p></div>
        <div class="uz-seg-row">
          <div class="uz-seg" id="uz-mode"><button data-v="daily">${t.daily}</button><button data-v="weekly">${t.weekly}</button></div>
          <div class="uz-seg" id="uz-osc"><button data-v="rsi">${t.rsi}</button><button data-v="macd">${t.macd}</button></div>
        </div>
      </div>
      <div class="uz-chart xl" id="uz-price"></div>
    </section>

    <section class="uz-card">
      <div class="uz-h"><div><h3>${t.heat}</h3><p>${t.heatSub}</p></div></div>
      <div class="uz-chart" id="uz-heat"></div>
    </section>

    <div class="uz-two">
      <section class="uz-card"><div class="uz-h"><div><h3>${t.flow}</h3><p>${t.flowSub}</p></div></div><div class="uz-chart" id="uz-flow"></div></section>
      <section class="uz-card"><div class="uz-h"><div><h3>${t.week}</h3><p>${t.weekSub}</p></div></div><div class="uz-chart" id="uz-week"></div></section>
    </div>

    <div class="uz-two">
      <section class="uz-card"><div class="uz-h"><div><h3>${t.mix}</h3><p>${t.mixSub}</p></div></div><div class="uz-chart" id="uz-mix"></div></section>
      <section class="uz-card"><div class="uz-h"><div><h3>${t.recon}</h3><p>${t.reconSub}</p></div></div><div class="uz-chart" id="uz-recon"></div></section>
    </div>

    <section class="uz-card">
      <div class="uz-h"><div><h3>${t.board}</h3><p>${t.boardSub}</p></div></div>
      <div class="uz-board" id="uz-board"></div>
    </section>

    <section class="uz-card">
      <div class="uz-h"><div><h3>${t.ledger}</h3><p>${t.ledgerSub}</p></div>
        <div class="uz-seg-row">
          <div class="uz-seg" id="uz-tab"><button data-v="days">${t.tabDays}</button><button data-v="months">${t.tabMonths}</button></div>
          <button type="button" class="uz-btn" id="uz-csv">${t.export}</button>
        </div>
      </div>
      <div class="uz-grid" id="uz-grid"></div>
    </section>

    <section class="uz-card uz-integrity">
      <div class="uz-h"><div><h3>${t.integrity}</h3></div></div>
      <div class="uz-int" id="uz-int"></div>
    </section>
  </section>`;

  const $ = s => root.querySelector(s);
  const el = {
    price: chart($("#uz-price")), heat: chart($("#uz-heat")), flow: chart($("#uz-flow")),
    week: chart($("#uz-week")), mix: chart($("#uz-mix")), recon: chart($("#uz-recon"))
  };
  observer = new ResizeObserver(() => charts.forEach(c => c.resize()));
  observer.observe(root);

  let view = { rows: [], prev: [] };
  let grid = null;
  const countTotal = new window.countUp.CountUp($("#uz-total"), 0, { duration: 1.4, separator: ",", decimalPlaces: 0 });
  countTotal.start();

  // ── sections ──
  function paintHero(s, p) {
    $("#uz-range").textContent = `${view.from} → ${view.to}`;
    countTotal.update(Math.round(s.total));
    $("#uz-total-d").innerHTML = view.prev.length ? `${chip(delta(s.total, p.total))}<small>${t.vs}</small>` : "";
    const g = Object.keys(GROUPS).map(k => [k, view.rows.reduce((a, r) => a + KEYS.filter(x => TENDERS[x].group === k).reduce((b, x) => b + (r[x] || 0), 0), 0)]);
    const tot = g.reduce((a, [, v]) => a + v, 0) || 1;
    $("#uz-rails").innerHTML = `<div class="uz-bar">${g.map(([k, v]) => `<i style="width:${v / tot * 100}%;background:${GROUPS[k].color}" title="${GROUPS[k][ar ? "ar" : "en"]} ${pct(v / tot)}"></i>`).join("")}</div>
      <div class="uz-legend">${g.map(([k, v]) => `<span><i style="background:${GROUPS[k].color}"></i>${GROUPS[k][ar ? "ar" : "en"]} <b class="data">${pct(v / tot)}</b></span>`).join("")}</div>`;
  }

  function paintKpis(s, p) {
    const has = view.prev.length > 0;
    const k = [
      [t.avg, `${compact(s.avg)}`, has ? chip(delta(s.avg, p.avg)) : "", "◆"],
      [t.best, s.best ? compact(s.best.total) : "—", s.best ? `<small class="data">${s.best.date}</small>` : "", "▲"],
      [t.digital, pct(s.digital), has ? chip(s.digital - p.digital) : "", "⬡"],
      [t.accuracy, pct(s.accuracy, 2), has ? chip(s.accuracy - p.accuracy) : "", "✓"],
      [t.promo, compact(s.promo), has ? chip(delta(s.promo, p.promo), true) : "", "✦"],
      [t.validators, fmt(s.validators), `<small>${fmt(s.days)} ${t.blocks}</small>`, "◎"]
    ];
    $("#uz-kpis").innerHTML = k.map(([label, value, foot, glyph]) => `<article><span class="uz-glyph">${glyph}</span><p>${label}</p><b class="data">${value}</b><div>${foot}</div></article>`).join("");
  }

  function paintTokens() {
    const rows = view.rows, total = sum(rows, "total") || 1;
    const months = byMonth(rows);
    const list = KEYS.map(k => ({ k, v: sum(rows, k), pv: sum(view.prev, k) })).filter(x => x.v || x.pv).sort((a, b) => b.v - a.v);
    $("#uz-tokens").innerHTML = list.map(({ k, v, pv }) => {
      const m = TENDERS[k];
      const seq = months.length > 1 ? months.map(x => x[k]) : rows.map(r => r[k] || 0);
      return `<article class="uz-token" style="--c:${m.color}">
        <div class="uz-token-top">
          <div class="uz-coin">${m.icon ? `<img src="${m.icon}" alt="" loading="lazy">` : `<span class="uz-others">OTHERS</span>`}</div>
          <div><h4>${m[ar ? "ar" : "en"]}</h4><span class="uz-ticker data">$${k.toUpperCase().slice(0, 5)}</span></div>
          ${view.prev.length ? chip(delta(v, pv)) : ""}
        </div>
        <b class="data">${fmt(v)}</b>
        <div class="uz-share"><i style="width:${Math.min(100, v / total * 100)}%"></i></div>
        <div class="uz-token-foot"><span class="data">${pct(v / total)}</span>${spark(seq, m.color)}</div>
      </article>`;
    }).join("") || `<p class="uz-empty">${t.empty}</p>`;
  }

  function series(values, period, fn, extra = {}) {
    if (values.length < period) return Array(values.length).fill(null);
    return pad(fn.calculate({ period, values, ...extra }), values.length);
  }

  function paintPrice() {
    const rows = view.rows;
    const weekly = ui.mode === "weekly";
    const w = weekly ? byWeek(rows) : null;
    const x = weekly ? w.map(d => d.week) : rows.map(r => r.date);
    const close = weekly ? w.map(d => d.c) : rows.map(r => r.total);
    const base = weekly ? w.map(d => +d.avg.toFixed(0)) : close; // weekly: indicators run on avg daily revenue, same scale as the candles
    const { SMA, BollingerBands, RSI, MACD } = window;
    const f1 = weekly ? 4 : 7, f2 = weekly ? 12 : 30;
    const sma1 = series(base, f1, SMA).map(v => v && +v.toFixed(0));
    const sma2 = series(base, f2, SMA).map(v => v && +v.toFixed(0));
    const bbRaw = base.length >= 20 ? BollingerBands.calculate({ period: 20, values: base, stdDev: 2 }) : [];
    const bb = pad(bbRaw, base.length);
    const lower = bb.map(b => b && Math.max(0, +b.lower.toFixed(0)));
    const band = bb.map((b, i) => b && +(b.upper - lower[i]).toFixed(0));
    let osc = [];
    if (ui.osc === "rsi") {
      const r = series(base, 14, RSI);
      osc = [{ name: "RSI", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: r.map(v => v && +v.toFixed(1)), showSymbol: false, lineStyle: { color: "#ffc857", width: 1.4 },
        markLine: { silent: true, symbol: "none", label: { color: "#7f789c", fontSize: 9 }, lineStyle: { type: "dashed", color: "rgba(255,92,122,.5)" }, data: [{ yAxis: 70 }, { yAxis: 30, lineStyle: { color: "rgba(76,240,168,.5)" } }] },
        markArea: { silent: true, itemStyle: { color: "rgba(155,107,255,.06)" }, data: [[{ yAxis: 30 }, { yAxis: 70 }]] } }];
    } else {
      const m = base.length >= 35 ? pad(MACD.calculate({ values: base, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }), base.length) : Array(base.length).fill(null);
      osc = [
        { name: "Histogram", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: m.map(v => v && v.histogram != null ? { value: +v.histogram.toFixed(0), itemStyle: { color: v.histogram >= 0 ? "rgba(76,240,168,.75)" : "rgba(255,92,122,.75)" } } : null), barMaxWidth: 6 },
        { name: "MACD", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: m.map(v => v && v.MACD != null ? +v.MACD.toFixed(0) : null), showSymbol: false, lineStyle: { color: "#3be7ff", width: 1.2 } },
        { name: "Signal", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: m.map(v => v && v.signal != null ? +v.signal.toFixed(0) : null), showSymbol: false, lineStyle: { color: "#ff4fd8", width: 1.2 } }
      ];
    }
    const main = weekly
      ? [{ name: ar ? "أسبوع" : "Week", type: "candlestick", data: w.map(d => [d.o, d.c, d.l, d.h]), itemStyle: { color: "#4cf0a8", color0: "#ff5c7a", borderColor: "#4cf0a8", borderColor0: "#ff5c7a" } },
         { name: ar ? "إجمالي الأسبوع" : "Week total", type: "bar", yAxisIndex: 2, data: w?.map(d => Math.round(d.sum)), itemStyle: { color: "rgba(155,107,255,.18)" }, barMaxWidth: 14, z: 0 }]
      : [{ name: ar ? "الإيراد" : "Revenue", type: "line", data: close, showSymbol: false, smooth: .25, lineStyle: { width: 1.8, color: "#f2efff" },
           areaStyle: { color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(255,79,216,.35)" }, { offset: 1, color: "rgba(155,107,255,0)" }]) } }];
    const bandSeries = [
      { name: "BB low", type: "line", data: lower, stack: "bb", lineStyle: { opacity: 0 }, showSymbol: false, silent: true, tooltip: { show: false } },
      { name: "Bollinger", type: "line", data: band, stack: "bb", lineStyle: { opacity: 0 }, showSymbol: false, areaStyle: { color: "rgba(59,231,255,.08)" }, silent: true, tooltip: { show: false } }
    ];
    el.price.setOption({
      animationDuration: 900, backgroundColor: "transparent",
      legend: { top: 0, textStyle: { color: "#bdb6d8", fontSize: 11 }, icon: "roundRect", itemWidth: 10, itemHeight: 4, data: [main[0].name, `SMA ${f1}`, `SMA ${f2}`, "Bollinger", ...osc.map(o => o.name)] },
      tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: "rgba(255,79,216,.5)" }, crossStyle: { color: "rgba(255,79,216,.5)" }, label: { backgroundColor: "#2a1f4a" } },
        valueFormatter: v => (Array.isArray(v) ? v.map(fmt).join(" / ") : v == null ? "—" : fmt(v)) },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [{ left: 8, right: 8, top: 34, height: "58%", containLabel: true }, { left: 8, right: 8, top: "76%", height: "14%", containLabel: true }],
      xAxis: [{ type: "category", data: x, boundaryGap: weekly, ...AXIS, axisLabel: { ...AXIS.axisLabel, show: false }, splitLine: { show: false } },
              { type: "category", gridIndex: 1, data: x, boundaryGap: weekly, ...AXIS, splitLine: { show: false } }],
      yAxis: [{ scale: false, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
              { gridIndex: 1, ...AXIS, splitNumber: 2, axisLabel: { ...AXIS.axisLabel, formatter: compact }, ...(ui.osc === "rsi" ? { min: 0, max: 100 } : {}) },
              { show: false, gridIndex: 0 }],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1] }, { type: "slider", xAxisIndex: [0, 1], bottom: 0, height: 16, borderColor: "transparent", backgroundColor: "rgba(155,107,255,.06)", fillerColor: "rgba(155,107,255,.18)", handleStyle: { color: "#9b6bff" }, textStyle: { color: "#7f789c" }, dataBackground: { lineStyle: { color: "#9b6bff" }, areaStyle: { color: "rgba(155,107,255,.15)" } } }],
      series: [...bandSeries, ...main,
        { name: `SMA ${f1}`, type: "line", data: sma1, showSymbol: false, smooth: true, lineStyle: { color: "#ffc857", width: 1.3 } },
        { name: `SMA ${f2}`, type: "line", data: sma2, showSymbol: false, smooth: true, lineStyle: { color: "#3be7ff", width: 1.3, type: "dashed" } },
        ...osc]
    }, true);
  }

  function paintHeat() {
    const rows = view.rows;
    const ys = [...new Set(rows.map(r => r.date.slice(0, 4)))];
    const max = Math.max(...rows.map(r => r.total), 1);
    const h = 128;
    $("#uz-heat").style.height = `${Math.max(1, ys.length) * h + 40}px`;
    el.heat.resize();
    el.heat.setOption({
      tooltip: { ...TIP, formatter: p => `<b>${p.value[0]}</b><br>${fmt(p.value[1])} ${t.sar}` },
      visualMap: { min: 0, max: Math.round(max * .8), show: true, orient: "horizontal", left: "center", bottom: 0, itemHeight: 140, itemWidth: 10, textStyle: { color: "#7f789c", fontSize: 10 }, formatter: v => compact(v),
        inRange: { color: ["#161227", "#3a1f6e", "#7b3dd6", "#ff4fd8", "#3be7ff"] } },
      calendar: ys.map((y, i) => ({ top: 24 + i * h, left: 34, right: 8, cellSize: ["auto", 13], range: y, itemStyle: { color: "rgba(255,255,255,.025)", borderColor: "#05040a", borderWidth: 3 },
        splitLine: { show: false }, yearLabel: { color: "#bdb6d8", fontFamily: "Unbounded, sans-serif", fontSize: 11, position: ar ? "right" : "left", margin: 26 },
        dayLabel: { color: "#7f789c", fontSize: 9, firstDay: 0, nameMap: ar ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : ["S", "M", "T", "W", "T", "F", "S"] },
        monthLabel: { color: "#7f789c", fontSize: 10, nameMap: ar ? ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"] : "EN" } })),
      series: ys.map((y, i) => ({ type: "heatmap", coordinateSystem: "calendar", calendarIndex: i, data: rows.filter(r => r.date.startsWith(y)).map(r => [r.date, r.total]) }))
    }, true);
  }

  function paintFlow() {
    const rows = view.rows;
    const L = k => TENDERS[k][ar ? "ar" : "en"], G = k => GROUPS[k][ar ? "ar" : "en"];
    const vals = KEYS.map(k => [k, sum(rows, k)]).filter(([, v]) => v > 0);
    const groups = [...new Set(vals.map(([k]) => TENDERS[k].group))];
    el.flow.setOption({
      tooltip: { ...TIP, trigger: "item", valueFormatter: v => `${fmt(v)} ${t.sar}` },
      series: [{ type: "sankey", left: 4, right: 70, top: 10, bottom: 10, nodeWidth: 10, nodeGap: 10, draggable: false, emphasis: { focus: "adjacency" },
        label: { color: "#f2efff", fontSize: 11, fontFamily: "Bricolage Grotesque, system-ui", formatter: p => (p.value / (view.total || 1) > .004 ? p.name : "") },
        lineStyle: { color: "gradient", opacity: .35, curveness: .5 },
        data: [...vals.map(([k]) => ({ name: L(k), itemStyle: { color: TENDERS[k].color } })), ...groups.map(g => ({ name: G(g), itemStyle: { color: GROUPS[g].color } })), { name: t.rail, itemStyle: { color: "#9b6bff" } }],
        links: [...vals.map(([k, v]) => ({ source: L(k), target: G(TENDERS[k].group), value: Math.round(v) })),
                ...groups.map(g => ({ source: G(g), target: t.rail, value: Math.round(vals.filter(([k]) => TENDERS[k].group === g).reduce((a, [, v]) => a + v, 0)) }))] }]
    }, true);
  }

  function paintWeek() {
    const acc = Array.from({ length: 7 }, () => [0, 0]);
    view.rows.forEach(r => { const d = day(r.date).getDay(); acc[d][0] += r.total; acc[d][1]++; });
    const avg = acc.map(([s, n]) => (n ? Math.round(s / n) : 0));
    const top = Math.max(...avg);
    el.week.setOption({
      tooltip: { ...TIP, valueFormatter: v => `${fmt(v)} ${t.sar}` },
      angleAxis: { type: "category", data: t.weekdays, ...AXIS, axisLabel: { ...AXIS.axisLabel, fontSize: 11, color: "#bdb6d8" } },
      radiusAxis: { ...AXIS, axisLabel: { show: false }, splitLine: { lineStyle: { color: "rgba(190,170,255,.08)" } } },
      polar: { radius: ["12%", "78%"] },
      series: [{ type: "bar", coordinateSystem: "polar", name: t.avg, data: avg.map(v => ({ value: v, itemStyle: { color: v === top ? "#ff4fd8" : new window.echarts.graphic.LinearGradient(0, 0, 1, 1, [{ offset: 0, color: "#9b6bff" }, { offset: 1, color: "#3be7ff" }]) } })), roundCap: true, barWidth: 14 }]
    }, true);
  }

  function paintMix() {
    const months = byMonth(view.rows);
    const ks = KEYS.filter(k => months.some(m => m[k] > 0));
    el.mix.setOption({
      tooltip: { ...TIP, trigger: "axis", valueFormatter: v => fmt(v) },
      legend: { type: "scroll", bottom: 0, textStyle: { color: "#bdb6d8", fontSize: 10 }, itemWidth: 10, itemHeight: 6, pageIconColor: "#9b6bff", pageTextStyle: { color: "#7f789c" } },
      grid: { left: 8, right: 8, top: 14, bottom: 34, containLabel: true },
      xAxis: { type: "category", data: months.map(m => monthLabel(m.month, ar)), boundaryGap: false, ...AXIS, splitLine: { show: false } },
      yAxis: { ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
      series: ks.map(k => ({ name: TENDERS[k][ar ? "ar" : "en"], type: "line", stack: "mix", smooth: true, showSymbol: false, lineStyle: { width: .8, color: TENDERS[k].color },
        areaStyle: { color: TENDERS[k].color, opacity: .55 }, emphasis: { focus: "series" }, data: months.map(m => Math.round(m[k])) }))
    }, true);
  }

  function paintRecon() {
    const months = byMonth(view.rows);
    el.recon.setOption({
      tooltip: { ...TIP, trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: "#bdb6d8", fontSize: 10 }, itemWidth: 10, itemHeight: 6 },
      grid: { left: 8, right: 8, top: 14, bottom: 34, containLabel: true },
      xAxis: { type: "category", data: months.map(m => monthLabel(m.month, ar)), ...AXIS, splitLine: { show: false } },
      yAxis: [{ ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } }, { ...AXIS, min: v => Math.min(98, Math.floor(v.min)), max: 100, splitLine: { show: false }, axisLabel: { ...AXIS.axisLabel, formatter: v => `${v}%` } }],
      series: [
        { name: t.cols.excess, type: "bar", stack: "v", data: months.map(m => Math.round(m.excess)), itemStyle: { color: "#4cf0a8", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 16, tooltip: { valueFormatter: v => `${fmt(v)} ${t.sar}` } },
        { name: t.cols.shortage, type: "bar", stack: "v", data: months.map(m => -Math.round(m.shortage)), itemStyle: { color: "#ff5c7a", borderRadius: [0, 0, 4, 4] }, barMaxWidth: 16, tooltip: { valueFormatter: v => `${fmt(Math.abs(v))} ${t.sar}` } },
        { name: t.cols.acc, type: "line", yAxisIndex: 1, smooth: true, symbol: "circle", symbolSize: 5, lineStyle: { color: "#ffc857", width: 1.5 }, itemStyle: { color: "#ffc857" },
          data: months.map(m => +((1 - (m.excess + m.shortage) / (m.report || m.total || 1)) * 100).toFixed(2)), tooltip: { valueFormatter: v => `${v}%` } }
      ]
    }, true);
  }

  function paintBoard() {
    const m = new Map();
    view.rows.forEach(r => r.cashiers.forEach(c => {
      if (!m.has(c.user)) m.set(c.user, { user: c.user, handled: 0, shifts: 0, excess: 0, shortage: 0, days: [] });
      const o = m.get(c.user);
      o.handled += c.total || 0; o.shifts++; o.excess += c.excess || 0; o.shortage += c.shortage || 0;
    }));
    const list = [...m.values()].filter(o => o.handled > 0).sort((a, b) => b.handled - a.handled);
    const top = list[0]?.handled || 1;
    $("#uz-board").innerHTML = list.map((o, i) => {
      const kiosk = /kiosk/i.test(o.user);
      const acc = o.handled ? 1 - (o.excess + o.shortage) / o.handled : 1;
      const initials = o.user.split(" ").slice(0, 2).map(s => s[0]).join("");
      const tier = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
      return `<div class="uz-val ${tier}">
        <span class="uz-rank data">${String(i + 1).padStart(2, "0")}</span>
        <span class="uz-avatar" style="--h:${parseInt(hash(o.user).slice(0, 3), 16) % 360}">${kiosk ? "⌁" : esc(initials)}</span>
        <div class="uz-val-id"><b>${esc(o.user)}</b><small class="data">0x${hash(o.user)} · ${fmt(o.shifts)} ${t.cols.shifts}</small></div>
        <div class="uz-val-bar"><i style="width:${o.handled / top * 100}%"></i></div>
        <div class="uz-val-n"><b class="data">${compact(o.handled)}</b><small class="data">${compact(o.handled / o.shifts)} / ${ar ? "وردية" : "shift"}</small></div>
        <span class="uz-acc ${acc >= .995 ? "hi" : acc >= .98 ? "mid" : "lo"} data">${pct(acc, 1)}</span>
      </div>`;
    }).join("") || `<p class="uz-empty">${t.empty}</p>`;
  }

  function status(r) {
    const v = (r.excess || 0) - (r.shortage || 0);
    if (Math.abs(v) < 1) return ["ok", t.ok];
    return v > 0 ? ["over", t.over] : ["short", t.short];
  }

  function tableData() {
    const h = window.gridjs.html;
    if (ui.tab === "months") {
      const months = byMonth(view.rows);
      const c = t.cols;
      return {
        columns: [c.month, c.days, c.total, c.mom, c.cash, c.card, c.online, c.delivery, c.promo, c.excess, c.shortage, c.acc],
        csv: months.map((m, i) => [m.month, m.days, m.total, i ? (m.total - months[i - 1].total) / months[i - 1].total : "", m.cash, m.card, m.online, delivery(m), promo(m), m.excess, m.shortage, 1 - (m.excess + m.shortage) / (m.report || m.total || 1)]),
        data: months.map((m, i) => {
          const d = i ? delta(m.total, months[i - 1].total) : null;
          const acc = 1 - (m.excess + m.shortage) / (m.report || m.total || 1);
          return [monthLabel(m.month, ar), m.days, h(`<b class="data">${fmt(m.total)}</b>`), h(chip(d)), fmt(m.cash), fmt(m.card), fmt(m.online), fmt(delivery(m)), fmt(promo(m)),
            h(`<span class="pos data">${fmt(m.excess)}</span>`), h(`<span class="neg data">${fmt(m.shortage)}</span>`), h(`<span class="data">${pct(acc, 2)}</span>`)];
        })
      };
    }
    const c = t.cols;
    const idx = new Map(days.map((d, i) => [d.date, i + 1]));
    const rows = view.rows.slice().reverse();
    return {
      columns: [c.block, c.hash, c.date, c.total, c.cash, c.card, c.online, c.delivery, c.promo, c.variance, c.status],
      csv: rows.map(r => [idx.get(r.date), txHash(r), r.date, r.total, r.cash || 0, r.card || 0, r.online || 0, delivery(r), promo(r), (r.excess || 0) - (r.shortage || 0), status(r)[1]]),
      data: rows.map(r => {
        const [cls, label] = status(r);
        const v = (r.excess || 0) - (r.shortage || 0);
        return [h(`<span class="uz-blk data">#${idx.get(r.date)}</span>`), h(`<span class="uz-hash data" title="${txHash(r)}">${short(txHash(r))}</span>`), r.date,
          h(`<b class="data">${fmt(r.total, 2)}</b>`), fmt(r.cash || 0), fmt(r.card || 0), fmt(r.online || 0), fmt(delivery(r)), fmt(promo(r)),
          h(`<span class="data ${v > 0 ? "pos" : v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${fmt(v, 2)}</span>`), h(`<span class="uz-pill ${cls}">${label}</span>`)];
      })
    };
  }

  let csvRows = [], csvCols = [];
  function paintGrid() {
    const { columns, data: rows, csv } = tableData();
    csvRows = csv; csvCols = columns;
    const host = $("#uz-grid");
    host.innerHTML = "";
    grid = new window.gridjs.Grid({
      columns, data: rows, sort: true, search: { placeholder: ar ? "ابحث بالتاريخ أو المبلغ…" : "Search date, hash, amount…" },
      pagination: { limit: ui.tab === "months" ? 24 : 12, summary: true }, fixedHeader: false,
      language: ar ? { search: { placeholder: "ابحث…" }, pagination: { previous: "السابق", next: "التالي", showing: "عرض", of: "من", to: "إلى", results: () => "سجل" }, noRecordsFound: "لا توجد نتائج" } : {},
      className: { table: "uz-table" }
    }).render(host);
  }

  function paintIntegrity() {
    const ranges = gapRanges(data.missing_days || []);
    const span = Math.round((day(latest.date) - day(days[0].date)) / 864e5) + 1;
    $("#uz-int").innerHTML = `
      <div class="uz-int-stats">
        <div><p>${t.coverage}</p><b class="data">${pct(days.length / span, 1)}</b><small class="data">${fmt(days.length)} / ${fmt(span)}</small></div>
        <div><p>${t.sources}</p><b class="data">${fmt(sources)}</b><small>DCS · xlsx · xls · ods</small></div>
        <div><p>${t.built}</p><b class="data">${esc((data.built || "").replace("T", " "))}</b><small>unaizah/build.py</small></div>
      </div>
      ${ranges.length ? `<div class="uz-gaps"><p>${t.gaps} · <span>${t.noFile}</span></p>${ranges.map(([a, b]) => `<span class="uz-gap data">${a === b ? a : `${a} → ${b}`}</span>`).join("")}</div>` : ""}`;
  }

  function paintAll() {
    view = window_(days, ui.period);
    view.total = sum(view.rows, "total");
    root.querySelectorAll(".uz-periods button").forEach(b => b.classList.toggle("on", b.dataset.p === ui.period));
    root.querySelectorAll("#uz-mode button").forEach(b => b.classList.toggle("on", b.dataset.v === ui.mode));
    root.querySelectorAll("#uz-osc button").forEach(b => b.classList.toggle("on", b.dataset.v === ui.osc));
    root.querySelectorAll("#uz-tab button").forEach(b => b.classList.toggle("on", b.dataset.v === ui.tab));
    const s = stats(view.rows), p = stats(view.prev);
    paintHero(s, p); paintKpis(s, p); paintTokens(); paintPrice(); paintHeat(); paintFlow(); paintWeek(); paintMix(); paintRecon(); paintBoard(); paintGrid();
  }

  root.querySelector(".uz-periods").onclick = e => { const b = e.target.closest("button"); if (!b) return; ui.period = b.dataset.p; sessionStorage.setItem("uz-period", ui.period); paintAll(); };
  $("#uz-mode").onclick = e => { const b = e.target.closest("button"); if (!b) return; ui.mode = b.dataset.v; root.querySelectorAll("#uz-mode button").forEach(x => x.classList.toggle("on", x === b)); paintPrice(); };
  $("#uz-osc").onclick = e => { const b = e.target.closest("button"); if (!b) return; ui.osc = b.dataset.v; root.querySelectorAll("#uz-osc button").forEach(x => x.classList.toggle("on", x === b)); paintPrice(); };
  $("#uz-tab").onclick = e => { const b = e.target.closest("button"); if (!b) return; ui.tab = b.dataset.v; root.querySelectorAll("#uz-tab button").forEach(x => x.classList.toggle("on", x === b)); paintGrid(); };
  $("#uz-csv").onclick = () => {
    const q = v => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : typeof v === "number" ? +v.toFixed(4) : v);
    const text = "﻿" + [csvCols, ...csvRows].map(r => r.map(q).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = `unaizah-${ui.tab}-${view.from}_${view.to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (!periods.includes(ui.period)) ui.period = "ytd";
  paintIntegrity();
  paintAll();
}

// Unaizah treasury — daily DCS ledger rebuilt by unaizah/build.py.
// Libraries (all open source on GitHub):
//   charts      github.com/apache/echarts
//   indicators  github.com/anandanand84/technicalindicators  (SMA · Bollinger · RSI · MACD)
//   counters    github.com/inorganik/countUp.js
// Vendored copies of the npm releases live in vendor/ so the board works offline.
import { timePinOk } from "../core/time-pin.js?v=85";
const CDN = {
  echarts: "vendor/echarts.min.js",
  ta: "vendor/technicalindicators.min.js",
  countup: "vendor/countUp.umd.js"
};
const lang = () => sessionStorage.getItem("noir-lang") || "en";

const TENDERS = {
  cash:    { en: "Cash",        ar: "كاش",          icon: "assets/pay/cash.webp",    color: "#3ed69e", group: "cash" },
  card:    { en: "Credit card", ar: "شبكة",         icon: "assets/pay/card.webp",    color: "#6ccbff", group: "digital" },
  online:  { en: "Online",      ar: "أونلاين",      icon: "assets/pay/online.webp",  color: "#5b7bff", group: "digital" },
  prepaid: { en: "Pre-paid",    ar: "مسبق الدفع",   icon: "assets/pay/prepaid.webp", color: "#ffb547", group: "digital" },
  jahez:   { en: "Jahez",       ar: "جاهز",         icon: "assets/pay/jahez.webp",   color: "#ff3b5c", group: "delivery" },
  hunger:  { en: "HungerStation", ar: "هنقرستيشن",  icon: "assets/pay/hunger.webp",  color: "#ffd400", group: "delivery" },
  voucher: { en: "Voucher",     ar: "قسيمة",        icon: "assets/pay/voucher.webp", color: "#ff7a59", group: "promo" },
  bogo:    { en: "Buy 1 get 1", ar: "اشتر ١ واحصل ١", icon: "assets/pay/bogo.webp",  color: "#dce6ff", group: "promo" },
  comp:    { en: "Comp",        ar: "ضيافة",        icon: "assets/pay/noir.webp",    color: "#8fa6ff", group: "promo" },
  other:   { en: "Other",       ar: "أخرى",         icon: null,                     color: "#a3adbf", group: "promo" }
};
const KEYS = Object.keys(TENDERS);
const GROUPS = {
  cash:     { en: "Cash vault",      ar: "خزنة الكاش",   color: "#3ed69e" },
  digital:  { en: "Digital rails",   ar: "الدفع الرقمي", color: "#6ccbff" },
  delivery: { en: "Delivery apps",   ar: "تطبيقات التوصيل", color: "#ffd400" },
  promo:    { en: "Promo & vouchers", ar: "العروض والقسائم", color: "#dce6ff" }
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
    cashT: "Cash & deposits", cashSub: "Cash collected per month from the DCS, what was counted into the safe, and the drawer excess and shortage — line it up with the bank deposit file.",
    cashCols: { month: "Month", days: "Days", cash: "Cash (DCS)", safe: "Counted to safe", diff: "Cash − safe", excess: "Excess", shortage: "Shortage", net: "Net", onHand: "On hand (month end)", check: "Check" },
    cashOk: "Matches", cashCheck: "Review", cashTotal: "Total", cashDays: "Days to review", cashDaysNone: "Every counted day matches its cash total.", cashExport: "Export cash CSV", notCounted: "not counted",
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
    cashT: "الكاش والإيداعات", cashSub: "الكاش المحصّل شهرياً من ملفات DCS، والمبلغ المعدود للخزنة، والزيادة والعجز — قارنه مع ملف الإيداع البنكي.",
    cashCols: { month: "الشهر", days: "الأيام", cash: "الكاش (DCS)", safe: "المعدود للخزنة", diff: "الكاش − الخزنة", excess: "زيادة", shortage: "عجز", net: "الصافي", onHand: "الرصيد آخر الشهر", check: "التحقق" },
    cashOk: "مطابق", cashCheck: "راجع", cashTotal: "الإجمالي", cashDays: "أيام تحتاج مراجعة", cashDaysNone: "كل الأيام المعدودة مطابقة لإجمالي الكاش.", cashExport: "تصدير الكاش CSV", notCounted: "غير معدود",
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
let renderId = 0;
const chart = el => { const c = window.echarts.init(el, null, { renderer: "canvas" }); charts.push(c); return c; };
function dispose() {
  charts.forEach(c => c.dispose()); charts = []; observer?.disconnect();
}

const AXIS = { axisLine: { lineStyle: { color: "rgba(150,170,210,.18)" } }, axisLabel: { color: "#687286", fontFamily: "Geist Mono, monospace", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(150,170,210,.07)" } } };
const TIP = { backgroundColor: "rgba(8,11,16,.94)", borderColor: "rgba(91,123,255,.45)", textStyle: { color: "#edf1f8", fontFamily: "Geist, system-ui", fontSize: 12 }, extraCssText: "backdrop-filter:blur(10px);border-radius:12px;box-shadow:0 10px 40px rgba(91,123,255,.25)" };

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
export async function renderUnaizah(root, H = {}) {
  const id = ++renderId;
  dispose();
  const ar = lang() === "ar", t = T[ar ? "ar" : "en"];
  root.innerHTML = `<div class="uz-loading"><i></i><span>${ar ? "مزامنة البلوكات…" : "Syncing blocks…"}</span></div>`;
  let data, rdr = null;
  const docs = name => H.allDocs ? H.allDocs(name).catch(() => []) : Promise.resolve([]);
  try {
    let dcsUps, rdrBase, rdrUps;
    [data, dcsUps, rdrBase, rdrUps] = await Promise.all([
      fetch(`unaizah/ledger.json?v=${Date.now() / 36e5 | 0}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      docs("dcs"), fetch("finance/rdr.json").then(r => r.ok ? r.json() : null).catch(() => null), docs("rdr"),
      load(CDN.echarts), load(CDN.ta), load(CDN.countup)
    ]);
    // DCS months uploaded from Settings sit on top of the built ledger
    if (dcsUps.length) data = (await import("./fin-dcs.js?v=85")).mergeLedger(data, dcsUps);
    rdr = [rdrBase, ...rdrUps].filter(Boolean).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""))[0] || null;
  } catch (e) {
    root.innerHTML = `<div class="uz-error">${ar ? "تعذر تحميل بيانات عنيزة." : "Could not load the Unaizah ledger."} <small>${esc(e.message)}</small></div>`;
    return;
  }
  if (id !== renderId || !root.isConnected) return; // a newer render took over while this one was loading
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
        <div class="uz-logo"><img src="assets/pay/noir.webp" alt="Noir Cinema"></div>
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
    <div id="uz-analyst" class="an-host"></div>
    <section class="uz-card ra" id="uz-rdr"></section>

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

    <section class="uz-card" id="uz-cash-card">
      <div class="uz-h"><div><h3>${t.cashT}</h3><p>${t.cashSub}</p></div><button type="button" class="uz-btn" id="uz-cash-csv">${t.cashExport}</button></div>
      <div class="uz-cash" id="uz-cash"></div>
    </section>

    <section class="uz-card uz-audit" id="uz-audit"></section>

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
  import("./fin-analyst.js?v=85").then(m => m.ledgerReport($("#uz-analyst"), days, { ar }))
    .catch(e => console.warn("Analyst report unavailable", e));
  import("./fin-audit.js?v=85").then(m => m.renderRdrAudit($("#uz-rdr"), { rdr, days, ar, echarts: window.echarts }))
    .catch(e => console.warn("Cash office audit unavailable", e));

  let view = { rows: [], prev: [] };
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
      osc = [{ name: "RSI", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: r.map(v => v && +v.toFixed(1)), showSymbol: false, lineStyle: { color: "#ffb547", width: 1.4 },
        markLine: { silent: true, symbol: "none", label: { color: "#687286", fontSize: 9 }, lineStyle: { type: "dashed", color: "rgba(255,84,104,.5)" }, data: [{ yAxis: 70 }, { yAxis: 30, lineStyle: { color: "rgba(62,214,158,.5)" } }] },
        markArea: { silent: true, itemStyle: { color: "rgba(91,123,255,.06)" }, data: [[{ yAxis: 30 }, { yAxis: 70 }]] } }];
    } else {
      const m = base.length >= 35 ? pad(MACD.calculate({ values: base, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }), base.length) : Array(base.length).fill(null);
      osc = [
        { name: "Histogram", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: m.map(v => v && v.histogram != null ? { value: +v.histogram.toFixed(0), itemStyle: { color: v.histogram >= 0 ? "rgba(62,214,158,.75)" : "rgba(255,84,104,.75)" } } : null), barMaxWidth: 6 },
        { name: "MACD", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: m.map(v => v && v.MACD != null ? +v.MACD.toFixed(0) : null), showSymbol: false, lineStyle: { color: "#6ccbff", width: 1.2 } },
        { name: "Signal", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: m.map(v => v && v.signal != null ? +v.signal.toFixed(0) : null), showSymbol: false, lineStyle: { color: "#dce6ff", width: 1.2 } }
      ];
    }
    const main = weekly
      ? [{ name: ar ? "أسبوع" : "Week", type: "candlestick", data: w.map(d => [d.o, d.c, d.l, d.h]), itemStyle: { color: "#3ed69e", color0: "#ff5468", borderColor: "#3ed69e", borderColor0: "#ff5468" } },
         { name: ar ? "إجمالي الأسبوع" : "Week total", type: "bar", yAxisIndex: 2, data: w?.map(d => Math.round(d.sum)), itemStyle: { color: "rgba(91,123,255,.18)" }, barMaxWidth: 14, z: 0 }]
      : [{ name: ar ? "الإيراد" : "Revenue", type: "line", data: close, showSymbol: false, smooth: .25, lineStyle: { width: 1.8, color: "#edf1f8" },
           areaStyle: { color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(220,230,255,.35)" }, { offset: 1, color: "rgba(91,123,255,0)" }]) } }];
    const bandSeries = [
      { name: "BB low", type: "line", data: lower, stack: "bb", lineStyle: { opacity: 0 }, showSymbol: false, silent: true, tooltip: { show: false } },
      { name: "Bollinger", type: "line", data: band, stack: "bb", lineStyle: { opacity: 0 }, showSymbol: false, areaStyle: { color: "rgba(108,203,255,.08)" }, silent: true, tooltip: { show: false } }
    ];
    el.price.setOption({
      animationDuration: 900, backgroundColor: "transparent",
      legend: { top: 0, textStyle: { color: "#a3adbf", fontSize: 11 }, icon: "roundRect", itemWidth: 10, itemHeight: 4, data: [main[0].name, `SMA ${f1}`, `SMA ${f2}`, "Bollinger", ...osc.map(o => o.name)] },
      tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: "rgba(220,230,255,.5)" }, crossStyle: { color: "rgba(220,230,255,.5)" }, label: { backgroundColor: "#1a2440" } },
        valueFormatter: v => (Array.isArray(v) ? v.map(fmt).join(" / ") : v == null ? "—" : fmt(v)) },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [{ left: 8, right: 8, top: 34, height: "58%", containLabel: true }, { left: 8, right: 8, top: "76%", height: "14%", containLabel: true }],
      xAxis: [{ type: "category", data: x, boundaryGap: weekly, ...AXIS, axisLabel: { ...AXIS.axisLabel, show: false }, splitLine: { show: false } },
              { type: "category", gridIndex: 1, data: x, boundaryGap: weekly, ...AXIS, splitLine: { show: false } }],
      yAxis: [{ scale: false, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } },
              { gridIndex: 1, ...AXIS, splitNumber: 2, axisLabel: { ...AXIS.axisLabel, formatter: compact }, ...(ui.osc === "rsi" ? { min: 0, max: 100 } : {}) },
              { show: false, gridIndex: 0 }],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1] }, { type: "slider", xAxisIndex: [0, 1], bottom: 0, height: 16, borderColor: "transparent", backgroundColor: "rgba(91,123,255,.06)", fillerColor: "rgba(91,123,255,.18)", handleStyle: { color: "#5b7bff" }, textStyle: { color: "#687286" }, dataBackground: { lineStyle: { color: "#5b7bff" }, areaStyle: { color: "rgba(91,123,255,.15)" } } }],
      series: [...bandSeries, ...main,
        { name: `SMA ${f1}`, type: "line", data: sma1, showSymbol: false, smooth: true, lineStyle: { color: "#ffb547", width: 1.3 } },
        { name: `SMA ${f2}`, type: "line", data: sma2, showSymbol: false, smooth: true, lineStyle: { color: "#6ccbff", width: 1.3, type: "dashed" } },
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
      visualMap: { min: 0, max: Math.round(max * .8), show: true, orient: "horizontal", left: "center", bottom: 0, itemHeight: 140, itemWidth: 10, textStyle: { color: "#687286", fontSize: 10 }, formatter: v => compact(v),
        inRange: { color: ["#161227", "#1d2a4a", "#4c6bff", "#dce6ff", "#6ccbff"] } },
      calendar: ys.map((y, i) => ({ top: 24 + i * h, left: 34, right: 8, cellSize: ["auto", 13], range: y, itemStyle: { color: "rgba(255,255,255,.025)", borderColor: "#000000", borderWidth: 3 },
        splitLine: { show: false }, yearLabel: { color: "#a3adbf", fontFamily: "Geist, sans-serif", fontSize: 11, position: ar ? "right" : "left", margin: 26 },
        dayLabel: { color: "#687286", fontSize: 9, firstDay: 0, nameMap: ar ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : ["S", "M", "T", "W", "T", "F", "S"] },
        monthLabel: { color: "#687286", fontSize: 10, nameMap: ar ? ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"] : "EN" } })),
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
        label: { color: "#edf1f8", fontSize: 11, fontFamily: "Geist, system-ui", formatter: p => (p.value / (view.total || 1) > .004 ? p.name : "") },
        lineStyle: { color: "gradient", opacity: .35, curveness: .5 },
        data: [...vals.map(([k]) => ({ name: L(k), itemStyle: { color: TENDERS[k].color } })), ...groups.map(g => ({ name: G(g), itemStyle: { color: GROUPS[g].color } })), { name: t.rail, itemStyle: { color: "#5b7bff" } }],
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
      angleAxis: { type: "category", data: t.weekdays, ...AXIS, axisLabel: { ...AXIS.axisLabel, fontSize: 11, color: "#a3adbf" } },
      radiusAxis: { ...AXIS, axisLabel: { show: false }, splitLine: { lineStyle: { color: "rgba(150,170,210,.08)" } } },
      polar: { radius: ["12%", "78%"] },
      series: [{ type: "bar", coordinateSystem: "polar", name: t.avg, data: avg.map(v => ({ value: v, itemStyle: { color: v === top ? "#dce6ff" : new window.echarts.graphic.LinearGradient(0, 0, 1, 1, [{ offset: 0, color: "#5b7bff" }, { offset: 1, color: "#6ccbff" }]) } })), roundCap: true, barWidth: 14 }]
    }, true);
  }

  function paintMix() {
    const months = byMonth(view.rows);
    const ks = KEYS.filter(k => months.some(m => m[k] > 0));
    el.mix.setOption({
      tooltip: { ...TIP, trigger: "axis", valueFormatter: v => fmt(v) },
      legend: { type: "scroll", bottom: 0, textStyle: { color: "#a3adbf", fontSize: 10 }, itemWidth: 10, itemHeight: 6, pageIconColor: "#5b7bff", pageTextStyle: { color: "#687286" } },
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
      legend: { bottom: 0, textStyle: { color: "#a3adbf", fontSize: 10 }, itemWidth: 10, itemHeight: 6 },
      grid: { left: 8, right: 8, top: 14, bottom: 34, containLabel: true },
      xAxis: { type: "category", data: months.map(m => monthLabel(m.month, ar)), ...AXIS, splitLine: { show: false } },
      yAxis: [{ ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: compact } }, { ...AXIS, min: v => Math.min(98, Math.floor(v.min)), max: 100, splitLine: { show: false }, axisLabel: { ...AXIS.axisLabel, formatter: v => `${v}%` } }],
      series: [
        { name: t.cols.excess, type: "bar", stack: "v", data: months.map(m => Math.round(m.excess)), itemStyle: { color: "#3ed69e", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 16, tooltip: { valueFormatter: v => `${fmt(v)} ${t.sar}` } },
        { name: t.cols.shortage, type: "bar", stack: "v", data: months.map(m => -Math.round(m.shortage)), itemStyle: { color: "#ff5468", borderRadius: [0, 0, 4, 4] }, barMaxWidth: 16, tooltip: { valueFormatter: v => `${fmt(Math.abs(v))} ${t.sar}` } },
        { name: t.cols.acc, type: "line", yAxisIndex: 1, smooth: true, symbol: "circle", symbolSize: 5, lineStyle: { color: "#ffb547", width: 1.5 }, itemStyle: { color: "#ffb547" },
          data: months.map(m => +((1 - (m.excess + m.shortage) / (m.report || m.total || 1)) * 100).toFixed(2)), tooltip: { valueFormatter: v => `${v}%` } }
      ]
    }, true);
  }

  let cashCsv = [];
  function paintCash() {
    const rows = view.rows;
    const months = new Map();
    rows.forEach(r => {
      const k = r.date.slice(0, 7);
      if (!months.has(k)) months.set(k, { month: k, days: 0, cash: 0, safe: 0, counted: 0, cashCounted: 0, excess: 0, shortage: 0, onHand: null });
      const m = months.get(k);
      m.days++; m.cash += r.cash || 0; m.excess += r.excess || 0; m.shortage += r.shortage || 0;
      if (r.safe != null) { m.safe += r.safe; m.counted++; m.cashCounted += r.cash || 0; }
      if (r.on_hand != null) m.onHand = r.on_hand;
    });
    const list = [...months.values()];
    const c = t.cashCols;
    const tot = list.reduce((a, m) => ({ days: a.days + m.days, cash: a.cash + m.cash, safe: a.safe + m.safe, cashCounted: a.cashCounted + m.cashCounted, excess: a.excess + m.excess, shortage: a.shortage + m.shortage }), { days: 0, cash: 0, safe: 0, cashCounted: 0, excess: 0, shortage: 0 });
    const money2 = n => fmt(n, 2);
    const row = m => {
      const diff = m.counted ? m.cashCounted - m.safe : null;
      const net = m.excess - m.shortage;
      const ok = diff == null ? null : Math.abs(diff) <= 1;
      return `<tr>
        <td>${monthLabel(m.month, ar)}</td><td class="data">${m.days}</td>
        <td class="data"><b>${money2(m.cash)}</b></td>
        <td class="data">${m.counted ? money2(m.safe) : `<small>${t.notCounted}</small>`}${m.counted && m.counted < m.days ? ` <small>(${m.counted}/${m.days})</small>` : ""}</td>
        <td class="data ${diff == null ? "" : ok ? "" : "neg"}">${diff == null ? "—" : money2(diff)}</td>
        <td class="data pos">${money2(m.excess)}</td><td class="data neg">${money2(m.shortage)}</td>
        <td class="data ${net > 0 ? "pos" : net < 0 ? "neg" : ""}">${net > 0 ? "+" : ""}${money2(net)}</td>
        <td class="data">${m.onHand == null ? "—" : money2(m.onHand)}</td></tr>`;
    };
    cashCsv = [[c.month, c.days, c.cash, c.safe, c.diff, c.excess, c.shortage, c.net, c.onHand],
      ...list.map(m => [m.month, m.days, +m.cash.toFixed(2), m.counted ? +m.safe.toFixed(2) : "", m.counted ? +(m.cashCounted - m.safe).toFixed(2) : "", +m.excess.toFixed(2), +m.shortage.toFixed(2), +(m.excess - m.shortage).toFixed(2), m.onHand ?? ""]),
      [t.cashTotal, tot.days, +tot.cash.toFixed(2), +tot.safe.toFixed(2), +(tot.cashCounted - tot.safe).toFixed(2), +tot.excess.toFixed(2), +tot.shortage.toFixed(2), +(tot.excess - tot.shortage).toFixed(2), ""]];
    const net = tot.excess - tot.shortage;
    $("#uz-cash").innerHTML = `
      <div class="uz-cash-kpis">
        <div><p>${c.cash}</p><b class="data">${money2(tot.cash)}</b></div>
        <div><p>${c.safe}</p><b class="data">${money2(tot.safe)}</b></div>
        <div><p>${c.excess}</p><b class="data pos">${money2(tot.excess)}</b></div>
        <div><p>${c.shortage}</p><b class="data neg">${money2(tot.shortage)}</b></div>
        <div><p>${c.net}</p><b class="data ${net >= 0 ? "pos" : "neg"}">${net > 0 ? "+" : ""}${money2(net)}</b></div>
      </div>
      <div class="fx-table-wrap"><table class="fx-table uz-cash-table">
        <thead><tr>${[c.month, c.days, c.cash, c.safe, c.diff, c.excess, c.shortage, c.net, c.onHand].map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${list.slice().reverse().map(row).join("")}</tbody>
        <tfoot><tr><td>${t.cashTotal}</td><td class="data">${tot.days}</td><td class="data">${money2(tot.cash)}</td><td class="data">${money2(tot.safe)}</td><td class="data">${money2(tot.cashCounted - tot.safe)}</td><td class="data pos">${money2(tot.excess)}</td><td class="data neg">${money2(tot.shortage)}</td><td class="data ${net >= 0 ? "pos" : "neg"}">${net > 0 ? "+" : ""}${money2(net)}</td><td></td><td></td></tr></tfoot>
      </table></div>`;
  }

  // Audit · Committee · Inquiry — only after the settings PIN (same unlock as Settings)
  function paintAudit() {
    const host = $("#uz-audit"); if (!host) return;
    const A = ar ? { title: "أوديت · لجنة · تساؤل", sub: "يفتح بالرقم السري حق الإعدادات.", pin: "الرقم السري", open: "فتح", bad: "الرقم غلط",
        committee: "لجنة", audit: "أوديت", inquiry: "تساؤل", rule: "لجنة ≥ 500 ر.س · أوديت ≥ 100 ر.س · تساؤل أقل من 100", none: "لا يوجد",
        day: "اليوم", amt: "المبلغ", why: "السبب", cashSafe: "الكاش ≠ المعدود للخزنة", short: "عجز", over: "زيادة", cashier: "الكاشير", shifts: "ورديات", lock: "قفل" }
      : { title: "Audit · Committee · Inquiry", sub: "Opens with the Settings PIN.", pin: "PIN", open: "Open", bad: "Wrong PIN",
        committee: "Committee", audit: "Audit", inquiry: "Inquiry", rule: "Committee ≥ 500 SAR · Audit ≥ 100 SAR · Inquiry under 100", none: "None",
        day: "Day", amt: "Amount", why: "Reason", cashSafe: "Cash ≠ counted to safe", short: "Shortage", over: "Excess", cashier: "Cashier", shifts: "shifts", lock: "Lock" };
    if (sessionStorage.getItem("noir-admin") !== "1") {
      host.innerHTML = `<div class="uz-h"><div><h3><svg class="ic-lock" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> ${A.title}</h3><p>${A.sub}</p></div></div>
        <form class="uz-lock" id="uz-lock"><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="${A.pin}" aria-label="${A.pin}"><button class="uz-btn" type="submit">${A.open}</button></form>`;
      host.querySelector("#uz-lock").onsubmit = e => {
        e.preventDefault();
        if (!timePinOk(e.target.pin.value)) { e.target.pin.value = ""; e.target.pin.placeholder = A.bad; return; }
        sessionStorage.setItem("noir-admin", "1"); paintAudit();
      };
      return;
    }
    const cls = a => a >= 500 ? "committee" : a >= 100 ? "audit" : "inquiry";
    const items = [];
    view.rows.forEach(r => {
      const diff = r.safe != null ? (r.cash || 0) - r.safe : 0;
      if (Math.abs(diff) > 1) items.push({ k: cls(Math.abs(diff)), day: r.date, amt: diff, why: A.cashSafe, who: (r.cashiers || []).map(c => c.user).filter(u => !/kiosk/i.test(u)).join("، ") });
      if ((r.shortage || 0) > 1) items.push({ k: cls(r.shortage), day: r.date, amt: -r.shortage, why: A.short, who: (r.cashiers || []).filter(c => (c.shortage || 0) > 0).map(c => c.user).join("، ") });
      if ((r.excess || 0) > 1) items.push({ k: cls(r.excess), day: r.date, amt: r.excess, why: A.over, who: (r.cashiers || []).filter(c => (c.excess || 0) > 0).map(c => c.user).join("، ") });
    });
    const groups = ["committee", "audit", "inquiry"].map(k => ({ k, list: items.filter(i => i.k === k).sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt)) }));
    const money2 = n => fmt(n, 2);
    host.innerHTML = `<div class="uz-h"><div><h3>${A.title}</h3><p>${A.rule}</p></div><button type="button" class="uz-btn" id="uz-audit-lock">${A.lock}</button></div>
      <div class="uz-audit-grid">${groups.map(g => `<div class="uz-aud uz-aud-${g.k}"><header><b>${A[g.k]}</b><span class="data">${g.list.length} · ${money2(g.list.reduce((s, i) => s + Math.abs(i.amt), 0))}</span></header>
        ${g.list.slice(0, 40).map(i => `<div class="uz-aud-row"><span class="data">${i.day}</span><b class="data ${i.amt < 0 ? "neg" : "pos"}">${i.amt > 0 ? "+" : ""}${money2(i.amt)}</b><em>${esc(i.why)}${i.who ? ` · ${esc(i.who)}` : ""}</em></div>`).join("") || `<p class="uz-empty">${A.none}</p>`}</div>`).join("")}</div>`;
    import("./fin-analyst.js?v=85").then(m => {
      const cz = m.cashierAudit(view.rows).filter(c => c.short >= 50);
      if (!cz.length || !host.isConnected) return;
      host.insertAdjacentHTML("beforeend", `<div class="uz-aud-cashiers"><h4>${A.cashier}</h4>${cz.map(c => `<span class="uz-aud-chip uz-aud-${cls(c.short)}"><b>${esc(c.user)}</b> <i class="data">${money2(c.short)}</i> · ${c.shifts} ${A.shifts} · ${A[cls(c.short)]}</span>`).join("")}</div>`);
    }).catch(() => {});
    host.querySelector("#uz-audit-lock").onclick = () => { sessionStorage.removeItem("noir-admin"); paintAudit(); };
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

  // cell = [html, sortValue]; plain values are both
  const cell = (html, sort) => [html, sort === undefined ? html : sort];
  function tableData() {
    const c = t.cols;
    if (ui.tab === "months") {
      const months = byMonth(view.rows);
      return {
        columns: [c.month, c.days, c.total, c.mom, c.cash, c.card, c.online, c.delivery, c.promo, c.excess, c.shortage, c.acc],
        csv: months.map((m, i) => [m.month, m.days, m.total, i ? (m.total - months[i - 1].total) / months[i - 1].total : "", m.cash, m.card, m.online, delivery(m), promo(m), m.excess, m.shortage, 1 - (m.excess + m.shortage) / (m.report || m.total || 1)]),
        rows: months.map((m, i) => {
          const d = i ? delta(m.total, months[i - 1].total) : null;
          const acc = 1 - (m.excess + m.shortage) / (m.report || m.total || 1);
          return [cell(monthLabel(m.month, ar), m.month), cell(m.days), cell(`<b class="data">${fmt(m.total)}</b>`, m.total), cell(chip(d), d ?? -Infinity),
            cell(fmt(m.cash), m.cash), cell(fmt(m.card), m.card), cell(fmt(m.online), m.online), cell(fmt(delivery(m)), delivery(m)), cell(fmt(promo(m)), promo(m)),
            cell(`<span class="pos data">${fmt(m.excess)}</span>`, m.excess), cell(`<span class="neg data">${fmt(m.shortage)}</span>`, m.shortage), cell(`<span class="data">${pct(acc, 2)}</span>`, acc)];
        }).reverse()
      };
    }
    const idx = new Map(days.map((d, i) => [d.date, i + 1]));
    const rows = view.rows.slice().reverse();
    return {
      columns: [c.block, c.hash, c.date, c.total, c.cash, c.card, c.online, c.delivery, c.promo, c.variance, c.status],
      csv: rows.map(r => [idx.get(r.date), txHash(r), r.date, r.total, r.cash || 0, r.card || 0, r.online || 0, delivery(r), promo(r), (r.excess || 0) - (r.shortage || 0), status(r)[1]]),
      rows: rows.map(r => {
        const [cls, label] = status(r);
        const v = (r.excess || 0) - (r.shortage || 0);
        const hsh = txHash(r);
        return [cell(`<span class="uz-blk data">#${idx.get(r.date)}</span>`, idx.get(r.date)), cell(`<span class="uz-hash data" title="${hsh}">${short(hsh)}</span>`, hsh), cell(r.date),
          cell(`<b class="data">${fmt(r.total, 2)}</b>`, r.total), cell(fmt(r.cash || 0), r.cash || 0), cell(fmt(r.card || 0), r.card || 0), cell(fmt(r.online || 0), r.online || 0),
          cell(fmt(delivery(r)), delivery(r)), cell(fmt(promo(r)), promo(r)),
          cell(`<span class="data ${v > 0 ? "pos" : v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${fmt(v, 2)}</span>`, v), cell(`<span class="uz-pill ${cls}">${label}</span>`, label)];
      })
    };
  }

  // Block explorer table: search, sort and pages, kept in plain DOM so it never races a re-render.
  let csvRows = [], csvCols = [];
  const table = { q: "", sort: null, dir: 1, page: 0 };
  function paintGrid(reset = true) {
    const { columns, rows, csv } = tableData();
    csvRows = csv; csvCols = columns;
    if (reset) { table.sort = null; table.page = 0; }
    const host = $("#uz-grid");
    if (!host.querySelector(".uz-search")) {
      host.innerHTML = `<input class="uz-search data" type="search" placeholder="${ar ? "ابحث بالتاريخ أو الهاش أو المبلغ…" : "Search date, hash, amount…"}" aria-label="Search">
        <div class="fx-table-wrap"><table class="fx-table uz-explorer"><thead></thead><tbody></tbody></table></div>
        <div class="uz-pager"><span class="uz-pager-info"></span><div class="uz-pager-btns"></div></div>`;
      host.querySelector(".uz-search").oninput = e => { table.q = e.target.value.trim().toLowerCase(); table.page = 0; draw(); };
    }
    host.querySelector(".uz-search").value = table.q;
    const limit = ui.tab === "months" ? 24 : 12;
    const strip = html => String(html).replace(/<[^>]+>/g, " ");
    const indexed = rows.map(r => ({ r, text: r.map(([html, sv]) => `${strip(html)} ${sv}`).join(" ").toLowerCase() }));
    function draw() {
      let list = table.q ? indexed.filter(x => x.text.includes(table.q)) : indexed.slice();
      if (table.sort != null) {
        const k = table.sort;
        list.sort((a, b) => { const x = a.r[k][1], y = b.r[k][1]; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * table.dir; });
      }
      const pages = Math.max(1, Math.ceil(list.length / limit));
      table.page = Math.min(table.page, pages - 1);
      const slice = list.slice(table.page * limit, table.page * limit + limit);
      host.querySelector("thead").innerHTML = `<tr>${columns.map((col, i) => `<th><button type="button" data-k="${i}" class="${table.sort === i ? (table.dir > 0 ? "asc" : "desc") : ""}">${col}<i></i></button></th>`).join("")}</tr>`;
      host.querySelector("tbody").innerHTML = slice.length ? slice.map(x => `<tr>${x.r.map(([html]) => `<td>${html}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${columns.length}" class="uz-empty">${ar ? "لا توجد نتائج" : "No matching blocks"}</td></tr>`;
      const from = list.length ? table.page * limit + 1 : 0, to = Math.min(list.length, (table.page + 1) * limit);
      host.querySelector(".uz-pager-info").innerHTML = ar ? `عرض <b>${from}</b>–<b>${to}</b> من <b>${list.length}</b>` : `Showing <b>${from}</b>–<b>${to}</b> of <b>${list.length}</b>`;
      const nums = [...new Set([0, table.page - 1, table.page, table.page + 1, pages - 1])].filter(n => n >= 0 && n < pages).sort((a, b) => a - b);
      let prevN = -1;
      host.querySelector(".uz-pager-btns").innerHTML = `<button type="button" data-p="${table.page - 1}" ${table.page ? "" : "disabled"}>${ar ? "السابق" : "Prev"}</button>` +
        nums.map(n => { const gap = n - prevN > 1 ? "<span>…</span>" : ""; prevN = n; return `${gap}<button type="button" data-p="${n}" class="${n === table.page ? "on" : ""}">${n + 1}</button>`; }).join("") +
        `<button type="button" data-p="${table.page + 1}" ${table.page < pages - 1 ? "" : "disabled"}>${ar ? "التالي" : "Next"}</button>`;
    }
    host.querySelector("thead").onclick = e => { const b = e.target.closest("button"); if (!b) return; const k = +b.dataset.k; table.dir = table.sort === k ? -table.dir : -1; table.sort = k; draw(); };
    host.querySelector(".uz-pager-btns").onclick = e => { const b = e.target.closest("button"); if (!b || b.disabled) return; table.page = +b.dataset.p; draw(); };
    draw();
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
    paintHero(s, p); paintKpis(s, p); paintTokens(); paintPrice(); paintHeat(); paintFlow(); paintWeek(); paintMix(); paintRecon(); paintCash(); paintAudit(); paintBoard(); paintGrid();
  }

  root.querySelector(".uz-periods").onclick = e => { const b = e.target.closest("button"); if (!b) return; ui.period = b.dataset.p; sessionStorage.setItem("uz-period", ui.period); paintAll(); };
  $("#uz-mode").onclick = e => { const b = e.target.closest("button"); if (!b) return; ui.mode = b.dataset.v; root.querySelectorAll("#uz-mode button").forEach(x => x.classList.toggle("on", x === b)); paintPrice(); };
  $("#uz-osc").onclick = e => { const b = e.target.closest("button"); if (!b) return; ui.osc = b.dataset.v; root.querySelectorAll("#uz-osc button").forEach(x => x.classList.toggle("on", x === b)); paintPrice(); };
  $("#uz-tab").onclick = e => { const b = e.target.closest("button"); if (!b) return; ui.tab = b.dataset.v; root.querySelectorAll("#uz-tab button").forEach(x => x.classList.toggle("on", x === b)); paintGrid(); };
  $("#uz-cash-csv").onclick = () => download(cashCsv, `unaizah-cash-${view.from}_${view.to}.csv`);
  function download(rows, name) {
    const q = v => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : typeof v === "number" ? +v.toFixed(4) : v);
    const text = "\ufeff" + rows.map(r => r.map(q).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("#uz-csv").onclick = () => download([csvCols, ...csvRows], `unaizah-${ui.tab}-${view.from}_${view.to}.csv`);

  if (!periods.includes(ui.period)) ui.period = "ytd";
  paintIntegrity();
  paintAll();
}

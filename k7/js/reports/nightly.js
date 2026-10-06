// Nightly reports — the daily "Performance Analysis" email, the NC Performance Unaizah workbook,
// a full financial analysis of every day on file, and the morning Team Brief card.
//   pdf.js (mozilla/pdf.js) reads the PDF · fflate (101arrowz/fflate) writes the workbook
//   ECharts (apache/echarts) charts · html-to-image (bubkoo/html-to-image) renders the brief
import { parsePerformancePdf } from "./nightly-parse.js?v=88";

const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const COL = "nightly";
const VAT = 0.15;
const fmt = (n, d = 0) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n) || 0);
const pct = (n, d = 1) => `${((Number(n) || 0) * 100).toFixed(d)}%`;
const sgn = (n, d = 1) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(d)}%`;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayD = iso => new Date(iso + "T00:00:00");
const addDays = (iso, n) => { const d = dayD(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], WD_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const T = {
  en: { title: "Nightly reports", upload: "Upload performance PDF", excel: "Download Excel", brief: "Team brief", last: "Last report", onFile: "days on file",
    missing: "missing days", none: "All days are on file.", pdfOnly: "Full detail (films, items) appears for days whose PDF was uploaded.", reading: "Reading the PDF…",
    saved: n => `${n} report(s) saved`, bad: "That PDF could not be read", built: "Excel downloaded",
    s: { summary: "Summary", box: "Box Office", conc: "Concessions", perf: "Performance Indicators", profit: "Concessions Profit Performance", films: "Audience by film", items: "Concession Sales Analysis" },
    analysis: "Financial analysis", daily: "Daily revenue", dailySub: "box office + concessions with a 7-day average · drag to zoom", months: "Month by month", monthsSub: "computed like the YTD Summary sheet",
    pace: "Budget pace", paceSub: "cumulative revenue against the yearly budget spread evenly", week: "Weekday rhythm", weekSub: "average revenue and spend per head by weekday",
    unit: "Price & spend", unitSub: "ATP and SPH by month", insights: "What the numbers say" },
  ar: { title: "التقارير الليلية", upload: "رفع تقرير الأداء PDF", excel: "تحميل الإكسل", brief: "بريف الفريق", last: "آخر تقرير", onFile: "يوم مسجل",
    missing: "أيام ناقصة", none: "كل الأيام مسجلة.", pdfOnly: "التفاصيل الكاملة (الأفلام والأصناف) تظهر للأيام اللي انرفع لها PDF.", reading: "جاري قراءة الـPDF…",
    saved: n => `انحفظ ${n} تقرير`, bad: "ما قدرنا نقرأ هذا الـPDF", built: "تم تحميل الإكسل",
    s: { summary: "الملخص", box: "شباك التذاكر", conc: "الكونسيشن", perf: "مؤشرات الأداء", profit: "ربحية الكونسيشن", films: "الحضور حسب الفيلم", items: "تحليل مبيعات الكونسيشن" },
    analysis: "التحليل المالي", daily: "الإيراد اليومي", dailySub: "التذاكر + الكونسيشن مع متوسط ٧ أيام · اسحب للتكبير", months: "شهر بشهر", monthsSub: "محسوب بنفس طريقة شيت YTD Summary",
    pace: "سرعة تحقيق الميزانية", paceSub: "الإيراد التراكمي مقابل ميزانية السنة موزعة بالتساوي", week: "إيقاع الأسبوع", weekSub: "متوسط الإيراد وصرف الفرد حسب اليوم",
    unit: "سعر التذكرة وصرف الفرد", unitSub: "ATP و SPH لكل شهر", insights: "وش تقول الأرقام" }
};

// derived figures from the nine workbook inputs
function enrich(d) {
  const total = (d.bor || 0) + (d.conc || 0), a = d.admits || 0;
  return { ...d, total, atpX: a ? d.bor / a : 0, sphX: a ? d.conc / a : 0, occX: d.capacity ? a / d.capacity : 0, asrX: a ? (d.trx || 0) / a : 0,
    convX: a ? (d.items || 0) / a : 0, cogsX: d.conc ? (d.cost || 0) / d.conc : 0, netBorX: (d.bor || 0) / (1 + VAT) - (d.gcam || 0), netConcX: (d.conc || 0) / (1 + VAT) };
}
const sum = (rows, k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
function agg(rows) {
  const a = sum(rows, "admits"), bor = sum(rows, "bor"), conc = sum(rows, "conc");
  return { days: rows.length, admits: a, bor, conc, total: bor + conc, trx: sum(rows, "trx"), items: sum(rows, "items"), cost: sum(rows, "cost"), capacity: sum(rows, "capacity"),
    atp: a ? bor / a : 0, sph: a ? conc / a : 0, occ: sum(rows, "capacity") ? a / sum(rows, "capacity") : 0, asr: a ? sum(rows, "trx") / a : 0, conv: a ? sum(rows, "items") / a : 0, cogs: conc ? sum(rows, "cost") / conc : 0 };
}

let state = { base: null, docs: [], sel: null }, charts = [];

async function loadAll(H) {
  if (!state.base) state.base = await fetch("nightly/days.json", { cache: "no-cache" }).then(r => r.json());
  state.docs = H.localDocs(COL);
  H.allDocs(COL).then(d => { const before = state.docs.length; state.docs = d; if (d.length !== before && document.getElementById("nr")) paint(H); }).catch(() => {});
}
function days() {
  const map = new Map(state.base.days.map(d => [d.date, { ...d, src: "xlsx" }]));
  state.docs.forEach(d => { if (d.date) map.set(d.date, { ...map.get(d.date), ...d, src: "pdf" }); });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).map(enrich);
}
function missingDays(D) {
  if (!D.length) return [];
  const have = new Set(D.map(d => d.date)), out = [];
  for (let d = `${D[0].date.slice(0, 4)}-01-01`; d <= D[D.length - 1].date; d = addDays(d, 1)) if (!have.has(d)) out.push(d);
  return out;
}

export async function renderNightly(host, H) {
  host.innerHTML = `<div class="nr" id="nr"><p class="empty">…</p></div>`;
  await loadAll(H);
  paint(H);
}

function paint(H) {
  charts.forEach(c => { try { c.dispose(); } catch {} }); charts = [];
  const host = document.getElementById("nr"); if (!host) return;
  const ar = AR(), L = T[ar ? "ar" : "en"], D = days(), miss = missingDays(D);
  const sel = D.find(d => d.date === state.sel) || D[D.length - 1];
  state.sel = sel?.date;
  const recent = D.slice(-21).reverse();
  if (sel && !recent.includes(sel)) recent.unshift(sel);
  // PDF days are listed first among the strip so an uploaded report is one tap away
  D.filter(d => d.src === "pdf" && !recent.includes(d)).slice(-10).forEach(d => recent.push(d));
  host.innerHTML = `
    <header class="nr-top">
      <div class="nr-chips">
        <span class="nr-chip"><i class="dot"></i>${L.last} <b class="data">${esc(D[D.length - 1]?.date || "—")}</b></span>
        <span class="nr-chip"><b class="data">${D.length}</b> ${L.onFile}</span>
        <span class="nr-chip ${miss.length ? "warn" : "ok"}" title="${esc(miss.slice(-20).join(", "))}"><b class="data">${miss.length}</b> ${L.missing}</span>
      </div>
      <div class="nr-acts">
        <label class="btn hot" for="nr-pdf">⬆ ${L.upload}</label><input id="nr-pdf" type="file" accept="application/pdf,.pdf" multiple hidden>
        <button class="btn" id="nr-xlsx">⬇ ${L.excel}</button>
        <button class="btn brief-btn" id="nr-brief">${L.brief}</button>
      </div>
    </header>
    ${miss.length ? `<p class="nr-miss">${L.missing}: ${miss.slice(-12).map(m => `<span class="data">${m}</span>`).join("")}${miss.length > 12 ? " …" : ""}</p>` : ""}
    <nav class="nr-days" aria-label="days">${recent.map(d => `<button data-day="${d.date}" aria-pressed="${d.date === sel?.date}" class="${d.src === "pdf" ? "pdf" : ""}">
      <small>${(ar ? WD_AR : WD_EN)[dayD(d.date).getDay()]}</small><b class="data">${d.date.slice(8)}</b><em>${(ar ? MON_AR : MON_EN)[Number(d.date.slice(5, 7)) - 1]}</em>${d.src === "pdf" ? "<i>✦</i>" : ""}</button>`).join("")}</nav>
    <section id="nr-report">${sel ? reportHtml(sel, D, L, ar) : ""}</section>
    <h2 class="nr-h">${L.analysis}</h2>
    <section id="nr-analysis">${analysisHtml(D, L, ar)}</section>`;

  host.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { state.sel = b.dataset.day; paint(H); });
  host.querySelector("#nr-pdf").onchange = async e => {
    const files = [...e.target.files]; if (!files.length) return;
    H.toast(L.reading); let ok = 0;
    for (const f of files) {
      try { const rec = await parsePerformancePdf(f); await H.putDoc(COL, rec.date, rec); state.docs = [...state.docs.filter(d => d.date !== rec.date), { id: rec.date, ...rec }]; state.sel = rec.date; ok++; }
      catch (err) { console.error(err); H.toast(`${L.bad}: ${f.name}`, true); }
    }
    if (ok) { H.toast(L.saved(ok)); H.log?.("report", `Nightly report saved · ${state.sel}`); H.markUpload?.("nightly", files.map(f => f.name).join(", ")).catch(() => {}); }
    e.target.value = ""; paint(H);
  };
  host.querySelector("#nr-xlsx").onclick = async () => {
    try {
      const { buildWorkbook } = await import("./nightly-xlsx.js?v=88");
      const blob = await buildWorkbook(D);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `NC Performance Unaizah ${isoOf(new Date())}.xlsx`; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000); H.toast(L.built);
    } catch (err) { console.error(err); H.toast(err.message, true); }
  };
  host.querySelector("#nr-brief").onclick = () => import("./nightly-brief.js?v=88").then(m => m.openBrief(sel, D, H)).catch(err => { console.error(err); H.toast(err.message, true); });
  drawCharts(D, L, ar);
}

// ── the nightly email, in the same order ─────────────────────
function kv(rows) { return `<dl class="nr-kv">${rows.filter(r => r[1] != null && r[1] !== "").map(([k, v, cls]) => `<div class="${cls || ""}"><dt>${k}</dt><dd class="data">${v}</dd></div>`).join("")}</dl>`; }
function reportHtml(d, D, L, ar) {
  const full = d.src === "pdf", n2 = v => v == null ? null : fmt(v, 2), n0 = v => v == null ? null : fmt(v);
  const dd = dayD(d.date), title = `${(ar ? WD_AR : WD_EN)[dd.getDay()]} ${d.date}`;
  const same = D.filter(x => dayD(x.date).getDay() === dd.getDay() && x.date < d.date).slice(-4), avg = same.length ? sum(same, "total") / same.length : 0;
  const vs = avg ? d.total / avg - 1 : null;
  const box = [["Box Office Revenue (BOR)", n2(d.bor)], ["VAT", n2(d.boVat ?? d.bor * 15 / 115)], ["Net BOR", n2(d.netBor ?? d.bor / 1.15)], ["Transactions", n0(d.boTrx)],
    ["ATP", n2(d.atp ?? d.atpX)], ["Net ATP", n2(d.netAtp)], ["Occupancy %", n2(d.occupancy ?? d.occX * 100)], ["GCAM", n2(d.gcam)], ["Effective Nett", n2(d.effectiveNett ?? d.netBorX)], ["Internet Service Charge", n2(d.serviceCharge)]];
  const summary = [["Total Admits", n0(d.admits)], ["Total Transactions", n0(d.transactions)], ["Total Seats In Cinema", n0(d.seats ?? 238)], ["Total Screen", n0(d.screens ?? 4)],
    ["Total No of Shows", n0(d.shows)], ["Avg. of Shows", n0(d.avgShows)], ["Total Capacity Available", n0(d.capacity)], ["Total Revenue", n2(d.totalRevenue ?? d.total), "hl"]];
  const conc = [["Gross Revenue", n2(d.conc)], ["VAT", n2(d.concVat ?? d.conc * 15 / 115)], ["Concession Net Revenue", n2(d.concNet ?? d.netConcX)], ["Spend Per Head", n2(d.sph ?? d.sphX)],
    ["Cost of Goods Sold", n2(d.cost)], ["Food Cost %", n2(d.foodCost ?? d.cogsX * 100)], ["Transactions", n0(d.trx)], ["Admission Strike Rate", n2(d.asr ?? d.asrX * 100)],
    ["Avg. Value Per Transaction", n2(d.avgValuePerTrx ?? (d.trx ? d.conc / d.trx : null))], ["Quantity of Item Sold", n0(d.items)]];
  const perf = [["Items Per Admit", n2(d.itemsPerAdmit ?? d.convX)], ["Items Per Transaction", n2(d.itemsPerTrx ?? (d.trx ? d.items / d.trx : null))], ["Transaction Strike Rate", n2(d.trxStrike)],
    ["Gross Box Revenue Per Seat", n2(d.grossBoxPerSeat)], ["Nett Box Revenue Per Seat", n2(d.netBoxPerSeat)], ["Total Revenue Per Seat", n2(d.totalPerSeat)],
    ["Average Sale Per Transaction", n2(d.avgSalePerTrx)], ["Average Sale Per Patron", n2(d.avgSalePerPatron ?? (d.admits ? d.total / d.admits : null))]];
  const profit = [["Profit at Standard Cost", n2(d.profit ?? (d.conc / 1.15 - d.cost))], ["Profit %", n2(d.profitPct)], ["Profit per Item", n2(d.profitPerItem)], ["Profit Per Admit", n2(d.profitPerAdmit)], ["Price Per Transaction", n2(d.pricePerTrx)]];
  const films = (d.films || []).slice().sort((a, b) => (b.bor || 0) - (a.bor || 0)), maxF = Math.max(1, ...films.map(f => f.bor || 0));
  const groups = d.groups || [];
  return `<article class="nr-mail ${full ? "full" : ""}">
    <header class="nr-mail-h"><div><small>${esc(d.cinema || "Onaizah - Othaim Mall - Noir Cinema")}</small><h3>Performance Analysis</h3><span class="data">${title}${d.asOn ? ` · As on ${esc(d.asOn)}` : ""}</span></div>
      <div class="nr-big"><small>${ar ? "إجمالي الإيراد" : "Total revenue"}</small><b class="data">${fmt(d.total, 2)}</b>${vs != null ? `<em class="${vs >= 0 ? "up" : "dn"}">${sgn(vs)} ${ar ? "عن متوسط نفس اليوم" : "vs same weekday avg"}</em>` : ""}</div></header>
    <div class="nr-cols3">
      <section><h4>${L.s.summary}</h4>${kv(summary)}</section>
      <section><h4>${L.s.box}</h4>${kv(box)}</section>
      <section><h4>${L.s.conc}</h4>${kv(conc)}</section>
    </div>
    <div class="nr-cols2">
      <section><h4>${L.s.perf}</h4>${kv(perf)}</section>
      <section><h4>${L.s.profit}</h4>${kv(profit)}</section>
    </div>
    ${films.length ? `<section class="nr-sec"><h4>${L.s.films}</h4><div class="ledger-wrap"><table class="ledger nr-t"><thead><tr><th>Film</th><th class="r">Shows</th><th class="r">Admits</th><th>Occ %</th><th class="r">BOR</th><th class="r">Nett BOR</th><th class="r">ATP</th></tr></thead><tbody>
      ${films.map(f => `<tr style="cursor:default"><td><b>${esc(f.name)}</b><i class="nr-bar" style="--w:${((f.bor || 0) / maxF * 100).toFixed(1)}%"></i></td><td class="r data">${fmt(f.shows)}</td><td class="r data">${fmt(f.admits)}</td>
        <td><span class="nr-occ"><u style="width:${Math.min(100, f.occupancy || 0).toFixed(1)}%"></u></span><small class="data">${fmt(f.occupancy, 1)}</small></td><td class="r data">${fmt(f.bor, 2)}</td><td class="r data">${fmt(f.nett, 2)}</td><td class="r data">${fmt(f.atp, 2)}</td></tr>`).join("")}
      </tbody></table></div></section>` : ""}
    ${groups.length ? `<section class="nr-sec"><h4>${L.s.items}</h4>${groups.map(g => `<div class="nr-group"><header><b>${esc(g.name)}</b>${g.total ? `<span class="data">${fmt(g.total.qty)} · ${fmt(g.total.sales, 2)} SAR</span>` : ""}</header>
      ${g.items.map(i => `<div class="nr-item"><span class="nr-q data">×${fmt(i.qty)}</span><b>${esc(i.name)}</b><span class="data">@ ${fmt(i.price, 2)}</span><span class="data">${fmt(i.sales, 2)}</span>
        <span class="nr-mix"><u style="width:${Math.min(100, (i.mix || 0) * 2).toFixed(1)}%"></u></span><em class="data">${fmt(i.stdProfitPct, 1)}%</em></div>`).join("")}</div>`).join("")}</section>` : ""}
    ${full ? "" : `<p class="nr-note">${L.pdfOnly}</p>`}
  </article>`;
}

// ── analysis ─────────────────────────────────────────────────
function analysisHtml(D, L, ar) {
  if (!D.length) return "";
  const last = D[D.length - 1], y = last.date.slice(0, 4), m = last.date.slice(0, 7);
  const ytd = agg(D.filter(d => d.date.startsWith(y))), mtd = agg(D.filter(d => d.date.startsWith(m)));
  const dom = Number(last.date.slice(8)), pm = isoOf(new Date(Number(y), Number(m.slice(5)) - 2, 1)).slice(0, 7);
  const pmtd = agg(D.filter(d => d.date.startsWith(pm) && Number(d.date.slice(8)) <= dom));
  const b = state.base.budget, budget = (b.bor || 0) + (b.conc || 0);
  const doy = (dayD(last.date) - dayD(`${y}-01-01`)) / 86400000 + 1, ydays = (Number(y) % 4 ? 365 : 366);
  const pace = budget * doy / ydays;
  const l30 = D.slice(-30), run = sum(l30, "total") / Math.max(1, l30.length), fc = ytd.total + run * (ydays - doy);
  const tiles = [
    [ar ? "منذ بداية السنة" : "Year to date", fmt(ytd.total), `${pct(ytd.total / budget)} ${ar ? "من الميزانية" : "of budget"}`, ytd.total >= pace ? "good" : "warn"],
    [ar ? "المتوقع للسنة" : "Year-end forecast", fmt(fc), `${pct(fc / budget)} ${ar ? "من الميزانية" : "of budget"} · ${ar ? "معدل آخر 30 يوم" : "30-day run rate"}`, fc >= budget ? "good" : "warn"],
    [ar ? "منذ بداية الشهر" : "Month to date", fmt(mtd.total), pmtd.total ? `${sgn(mtd.total / pmtd.total - 1)} ${ar ? "عن نفس الفترة الشهر الماضي" : "vs same days last month"}` : "", mtd.total >= pmtd.total ? "good" : "warn"],
    [ar ? "الحضور منذ بداية السنة" : "Admits YTD", fmt(ytd.admits), `${pct(ytd.admits / (b.admits || 1))} ${ar ? "من الهدف" : "of target"}`, ""],
    ["ATP · SPH", `${fmt(ytd.atp, 2)} · ${fmt(ytd.sph, 2)}`, ar ? "سعر التذكرة · صرف الفرد" : "ticket price · spend per head", ""],
    [ar ? "تكلفة الكونسيشن" : "Concession COGS", pct(ytd.cogs), `${ar ? "التحويل" : "conversion"} ${fmt(ytd.conv, 2)} ${ar ? "صنف/فرد" : "items/admit"}`, ytd.cogs < 0.2 ? "good" : "warn"]
  ];
  const months = [...new Set(D.map(d => d.date.slice(0, 7)))].map(k => ({ k, ...agg(D.filter(d => d.date.startsWith(k))) }));
  const best = [...D].sort((a, b) => b.total - a.total)[0], worst = [...D].filter(d => d.admits).sort((a, b) => a.total - b.total)[0];
  const wd = [0, 1, 2, 3, 4, 5, 6].map(w => { const r = D.filter(d => dayD(d.date).getDay() === w); return { w, avg: r.length ? sum(r, "total") / r.length : 0, sph: agg(r).sph }; });
  const wBest = [...wd].sort((a, b) => b.avg - a.avg)[0], wWorst = [...wd].sort((a, b) => a.avg - b.avg)[0];
  const lm = months[months.length - 2], tm = months[months.length - 1];
  const ins = [
    [ytd.total >= pace ? "good" : "bad", ar ? `الإيراد ${ytd.total >= pace ? "متقدم على" : "متأخر عن"} الميزانية بـ ${fmt(Math.abs(ytd.total - pace))} ريال` : `Revenue is ${fmt(Math.abs(ytd.total - pace))} SAR ${ytd.total >= pace ? "ahead of" : "behind"} budget pace`],
    ["info", ar ? `أفضل يوم ${best.date}: ${fmt(best.total)} ريال و ${fmt(best.admits)} حضور` : `Best day ${best.date}: ${fmt(best.total)} SAR from ${fmt(best.admits)} admits`],
    ["info", ar ? `${WD_AR[wBest.w]} أقوى يوم بمتوسط ${fmt(wBest.avg)}، و${WD_AR[wWorst.w]} الأضعف ${fmt(wWorst.avg)}` : `${WD_EN[wBest.w]} is the strongest day (${fmt(wBest.avg)} avg), ${WD_EN[wWorst.w]} the weakest (${fmt(wWorst.avg)})`],
    lm && tm ? [tm.sph >= lm.sph ? "good" : "warn", ar ? `صرف الفرد ${fmt(tm.sph, 2)} هذا الشهر مقابل ${fmt(lm.sph, 2)} الشهر الماضي` : `Spend per head ${fmt(tm.sph, 2)} this month against ${fmt(lm.sph, 2)} last month`] : null,
    [ytd.cogs < 0.2 ? "good" : "warn", ar ? `تكلفة البضاعة ${pct(ytd.cogs)} من إيراد الكونسيشن` : `Cost of goods is ${pct(ytd.cogs)} of concession revenue`],
    ["info", ar ? `معدل الشراء ${pct(ytd.asr)} من الحضور يشترون من الكونسيشن` : `${pct(ytd.asr)} of admits buy at the concession (strike rate)`],
    worst ? ["warn", ar ? `أضعف يوم ${worst.date}: ${fmt(worst.total)} ريال` : `Weakest day ${worst.date}: ${fmt(worst.total)} SAR`] : null
  ].filter(Boolean);
  const mn = k => (ar ? MON_AR : MON_EN)[Number(k.slice(5)) - 1];
  return `<div class="nr-tiles">${tiles.map(t => `<article class="${t[3]}"><span>${t[0]}</span><b class="data">${t[1]}</b><em>${t[2]}</em></article>`).join("")}</div>
    <ul class="nr-ins">${ins.map(i => `<li class="${i[0]}">${esc(i[1])}</li>`).join("")}</ul>
    <section class="slab nr-c"><div class="slab-h"><h2>${L.daily}</h2></div><p class="si-sub">${L.dailySub}</p><div id="nr-ch-daily" class="nr-chart tall"></div></section>
    <div class="nr-grid">
      <section class="slab nr-c"><div class="slab-h"><h2>${L.pace}</h2></div><p class="si-sub">${L.paceSub}</p><div id="nr-ch-pace" class="nr-chart"></div></section>
      <section class="slab nr-c"><div class="slab-h"><h2>${L.week}</h2></div><p class="si-sub">${L.weekSub}</p><div id="nr-ch-week" class="nr-chart"></div></section>
    </div>
    <section class="slab nr-c"><div class="slab-h"><h2>${L.months}</h2></div><p class="si-sub">${L.monthsSub}</p>
      <div class="ledger-wrap"><table class="ledger nr-t"><thead><tr><th>Month</th><th class="r">Admits</th><th class="r">ATP</th><th class="r">OCC%</th><th class="r">GBO Rev</th><th class="r">G-Conc Rev</th><th class="r">SPH</th><th class="r">ASR</th><th class="r">Conversion</th><th class="r">COGS %</th><th class="r">Total Revenue</th></tr></thead><tbody>
      ${months.map(r => `<tr style="cursor:default"><td><b>${mn(r.k)}</b></td><td class="r data">${fmt(r.admits)}</td><td class="r data">${fmt(r.atp, 2)}</td><td class="r data">${pct(r.occ)}</td><td class="r data">${fmt(r.bor)}</td><td class="r data">${fmt(r.conc)}</td><td class="r data">${fmt(r.sph, 2)}</td><td class="r data">${pct(r.asr)}</td><td class="r data">${fmt(r.conv, 2)}</td><td class="r data">${pct(r.cogs)}</td><td class="r data"><b>${fmt(r.total)}</b></td></tr>`).join("")}
      <tr class="grp-row"><td><b>YTD</b></td><td class="r data">${fmt(ytd.admits)}</td><td class="r data">${fmt(ytd.atp, 2)}</td><td class="r data">${pct(ytd.occ)}</td><td class="r data">${fmt(ytd.bor)}</td><td class="r data">${fmt(ytd.conc)}</td><td class="r data">${fmt(ytd.sph, 2)}</td><td class="r data">${pct(ytd.asr)}</td><td class="r data">${fmt(ytd.conv, 2)}</td><td class="r data">${pct(ytd.cogs)}</td><td class="r data"><b>${fmt(ytd.total)}</b></td></tr>
      <tr class="grp-row"><td><b>${ar ? "الميزانية" : "Budget"}</b></td><td class="r data">${fmt(b.admits)}</td><td></td><td></td><td class="r data">${fmt(b.bor)}</td><td class="r data">${fmt(b.conc)}</td><td colspan="4"></td><td class="r data"><b>${fmt(budget)}</b></td></tr>
      </tbody></table></div>
      <div id="nr-ch-month" class="nr-chart"></div></section>
    <section class="slab nr-c"><div class="slab-h"><h2>${L.unit}</h2></div><p class="si-sub">${L.unitSub}</p><div id="nr-ch-unit" class="nr-chart"></div></section>`;
}

function drawCharts(D, L, ar) {
  if (!D.length) return;
  const els = ["nr-ch-daily", "nr-ch-pace", "nr-ch-week", "nr-ch-month", "nr-ch-unit"].map(id => document.getElementById(id)).filter(Boolean);
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); draw(e.target.id); }), { rootMargin: "300px" });
  els.forEach(el => io.observe(el));
  const ink = "#d3dae6", grid = "rgba(255,255,255,.07)";
  const base = { textStyle: { fontFamily: "Geist, system-ui, sans-serif", color: ink }, tooltip: { backgroundColor: "#0a0e15", borderColor: "#2b3446", textStyle: { color: "#edf1f8" }, trigger: "axis" },
    legend: { top: 0, textStyle: { color: ink } }, grid: { left: 54, right: 20, top: 36, bottom: 40 } };
  const ax = { axisLabel: { color: ink }, axisLine: { lineStyle: { color: grid } }, splitLine: { lineStyle: { color: grid } } };
  const ec = () => window.echarts ? Promise.resolve(window.echarts) : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/echarts.min.js"; s.onload = () => res(window.echarts); s.onerror = rej; document.head.append(s); });
  const mk = (id, opt) => ec().then(E => { const el = document.getElementById(id); if (!el) return; const c = E.init(el); c.setOption({ ...base, ...opt }); charts.push(c); new ResizeObserver(() => c.resize()).observe(el); });
  const mn = k => (ar ? MON_AR : MON_EN)[Number(k.slice(5)) - 1];
  function draw(id) {
    if (id === "nr-ch-daily") {
      const ma = D.map((d, i) => { const w = D.slice(Math.max(0, i - 6), i + 1); return +(sum(w, "total") / w.length).toFixed(0); });
      mk(id, { xAxis: { type: "category", data: D.map(d => d.date), ...ax, splitLine: { show: false } }, yAxis: { type: "value", ...ax },
        dataZoom: [{ type: "inside", start: Math.max(0, 100 - 9000 / D.length) }, { type: "slider", height: 16, bottom: 8, borderColor: "transparent", textStyle: { color: ink } }],
        grid: { ...base.grid, bottom: 50 },
        series: [{ name: ar ? "التذاكر" : "Box office", type: "bar", stack: "r", data: D.map(d => +d.bor.toFixed(0)), itemStyle: { color: "#5b7bff" } },
          { name: ar ? "الكونسيشن" : "Concessions", type: "bar", stack: "r", data: D.map(d => +d.conc.toFixed(0)), itemStyle: { color: "#dce6ff" } },
          { name: ar ? "متوسط ٧ أيام" : "7-day avg", type: "line", data: ma, symbol: "none", smooth: true, lineStyle: { color: "#6ccbff", width: 2 } }] });
    }
    if (id === "nr-ch-pace") {
      const y = D[D.length - 1].date.slice(0, 4), rows = D.filter(d => d.date.startsWith(y)), b = state.base.budget, bud = (b.bor || 0) + (b.conc || 0);
      let run = 0; const cum = rows.map(d => (run += d.total));
      const ydays = Number(y) % 4 ? 365 : 366;
      mk(id, { xAxis: { type: "category", data: rows.map(d => d.date), ...ax, splitLine: { show: false } }, yAxis: { type: "value", ...ax },
        series: [{ name: ar ? "الفعلي" : "Actual", type: "line", data: cum.map(v => +v.toFixed(0)), symbol: "none", areaStyle: { color: "rgba(91,123,255,.18)" }, lineStyle: { color: "#5b7bff", width: 2 } },
          { name: ar ? "الميزانية" : "Budget", type: "line", data: rows.map(d => +(bud * ((dayD(d.date) - dayD(`${y}-01-01`)) / 86400000 + 1) / ydays).toFixed(0)), symbol: "none", lineStyle: { color: "#ffb547", type: "dashed" } }] });
    }
    if (id === "nr-ch-week") {
      const order = [6, 0, 1, 2, 3, 4, 5];
      const wd = order.map(w => { const r = D.filter(d => dayD(d.date).getDay() === w); return { w, avg: r.length ? sum(r, "total") / r.length : 0, sph: agg(r).sph }; });
      mk(id, { xAxis: { type: "category", data: wd.map(x => (ar ? WD_AR : WD_EN)[x.w]), ...ax }, yAxis: [{ type: "value", ...ax }, { type: "value", ...ax, splitLine: { show: false } }],
        series: [{ name: ar ? "متوسط الإيراد" : "Avg revenue", type: "bar", data: wd.map(x => +x.avg.toFixed(0)), itemStyle: { color: "#5b7bff", borderRadius: [6, 6, 0, 0] } },
          { name: "SPH", type: "line", yAxisIndex: 1, data: wd.map(x => +x.sph.toFixed(2)), lineStyle: { color: "#3ed69e" }, itemStyle: { color: "#3ed69e" } }] });
    }
    if (id === "nr-ch-month" || id === "nr-ch-unit") {
      const ks = [...new Set(D.map(d => d.date.slice(0, 7)))], M = ks.map(k => ({ k, ...agg(D.filter(d => d.date.startsWith(k))) }));
      if (id === "nr-ch-month") mk(id, { xAxis: { type: "category", data: M.map(r => mn(r.k)), ...ax }, yAxis: { type: "value", ...ax },
        series: [{ name: ar ? "التذاكر" : "Box office", type: "bar", stack: "m", data: M.map(r => +r.bor.toFixed(0)), itemStyle: { color: "#5b7bff" } },
          { name: ar ? "الكونسيشن" : "Concessions", type: "bar", stack: "m", data: M.map(r => +r.conc.toFixed(0)), itemStyle: { color: "#dce6ff", borderRadius: [6, 6, 0, 0] } }] });
      else mk(id, { xAxis: { type: "category", data: M.map(r => mn(r.k)), ...ax }, yAxis: { type: "value", ...ax },
        series: [{ name: "ATP", type: "line", smooth: true, data: M.map(r => +r.atp.toFixed(2)), lineStyle: { color: "#5b7bff", width: 2 }, itemStyle: { color: "#5b7bff" } },
          { name: "SPH", type: "line", smooth: true, data: M.map(r => +r.sph.toFixed(2)), lineStyle: { color: "#dce6ff", width: 2 }, itemStyle: { color: "#dce6ff" } }] });
    }
  }
}

export { days as nightlyDays, agg, enrich };

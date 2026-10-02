// Financial board. github.com/simple-statistics/simple-statistics and github.com/tradingview/lightweight-charts
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب" };
const EN = { hafar: "Hafar", khafji: "Khafji", unaizah: "Unaizah", dammam: "Dammam", mithnab: "Mithnab" };
const sar = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const lang = () => sessionStorage.getItem("noir-lang") || "en";

function load(src, test) {
  if (test()) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}

export async function renderFinance(root) {
  const ar = lang() === "ar";
  const name = b => ar ? (AR[b.id] || b.name) : (EN[b.id] || b.name);
  const data = await fetch("finance/budget-2026.json?v=54").then(r => r.json());
  await load("https://cdn.jsdelivr.net/npm/simple-statistics@7.8.8/dist/simple-statistics.min.js", () => window.ss);
  await load("https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js", () => window.LightweightCharts);
  const rows = data.branches.map(b => {
    const done = b.weeks.filter(w => w.a != null);
    const points = done.map((w, i) => [i + 1, w.a]);
    const line = window.ss.linearRegression(points);
    const weeksLeft = Math.max(1, b.weeks.length - done.length);
    const forecast = Math.round(b.ytdRevActual + line.m * weeksLeft * (done.length / Math.max(1, done.length)));
    const need = Math.max(0, Math.round((b.yearRev - b.ytdRevActual) / weeksLeft));
    return { ...b, gap: Math.round(b.ytdRevTarget - b.ytdRevActual), left: Math.round(b.yearRev - b.ytdRevActual), hit: Math.round(b.ytdRevActual / b.ytdRevTarget * 100), forecast, need, done };
  }).sort((a, b) => b.gap - a.gap);
  const gap = rows.reduce((a, b) => a + b.gap, 0);
  root.innerHTML = `
    <section class="fin-board" dir="${ar ? "rtl" : "ltr"}">
      <header class="fin-top">
        <div><p>${ar ? "تحليل حتى الأسبوع ٣٩" : "Analysis through week 39"}</p><h2>${ar ? "الفجوة المالية" : "Financial gap"}</h2></div>
        <div class="fin-kpis"><span><b>${sar(gap)}</b><i>${ar ? "عجز حالي" : "Current gap"}</i></span></div>
      </header>
      <div id="fin-line" style="height:280px"></div>
      <ol class="fin-rank">${rows.map(b => `<li><strong>${name(b)}</strong><span>${ar ? "مطلوب أسبوعياً" : "Need / week"} ${sar(b.need)}</span><b>${sar(b.gap)}</b></li>`).join("")}</ol>
    </section>`;
  const chart = window.LightweightCharts.createChart(document.getElementById("fin-line"), {
    height: 280, layout: { background: { color: "transparent" }, textColor: "#f4ede4" },
    grid: { vertLines: { color: "rgba(255,255,255,.05)" }, horzLines: { color: "rgba(255,255,255,.05)" } },
    rightPriceScale: { borderColor: "rgba(255,255,255,.08)" }, timeScale: { borderColor: "rgba(255,255,255,.08)" }
  });
  const actual = chart.addLineSeries({ color: "#c46bd4", lineWidth: 2 });
  const target = chart.addLineSeries({ color: "rgba(244,237,228,.45)", lineWidth: 1 });
  const branch = rows[0];
  const start = new Date("2026-01-05");
  const day = i => { const d = new Date(start); d.setDate(start.getDate() + i * 7); return d.toISOString().slice(0, 10); };
  actual.setData(branch.done.map((w, i) => ({ time: day(i), value: w.a })));
  target.setData(branch.done.map((w, i) => ({ time: day(i), value: w.t })));
  chart.timeScale().fitContent();
}

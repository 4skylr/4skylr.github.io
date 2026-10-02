// Finance page. Charts: github.com/tradingview/lightweight-charts
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب" };
const EN = { hafar: "Hafar", khafji: "Khafji", unaizah: "Unaizah", dammam: "Dammam", mithnab: "Mithnab" };
const money = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const lang = () => sessionStorage.getItem("noir-lang") || "en";

function load(src, test) {
  if (test()) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}

export async function renderFinance(root) {
  const ar = lang() === "ar";
  const name = id => ar ? AR[id] : EN[id];
  const data = await fetch("finance/budget-2026.json?v=55").then(r => r.json());
  await load("https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js", () => window.LightweightCharts);
  const rows = data.branches.map(b => {
    const done = b.weeks.filter(w => w.a != null);
    const leftWeeks = Math.max(1, b.weeks.length - done.length);
    const gap = Math.round(b.ytdRevTarget - b.ytdRevActual);
    const yearLeft = Math.round(b.yearRev - b.ytdRevActual);
    return { ...b, done, leftWeeks, gap, yearLeft, hit: Math.round(b.ytdRevActual / b.ytdRevTarget * 100), need: Math.round(yearLeft / leftWeeks) };
  }).sort((a, b) => b.gap - a.gap);
  const gap = rows.reduce((s, b) => s + b.gap, 0);
  const yearLeft = rows.reduce((s, b) => s + b.yearLeft, 0);
  root.innerHTML = `
    <section class="fin-page" dir="${ar ? "rtl" : "ltr"}">
      <header class="fin-top">
        <div><p>Week 39 · 1 Oct 2026</p><h2>${ar ? "التحليل المالي" : "Financial analysis"}</h2></div>
        <div class="fin-kpis">
          <span><b>${money(gap)}</b><i>${ar ? "عجز حتى الأسبوع ٣٩" : "Gap to week 39"}</i></span>
          <span><b>${money(yearLeft)}</b><i>${ar ? "باقي ميزانية السنة" : "Left to year budget"}</i></span>
          <span><b>16</b><i>${ar ? "أسابيع متبقية" : "Weeks remaining"}</i></span>
        </div>
      </header>
      <div class="fin-table-wrap"><table class="fin-table">
        <thead><tr><th>${ar ? "الفرع" : "Branch"}</th><th>${ar ? "محقق" : "Actual"}</th><th>${ar ? "تارجت" : "Target"}</th><th>${ar ? "النسبة" : "Hit"}</th><th>${ar ? "العجز" : "Gap"}</th><th>${ar ? "مطلوب أسبوعياً" : "Need / week"}</th></tr></thead>
        <tbody>${rows.map(b => `<tr data-id="${b.id}"><td>${name(b.id)}</td><td>${money(b.ytdRevActual)}</td><td>${money(b.ytdRevTarget)}</td><td>${b.hit}%</td><td class="neg">${money(b.gap)}</td><td>${money(b.need)}</td></tr>`).join("")}</tbody>
      </table></div>
      <div class="fin-chart-card"><p id="fin-caption">${name(rows[0].id)} · ${ar ? "إيراد أسبوعي مقابل التارجت" : "Weekly revenue against target"}</p><div id="fin-line"></div></div>
    </section>`;
  const chart = window.LightweightCharts.createChart(document.getElementById("fin-line"), {
    height: 320, layout: { background: { color: "transparent" }, textColor: "#f4ede4" },
    grid: { vertLines: { color: "rgba(255,255,255,.05)" }, horzLines: { color: "rgba(255,255,255,.05)" } },
    rightPriceScale: { borderColor: "rgba(255,255,255,.08)" }, timeScale: { borderColor: "rgba(255,255,255,.08)" }
  });
  const actual = chart.addLineSeries({ color: "#c46bd4", lineWidth: 2 });
  const target = chart.addLineSeries({ color: "rgba(244,237,228,.4)", lineWidth: 1 });
  const start = new Date("2026-01-05");
  const day = i => { const d = new Date(start); d.setDate(start.getDate() + i * 7); return d.toISOString().slice(0, 10); };
  const draw = b => {
    actual.setData(b.done.map((w, i) => ({ time: day(i), value: w.a })));
    target.setData(b.done.map((w, i) => ({ time: day(i), value: w.t })));
    chart.timeScale().fitContent();
    document.getElementById("fin-caption").textContent = `${name(b.id)} · ${ar ? "إيراد أسبوعي مقابل التارجت" : "Weekly revenue against target"}`;
  };
  draw(rows[0]);
  root.querySelectorAll("tr[data-id]").forEach(tr => tr.onclick = () => draw(rows.find(b => b.id === tr.dataset.id)));
}

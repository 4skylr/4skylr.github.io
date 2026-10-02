// Budget board. Charts: github.com/apache/echarts (66k stars) and github.com/apexcharts/apexcharts.js
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب" };
const EN = { hafar: "Hafar", khafji: "Khafji", unaizah: "Unaizah", dammam: "Dammam", mithnab: "Mithnab" };
const sar = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const lang = () => sessionStorage.getItem("noir-lang") || "en";

function load(src, key) {
  if (window[key]) return Promise.resolve(window[key]);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(window[key]); s.onerror = rej; document.head.append(s);
  });
}

export async function renderFinance(root) {
  const ar = lang() === "ar";
  const name = b => ar ? (AR[b.id] || b.name) : (EN[b.id] || b.name);
  const data = await fetch("finance/budget-2026.json?v=53").then(r => r.json());
  const rows = data.branches.map(b => ({
    ...b,
    gap: Math.round(b.ytdRevTarget - b.ytdRevActual),
    left: Math.round(b.yearRev - b.ytdRevActual),
    hit: b.ytdRevTarget ? Math.round(b.ytdRevActual / b.ytdRevTarget * 100) : 0
  })).sort((a, b) => b.gap - a.gap);
  const gap = rows.reduce((a, b) => a + b.gap, 0);
  const left = rows.reduce((a, b) => a + b.left, 0);
  root.innerHTML = `
    <section class="fin-board" dir="${ar ? "rtl" : "ltr"}">
      <header class="fin-top">
        <div><p>${ar ? "حتى ١ أكتوبر · الأسبوع ٣٩" : "As of 1 Oct · Week 39"}</p><h2>${ar ? "عجز الميزانية" : "Budget gap"}</h2></div>
        <div class="fin-kpis">
          <span><b>${sar(gap)}</b><i>${ar ? "عجز حالي" : "Current gap"}</i></span>
          <span><b>${sar(left)}</b><i>${ar ? "باقي السنة" : "Left this year"}</i></span>
        </div>
      </header>
      <div class="fin-grid">
        <div id="fin-gap"></div>
        <ol class="fin-rank">${rows.map((b, i) => `<li><em>${i + 1}</em><strong>${name(b)}</strong><span>${b.hit}%</span><b>${sar(b.gap)}</b></li>`).join("")}</ol>
      </div>
      <div id="fin-hit"></div>
    </section>`;
  const echarts = await load("https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js", "echarts");
  echarts.init(document.getElementById("fin-gap"), null, { renderer: "svg", height: 280 }).setOption({
    backgroundColor: "transparent",
    grid: { left: 90, right: 24, top: 10, bottom: 24 },
    xAxis: { type: "value", axisLabel: { color: "#a4a4a4", formatter: v => sar(v) }, splitLine: { lineStyle: { color: "rgba(255,255,255,.06)" } } },
    yAxis: { type: "category", data: rows.map(name).reverse(), axisLabel: { color: "#f4ede4" } },
    series: [{ type: "bar", data: rows.map(b => b.gap).reverse(), barWidth: 16, itemStyle: { borderRadius: 8, color: "#c46bd4" } }]
  });
  const Apex = await load("https://cdn.jsdelivr.net/npm/apexcharts@3.54.0/dist/apexcharts.min.js", "ApexCharts");
  new Apex(document.getElementById("fin-hit"), {
    chart: { type: "radialBar", height: 300, background: "transparent", foreColor: "#f4ede4", toolbar: { show: false } },
    series: rows.map(b => b.hit),
    labels: rows.map(name),
    colors: ["#e23b4a", "#c46bd4", "#9b6bff", "#f4ede4", "#7c2280"],
    plotOptions: { radialBar: { hollow: { size: "28%" }, dataLabels: { total: { show: true, label: ar ? "عجز" : "Gap", formatter: () => sar(gap) } } } },
    stroke: { lineCap: "round" }
  }).render();
}

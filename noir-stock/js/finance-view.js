// Budget dashboard. Library: github.com/apexcharts/apexcharts.js
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب" };
const sar = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));

function loadApex() {
  if (window.ApexCharts) return Promise.resolve(window.ApexCharts);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/apexcharts@3.54.0/dist/apexcharts.min.js";
    s.onload = () => res(window.ApexCharts);
    s.onerror = rej;
    document.head.append(s);
  });
}

export async function renderFinance(root) {
  const data = await fetch("finance/budget-2026.json?v=52").then(r => r.json());
  const rows = data.branches.map(b => ({
    ...b,
    gap: Math.round(b.ytdRevTarget - b.ytdRevActual),
    left: Math.round(b.yearRev - b.ytdRevActual),
    hit: b.ytdRevTarget ? Math.round(b.ytdRevActual / b.ytdRevTarget * 100) : 0
  }));
  const gap = rows.reduce((a, b) => a + b.gap, 0);
  const left = rows.reduce((a, b) => a + b.left, 0);
  root.innerHTML = `
    <section class="slab">
      <div class="slab-h"><h2>عجز الميزانية</h2><span class="voice">الأسبوع ٣٩ · ١ أكتوبر</span></div>
      <p class="pc-qty"><b>${sar(gap)}</b> <span>عجز حالي · باقي السنة ${sar(left)}</span></p>
      <div id="fin-gap"></div>
    </section>
    <section class="slab"><div class="slab-h"><h2>نسبة التحقيق</h2><span class="voice">من تارجت الأسبوع ٣٩</span></div><div id="fin-hit"></div></section>
    <div class="vaults">${rows.map(b => `<article class="slab vault">
      <h3>${AR[b.id] || b.name}</h3>
      <div class="amt">${sar(b.gap)}<small>عجز</small></div>
      <div class="vault-foot"><span>${b.hit}% محقق</span><span>باقي السنة ${sar(b.left)}</span></div>
    </article>`).join("")}</div>`;
  const Apex = await loadApex();
  const theme = { foreColor: "#f4ede4", fontFamily: "IBM Plex Sans Arabic, sans-serif", toolbar: { show: false } };
  new Apex(document.getElementById("fin-gap"), {
    chart: { type: "bar", height: 320, background: "transparent", ...theme },
    series: [{ name: "العجز", data: rows.map(b => b.gap) }],
    plotOptions: { bar: { horizontal: true, borderRadius: 8, barHeight: "58%", distributed: true } },
    colors: ["#c46bd4", "#9b6bff", "#e23b4a", "#f4ede4", "#7c2280"],
    xaxis: { categories: rows.map(b => AR[b.id] || b.name), labels: { formatter: v => sar(v) } },
    dataLabels: { enabled: true, formatter: v => sar(v), style: { colors: ["#0a0612"] } },
    grid: { borderColor: "rgba(255,255,255,.08)" },
    tooltip: { y: { formatter: v => sar(v) + " SAR" } },
    legend: { show: false }
  }).render();
  new Apex(document.getElementById("fin-hit"), {
    chart: { type: "radialBar", height: 340, background: "transparent", ...theme },
    series: rows.map(b => b.hit),
    labels: rows.map(b => AR[b.id] || b.name),
    colors: ["#9b6bff", "#c46bd4", "#f4ede4", "#e23b4a", "#7c2280"],
    plotOptions: { radialBar: { hollow: { size: "28%" }, dataLabels: { total: { show: true, label: "عجز", formatter: () => sar(gap) } } } },
    stroke: { lineCap: "round" }
  }).render();
}

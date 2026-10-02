// Mount points only. Every visual here is rendered by a GitHub library:
//   chart.js            github.com/chartjs/Chart.js
//   ApexCharts          github.com/apexcharts/apexcharts.js

//   CountUp.js          github.com/inorganik/countUp.js
const LIB = {
  chart: "vendor/chart.umd.min.js",
  apex: "vendor/apexcharts.min.js",
  countup: "vendor/countUp.umd.js"
};
const loading = new Map();
let mountId = 0;
function loadScript(src) {
  if (loading.has(src)) return loading.get(src);
  const p = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => res();
    s.onerror = () => { loading.delete(src); rej(new Error(src)); };
    document.head.append(s);
  });
  loading.set(src, p);
  return p;
}

let chartBar = null, apexValue = null, apexLoc = null, grid = null;

export async function mountGithubDash(ctx) {
  const barHost = document.getElementById("gh-stock-bar");
  const countHost = document.getElementById("gh-count");
  const apexHost = document.getElementById("gh-apex");
  const locHost = document.getElementById("gh-loc");
  const gridHost = document.getElementById("gh-grid");
  if (!barHost) return;
  // The libraries load async; if the person has moved to another tab meanwhile, the mount points are gone.
  const id = ++mountId;
  const alive = () => barHost.isConnected && id === mountId;
  chartBar?.destroy(); chartBar = null;
  apexValue?.destroy(); apexValue = null;
  apexLoc?.destroy(); apexLoc = null;
  grid?.destroy(); grid = null;

  const { products, locations, categories, units, total, value, qty } = ctx;
  const unitsOnHand = products.reduce((a, p) => a + total(p), 0);
  const ranked = [...products].sort((a, b) => total(b) - total(a)).slice(0, 12);

  try {
    await loadScript(LIB.countup);
    if (!alive()) return;
    const CountUp = window.countUp?.CountUp;
    if (CountUp && countHost) {
      countHost.innerHTML = `<div class="slab-h"><h2>Current stock count</h2><span class="voice">CountUp.js</span></div><div class="hero-num" id="gh-count-num" style="font-size:clamp(42px,6vw,72px)">0</div>`;
      const c = new CountUp("gh-count-num", unitsOnHand, { duration: 1.4, separator: ",", decimalPlaces: 0 });
      if (!c.error) c.start(); else countHost.querySelector("#gh-count-num").textContent = ctx.nf0.format(unitsOnHand);
    }
  } catch { if (countHost) countHost.innerHTML = `<p class="empty">CountUp.js needs a connection.</p>`; }

  try {
    await loadScript(LIB.chart);
    if (!alive()) return;
    barHost.innerHTML = `<div class="slab-h"><h2>Current stock bar</h2><span class="voice">Chart.js</span></div><div style="height:360px"><canvas id="gh-bar-canvas"></canvas></div>`;
    chartBar = new window.Chart(document.getElementById("gh-bar-canvas"), {
      type: "bar",
      data: {
        labels: ranked.map(p => p.name),
        datasets: [{
          label: "On hand",
          data: ranked.map(p => Math.round(total(p) * 100) / 100),
          backgroundColor: "#9b6bff",
          borderRadius: 6,
          maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(190,170,255,.12)" }, ticks: { color: "#bdb6d8" } },
          y: { grid: { display: false }, ticks: { color: "#f2efff", font: { size: 11 } } }
        }
      }
    });
  } catch { barHost.innerHTML = `<p class="empty">Chart.js needs a connection.</p>`; }

  try {
    await loadScript(LIB.apex);
    if (!alive()) return;
    const byCat = categories.map(c => ({
      name: c.name,
      v: products.filter(p => p.category === c.id).reduce((a, p) => a + value(p), 0)
    })).filter(c => c.v > 0.01);
    apexHost.innerHTML = `<div class="slab-h"><h2>Value dashboard</h2><span class="voice">ApexCharts</span></div><div id="gh-apex-chart"></div>`;
    apexValue = new window.ApexCharts(document.getElementById("gh-apex-chart"), {
      chart: { type: "donut", height: 320, background: "transparent", fontFamily: "Martian Mono, monospace" },
      theme: { mode: "dark" },
      labels: byCat.map(c => c.name),
      series: byCat.map(c => Math.round(c.v)),
      legend: { position: "bottom", labels: { colors: "#bdb6d8" } },
      stroke: { colors: ["#05040a"] },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: n => `${ctx.sar(n)} SAR` } }
    });
    apexValue.render();

    locHost.innerHTML = `<div class="slab-h"><h2>Stock by vault</h2><span class="voice">ApexCharts</span></div><div id="gh-loc-chart"></div>`;
    apexLoc = new window.ApexCharts(document.getElementById("gh-loc-chart"), {
      chart: { type: "bar", height: 280, background: "transparent", toolbar: { show: false }, fontFamily: "Martian Mono, monospace" },
      theme: { mode: "dark" },
      series: [{ name: "Value SAR", data: locations.map(l => Math.round(products.reduce((a, p) => a + value(p, l.id), 0))) }],
      xaxis: { categories: locations.map(l => l.short), labels: { style: { colors: "#bdb6d8" } } },
      yaxis: { labels: { style: { colors: "#7f789c" } } },
      plotOptions: { bar: { borderRadius: 6, columnWidth: "46%" } },
      colors: ["#ff4fd8"],
      dataLabels: { enabled: false },
      grid: { borderColor: "rgba(190,170,255,.12)" }
    });
    apexLoc.render();
  } catch { apexHost.innerHTML = `<p class="empty">ApexCharts needs a connection.</p>`; }

  // the Grid.js table was a duplicate of the Stock ledger and broke in Arabic; removed
}

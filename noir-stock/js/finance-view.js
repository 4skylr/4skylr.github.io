// Web3 budget gauges. Library: github.com/apache/echarts
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب" };
const sar = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));

function loadEcharts() {
  if (window.echarts) return Promise.resolve(window.echarts);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js";
    s.onload = () => res(window.echarts);
    s.onerror = rej;
    document.head.append(s);
  });
}

export async function renderFinance(root) {
  const data = await fetch("finance/budget-2026.json?v=51").then(r => r.json());
  const rows = data.branches.map(b => ({ ...b, gap: Math.max(0, b.ytdRevTarget - b.ytdRevActual), left: b.yearRev - b.ytdRevActual, hit: b.ytdRevTarget ? b.ytdRevActual / b.ytdRevTarget : 0 }));
  const gap = rows.reduce((a, b) => a + b.gap, 0);
  const left = rows.reduce((a, b) => a + b.left, 0);
  root.innerHTML = `
    <section class="slab">
      <div class="slab-h"><h2>العجز والباقي</h2><span class="voice">حتى ١ أكتوبر · الأسبوع ٣٩</span></div>
      <p class="pc-qty"><b>${sar(gap)}</b> <span>عجز حالي · باقي السنة ${sar(left)}</span></p>
      <div id="fin-ring" style="height:340px"></div>
    </section>
    <div class="vaults">${rows.map(b => `<article class="slab vault">
      <h3>${AR[b.id] || b.name}</h3>
      <div class="amt">${sar(b.gap)}<small>عجز</small></div>
      <div class="meter"><i style="width:${Math.round(b.hit * 100)}%"></i></div>
      <div class="vault-foot"><span>${Math.round(b.hit * 100)}% محقق</span><span>باقي السنة ${sar(b.left)}</span></div>
    </article>`).join("")}</div>
    <section class="slab"><div id="fin-orbit" style="height:280px"></div></section>`;
  const echarts = await loadEcharts();
  echarts.init(document.getElementById("fin-ring"), null, { renderer: "svg" }).setOption({
    backgroundColor: "transparent",
    series: rows.map((b, i) => ({
      type: "gauge",
      startAngle: 210,
      endAngle: -30,
      radius: `${78 - i * 12}%`,
      center: ["50%", "58%"],
      min: 0,
      max: 100,
      progress: { show: true, width: 8, roundCap: true, itemStyle: { color: i === 3 ? "#e23b4a" : "#c46bd4" } },
      axisLine: { lineStyle: { width: 8, color: [[1, "rgba(255,255,255,.08)"]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      title: { show: i === 0, offsetCenter: [0, "28%"], color: "#f4ede4", fontSize: 13 },
      detail: { show: i === 0, offsetCenter: [0, "0%"], color: "#f4ede4", fontSize: 28, formatter: () => sar(gap) },
      data: [{ value: Math.round(b.hit * 100), name: "عجز الفروع" }]
    }))
  });
  echarts.init(document.getElementById("fin-orbit"), null, { renderer: "svg" }).setOption({
    backgroundColor: "transparent",
    polar: {},
    angleAxis: { type: "category", data: rows.map(b => AR[b.id]), axisLabel: { color: "#f4ede4" } },
    radiusAxis: { axisLabel: { color: "#a4a4a4" }, splitLine: { lineStyle: { color: "rgba(255,255,255,.08)" } } },
    series: [
      { type: "bar", coordinateSystem: "polar", name: "محقق", data: rows.map(b => Math.round(b.ytdRevActual)), itemStyle: { color: "#9b6bff" } },
      { type: "bar", coordinateSystem: "polar", name: "عجز", data: rows.map(b => Math.round(b.gap)), itemStyle: { color: "#e23b4a" } }
    ]
  });
}

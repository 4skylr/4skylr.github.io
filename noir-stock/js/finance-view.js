// Finance page. Chart: github.com/apache/echarts
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب" };
const EN = { hafar: "Hafar", khafji: "Khafji", unaizah: "Unaizah", dammam: "Dammam", mithnab: "Mithnab" };
const money = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const lang = () => sessionStorage.getItem("noir-lang") || "en";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function monthsOf(branch) {
  const start = new Date("2026-01-05");
  const bucket = {};
  branch.weeks.forEach((w, i) => {
    if (w.a == null) return;
    const dt = new Date(start);
    dt.setDate(start.getDate() + i * 7);
    const key = dt.getMonth();
    bucket[key] = bucket[key] || { m: key, a: 0, t: 0 };
    bucket[key].a += Number(w.a) || 0;
    bucket[key].t += Number(w.t) || 0;
  });
  return Object.values(bucket).sort((a, b) => a.m - b.m);
}

export async function renderFinance(root) {
  const ar = lang() === "ar";
  const name = id => ar ? AR[id] : EN[id];
  const data = await fetch("finance/budget-2026.json?v=56").then(r => r.json());
  const echarts = await loadEcharts();
  const rows = data.branches.map(b => {
    const done = b.weeks.filter(w => w.a != null).length;
    const leftWeeks = Math.max(1, b.weeks.length - done);
    return {
      ...b,
      gap: Math.round(b.ytdRevTarget - b.ytdRevActual),
      yearLeft: Math.round(b.yearRev - b.ytdRevActual),
      hit: Math.round(b.ytdRevActual / b.ytdRevTarget * 100),
      need: Math.round((b.yearRev - b.ytdRevActual) / leftWeeks),
      months: monthsOf(b)
    };
  }).sort((a, b) => b.hit - a.hit);
  const gap = rows.reduce((s, b) => s + b.gap, 0);
  root.innerHTML = `
    <section class="fin-page" dir="${ar ? "rtl" : "ltr"}">
      <header class="fin-top">
        <div><p>${ar ? "حتى ١ أكتوبر · الأسبوع ٣٩" : "Through 1 Oct · week 39"}</p><h2>${ar ? "تقدم الفروع" : "Branch progress"}</h2></div>
        <div class="fin-kpis"><span><b>${money(gap)}</b><i>${ar ? "عجز حالي" : "Current gap"}</i></span></div>
      </header>
      <div class="fin-cards">${rows.map(b => `<button type="button" class="fin-card" data-id="${b.id}">
        <strong>${name(b.id)}</strong>
        <em>${b.hit}%</em>
        <i style="width:${Math.min(b.hit, 100)}%"></i>
        <span>${ar ? "عجز" : "Gap"} ${money(b.gap)}</span>
        <span>${ar ? "باقي السنة" : "Left this year"} ${money(b.yearLeft)}</span>
      </button>`).join("")}</div>
      <div class="fin-chart-card"><p id="fin-caption"></p><div id="fin-months" style="height:320px"></div></div>
    </section>`;
  const chart = echarts.init(document.getElementById("fin-months"), null, { renderer: "svg" });
  const draw = b => {
    document.getElementById("fin-caption").textContent = `${name(b.id)} · ${ar ? "المبيعات الشهرية" : "Monthly sales"} · ${ar ? "باقي للتحقيق" : "left to hit"} ${money(b.yearLeft)}`;
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      legend: { textStyle: { color: "#f4ede4" } },
      grid: { left: 64, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "category", data: b.months.map(m => MONTHS[m.m]), axisLabel: { color: "#f4ede4" } },
      yAxis: { type: "value", axisLabel: { color: "#a4a4a4" }, splitLine: { lineStyle: { color: "rgba(255,255,255,.06)" } } },
      series: [
        { name: ar ? "التارجت" : "Target", type: "bar", data: b.months.map(m => Math.round(m.t)), itemStyle: { color: "rgba(244,237,228,.28)", borderRadius: 6 } },
        { name: ar ? "المبيعات" : "Sales", type: "bar", data: b.months.map(m => Math.round(m.a)), itemStyle: { color: "#c46bd4", borderRadius: 6 } }
      ]
    });
    root.querySelectorAll(".fin-card").forEach(el => el.classList.toggle("on", el.dataset.id === b.id));
  };
  draw(rows[0]);
  root.querySelectorAll(".fin-card").forEach(el => el.onclick = () => draw(rows.find(b => b.id === el.dataset.id)));
}

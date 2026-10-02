// Finance page. Chart: github.com/apache/echarts
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب", all: "كل الفروع" };
const EN = { hafar: "Hafar", khafji: "Khafji", unaizah: "Unaizah", dammam: "Dammam", mithnab: "Mithnab", all: "All branches" };
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

function monthsOf(weeks) {
  const start = new Date("2026-01-05");
  const bucket = {};
  weeks.forEach((w, i) => {
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
  const label = id => ar ? AR[id] : EN[id];
  const data = await fetch("finance/budget-2026.json?v=57").then(r => r.json());
  const echarts = await loadEcharts();
  const rows = data.branches.map(b => {
    const done = b.weeks.filter(w => w.a != null).length;
    const leftWeeks = Math.max(1, b.weeks.length - done);
    return {
      ...b,
      gap: Math.round(b.ytdRevTarget - b.ytdRevActual),
      yearLeft: Math.round(b.yearRev - b.ytdRevActual),
      hit: Math.round(b.ytdRevActual / b.ytdRevTarget * 100),
      need: Math.round((b.yearRev - b.ytdRevActual) / leftWeeks)
    };
  });
  root.innerHTML = `
    <section class="fin-page" dir="${ar ? "rtl" : "ltr"}">
      <label class="fin-pick">${ar ? "الفرع" : "Branch"}
        <select id="fin-branch">
          <option value="all">${label("all")}</option>
          ${rows.map(b => `<option value="${b.id}">${label(b.id)}</option>`).join("")}
        </select>
      </label>
      <div class="fin-kpis" id="fin-kpis"></div>
      <div class="fin-chart-card"><div id="fin-months" style="height:340px"></div></div>
      <div class="fin-table-wrap"><table class="fin-table" id="fin-table"></table></div>
    </section>`;
  const chart = echarts.init(document.getElementById("fin-months"), null, { renderer: "svg" });
  const drawAll = () => {
    const gap = rows.reduce((s, b) => s + b.gap, 0);
    const left = rows.reduce((s, b) => s + b.yearLeft, 0);
    document.getElementById("fin-kpis").innerHTML = `<span><b>${money(gap)}</b><i>${ar ? "عجز كل الفروع" : "Gap, all branches"}</i></span><span><b>${money(left)}</b><i>${ar ? "باقي السنة" : "Left this year"}</i></span>`;
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      legend: { textStyle: { color: "#f4ede4" } },
      grid: { left: 80, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "category", data: rows.map(b => label(b.id)), axisLabel: { color: "#f4ede4" } },
      yAxis: { type: "value", axisLabel: { color: "#a4a4a4" }, splitLine: { lineStyle: { color: "rgba(255,255,255,.06)" } } },
      series: [
        { name: ar ? "محقق" : "Actual", type: "bar", data: rows.map(b => Math.round(b.ytdRevActual)), itemStyle: { color: "#c46bd4", borderRadius: 6 } },
        { name: ar ? "تارجت" : "Target", type: "bar", data: rows.map(b => Math.round(b.ytdRevTarget)), itemStyle: { color: "rgba(244,237,228,.28)", borderRadius: 6 } }
      ]
    }, true);
    document.getElementById("fin-table").innerHTML = `<thead><tr><th>${ar ? "الفرع" : "Branch"}</th><th>${ar ? "النسبة" : "Hit"}</th><th>${ar ? "العجز" : "Gap"}</th><th>${ar ? "باقي السنة" : "Left this year"}</th><th>${ar ? "مطلوب أسبوعياً" : "Need / week"}</th></tr></thead><tbody>${rows.map(b => `<tr><td>${label(b.id)}</td><td>${b.hit}%</td><td class="neg">${money(b.gap)}</td><td>${money(b.yearLeft)}</td><td>${money(b.need)}</td></tr>`).join("")}</tbody>`;
  };
  const drawOne = b => {
    const months = monthsOf(b.weeks);
    document.getElementById("fin-kpis").innerHTML = `<span><b>${b.hit}%</b><i>${ar ? "نسبة التحقيق" : "Hit rate"}</i></span><span><b>${money(b.gap)}</b><i>${ar ? "العجز الحالي" : "Current gap"}</i></span><span><b>${money(b.yearLeft)}</b><i>${ar ? "باقي للميزانية" : "Left to budget"}</i></span>`;
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      legend: { textStyle: { color: "#f4ede4" } },
      grid: { left: 64, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "category", data: months.map(m => MONTHS[m.m]), axisLabel: { color: "#f4ede4" } },
      yAxis: { type: "value", axisLabel: { color: "#a4a4a4" }, splitLine: { lineStyle: { color: "rgba(255,255,255,.06)" } } },
      series: [
        { name: ar ? "المبيعات" : "Sales", type: "bar", data: months.map(m => Math.round(m.a)), itemStyle: { color: "#c46bd4", borderRadius: 6 } },
        { name: ar ? "التارجت" : "Target", type: "bar", data: months.map(m => Math.round(m.t)), itemStyle: { color: "rgba(244,237,228,.28)", borderRadius: 6 } }
      ]
    }, true);
    document.getElementById("fin-table").innerHTML = `<thead><tr><th>${ar ? "الشهر" : "Month"}</th><th>${ar ? "المبيعات" : "Sales"}</th><th>${ar ? "التارجت" : "Target"}</th><th>${ar ? "الفرق" : "Gap"}</th></tr></thead><tbody>${months.map(m => `<tr><td>${MONTHS[m.m]}</td><td>${money(m.a)}</td><td>${money(m.t)}</td><td class="neg">${money(m.t - m.a)}</td></tr>`).join("")}</tbody>`;
  };
  const select = document.getElementById("fin-branch");
  const paint = () => select.value === "all" ? drawAll() : drawOne(rows.find(b => b.id === select.value));
  select.onchange = paint;
  paint();
}

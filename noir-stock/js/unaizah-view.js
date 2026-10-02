// Unaizah sales. Chart: github.com/apache/echarts
const NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const money = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const lang = () => sessionStorage.getItem("noir-lang") || "en";

export async function renderUnaizah(root) {
  const ar = lang() === "ar";
  const data = await fetch("unaizah/sales.json?v=58").then(r => r.json());
  if (!window.echarts) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"; s.onload = res; s.onerror = rej; document.head.append(s); });
  root.innerHTML = `
    <section class="fin-page" dir="${ar ? "rtl" : "ltr"}">
      <header class="fin-top">
        <div><p>Unaizah · DCS</p><h2>${ar ? "مبيعات عنيزة" : "Unaizah sales"}</h2></div>
        <label class="fin-pick">${ar ? "السنة" : "Year"}
          <select id="uz-year"><option>2024</option><option>2025</option><option selected>2026</option></select>
        </label>
      </header>
      <div class="fin-kpis" id="uz-kpis"></div>
      <div class="fin-chart-card"><div id="uz-chart" style="height:300px"></div></div>
      <div class="fin-table-wrap"><table class="fin-table" id="uz-table"></table></div>
      <p class="note" id="uz-note"></p>
    </section>`;
  const chart = window.echarts.init(document.getElementById("uz-chart"), null, { renderer: "svg" });
  const paint = () => {
    const year = document.getElementById("uz-year").value;
    const rows = data.months.filter(m => m.year === year);
    const total = rows.reduce((s, m) => s + m.total, 0);
    document.getElementById("uz-kpis").innerHTML = `<span><b>${money(total)}</b><i>${ar ? "مجموع السنة" : "Year total"}</i></span><span><b>${rows.length}</b><i>${ar ? "أشهر مرفوعة" : "Months filed"}</i></span>`;
    chart.setOption({
      backgroundColor: "transparent",
      grid: { left: 64, right: 12, top: 20, bottom: 28 },
      xAxis: { type: "category", data: rows.map(m => NAMES[m.month - 1]), axisLabel: { color: "#f4ede4" } },
      yAxis: { type: "value", axisLabel: { color: "#a4a4a4" }, splitLine: { lineStyle: { color: "rgba(255,255,255,.06)" } } },
      series: [{ type: "bar", data: rows.map(m => Math.round(m.total)), itemStyle: { color: "#c46bd4", borderRadius: 6 } }]
    }, true);
    document.getElementById("uz-table").innerHTML = `<thead><tr><th>${ar ? "الشهر" : "Month"}</th><th>${ar ? "المبيعات" : "Sales"}</th><th>${ar ? "الأيام" : "Days"}</th><th>${ar ? "الملف" : "File"}</th></tr></thead><tbody>${
      rows.map(m => `<tr><td>${NAMES[m.month - 1]}</td><td>${money(m.total)}</td><td>${m.days}</td><td>${m.file}</td></tr>`).join("")
    }</tbody>`;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const diff = last && prev ? Math.round((last.total - prev.total) / prev.total * 100) : null;
    document.getElementById("uz-note").textContent = last
      ? `${NAMES[last.month - 1]} ${year}: ${money(last.total)}${diff == null ? "" : ` · ${diff > 0 ? "+" : ""}${diff}% vs previous month`}. October onward waits for the weekly file.`
      : "No file for this year yet.";
  };
  document.getElementById("uz-year").onchange = paint;
  paint();
}

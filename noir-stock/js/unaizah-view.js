// Unaizah statement. D3: github.com/d3/d3  Forecast: github.com/simple-statistics/simple-statistics
const NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const money = n => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const lang = () => sessionStorage.getItem("noir-lang") || "en";
const load = (src, test) => test() ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });

function forecast(rows) {
  const ys = rows.map(m => Number(m.total) || 0);
  if (ys.length < 2 || !window.ss) return null;
  const line = window.ss.linearRegression(ys.map((y, i) => [i + 1, y]));
  return Math.max(0, line.m * (ys.length + 1) + line.b);
}

function drawD3(rows) {
  const host = document.getElementById("uz-d3");
  if (!host || !window.d3) return;
  host.innerHTML = "";
  const w = Math.max(host.clientWidth || 720, 320), h = 260, m = { t: 16, r: 12, b: 32, l: 64 };
  const svg = window.d3.select(host).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const max = window.d3.max(rows, d => Math.max(+d.cash || 0, +d.credit_card || 0)) || 1;
  const x = window.d3.scaleBand().domain(rows.map(d => NAMES[d.month - 1].slice(0, 3))).range([m.l, w - m.r]).padding(0.28);
  const y = window.d3.scaleLinear().domain([0, max * 1.08]).nice().range([h - m.b, m.t]);
  svg.append("g").attr("transform", `translate(0,${h - m.b})`).call(window.d3.axisBottom(x)).selectAll("text").attr("fill", "#a4a4a4");
  svg.append("g").attr("transform", `translate(${m.l},0)`).call(window.d3.axisLeft(y).ticks(4).tickFormat(v => `${Math.round(v / 1000)}k`)).selectAll("text").attr("fill", "#a4a4a4");
  svg.selectAll("path,line").attr("stroke", "rgba(255,255,255,.12)");
  svg.selectAll(".cash").data(rows).join("rect").attr("x", d => x(NAMES[d.month - 1].slice(0, 3))).attr("width", x.bandwidth() / 2).attr("y", d => y(+d.cash || 0)).attr("height", d => y(0) - y(+d.cash || 0)).attr("fill", "#f4ede4");
  svg.selectAll(".card").data(rows).join("rect").attr("x", d => x(NAMES[d.month - 1].slice(0, 3)) + x.bandwidth() / 2).attr("width", x.bandwidth() / 2).attr("y", d => y(+d.credit_card || 0)).attr("height", d => y(0) - y(+d.credit_card || 0)).attr("fill", "#c46bd4");
}

export async function renderUnaizah(root) {
  const ar = lang() === "ar";
  const data = await fetch("unaizah/sales.json?v=61").then(r => r.json());
  root.innerHTML = `
    <section class="stmt" dir="${ar ? "rtl" : "ltr"}">
      <header class="stmt-head">
        <div><p>Noir Cinema · Unaizah</p><h2>${ar ? "كشف المبيعات" : "Sales statement"}</h2></div>
        <label class="fin-pick">${ar ? "السنة" : "Year"}<select id="uz-year"><option>2024</option><option>2025</option><option selected>2026</option></select></label>
      </header>
      <div class="stmt-kpis" id="uz-kpis"></div>
      <div class="stmt-card"><div class="stmt-legend"><span><i class="c"></i>${ar ? "كاش" : "Cash"}</span><span><i class="k"></i>${ar ? "شبكة" : "Card"}</span><b id="uz-forecast"></b></div><div id="uz-d3"></div></div>
      <div class="fin-table-wrap"><table class="stmt-table" id="uz-table"></table></div>
    </section>`;
  const paint = () => {
    const rows = data.months.filter(m => m.year === document.getElementById("uz-year").value);
    const sum = k => rows.reduce((s, m) => s + (Number(m[k]) || 0), 0);
    const total = sum("total"), cash = sum("cash"), card = sum("credit_card");
    document.getElementById("uz-kpis").innerHTML = [
      [ar ? "إجمالي المبيعات" : "Net sales", money(total)],
      [ar ? "كاش" : "Cash", `${money(cash)} · ${total ? Math.round(cash / total * 100) : 0}%`],
      [ar ? "شبكة" : "Card", `${money(card)} · ${total ? Math.round(card / total * 100) : 0}%`],
      [ar ? "العجز" : "Shortage", money(sum("shortage"))]
    ].map(([l, v]) => `<span><i>${l}</i><b>${v}</b></span>`).join("");
    document.getElementById("uz-table").innerHTML = `<thead><tr>
      <th>${ar ? "الشهر" : "Month"}</th><th>${ar ? "كاش" : "Cash"}</th><th>${ar ? "شبكة" : "Card"}</th><th>${ar ? "أونلاين" : "Online"}</th><th>${ar ? "الإجمالي" : "Total"}</th><th>${ar ? "فرق الشهر" : "Vs prior"}</th><th>${ar ? "عجز" : "Shortage"}</th>
    </tr></thead><tbody>${rows.map((m, i) => {
      const prior = i ? rows[i - 1].total : 0;
      const diff = prior ? (m.total - prior) / prior * 100 : 0;
      return `<tr><td>${NAMES[m.month - 1]}</td><td>${money(m.cash)}</td><td>${money(m.credit_card)}</td><td>${money(m.online)}</td><td>${money(m.total)}</td><td class="${diff < 0 ? "neg" : ""}">${i ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%` : "—"}</td><td class="neg">${money(m.shortage)}</td></tr>`;
    }).join("")}<tr class="total"><td>${ar ? "الإجمالي" : "Total"}</td><td>${money(cash)}</td><td>${money(card)}</td><td>${money(sum("online"))}</td><td>${money(total)}</td><td></td><td class="neg">${money(sum("shortage"))}</td></tr></tbody>`;
    drawD3(rows);
    const next = forecast(rows);
    document.getElementById("uz-forecast").textContent = next ? `${ar ? "توقع الشهر القادم" : "Next month"} ${money(next)}` : "";
  };
  await load("https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js", () => window.d3);
  await load("https://cdn.jsdelivr.net/npm/simple-statistics@7.8.8/dist/simple-statistics.min.js", () => window.ss);
  document.getElementById("uz-year").onchange = paint;
  paint();
}

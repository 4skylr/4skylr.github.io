// Unaizah ledger. No chart: cash, card, shortage, and tender movements.
const NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const money = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const lang = () => sessionStorage.getItem("noir-lang") || "en";
function load(src, test) { if (test()) return Promise.resolve(); return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); }); }
function forecast(rows) {
  const ys = rows.map(m => Number(m.total) || 0);
  if (ys.length < 2 || !window.ss) return null;
  const line = window.ss.linearRegression(ys.map((y, i) => [i + 1, y]));
  return Math.max(0, Math.round(line.m * (ys.length + 1) + line.b));
}
function drawD3(rows) {
  const host = document.getElementById("uz-d3");
  host.innerHTML = "";
  const w = host.clientWidth || 640, h = 220, pad = 28;
  const svg = window.d3.select(host).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const max = window.d3.max(rows, d => Math.max(Number(d.cash) || 0, Number(d.credit_card) || 0)) || 1;
  const x = window.d3.scaleBand().domain(rows.map(d => NAMES[d.month - 1])).range([pad, w - 8]).padding(0.25);
  const y = window.d3.scaleLinear().domain([0, max]).range([h - pad, 12]);
  svg.selectAll("rect.cash").data(rows).join("rect").attr("class", "cash").attr("x", d => x(NAMES[d.month - 1])).attr("width", x.bandwidth() / 2).attr("y", d => y(Number(d.cash) || 0)).attr("height", d => y(0) - y(Number(d.cash) || 0)).attr("fill", "#f4ede4");
  svg.selectAll("rect.card").data(rows).join("rect").attr("class", "card").attr("x", d => x(NAMES[d.month - 1]) + x.bandwidth() / 2).attr("width", x.bandwidth() / 2).attr("y", d => y(Number(d.credit_card) || 0)).attr("height", d => y(0) - y(Number(d.credit_card) || 0)).attr("fill", "#c46bd4");
  svg.selectAll("text.lab").data(rows).join("text").attr("class", "lab").attr("x", d => x(NAMES[d.month - 1]) + x.bandwidth() / 2).attr("y", h - 8).attr("text-anchor", "middle").attr("fill", "#a4a4a4").attr("font-size", 11).text(d => NAMES[d.month - 1]);
}

export async function renderUnaizah(root) {
  const ar = lang() === "ar";
  const data = await fetch("unaizah/sales.json?v=59").then(r => r.json());
  root.innerHTML = `
    <section class="fin-page" dir="${ar ? "rtl" : "ltr"}">
      <header class="fin-top">
        <div><p>Unaizah · DCS</p><h2>${ar ? "قائمة مبيعات عنيزة" : "Unaizah sales ledger"}</h2></div>
        <label class="fin-pick">${ar ? "السنة" : "Year"}
          <select id="uz-year"><option>2024</option><option>2025</option><option selected>2026</option></select>
        </label>
      </header>
      <div class="fin-kpis" id="uz-kpis"></div>
      <div class="fin-table-wrap"><table class="fin-table" id="uz-table"></table></div>
      <div class="fin-chart-card"><p id="uz-forecast"></p><div id="uz-d3"></div></div>
      <div class="fin-table-wrap"><table class="fin-table" id="uz-move"></table></div>
    </section>`;
  const paint = () => {
    const year = document.getElementById("uz-year").value;
    const rows = data.months.filter(m => m.year === year);
    const sum = k => rows.reduce((s, m) => s + (Number(m[k]) || 0), 0);
    document.getElementById("uz-kpis").innerHTML = `
      <span><b>${money(sum("cash"))}</b><i>${ar ? "كاش" : "Cash"}</i></span>
      <span><b>${money(sum("credit_card"))}</b><i>${ar ? "شبكة" : "Card"}</i></span>
      <span><b>${money(sum("shortage"))}</b><i>${ar ? "عجز" : "Shortage"}</i></span>`;
    document.getElementById("uz-table").innerHTML = `<thead><tr>
      <th>${ar ? "الشهر" : "Month"}</th><th>${ar ? "كاش" : "Cash"}</th><th>${ar ? "شبكة" : "Card"}</th>
      <th>${ar ? "أونلاين" : "Online"}</th><th>${ar ? "الإجمالي" : "Total"}</th><th>${ar ? "عجز" : "Shortage"}</th><th>${ar ? "زيادة" : "Excess"}</th>
    </tr></thead><tbody>${rows.map(m => `<tr>
      <td>${NAMES[m.month - 1]}</td><td>${money(m.cash)}</td><td>${money(m.credit_card)}</td>
      <td>${money(m.online)}</td><td>${money(m.total)}</td><td class="neg">${money(m.shortage)}</td><td>${money(m.excess)}</td>
    </tr>`).join("")}</tbody>`;
    document.getElementById("uz-move").innerHTML = `<thead><tr>
      <th>${ar ? "الشهر" : "Month"}</th><th>Jahez</th><th>Hunger</th><th>${ar ? "قسيمة" : "Voucher"}</th><th>${ar ? "مسبق" : "Prepaid"}</th><th>${ar ? "أخرى" : "Other"}</th>
    </tr></thead><tbody>${rows.map(m => `<tr>
      <td>${NAMES[m.month - 1]}</td><td>${money(m.jahez)}</td><td>${money(m.hunger_station)}</td>
      <td>${money(m.voucher)}</td><td>${money(m["pre-paid"])}</td><td>${money(m.other)}</td>
    </tr>`).join("")}</tbody>`;
  };
  document.getElementById("uz-year").onchange = paint;
  await load("https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js", () => window.d3);
  await load("https://cdn.jsdelivr.net/npm/simple-statistics@7.8.8/dist/simple-statistics.min.js", () => window.ss);
  paint();
  const old = paint;
  document.getElementById("uz-year").onchange = () => { old(); const rows = data.months.filter(m => m.year === document.getElementById("uz-year").value); drawD3(rows); const next = forecast(rows); document.getElementById("uz-forecast").textContent = next ? (ar ? "توقع الشهر القادم " : "Next month forecast ") + money(next) : ""; };
  document.getElementById("uz-year").onchange();
}

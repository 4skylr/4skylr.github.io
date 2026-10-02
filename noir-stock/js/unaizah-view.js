// Unaizah ledger. No chart: cash, card, shortage, and tender movements.
const NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const money = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const lang = () => sessionStorage.getItem("noir-lang") || "en";

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
  paint();
}

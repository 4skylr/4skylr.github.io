// Unaizah tender board. Icons from the payment sheet. D3: github.com/d3/d3
const NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const money = n => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const lang = () => sessionStorage.getItem("noir-lang") || "en";
const TENDERS = [
  ["cash", "Cash", "كاش", "assets/pay/cash.png"],
  ["credit_card", "Card", "شبكة", "assets/pay/card.png"],
  ["online", "Online", "أونلاين", "assets/pay/online.png"],
  ["jahez", "Jahez", "جاهز", "assets/pay/jahez.png"],
  ["hunger_station", "Hunger", "هنقر", "assets/pay/hunger.png"],
  ["voucher", "Voucher", "قسيمة", "assets/pay/voucher.png"],
  ["pre-paid", "Prepaid", "مسبق", "assets/pay/prepaid.png"],
  ["other", "Other", "أخرى", "assets/pay/noir.png"]
];

export async function renderUnaizah(root) {
  const ar = lang() === "ar";
  const data = await fetch("unaizah/sales.json?v=62").then(r => r.json());
  root.innerHTML = `
    <section class="pay-board" dir="${ar ? "rtl" : "ltr"}">
      <header class="stmt-head">
        <div class="pay-brand"><img src="assets/pay/noir.png" alt="Noir Cinema"><div><p>Noir Cinema · Unaizah</p><h2>${ar ? "حركة الدفع" : "Tender movement"}</h2></div></div>
        <label class="fin-pick">${ar ? "السنة" : "Year"}<select id="uz-year"><option>2024</option><option>2025</option><option selected>2026</option></select></label>
      </header>
      <div class="pay-grid" id="uz-grid"></div>
      <div class="fin-table-wrap"><table class="stmt-table" id="uz-table"></table></div>
    </section>`;
  const paint = () => {
    const rows = data.months.filter(m => m.year === document.getElementById("uz-year").value);
    const sum = k => rows.reduce((s, m) => s + (Number(m[k]) || 0), 0);
    const total = sum("total") || 1;
    document.getElementById("uz-grid").innerHTML = TENDERS.map(([key, en, arName, icon]) => {
      const n = sum(key);
      return `<article><img src="${icon}" alt=""><b>${money(n)}</b><span>${ar ? arName : en}</span><i style="width:${Math.min(100, n / total * 100)}%"></i></article>`;
    }).join("") + `<article class="short"><img src="assets/pay/bogo.png" alt=""><b>${money(sum("shortage"))}</b><span>${ar ? "العجز" : "Shortage"}</span></article>`;
    document.getElementById("uz-table").innerHTML = `<thead><tr><th>${ar ? "الشهر" : "Month"}</th>${TENDERS.slice(0, 4).map(t => `<th>${ar ? t[2] : t[1]}</th>`).join("")}<th>${ar ? "الإجمالي" : "Total"}</th><th>${ar ? "عجز" : "Shortage"}</th></tr></thead><tbody>${rows.map(m => `<tr><td>${NAMES[m.month - 1]}</td><td>${money(m.cash)}</td><td>${money(m.credit_card)}</td><td>${money(m.online)}</td><td>${money(m.jahez)}</td><td>${money(m.total)}</td><td class="neg">${money(m.shortage)}</td></tr>`).join("")}</tbody>`;
  };
  document.getElementById("uz-year").onchange = paint;
  paint();
}

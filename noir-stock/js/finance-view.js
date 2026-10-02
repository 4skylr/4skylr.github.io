// Budget section. Chart: github.com/chartjs/Chart.js
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب" };
const sar = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const pct = (a, t) => t ? Math.round(a / t * 100) : 0;

export async function renderFinance(root) {
  const data = await fetch("finance/budget-2026.json?v=48").then(r => r.json());
  const rows = data.branches;
  const totActual = rows.reduce((a, b) => a + b.ytdRevActual, 0);
  const totTarget = rows.reduce((a, b) => a + b.ytdRevTarget, 0);
  const totYear = rows.reduce((a, b) => a + b.yearRev, 0);
  root.innerHTML = `
    <section class="slab">
      <div class="slab-h"><h2>الميزانية</h2><span class="voice">حتى ١ أكتوبر · الأسبوع ٣٩</span></div>
      <p class="pc-qty"><b>${sar(totActual)}</b> <span>من ${sar(totTarget)} · ${pct(totActual, totTarget)}%</span></p>
      <p class="note">باقي على تارجت السنة ${sar(totYear - totActual)} ريال. القسم منفصل عن الجرد.</p>
      <canvas id="fin-chart" height="120"></canvas>
    </section>
    <div class="vaults">${rows.map(b => {
      const p = pct(b.ytdRevActual, b.ytdRevTarget);
      const left = b.yearRev - b.ytdRevActual;
      return `<article class="slab vault">
        <h3>${AR[b.id] || b.name}</h3>
        <div class="amt">${sar(b.ytdRevActual)}<small>SAR</small></div>
        <div class="meter"><i style="width:${Math.min(p, 100)}%"></i></div>
        <div class="vault-foot"><span>${p}% من التارجت</span><span>${b.varRev < 0 ? "ناقص" : "زايد"} ${sar(Math.abs(b.varRev))}</span></div>
        <p class="note">الأسبوع ${b.weekAdmActual} من ${b.weekAdmTarget} تذكرة · باقي السنة ${sar(left)}</p>
      </article>`;
    }).join("")}</div>`;
  if (!window.Chart) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"; s.onload = res; s.onerror = rej; document.head.append(s); });
  new window.Chart(document.getElementById("fin-chart"), {
    type: "bar",
    data: {
      labels: rows.map(b => AR[b.id] || b.name),
      datasets: [
        { label: "التارجت", data: rows.map(b => b.ytdRevTarget), backgroundColor: "rgba(244,237,228,.25)" },
        { label: "المحقق", data: rows.map(b => b.ytdRevActual), backgroundColor: "#9b6bff" }
      ]
    },
    options: { plugins: { legend: { labels: { color: "#f4ede4" } } }, scales: { x: { ticks: { color: "#a4a4a4" } }, y: { ticks: { color: "#a4a4a4" } } } }
  });
}

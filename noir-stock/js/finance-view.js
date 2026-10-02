// Budget gap chart. Chart: github.com/chartjs/Chart.js
const AR = { hafar: "حفر الباطن", khafji: "الخفجي", unaizah: "عنيزة", dammam: "الدمام", mithnab: "المذنب" };
const sar = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));

export async function renderFinance(root) {
  const data = await fetch("finance/budget-2026.json?v=50").then(r => r.json());
  const rows = data.branches.map(b => ({ ...b, gap: Math.max(0, b.ytdRevTarget - b.ytdRevActual), left: b.yearRev - b.ytdRevActual }));
  const gap = rows.reduce((a, b) => a + b.gap, 0);
  const left = rows.reduce((a, b) => a + b.left, 0);
  root.innerHTML = `
    <section class="slab">
      <div class="slab-h"><h2>العجز والباقي</h2><span class="voice">حتى ١ أكتوبر · الأسبوع ٣٩</span></div>
      <p class="pc-qty"><b>${sar(gap)}</b> <span>عجز حالي عن تارجت الأسبوع ٣٩</span></p>
      <p class="note">باقي على ميزانية السنة ${sar(left)} ريال. الأحمر هو النقص، والبنفسجي المحقق.</p>
      <canvas id="fin-chart" height="180"></canvas>
    </section>
    <div class="vaults">${rows.map(b => `<article class="slab vault">
      <h3>${AR[b.id] || b.name}</h3>
      <div class="amt">${sar(b.gap)}<small>عجز</small></div>
      <div class="vault-foot"><span>محقق ${sar(b.ytdRevActual)}</span><span>تارجت ${sar(b.ytdRevTarget)}</span></div>
      <p class="note">باقي على ميزانية السنة ${sar(b.left)} · تذاكر ناقصة ${sar(Math.abs(b.varAdm))}</p>
    </article>`).join("")}</div>`;
  if (!window.Chart) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"; s.onload = res; s.onerror = rej; document.head.append(s); });
  new window.Chart(document.getElementById("fin-chart"), {
    type: "bar",
    data: {
      labels: rows.map(b => AR[b.id] || b.name),
      datasets: [
        { label: "المحقق", data: rows.map(b => b.ytdRevActual), backgroundColor: "#9b6bff", borderRadius: 8, stack: "gap" },
        { label: "العجز", data: rows.map(b => b.gap), backgroundColor: "#e23b4a", borderRadius: 8, stack: "gap" }
      ]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { labels: { color: "#f4ede4" } } },
      scales: { x: { stacked: true, ticks: { color: "#a4a4a4" } }, y: { stacked: true, ticks: { color: "#f4ede4" } } }
    }
  });
}

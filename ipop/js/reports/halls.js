// Auditoriums — the four halls seat by seat, with how often each seat was booked.
//   Seat data: "User Transaction Log - Payment Type wise" (parsed by halls-parse.js with mozilla/pdf.js)
//   Pinch and zoom: @panzoom/panzoom (timmywil/panzoom) · Charts: ECharts (apache/echarts)
import { HALLS, seatsOf, typeCount } from "./halls-data.js?v=104";
import { loadEcharts } from "../core/chart-theme.js?v=104";

const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const COL = "halls";
const fmt = (n, d = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n || 0);
const pct = n => `${Math.round(n * 100)}%`;
const T = (en, ar) => AR() ? ar : en;
const TYPE = { co: ["Comfort", "كومفورت"], cp: ["Comfort+", "كومفورت+"], wc: ["Wheelchair", "كرسي متحرك"] };
const tName = t => T(...TYPE[t]);
// booking heat in the booth palette: cold steel → chain blue → ice → xenon → tungsten for the busiest seats
const HEAT = [[0, [20, 28, 52]], [0.3, [91, 123, 255]], [0.6, [108, 203, 255]], [0.82, [220, 230, 255]], [1, [255, 181, 71]]];
function heat(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < HEAT.length; i++) if (t <= HEAT[i][0]) {
    const [a, ca] = HEAT[i - 1], [b, cb] = HEAT[i], k = (t - a) / (b - a);
    return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(",")})`;
  }
  return "rgb(255,211,110)";
}
const TYPE_FILL = { co: "#8fa6ff", cp: "#ffb547", wc: "#6ccbff" };
const ui = { hall: "all", mode: "heat", seat: null };
try { Object.assign(ui, JSON.parse(localStorage.getItem("noir-halls-ui") || "{}"), { seat: null }); } catch {}
const keep = () => { try { localStorage.setItem("noir-halls-ui", JSON.stringify({ hall: ui.hall, mode: ui.mode })); } catch {} };

// ── numbers for one hall ─────────────────────────────────────
function stats(hall, D) {
  const H = D?.halls?.[hall.id] || { tickets: 0, revenue: 0, free: 0, seats: {}, films: [], hours: Array(24).fill(0), wd: Array(7).fill(0) };
  const seats = seatsOf(hall).map(s => ({ ...s, n0: s.n, count: H.seats[s.id]?.[0] || 0, rev: H.seats[s.id]?.[1] || 0 }));
  const max = Math.max(1, ...seats.map(s => s.count));
  const ranked = [...seats].sort((a, b) => b.count - a.count || a.row - b.row || a.col - b.col);
  ranked.forEach((s, i) => { s.rank = i + 1; });
  const types = typeCount(hall), byType = { co: 0, cp: 0, wc: 0 };
  seats.forEach(s => { byType[s.type] += s.count; });
  const rows = hall.rows.map(r => { const g = seats.filter(s => s.r === r.r); const sum = g.reduce((a, s) => a + s.count, 0); return { r: r.r, type: r.type, seats: g.length, sum, avg: sum / g.length }; });
  return { hall, H, seats, max, ranked, types, byType, rows, total: seats.length, perSeat: H.tickets / seats.length };
}

// ── the seat map (SVG) ───────────────────────────────────────
const U = 40, PITCH = 44, LBL = 44, TOP = 86, GAP = 26;
function mapSvg(S, { big = false, mode = ui.mode } = {}) {
  const { hall, seats, max } = S, w = hall.cols * U + LBL * 2;
  let y = TOP; const rowY = hall.rows.map(r => { if (r.gap) y += GAP; const v = y; y += PITCH; return v; });
  const h = y + 10, top3 = new Set(mode === "heat" ? S.ranked.slice(0, 3).filter(s => s.count).map(s => s.id) : []);
  const seatG = s => {
    const x = LBL + s.col * U + 4, yy = rowY[s.row], t = Math.sqrt(s.count / max), cold = !s.count;
    const fill = mode === "heat" ? (cold ? "transparent" : heat(t)) : TYPE_FILL[s.type];
    const ink = mode === "heat" ? (t > 0.55 ? "#0c111b" : "#edf1f8") : "#0c111b";
    const top = top3.has(s.id);
    return `<g class="hl-seat${top ? " top" : ""}${cold ? " cold" : ""}${ui.seat === s.id ? " sel" : ""}" data-seat="${s.id}" ${big ? `tabindex="0" role="button" aria-label="${s.id} ${tName(s.type)} ${s.count}"` : ""}>
      <rect class="bk" x="${x}" y="${yy}" width="32" height="25" rx="8" fill="${fill}" ${cold && mode === "heat" ? 'stroke="#4a5570" stroke-dasharray="3 3"' : ""}/>
      <rect class="cu" x="${x + 3}" y="${yy + 21}" width="26" height="9" rx="4" fill="${fill}" ${s.type === "cp" && mode === "heat" ? 'stroke="#ffb547" stroke-width="1.6"' : ""} opacity="${cold && mode === "heat" ? 0 : 0.78}"/>
      ${s.type === "wc" ? `<text class="wc" x="${x + 16}" y="${yy + 17}" text-anchor="middle">♿</text>` : big ? `<text x="${x + 16}" y="${yy + 16.5}" text-anchor="middle" fill="${ink}">${mode === "heat" ? s.count : s.n}</text>` : ""}
      ${top ? `<g class="crown"><rect x="${x + 2}" y="${yy - 15}" width="28" height="13" rx="6.5"/><text x="${x + 16}" y="${yy - 5.6}" text-anchor="middle">#${S.ranked.findIndex(r => r.id === s.id) + 1}</text></g>` : ""}
    </g>`;
  };
  const labels = hall.rows.map((r, i) => { const n = seats.filter(s => s.r === r.r).length;
    return `<text class="rl" x="${LBL - 10}" y="${rowY[i] + 20}" text-anchor="end">${r.r}</text><text class="rl" x="${w - LBL + 10}" y="${rowY[i] + 20}">${r.r}</text>${big ? `<text class="rn" x="${LBL - 10}" y="${rowY[i] + 31}" text-anchor="end">1-${n}</text>` : ""}`; }).join("");
  const id = `sg${hall.id}${big ? "b" : ""}`;
  return `<svg class="hl-svg" viewBox="0 0 ${w} ${h}" style="max-width:${Math.round(w * (big ? 1.25 : 1.05))}px" role="${big ? "group" : "img"}" aria-label="Screen ${hall.id}">
    <defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#5b7bff" stop-opacity=".1"/><stop offset=".5" stop-color="#dce6ff"/><stop offset="1" stop-color="#6ccbff" stop-opacity=".1"/></linearGradient>
      <radialGradient id="${id}g" cx=".5" cy="0" r=".6"><stop offset="0" stop-color="#dce6ff" stop-opacity=".28"/><stop offset="1" stop-color="#dce6ff" stop-opacity="0"/></radialGradient></defs>
    <rect x="0" y="0" width="${w}" height="${TOP + 40}" fill="url(#${id}g)"/>
    <path d="M${LBL} 40 Q ${w / 2} 6 ${w - LBL} 40" fill="none" stroke="url(#${id})" stroke-width="5" stroke-linecap="round"/>
    <text class="scr" x="${w / 2}" y="58" text-anchor="middle">SCREEN ${hall.id}</text>
    ${labels}${seats.map(seatG).join("")}
  </svg>`;
}

// ── page ─────────────────────────────────────────────────────
let D = null;
export async function renderHalls(host, H) {
  host.innerHTML = `<div class="hl"><p class="empty">…</p></div>`;
  D = await loadData(H);
  draw(host);
}
async function loadData(H) {
  const local = H.localDocs ? Object.values(H.localDocs(COL) || {}) : [];
  let remote = [];
  try { remote = H.allDocs ? Object.values(await H.allDocs(COL) || {}) : []; } catch {}
  const base = await fetch("halls/seats.json").then(r => r.ok ? r.json() : null).catch(() => null);
  return [base, ...local, ...remote].filter(Boolean).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""))[0] || null;
}

function draw(host) {
  const all = HALLS.map(h => stats(h, D));
  const inv = all.reduce((a, s) => { a.co += s.types.co; a.cp += s.types.cp; a.wc += s.types.wc; a.total += s.total; return a; }, { co: 0, cp: 0, wc: 0, total: 0 });
  const one = ui.hall === "all" ? null : all.find(s => String(s.hall.id) === String(ui.hall));
  const scope = one ? [one] : all;
  const sc = scope.reduce((a, s) => { a.co += s.types.co; a.cp += s.types.cp; a.wc += s.types.wc; a.total += s.total; a.tickets += s.H.tickets; return a; }, { co: 0, cp: 0, wc: 0, total: 0, tickets: 0 });
  const hot = scope.flatMap(s => s.seats.map(x => ({ ...x, hall: s.hall.id }))).sort((a, b) => b.count - a.count)[0];
  host.innerHTML = `<div class="hl">
    <section class="hl-hero">
      <div class="hl-hero-main">
        <span class="hl-k">${one ? `SCREEN ${one.hall.id}` : T("All auditoriums", "كل القاعات")}</span>
        <b class="hl-big data">${fmt(sc.total)}<small>${T("seats", "مقعد")}</small></b>
        <div class="hl-types">${["co", "cp", "wc"].map(t => `<span class="hl-type t-${t}"><i></i>${tName(t)}<b class="data">${sc[t]}</b></span>`).join("")}</div>
      </div>
      <div class="hl-hero-side">
        <div><span>${T("Tickets on these seats", "تذاكر على هالمقاعد")}</span><b class="data">${fmt(sc.tickets)}</b></div>
        <div><span>${T("Per seat", "لكل مقعد")}</span><b class="data">${fmt(sc.tickets / sc.total, 1)}</b></div>
        ${hot ? `<div class="hot"><span>${T("Hottest seat", "أكثر مقعد انحجز")}</span><b class="data">S${hot.hall} · ${hot.id} <em>×${fmt(hot.count)}</em></b></div>` : ""}
      </div>
    </section>

    <div class="hl-bar">
      <div class="hl-tabs" role="tablist">
        <button role="tab" data-hall="all" aria-selected="${!one}">${T("All", "الكل")}<sup>${inv.total}</sup></button>
        ${all.map(s => `<button role="tab" data-hall="${s.hall.id}" aria-selected="${one?.hall.id === s.hall.id}">${T("Screen", "قاعة")} ${s.hall.id}<sup>${s.total}</sup></button>`).join("")}
      </div>
      <div class="seg hl-mode" role="group">
        <button data-mode="heat" aria-pressed="${ui.mode === "heat"}">${T("Bookings", "الحجوزات")}</button>
        <button data-mode="type" aria-pressed="${ui.mode === "type"}">${T("Seat types", "أنواع المقاعد")}</button>
      </div>
    </div>
    ${legend()}
    ${one ? hallView(one) : allView(all, inv)}
    <p class="hl-src">${D ? `${T("Source", "المصدر")}: <b>User Transaction Log - Payment Type wise</b> · ${D.from} → ${D.to} · ${fmt(D.tickets)} ${T("tickets", "تذكرة")}` : T("No seat report yet. Upload it from Settings.", "ما فيه تقرير مقاعد. ارفعه من الإعدادات.")}</p>
  </div>`;
  host.querySelectorAll("[data-hall]").forEach(b => b.onclick = () => { ui.hall = b.dataset.hall; ui.seat = null; keep(); draw(host); });
  host.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { ui.mode = b.dataset.mode; keep(); draw(host); });
  host.querySelectorAll(".hl-card[data-open]").forEach(c => c.onclick = () => { ui.hall = c.dataset.open; ui.seat = null; keep(); draw(host); host.scrollIntoView({ behavior: "smooth" }); });
  if (one) wireHall(host, one); else charts(host, all);
}

function legend() {
  if (ui.mode === "type") return `<div class="hl-legend">${["co", "cp", "wc"].map(t => `<span><i class="sw t-${t}"></i>${tName(t)}</span>`).join("")}<span class="note">${T("Numbers run left to right", "الترقيم من اليسار لليمين")}</span></div>`;
  return `<div class="hl-legend"><span class="ramp"><i></i>${T("fewer", "أقل")} → ${T("more bookings", "أكثر حجز")}</span><span><i class="sw cold"></i>${T("never booked", "ما انحجز")}</span><span><i class="sw crown">#1</i>${T("top 3 of the hall", "أعلى ٣ بالقاعة")}</span><span><i class="sw cpl"></i>${tName("cp")}</span></div>`;
}

// ── all halls ────────────────────────────────────────────────
function allView(all, inv) {
  const busiest = [...all].sort((a, b) => b.perSeat - a.perSeat)[0];
  const co = all.reduce((a, s) => a + s.byType.co, 0) / inv.co, cp = all.reduce((a, s) => a + s.byType.cp, 0) / inv.cp, wc = all.reduce((a, s) => a + s.byType.wc, 0) / inv.wc;
  const backShare = all.reduce((a, s) => a + s.rows.slice(-2).reduce((x, r) => x + r.sum, 0), 0) / Math.max(1, all.reduce((a, s) => a + s.H.tickets, 0));
  const ins = [
    [T(`Screen ${busiest.hall.id} works hardest: ${fmt(busiest.perSeat, 0)} tickets per seat.`, `القاعة ${busiest.hall.id} الأكثر شغل: ${fmt(busiest.perSeat, 0)} تذكرة لكل مقعد.`), "good"],
    [T(`A Comfort+ seat sells ${fmt(cp / co, 1)}× a Comfort seat (${fmt(cp, 0)} vs ${fmt(co, 0)} tickets each).`, `مقعد الكومفورت+ ينحجز ${fmt(cp / co, 1)}× مقعد الكومفورت (${fmt(cp, 0)} مقابل ${fmt(co, 0)} تذكرة للمقعد).`), "info"],
    [T(`The last two rows take ${pct(backShare)} of all tickets. Guests sit at the back first.`, `آخر صفين ياخذون ${pct(backShare)} من كل التذاكر. الضيوف يبدون من الخلف.`), "info"],
    [T(`Wheelchair seats average ${fmt(wc, 0)} tickets each. Keep them free for guests who need them.`, `مقاعد الكرسي المتحرك متوسطها ${fmt(wc, 0)} تذكرة. خلها متاحة للي يحتاجها.`), "warn"]
  ];
  return `<section class="hl-grid">${all.map(s => `<article class="hl-card" data-open="${s.hall.id}" tabindex="0">
      <header><b>SCREEN ${s.hall.id}</b><span class="data">${s.total} ${T("seats", "مقعد")}</span></header>
      ${mapSvg(s)}
      <footer>
        <span><i>${T("Tickets", "تذاكر")}</i><b class="data">${fmt(s.H.tickets)}</b></span>
        <span><i>${T("Per seat", "للمقعد")}</i><b class="data">${fmt(s.perSeat, 0)}</b></span>
        <span><i>${T("Top seat", "الأول")}</i><b class="data">${s.ranked[0].id} ×${s.ranked[0].count}</b></span>
      </footer></article>`).join("")}</section>
    <section class="hl-two">
      <article class="hl-panel"><h3>${T("Seat inventory", "جرد المقاعد")}</h3>
        <table class="hl-inv"><thead><tr><th><span class="sr">${T("Hall", "القاعة")}</span></th>${["co", "cp", "wc"].map(t => `<th><i class="sw t-${t}"></i>${tName(t)}</th>`).join("")}<th>${T("Total", "المجموع")}</th></tr></thead>
        <tbody>${all.map(s => `<tr><td>SCREEN ${s.hall.id}</td><td class="data">${s.types.co}</td><td class="data">${s.types.cp}</td><td class="data">${s.types.wc}</td><td class="data b">${s.total}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>${T("All halls", "كل القاعات")}</td><td class="data">${inv.co}</td><td class="data">${inv.cp}</td><td class="data">${inv.wc}</td><td class="data b">${inv.total}</td></tr></tfoot></table></article>
      <article class="hl-panel"><h3>${T("What the seats say", "وش تقول المقاعد")}</h3><ul class="hl-ins">${ins.map(([t, k]) => `<li class="${k}">${t}</li>`).join("")}</ul></article>
    </section>
    <section class="hl-two">
      <article class="hl-panel"><h3>${T("Tickets per seat", "تذاكر لكل مقعد")}</h3><div class="hl-chart" id="hl-ch-hall"></div></article>
      <article class="hl-panel"><h3>${T("Demand by seat type", "الطلب حسب نوع المقعد")}</h3><div class="hl-chart" id="hl-ch-type"></div></article>
    </section>`;
}

// ── one hall ─────────────────────────────────────────────────
function hallView(S) {
  const cold = [...S.seats].sort((a, b) => a.count - b.count || a.row - b.row).slice(0, 5);
  const maxRow = Math.max(...S.rows.map(r => r.avg), 1);
  const per = t => S.types[t] ? S.byType[t] / S.types[t] : 0;
  return `<section class="hl-stage">
      <div class="hl-zoom">
        <div class="hl-zbar"><b>SCREEN ${S.hall.id}</b><span class="data">${S.total} ${T("seats", "مقعد")}</span>
          <div class="hl-zbtns"><button data-z="out" aria-label="Zoom out">−</button><button data-z="reset" aria-label="Reset">⟲</button><button data-z="in" aria-label="Zoom in">+</button></div></div>
        <div class="hl-pzwrap"><div class="hl-pz">${mapSvg(S, { big: true })}</div></div></div>
      <div class="hl-seat-card" id="hl-seat">${seatCard(S)}</div>
    </section>
    <section class="hl-kpis">
      ${["co", "cp", "wc"].map(t => `<article class="t-${t}"><span><i class="sw t-${t}"></i>${tName(t)}</span><b class="data">${S.types[t]}</b><em>${fmt(per(t), 0)} ${T("tickets / seat", "تذكرة للمقعد")}</em></article>`).join("")}
      <article><span>${T("Tickets", "التذاكر")}</span><b class="data">${fmt(S.H.tickets)}</b><em>${fmt(S.H.free)} ${T("free", "مجانية")} · ${fmt(S.H.revenue)} SAR</em></article>
    </section>
    <section class="hl-two">
      <article class="hl-panel"><h3>${T("Top seats", "أكثر المقاعد حجزاً")}</h3>
        <ol class="hl-lead">${S.ranked.slice(0, 8).map(s => `<li data-pick="${s.id}"><b>${s.id}</b><i class="sw t-${s.type}"></i><span class="bar"><u style="width:${(s.count / S.max * 100).toFixed(1)}%;background:${heat(s.count / S.max)}"></u></span><em class="data">×${fmt(s.count)}</em></li>`).join("")}</ol></article>
      <article class="hl-panel"><h3>${T("Rows, screen to back", "الصفوف من الشاشة للخلف")}</h3>
        <div class="hl-rows">${S.rows.map(r => `<div><b>${r.r}</b><span class="bar"><u style="width:${(r.avg / maxRow * 100).toFixed(1)}%;background:${heat(r.avg / maxRow)}"></u></span><em class="data">${fmt(r.avg, 0)}</em></div>`).join("")}</div>
        <p class="note">${T("Average tickets per seat in each row", "متوسط التذاكر لكل مقعد بالصف")}</p></article>
    </section>
    <section class="hl-two">
      <article class="hl-panel"><h3>${T("Hardest to sell", "أصعب المقاعد بيعاً")}</h3>
        <ol class="hl-lead cold">${cold.map(s => `<li data-pick="${s.id}"><b>${s.id}</b><i class="sw t-${s.type}"></i><span class="bar"><u style="width:${(s.count / S.max * 100).toFixed(1)}%"></u></span><em class="data">×${fmt(s.count)}</em></li>`).join("")}</ol>
        <p class="note">${T("Front corners sell last. Good seats for walk-ins and promo tickets.", "الزوايا الأمامية آخر شي ينباع. مناسبة للعروض والحضور المباشر.")}</p></article>
      <article class="hl-panel"><h3>${T("Top films in this hall", "أكثر الأفلام بالقاعة")}</h3>
        <ol class="hl-films">${(S.H.films || []).map(({ f, n }) => `<li><span>${esc(f)}</span><em class="data">${fmt(n)}</em></li>`).join("") || `<li>—</li>`}</ol></article>
    </section>
    <section class="hl-panel"><h3>${T("When this hall fills", "متى تمتلي القاعة")}</h3><div class="hl-chart" id="hl-ch-hours"></div></section>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function seatCard(S) {
  const s = S.seats.find(x => x.id === ui.seat);
  if (!s) return `<p class="hl-tip">${T("Tap a seat to see how often it was booked.", "اضغط على أي مقعد عشان تشوف كم مرة انحجز.")}</p>`;
  const avg = S.perSeat, rel = avg ? s.count / avg : 0, share = S.H.tickets ? s.count / S.H.tickets : 0;
  return `<div class="hl-sc" style="--h:${heat(s.count / S.max)}">
    <div class="hl-sc-id"><b>${s.id}</b><span><i class="sw t-${s.type}"></i>${tName(s.type)} · SCREEN ${S.hall.id}</span></div>
    <div class="hl-sc-n"><b class="data">${fmt(s.count)}</b><span>${T("times booked", "مرة انحجز")}</span></div>
    <div class="hl-sc-g">
      <span><i>${T("Rank", "الترتيب")}</i><b class="data">#${s.rank} / ${S.total}</b></span>
      <span><i>${T("vs hall average", "مقابل متوسط القاعة")}</i><b class="data ${rel >= 1 ? "up" : "dn"}">${fmt(rel, 1)}×</b></span>
      <span><i>${T("Share of hall tickets", "حصته من تذاكر القاعة")}</i><b class="data">${(share * 100).toFixed(1)}%</b></span>
      <span><i>${T("Revenue", "الإيراد")}</i><b class="data">${fmt(s.rev)} SAR</b></span>
    </div></div>`;
}

async function wireHall(host, S) {
  const pick = id => { ui.seat = id; host.querySelectorAll(".hl-seat.sel").forEach(e => e.classList.remove("sel")); host.querySelector(`.hl-seat[data-seat="${id}"]`)?.classList.add("sel"); host.querySelector("#hl-seat").innerHTML = seatCard(S); };
  host.querySelectorAll(".hl-pz .hl-seat").forEach(g => { g.addEventListener("click", () => pick(g.dataset.seat)); g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(g.dataset.seat); } }); });
  host.querySelectorAll("[data-pick]").forEach(li => li.onclick = () => { pick(li.dataset.pick); host.querySelector(".hl-stage").scrollIntoView({ behavior: "smooth", block: "start" }); });
  try {
    const { default: Panzoom } = await import("../../vendor/panzoom.mjs");
    // at 1x the page scrolls normally over the map; once zoomed in, dragging pans the map
    const el = host.querySelector(".hl-pz"), wrap = el.parentElement;
    const pz = Panzoom(el, { maxScale: 4, minScale: 1, step: 0.45, cursor: "grab", disablePan: true, touchAction: "pan-y" });
    const sync = () => { const z = pz.getScale() > 1.01; pz.setOptions({ disablePan: !z }); el.style.touchAction = wrap.style.touchAction = z ? "none" : "pan-y"; el.style.cursor = z ? "grab" : "default"; if (!z) pz.pan(0, 0, { animate: true }); };
    el.addEventListener("panzoomend", sync); el.addEventListener("panzoomzoom", () => setTimeout(sync, 0));
    wrap.addEventListener("wheel", e => { if (e.ctrlKey || e.metaKey) { pz.zoomWithWheel(e); sync(); } }, { passive: false });
    host.querySelectorAll("[data-z]").forEach(b => b.onclick = () => ({ in: () => pz.zoomIn(), out: () => pz.zoomOut(), reset: () => pz.reset() })[b.dataset.z]() || setTimeout(sync, 0));
  } catch (e) { console.warn("Zoom unavailable", e); }
  const ec = await echarts(); if (!ec) return;
  const order = [...Array(24).keys()].map(i => (i + 10) % 24).filter(h => S.H.hours[h] || (h >= 12 || h <= 2));
  chart(ec, host.querySelector("#hl-ch-hours"), {
    grid: { left: 40, right: 12, top: 16, bottom: 28 },
    xAxis: { type: "category", data: order.map(h => `${String(h).padStart(2, "0")}:00`), axisLabel: { color: "#a3adbf", fontSize: 10 } },
    yAxis: { type: "value", axisLabel: { color: "#808a9d", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(150,170,210,.08)" } } },
    tooltip: { trigger: "axis", valueFormatter: v => fmt(v) + " " + T("tickets", "تذكرة") },
    series: [{ type: "bar", data: order.map(h => S.H.hours[h]), barWidth: "60%", itemStyle: { borderRadius: [6, 6, 0, 0], color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#dce6ff" }, { offset: 1, color: "#4662d6" }] } } }]
  });
}

function charts(host, all) {
  echarts().then(ec => {
    if (!ec) return;
    const ax = { axisLabel: { color: "#a3adbf", fontSize: 11 }, axisLine: { lineStyle: { color: "rgba(150,170,210,.2)" } } };
    chart(ec, host.querySelector("#hl-ch-hall"), {
      grid: { left: 44, right: 12, top: 16, bottom: 28 }, tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: all.map(s => `S${s.hall.id}`), ...ax },
      yAxis: { type: "value", ...ax, splitLine: { lineStyle: { color: "rgba(150,170,210,.08)" } } },
      series: [{ type: "bar", data: all.map(s => Math.round(s.perSeat)), barWidth: "46%", label: { show: true, position: "top", color: "#edf1f8", fontFamily: "monospace" },
        itemStyle: { borderRadius: [8, 8, 0, 0], color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#ffb547" }, { offset: 0.5, color: "#dce6ff" }, { offset: 1, color: "#4662d6" }] } } }]
    });
    const types = ["co", "cp", "wc"];
    chart(ec, host.querySelector("#hl-ch-type"), {
      grid: { left: 44, right: 12, top: 34, bottom: 28 }, tooltip: { trigger: "axis" },
      legend: { top: 0, textStyle: { color: "#a3adbf" }, itemWidth: 10, itemHeight: 10 },
      xAxis: { type: "category", data: all.map(s => `S${s.hall.id}`), ...ax },
      yAxis: { type: "value", ...ax, splitLine: { lineStyle: { color: "rgba(150,170,210,.08)" } } },
      series: types.map(t => ({ name: tName(t), type: "bar", barGap: "12%", itemStyle: { color: TYPE_FILL[t], borderRadius: [5, 5, 0, 0] },
        data: all.map(s => s.types[t] ? Math.round(s.byType[t] / s.types[t]) : 0) }))
    });
  });
}
function chart(ec, el, opt) {
  if (!el) return;
  const c = ec.init(el, null, { renderer: "canvas" }); c.setOption({ animationDuration: 700, textStyle: { fontFamily: "inherit" }, ...opt });
  new ResizeObserver(() => { if (!c.isDisposed()) c.resize(); }).observe(el);
}
const echarts = () => loadEcharts().catch(() => null);

// ── upload (Settings) ────────────────────────────────────────
export async function uploadSeatReport(file, H, onProgress) {
  const { parseTxLog } = await import("./halls-parse.js?v=104");
  const d = await parseTxLog(file, onProgress);
  await H.putDoc(COL, "seats", d);
  await H.log?.("report", `Seat report · ${d.tickets} tickets · ${d.from} → ${d.to}`);
  return d;
}

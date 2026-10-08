// The Overview opens the way the style reference opens a product page, with this branch's own products in place of
// hardware: a white hero stage (launch label, product name, one statement, the product render, a floating price
// callout with a blue pill), then a Studio Mist highlights band of large white cards that advance on their own.
import { servingOf } from "../finance/serving.js?v=103";
import { soldOf, moveOf } from "../data/sales-data.js?v=103";
import { AR as NAMES_AR } from "./names-ar.js?v=103";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const render = (p, H) => `<img class="gx-img" src="assets/cutouts/${esc(p.id)}.webp?v=46" alt="" loading="lazy" onerror="this.onerror=null;this.src='${esc(H.src(p.image || ""))}'">`;

export function stageHtml(H, ar) {
  const T = (e, a) => (ar ? a : e), P = H.data().products, name = p => esc(ar ? (NAMES_AR[p.id] || p.name) : p.name);
  const sold = p => (moveOf(p.id)?.shared ? 0 : soldOf(p.id) || 0);
  const ranked = P.filter(p => sold(p) > 0).sort((a, b) => sold(b) - sold(a));
  const star = ranked.find(p => servingOf(p)?.kind === "serving") || ranked[0];
  if (!star) return "";
  const sv = servingOf(star), best = sv?.kind === "serving" ? [...sv.options].sort((a, b) => b.profit - a.profit)[0] : null;
  const unit = esc(H.UNITS[star.unit] || star.unit || "");
  // the iPop stage from the identity: the pearl mark and the wordmark on brushed silver
  const brand = `<section class="gx-brand" aria-label="iPop — People of Performance"><img src="assets/brand/ipop-hero.webp" alt="iPop — People of Performance" width="2816" height="1536" decoding="async"></section>`;
  const hero = `<section class="gx-hero">
      <span class="gx-label">${T("Best seller this year", "الأكثر مبيعاً هذي السنة")}</span>
      <h2 class="gx-name">${name(star)}</h2>
      <p class="gx-claim">${best ? T(`${H.qty(sold(star))} sold. ${best.profit.toFixed(2)} SR profit in every one.`, `${H.qty(sold(star))} مباعة. ${best.profit.toFixed(2)} ر.س ربح في كل وحدة.`)
        : T(`${H.qty(sold(star))} ${unit} sold since January.`, `${H.qty(sold(star))} ${unit} مباع من بداية السنة.`)}</p>
      <div class="gx-stage" data-edit="${esc(star.id)}">${render(star, H).replace('class="gx-img"', 'class="gx-render"')}</div>
      <div class="gx-callout"><span><b>${best ? T(`From ${sv.price} SR`, `من ${sv.price} ر.س`) : `${H.qty(H.total(star))} ${unit} ${T("in stock", "بالمخزون")}`}</b>
        <small>${best ? T(`cost ${best.cost.toFixed(2)} · ${sv.options.length} flavours`, `التكلفة ${best.cost.toFixed(2)} · ${sv.options.length} نكهات`) : T("across all stores", "بكل المواقع")}</small></span>
        <button type="button" class="btn hot" data-edit="${esc(star.id)}">${T("View", "عرض")}</button></div>
    </section>`;
  const picks = ranked.slice(0, 8);
  const band = `<section class="gx-band" aria-roledescription="carousel" aria-label="${T("Top sellers", "الأكثر مبيعاً")}">
      <div class="gx-band-h"><h2>${T("Get the highlights.", "أبرز المنتجات.")}</h2><button type="button" data-route="products">${T("See all stock", "كل المخزون")} ›</button></div>
      <div class="gx-track">${picks.map((p, i) => { const s = servingOf(p), o = s?.kind === "serving" ? s.options[0] : null;
        return `<button type="button" class="gx-slide" data-edit="${esc(p.id)}" data-i="${i}" aria-label="${name(p)}">
          <small>#${i + 1} · ${esc(H.catName(p.category))}</small><h3>${name(p)}</h3>
          <p>${H.qty(sold(p))} ${T("sold this year", "مباع هذي السنة")}${o ? ` · ${T("profit", "ربح")} ${o.profit.toFixed(2)}` : ""}</p>${render(p, H)}</button>`; }).join("")}</div>
      <div class="gx-ctl"><span class="gx-dots" role="tablist">${picks.map((_, i) => `<i role="tab" data-to="${i}" class="${i ? "" : "on"}" aria-label="${i + 1}"></i>`).join("")}</span>
        <button type="button" class="gx-play" aria-label="${T("Pause", "إيقاف")}" aria-pressed="false"><svg viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor"/></svg></button></div>
    </section>`;
  return brand + hero + band;
}

// the band advances every 4 s (paused by the control, by a finger on it, or when reduced motion is asked for)
export function wireStage(root) {
  const track = root.querySelector(".gx-track"); if (!track || track.dataset.wired) return; track.dataset.wired = "1";
  const slides = [...track.children], dots = [...root.querySelectorAll(".gx-dots i")], play = root.querySelector(".gx-play");
  let at = 0, paused = matchMedia("(prefers-reduced-motion: reduce)").matches, timer = 0;
  const mark = i => dots.forEach((d, k) => d.classList.toggle("on", k === i));
  const go = i => { at = (i + slides.length) % slides.length; const s = slides[at]; track.scrollTo({ left: s.offsetLeft - track.offsetLeft - (track.clientWidth - s.clientWidth) / 2, behavior: "smooth" }); mark(at); };
  const tick = () => { clearTimeout(timer); if (!track.isConnected) return; if (!paused) go(at + 1); timer = setTimeout(tick, 4000); };
  const icon = () => { play.setAttribute("aria-pressed", String(paused)); play.innerHTML = paused ? '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2.5v9l7.5-4.5z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor"/></svg>'; };
  play.onclick = () => { paused = !paused; icon(); };
  dots.forEach(d => d.onclick = () => go(Number(d.dataset.to)));
  track.addEventListener("pointerdown", () => { paused = true; icon(); }, { passive: true });
  let st = 0; track.addEventListener("scroll", () => { clearTimeout(st); st = setTimeout(() => {
    const mid = track.scrollLeft + track.clientWidth / 2; let best = 0, d = Infinity;
    slides.forEach((s, k) => { const c = s.offsetLeft - track.offsetLeft + s.clientWidth / 2; if (Math.abs(c - mid) < d) { d = Math.abs(c - mid); best = k; } }); at = best; mark(at); }, 80); }, { passive: true });
  icon(); timer = setTimeout(tick, 4000);
}

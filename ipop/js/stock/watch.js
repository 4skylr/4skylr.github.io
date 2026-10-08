// Product watch: what a scan opens, for that one product only (design after "chase2k25" on Uiverse.io).
// Screens (swipe up, turn the crown, or use the dots):
//   1 · the product: photo (the card's own .pc-shot, passed in untouched), name, barcode, next expiry
//   2 · on hand: Main Stores, then Mini Store, then Concession
//   3 · expiry: the dated groups (packaging, lids, straws and CO₂ are quantity only)
//   4 · recipe: this product's own recipe, or, for an ingredient (oil, caramel, sugar …), the recipes that use it and how much each one takes
// Under the watch: Start count, and Send report to admin once this phone has counts waiting.
import { RECIPES } from "../data/recipes-data.js?v=106";
import { prettyName } from "./recipe-names.js?v=106";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const low = s => String(s ?? "").toLowerCase().trim();
const pad = n => String(n).padStart(2, "0");
const tone = d => (d == null ? "none" : d < 0 ? "exp" : d <= 7 ? "crit" : d <= 30 ? "soon" : "ok");
const num = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// The recipe screen, from recipes-data.js and nothing else.
//  own:  a menu recipe carries this product's report name (a can, a bottle, a packet) → its lines
//  uses: no recipe of its own → every recipe that consumes it and how much, in the recipe unit of the catalog unit
//        (kg → g, L → ml, pieces → pcs). Combos that differ only by the drink they come with take the same amount: one row.
export function recipeFor(p) {
  const key = low(p.sku || p.name);
  if (!key) return { kind: "none" };
  const own = RECIPES.filter(r => low(r.name) === key).sort((a, b) => Number(!!a.ta) - Number(!!b.ta))[0];
  if (own) return { kind: "own", name: own.name, lines: own.lines.map(l => ({ name: l.rm, qty: l.qty, uom: l.uom })) };
  const rows = new Map();
  for (const r of RECIPES) {
    const l = r.lines.find(x => low(x.rm) === key); if (!l) continue;
    const base = r.name.replace(/\s+with\s+.+$/i, "").trim(), k = `${low(base)}|${l.qty}|${l.uom}|${r.ta ? 1 : 0}`;
    const row = rows.get(k) || { name: base, ta: !!r.ta, qty: l.qty, uom: l.uom, n: 0 };
    row.n++; rows.set(k, row);
  }
  const list = [...rows.values()].sort((a, b) => Number(a.ta) - Number(b.ta) || b.qty - a.qty || a.name.localeCompare(b.name));
  return list.length ? { kind: "uses", rows: list } : { kind: "none" };
}

// o: { p, H, name, shot, code, barcode, unit, total, locs: [{ id, label, n }], dated, groups: [{ label, qty, when, left }], next, recipe }
export function watchHtml(o) {
  const { H, name, shot, code, barcode, unit, total, locs, dated, groups, next, recipe, p } = o, q = n => H.qty(n);
  const d = next ? next.left : null, t = tone(d), frac = d == null ? 0 : Math.max(0, Math.min(1, d / 365));
  const ringDeg = Math.round((d == null ? 0 : d < 0 ? 1 : Math.min(1, d / 90)) * 360);
  const out = p && !total;
  const recipeView = recipe.kind === "own"
    ? `<section class="nw-view nw-list" aria-label="Recipe">
        <h3>Recipe<em>${esc(prettyName(recipe.name))}</em></h3>
        <div class="nw-rows nw-scroll">${recipe.lines.map(l => `<div class="nw-row"><span>${esc(prettyName(l.name))}</span><b class="data">${num(l.qty)}<small>${esc(l.uom)}</small></b></div>`).join("")}</div>
        <p class="nw-note">One serving, as sold</p></section>`
    : recipe.kind === "uses"
      ? `<section class="nw-view nw-list" aria-label="Used in recipes">
        <h3>Used in<em class="data">${recipe.rows.reduce((a, r) => a + r.n, 0)} recipes</em></h3>
        <div class="nw-rows nw-scroll">${recipe.rows.map(r => `<div class="nw-row"><span>${esc(prettyName(r.name))}<small>${r.ta ? "Takeaway" : "Served"}${r.n > 1 ? ` · ${r.n} versions` : ""}</small></span><b class="data">${num(r.qty)}<small>${esc(r.uom)} each</small></b></div>`).join("")}</div>
        <p class="nw-note">Has no recipe of its own · amount each recipe takes per serving</p></section>`
      : `<section class="nw-view nw-list" aria-label="Recipe"><h3>Recipe</h3><p class="nw-empty">Not in any menu recipe</p></section>`;
  const views = [
    `<section class="nw-view nw-face" aria-label="Product">
      <div class="nw-comp nw-tl"><b class="data">${q(total)}</b><small>${esc(unit)} on hand</small></div>
      <div class="nw-comp nw-tr t-${t}" style="--deg:${ringDeg}deg"><b class="data">${d == null ? "—" : d < 0 ? "!" : d}</b><small>${!dated ? "no date" : d == null ? "no date" : d < 0 ? "expired" : "days"}</small></div>
      <div class="nw-photo">${shot}<span class="pass-laser" aria-hidden="true"></span>${out ? `<span class="nw-oos">Out of stock</span>` : ""}</div>
      <p class="nw-name">${esc(name)}</p>
      <div class="nw-comp nw-bottom t-${t}">
        <div class="nw-code">${barcode ? `<img src="${esc(barcode)}" alt="" width="96" height="22" decoding="async">` : ""}<small class="data" dir="ltr">${esc(code)}</small></div>
        <div class="nw-exp"><small>${!dated ? "Expiry" : next ? (d < 0 ? "Expired" : "Expires") : "Expiry"}</small><b class="data" dir="ltr">${!dated ? "Not dated" : next ? esc(next.when) : "—"}</b>
          <div class="nw-progress"><i style="width:${(frac * 100).toFixed(1)}%"></i></div></div>
      </div>
      <p class="nw-hint" aria-hidden="true"><i></i>Swipe up</p>
    </section>`,
    `<section class="nw-view nw-list nw-stock" aria-label="On hand">
      <h3>On hand<em class="data">${q(total)} ${esc(unit)}</em></h3>
      <div class="nw-rows">${locs.map((x, i) => `<div class="nw-row"><span><i class="data">${i + 1}</i> ${esc(x.label)}</span><b class="data">${q(x.n)}<small>${esc(unit)}</small></b></div>`).join("")}</div>
    </section>`,
    `<section class="nw-view nw-list" aria-label="Expiry">
      <h3>Expiry<em class="data">${dated ? `${groups.length} ${groups.length === 1 ? "group" : "groups"}` : "not dated"}</em></h3>
      ${!dated ? `<p class="nw-empty">No expiry date · counted by quantity only</p>`
        : groups.length ? `<div class="nw-rows nw-scroll">${groups.map(b => `<div class="nw-row nw-g t-${tone(b.left)}"><span>${esc(b.label)}<small>${q(b.qty)} ${esc(unit)}</small></span>
          <b class="data" dir="ltr">${esc(b.when)}<small>${b.left < 0 ? "expired" : `${b.left} days`}</small></b></div>`).join("")}</div>`
        : `<p class="nw-empty">No date recorded yet</p>`}
    </section>`,
    recipeView
  ];
  const now = new Date();
  const bar = `<div class="nw-bar">
      <button type="button" class="nw-pill nw-start" data-count><span class="nw-play" aria-hidden="true"></span><b>Start count</b></button>
      <button type="button" class="nw-pill nw-send" data-send hidden><b>Send report to admin</b><em class="data"></em></button>
    </div>`;
  return `<div class="nw-shell"><div class="nw">
    <div class="nw-strap top" aria-hidden="true"></div><div class="nw-strap bottom" aria-hidden="true"></div>
    <div class="nw-case">
      <span class="nw-crown-well" aria-hidden="true"></span><button type="button" class="nw-crown" aria-label="Next screen"></button>
      <span class="nw-side-well" aria-hidden="true"></span><button type="button" class="nw-side" aria-label="Previous screen"></button>
      <span class="nw-action-well" aria-hidden="true"></span><button type="button" class="nw-action" aria-label="Back to the product"></button>
      <div class="nw-display" tabindex="0" role="region" aria-roledescription="watch" aria-label="Product watch: swipe up for more">
        <div class="nw-status"><span class="nw-time data">${pad(now.getHours())}:${pad(now.getMinutes())}</span><span class="nw-brand">iPop<i></i></span></div>
        <div class="nw-wrap" style="height:${views.length * 100}%;--nv:${views.length}">${views.join("")}</div>
        <div class="nw-dots" role="tablist">${views.map((_, i) => `<button type="button" role="tab" class="nw-dot" data-go="${i}" aria-label="Screen ${i + 1}"></button>`).join("")}</div>
      </div>
    </div>
  </div>${bar}</div>`;
}

// screens move up and down: swipe, wheel, arrow keys, crown (next), side button (back one), action button (the face), dots.
// A list that scrolls (.nw-scroll) and the count mission (.nw-m) keep their own touch and wheel.
export function mountWatch(root, { onCount, onSend } = {}) {
  const w = root.querySelector(".nw"); if (!w) return;
  const disp = w.querySelector(".nw-display"), wrap = w.querySelector(".nw-wrap"), dots = [...w.querySelectorAll(".nw-dot")], n = dots.length;
  let at = 0, movedAt = 0;
  const busy = () => performance.now() - movedAt < 650;
  const set = (i, instant) => {
    const to = Math.max(0, Math.min(n - 1, i)); if (to !== at) movedAt = performance.now();
    at = to;
    wrap.style.transition = instant ? "none" : "";
    wrap.style.transform = `translate3d(0, ${-at * 100 / n}%, 0)`;
    dots.forEach((d, k) => d.setAttribute("aria-selected", String(k === at)));
    w.classList.toggle("is-up", at > 0);
  };
  set(0, true);
  dots.forEach(d => d.onclick = e => { e.stopPropagation(); set(Number(d.dataset.go)); });
  w.querySelector(".nw-crown").onclick = () => set(at + 1 >= n ? 0 : at + 1);
  w.querySelector(".nw-side").onclick = () => set(at - 1);
  w.querySelector(".nw-action").onclick = () => set(0);
  const shell = w.closest(".nw-shell") || root;
  shell.querySelector("[data-count]")?.addEventListener("click", () => { set(0); onCount?.(disp); });
  shell.querySelector("[data-send]")?.addEventListener("click", e => onSend?.(e.currentTarget));
  const own = e => {
    if (e.target.closest?.(".nw-m")) return true;
    const sc = e.target.closest?.(".nw-scroll");
    return !!sc && sc.scrollHeight > sc.clientHeight + 2;
  };
  disp.addEventListener("keydown", e => { if (own(e)) return; if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); set(at + 1); } if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); set(at - 1); } });
  let wheelAt = 0;
  // one screen per wheel turn or swipe, never a run of them
  disp.addEventListener("wheel", e => { if (own(e)) return; if (busy() || Math.abs(e.deltaY) < 18 || Date.now() - wheelAt < 900) { e.preventDefault(); return; } const i = at + (e.deltaY > 0 ? 1 : -1); if (i < 0 || i >= n) return; e.preventDefault(); wheelAt = Date.now(); set(i); }, { passive: false });
  // the finger drags the screens; release past a quarter of a screen (or a flick) moves one
  let y0 = null, x0 = 0, t0 = 0, dy = 0, h = 1, drag = false;
  disp.addEventListener("pointerdown", e => { if (e.button > 0 || own(e)) return; y0 = e.clientY; x0 = e.clientX; t0 = performance.now(); dy = 0; drag = false; h = disp.clientHeight || 1; });
  disp.addEventListener("pointermove", e => {
    if (y0 == null) return; dy = e.clientY - y0;
    if (!drag && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(e.clientX - x0)) { drag = true; disp.setPointerCapture?.(e.pointerId); }
    if (!drag) return;
    const edge = (at === 0 && dy > 0) || (at === n - 1 && dy < 0) ? .3 : 1;
    wrap.style.transition = "none"; wrap.style.transform = `translate3d(0, calc(${-at * 100 / n}% + ${dy * edge}px), 0)`;
  });
  const end = () => { if (y0 == null) return; const v = dy / Math.max(1, performance.now() - t0); y0 = null;
    if (!drag) return; drag = false;
    set(dy < -h / 4 || v < -.6 ? at + 1 : dy > h / 4 || v > .6 ? at - 1 : at); };
  disp.addEventListener("pointerup", end); disp.addEventListener("pointercancel", end);
  disp.style.touchAction = "none";
  // the status-bar clock
  const tEl = w.querySelector(".nw-time");
  const tick = () => { if (!w.isConnected) { clearInterval(iv); return; } const d = new Date(); tEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const iv = setInterval(tick, 15000);
}

// Product watch: the scan card's photo sits on a smartwatch face (design after "chase2k25" on Uiverse.io).
// Face: the product photo (the card's own .pc-shot, passed in untouched), how many expiry groups it has, the next
// expiry date and the days left. Swipe the screen up (or turn the crown, or use the dots) for the next screens:
// recipes (each opens the recipe theater), stock by location, the groups one by one, and sales.
import { RAW_MATERIALS } from "../data/recipes-data.js?v=99";
import { CAT, prettyName } from "./recipe-names.js?v=99";
import { servingOf } from "../finance/serving.js?v=99";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const low = s => String(s ?? "").toLowerCase();
const RM = new Map(Object.entries(RAW_MATERIALS).map(([k, v]) => [low(k), v]));
const pad = n => String(n).padStart(2, "0");
const RING = ["#ff3b30", "#34c759", "#007aff"];

// how many serves of a recipe the stock makes (the ingredient that runs out first decides)
function makes(r, products, total) {
  let best = Infinity;
  for (const l of r.lines) {
    const key = low(l.rm), p = products.find(x => low(x.sku) === key || low(x.name) === key);
    const have = p ? total(p) * (RM.get(key)?.conv || 1) : 0;
    if (l.qty > 0) best = Math.min(best, Math.floor(have / l.qty + 1e-9));
  }
  return best;
}
const tone = d => (d == null ? "none" : d < 0 ? "exp" : d <= 7 ? "crit" : d <= 30 ? "soon" : "ok");

export function watchHtml(o) {
  const { ar, shot, groups, next, recipes, locs, total, unit, sold, perDay, code, H, products, gname, locName, name = "", p } = o;
  const T = (e, a) => (ar ? a : e), q = n => H.qty(n);
  const d = next ? next.left : null, t = tone(d), frac = d == null ? 0 : Math.max(0, Math.min(1, d / 365));
  const ringDeg = Math.round((d == null ? 0 : d < 0 ? 1 : Math.min(1, d / 90)) * 360);
  const lines = [
    // 1 · face
    `<section class="nw-view nw-face" aria-label="${T("Product", "المنتج")}">
      <div class="nw-comp nw-tl"><b class="data">${groups.length || "—"}</b><small>${groups.length ? T(groups.length === 1 ? "group" : "groups", "مجموعة") : T("no date", "بدون تاريخ")}</small></div>
      <div class="nw-comp nw-tr t-${t}" style="--deg:${ringDeg}deg"><b class="data">${d == null ? "∞" : d < 0 ? "!" : d}</b><small>${d == null ? T("days", "يوم") : d < 0 ? T("expired", "منتهي") : T("days", "يوم")}</small></div>
      <div class="nw-photo">${shot}<span class="pass-laser" aria-hidden="true"></span>${p?.outOfStock ? `<span class="nw-oos">${T("Out of stock", "نفد من المخزون")}</span>` : ""}</div>${name ? `<p class="nw-name">${esc(name)}</p>` : ""}
      <div class="nw-comp nw-bottom t-${t}">
        <div><small>${next ? (d < 0 ? T("Expired on", "انتهى في") : T("Expires", "ينتهي")) : T("Expiry", "الانتهاء")}</small><b class="data" dir="ltr">${next ? esc(next.when) : "—"}</b>
          <div class="nw-progress"><i style="width:${(frac * 100).toFixed(1)}%"></i></div></div>
        <span class="nw-qty data" dir="ltr">${q(total)}<em>${esc(unit)}</em></span>
      </div>
      <p class="nw-hint" aria-hidden="true"><i></i>${T("Swipe up", "اسحب لفوق")}</p>
    </section>`,
    // 2 · one full serving: cost (the whole recipe), price, profit — per flavour
    ...((sv => !sv ? [] : [sv.kind === "serving" ? `<section class="nw-view nw-list nw-econ" aria-label="${T("Cost and profit", "التكلفة والربح")}">
      <h3>${T("Per serving", "الحبة الواحدة")}<em class="data">${T("sells", "البيع")} ${sv.price} ${T("SR", "ر.س")}</em></h3>
      <div class="nw-rows">${sv.options.slice(0, 4).map(x => `<div class="nw-row"><span>${esc(ar ? x.label.ar : x.label.en)}<small>${T("cost", "التكلفة")} <b class="data">${x.cost.toFixed(2)}</b></small></span>
        <b class="data nw-profit">${x.profit.toFixed(2)}<small>${T("profit", "ربح")} · ${Math.round(x.margin * 100)}%</small></b></div>`).join("")}</div>
      <p class="nw-note">${T("Cost = every ingredient of the recipe · profit on the price without VAT", "التكلفة = كل مكوّنات الوصفة · الربح على السعر بدون الضريبة")}</p></section>`
      : `<section class="nw-view nw-info" aria-label="${T("Cost", "التكلفة")}">
      <div class="nw-cover"><b class="data">${sv.cost.toFixed(2)}</b><small>${T("SR per", "ر.س لكل")} ${esc(H.UNITS?.[sv.unit] || sv.unit || "")}</small></div>
      <p class="nw-line"><span>${T("In recipes", "يدخل في")}</span><b class="data">${sv.uses}</b></p></section>`])(p ? servingOf(p) : null)),
    // 3 · recipes
    `<section class="nw-view nw-list" aria-label="${T("Recipes", "الوصفات")}">
      <h3>${T("Recipe", "الوصفة")}<em class="data">${recipes.length}</em></h3>
      ${recipes.length ? `<div class="nw-rows" data-rt-list>${recipes.slice(0, 4).map(r => { const m = makes(r, products, H.total);
        return `<button type="button" class="nw-row" data-rt="${esc(r.name)}"><span>${esc(prettyName(r.name, ar))}<small>${esc((CAT[r.cat] || [r.cat, r.cat])[ar ? 1 : 0])}</small></span><b class="data">${isFinite(m) ? q(m) : "∞"}</b></button>`; }).join("")}</div>
        <p class="nw-note">${T("Number = serves the stock makes · tap to open", "الرقم = كم حصة يكفي المخزون · اضغط للفتح")}</p>`
      : `<p class="nw-empty">${T("Not used in a menu recipe", "ما يدخل في وصفة منيو")}</p>`}
    </section>`,
    // 3 · stock by location (activity rings)
    `<section class="nw-view nw-act" aria-label="${T("Stock", "المخزون")}">
      <h3>${T("On hand", "الموجود")}<em class="data">${q(total)} ${esc(unit)}</em></h3>
      ${locs.map((x, i) => { const pct = total ? x.n / total : 0;
        return `<div class="nw-act-row"><span class="nw-ring" style="--c:${RING[i % 3]};--deg:${Math.round(pct * 360)}deg"></span>
          <div><b class="data">${q(x.n)}</b><small>${esc(locName(x.l))} · ${Math.round(pct * 100)}%</small></div></div>`; }).join("")}
    </section>`,
    // 4 · groups
    `<section class="nw-view nw-list" aria-label="${T("Groups", "المجموعات")}">
      <h3>${T("Groups", "المجموعات")}<em class="data">${groups.length}</em></h3>
      ${groups.length ? `<div class="nw-rows">${groups.slice(0, 4).map(b => `<div class="nw-row nw-g t-${tone(b.left)}"><span>${esc(gname(b.n))}<small>${esc(locName({ id: b.loc, name: b.location }))} · ${q(b.qty)}</small></span>
          <b class="data" dir="ltr">${b.left < 0 ? T("expired", "منتهي") : `${b.left} ${T("d", "يوم")}`}<small>${esc(b.when)}</small></b></div>`).join("")}</div>`
      : `<p class="nw-empty">${T("No dated groups · quantity only", "بدون تاريخ · الكمية فقط")}</p>`}
    </section>`,
    // 5 · sales
    `<section class="nw-view nw-info" aria-label="${T("Sales", "المبيعات")}">
      <div class="nw-cover"><b class="data">${sold ? q(sold) : "—"}</b><small>${T("sold this year", "مباع هذي السنة")}</small></div>
      <p class="nw-line"><span>${T("Per day", "باليوم")}</span><b class="data" dir="ltr">${perDay ? "≈ " + q(perDay) : "—"}</b></p>
      <p class="nw-line"><span>${T("Lasts", "يكفي")}</span><b class="data" dir="ltr">${perDay ? `${Math.round(total / perDay)} ${T("d", "يوم")}` : "—"}</b></p>
      <p class="nw-line"><span>${T("Code", "الكود")}</span><b class="data" dir="ltr">${esc(code)}</b></p>
    </section>`
  ];
  const now = new Date();
  // under the watch: the language and the count mission, always in sight
  const bar = `<div class="nw-bar" dir="${ar ? "rtl" : "ltr"}">
      <button type="button" class="nw-pill nw-lang" data-lang aria-label="${ar ? "English" : "عربي"}">${ar ? "EN" : "ع"}</button>
      <button type="button" class="nw-pill nw-start" data-count><span class="nw-play" aria-hidden="true"></span><b>${T("Start count", "ابدأ الجرد")}</b></button>
    </div>`;
  return `<div class="nw-shell"><div class="nw" dir="ltr">
    <div class="nw-strap top" aria-hidden="true"></div><div class="nw-strap bottom" aria-hidden="true"></div>
    <div class="nw-case">
      <span class="nw-crown-well" aria-hidden="true"></span><button type="button" class="nw-crown" aria-label="${T("Next screen", "الشاشة التالية")}"></button>
      <span class="nw-side-well" aria-hidden="true"></span><button type="button" class="nw-side" aria-label="${ar ? "English" : "عربي"}" title="${ar ? "English" : "عربي"}"></button>
      <span class="nw-action-well" aria-hidden="true"></span><button type="button" class="nw-action" aria-label="${T("Back to the product", "رجوع للمنتج")}"></button>
      <div class="nw-display" tabindex="0" role="region" aria-roledescription="${T("watch", "ساعة")}" aria-label="${T("Product watch: swipe up for more", "ساعة المنتج: اسحب لفوق للمزيد")}" dir="${ar ? "rtl" : "ltr"}">
        <div class="nw-status" dir="ltr"><span class="nw-time data">${pad(now.getHours())}:${pad(now.getMinutes())}</span><span class="nw-brand">NOIR<i></i></span></div>
        <div class="nw-wrap" style="height:${lines.length * 100}%;--nv:${lines.length}">${lines.join("")}</div>
        <div class="nw-dots" role="tablist">${lines.map((_, i) => `<button type="button" role="tab" class="nw-dot" data-go="${i}" aria-label="${i + 1}"></button>`).join("")}</div>
      </div>
    </div>
  </div>${bar}</div>`;
}

// screens move up and down: swipe, wheel, arrow keys, crown (next), action button (back to the face), dots
export function mountWatch(root, { onRecipe, onLang, onCount } = {}) {
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
  w.querySelector(".nw-action").onclick = () => set(0);
  w.querySelector(".nw-side").onclick = () => onLang?.(); // the side button switches Arabic / English too
  const shell = w.closest(".nw-shell") || root;
  shell.querySelector("[data-lang]")?.addEventListener("click", () => onLang?.());
  shell.querySelector("[data-count]")?.addEventListener("click", () => { set(0); onCount?.(disp); });
  const mission = e => !!e.target.closest?.(".nw-m");
  disp.addEventListener("keydown", e => { if (mission(e)) return; if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); set(at + 1); } if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); set(at - 1); } });
  let wheelAt = 0;
  // one screen per wheel turn or swipe, never a run of them
  disp.addEventListener("wheel", e => { if (mission(e)) return; if (busy() || Math.abs(e.deltaY) < 18 || Date.now() - wheelAt < 900) { if (!mission(e)) e.preventDefault(); return; } const i = at + (e.deltaY > 0 ? 1 : -1); if (i < 0 || i >= n) return; e.preventDefault(); wheelAt = Date.now(); set(i); }, { passive: false });
  // the finger drags the screens; release past a third of a screen (or a flick) moves one
  let y0 = null, x0 = 0, t0 = 0, dy = 0, h = 1, drag = false;
  disp.addEventListener("pointerdown", e => { if (e.button > 0 || mission(e)) return; y0 = e.clientY; x0 = e.clientX; t0 = performance.now(); dy = 0; drag = false; h = disp.clientHeight || 1; });
  disp.addEventListener("pointermove", e => {
    if (y0 == null) return; dy = e.clientY - y0;
    if (!drag && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(e.clientX - x0)) { drag = true; disp.setPointerCapture?.(e.pointerId); }
    if (!drag) return;
    const edge = (at === 0 && dy > 0) || (at === n - 1 && dy < 0) ? .3 : 1;
    wrap.style.transition = "none"; wrap.style.transform = `translate3d(0, calc(${-at * 100 / n}% + ${dy * edge}px), 0)`;
  });
  const end = () => { if (y0 == null) return; const v = dy / Math.max(1, performance.now() - t0); y0 = null;
    if (!drag) return; drag = false; w.dataset.dragged = "1"; setTimeout(() => { delete w.dataset.dragged; }, 50);
    set(dy < -h / 4 || v < -.6 ? at + 1 : dy > h / 4 || v > .6 ? at - 1 : at); };
  disp.addEventListener("pointerup", end); disp.addEventListener("pointercancel", end);
  disp.style.touchAction = "none";
  // recipe rows open the recipe theater
  w.addEventListener("click", e => { const b = e.target.closest?.("[data-rt]"); if (!b || w.dataset.dragged) return; e.stopPropagation();
    onRecipe?.(b.dataset.rt, [...w.querySelectorAll("[data-rt]")].map(x => x.dataset.rt), b); }, true);
  // the status-bar clock
  const tEl = w.querySelector(".nw-time");
  const tick = () => { if (!w.isConnected) { clearInterval(iv); return; } const d = new Date(); tEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const iv = setInterval(tick, 15000);
}

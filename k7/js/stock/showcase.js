// Stock showcase — the product list as a stage: the chosen product floats in the middle, the rest wait on an arc either
// side. Pick one by clicking, dragging, the arrow keys, the wheel or the category rail. The middle product tilts toward
// the pointer; tap it (or T) to turn it round: its back carries the recipes it goes into, their calories and its
// expiry groups. "Open product" opens the full card; the heart records a like under the viewer's name. Motion: GSAP + Draggable + InertiaPlugin (greensock/GSAP, vendored, loaded on first use).
// Images: the transparent cut-outs in assets/cutouts (made from assets/products by a script); if a cut-out is missing
// the original photo is shown on a white plate. The original images and their code are not touched.
import { soldOf } from "../data/sales-data.js?v=93";
import { alertFor } from "./stock-alerts.js?v=93";
import { placement } from "./fefo-place.js?v=93";
import { RECIPES, RAW_MATERIALS } from "../data/recipes-data.js?v=93";
import { KCAL, recipeKcal } from "../data/nutrition.js?v=93";
import { mountLikes } from "../core/likes.js?v=93";
import { deck, wire } from "./recipe-theater.js?v=93";

const low = s => String(s || "").toLowerCase();
// "Xtra Large Tub Caramel Popcorn - 130 Oz" → "Caramel · 130 oz"; flavours in Arabic on the Arabic site
const plural = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`;
// recipes this product goes into (by its system name), heaviest use first; take-away duplicates left out
function usesOf(p) {
  const key = low(p.sku); if (!key) return [];
  const rm = Object.entries(RAW_MATERIALS).find(([k]) => low(k) === key)?.[1];
  return RECIPES.filter(r => !r.ta && !/^TA /i.test(r.name)).map(r => { const l = r.lines.find(x => low(x.rm) === key); return l ? { r, qty: l.qty, unit: rm?.recipe || "", kcal: recipeKcal(r, RAW_MATERIALS) } : null; })
    .filter(Boolean).sort((a, b) => b.qty - a.qty);
}

const LIBS = ["vendor/gsap/gsap.min.js", "vendor/gsap/Draggable.min.js", "vendor/gsap/InertiaPlugin.min.js"];
let libP = null;
const loadLibs = () => libP ??= LIBS.filter(src => !(window.gsap && src.endsWith("/gsap.min.js"))).reduce((p, src) => p.then(() => new Promise((res, rej) => {
  const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { libP = null; rej(new Error("Could not load the animation library")); }; document.head.append(s);
})), Promise.resolve()).then(() => { window.gsap.registerPlugin(window.Draggable, window.InertiaPlugin); return window.gsap; });

const LOC_AR = { refuel: "الكونسيشن", mini: "الميني ستور", stores: "المستودع" };
const LOC_EN = { refuel: "Concession", mini: "Mini Store", stores: "Store" };
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const cutOf = src => String(src || "").replace("assets/products/", "assets/cutouts/");
const TINT = new Map(); // image src → "r, g, b"
function tintOf(img) {
  if (TINT.has(img.src)) return TINT.get(img.src);
  try {
    const c = document.createElement("canvas"); c.width = c.height = 24; const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, 24, 24); const d = x.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3], mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (a < 160 || mx - mn < 28 || mx < 40) continue; // skip transparent, grey/white and near-black pixels: keep the brand colour
      const w = (mx - mn) / 255; r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w;
    }
    const v = n ? `${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)}` : "108, 203, 255";
    TINT.set(img.src, v); return v;
  } catch { return "108, 203, 255"; }
}

window.addEventListener("resize", () => { if (S.host?.isConnected) S.layout?.(); }, { passive: true });
const S = { id: null, pos: 0, list: [], gsap: null, drag: null, host: null, H: null, tl: null, side: "front", flip: { deg: 0 } };
export async function renderShowcase(host, H, list) {
  const ar = (sessionStorage.getItem("noir-lang") || "en") === "ar", T = (en, a) => ar ? a : en, esc = H.esc;
  S.host = host; S.H = H; S.list = list;
  wire(host, () => S.H, { lang: (sessionStorage.getItem("noir-lang") || "en") === "ar" ? "ar" : "en" });
  if (!list.length) { host.innerHTML = `<p class="empty">${T("Nothing matches the search or the category.", "ما فيه شي يطابق البحث أو الفئة.")}</p>`; return; }
  let at = Math.max(0, list.findIndex(p => p.id === S.id)); S.pos = at; S.id = list[at].id;
  const cats = [...new Set(list.map(p => p.category))];
  host.innerHTML = `<section class="sc" tabindex="0" aria-roledescription="carousel" aria-label="${T("Products", "المنتجات")}">
    <div class="sc-bg" aria-hidden="true"></div><div class="sc-ring" aria-hidden="true"></div>
    <div class="sc-copy" aria-live="polite"></div>
    <div class="sc-stage" dir="ltr"><div class="sc-track">${list.map((p, i) => `<button class="sc-it" data-i="${i}" aria-label="${esc((ar && H.namesAr?.[p.id]) || p.name)}" tabindex="-1">
        <span class="sc-float"><span class="sc-turn"><img class="sc-front" src="${esc(cutOf(p.image))}" data-orig="${esc(p.image || "")}" alt="" draggable="false" loading="${Math.abs(i - at) < 6 ? "eager" : "lazy"}" decoding="async"></span></span></button>`).join("")}</div>
      <button class="sc-spin" type="button" aria-label="${T("Turn the product", "لف المنتج")}" title="${T("Turn (T)", "لف (T)")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/></svg><span>${T("Turn", "لف")}</span></button>
      <div class="sc-floor" aria-hidden="true"></div></div>
    <nav class="sc-rail" aria-label="${T("Jump to a category", "انتقل لفئة")}">${cats.map(c => `<button data-cat="${esc(c)}" title="${esc(H.catName(c))}"><span>${esc(H.catName(c))}</span></button>`).join("")}</nav>
    <div class="sc-foot" dir="ltr"><button class="sc-nav" data-step="-1" aria-label="${T("Previous", "السابق")}">‹</button>
      <div class="sc-prog" aria-hidden="true"><i></i></div><span class="sc-count data"></span>
      <button class="sc-nav" data-step="1" aria-label="${T("Next", "التالي")}">›</button></div>
  </section>`;
  const sec = host.querySelector(".sc"), its = [...host.querySelectorAll(".sc-it")];
  its.forEach(b => { const img = b.querySelector("img"); img.onerror = () => { if (img.dataset.orig && img.src.indexOf(img.dataset.orig) < 0) { img.onerror = null; img.src = img.dataset.orig; b.classList.add("plate"); } }; });
  const spacing = () => Math.min(230, Math.max(120, sec.clientWidth * .2));

  // place every product for a fractional position (drag in progress) — only ±5 around the centre are drawn
  const layout = () => {
    const sp = spacing();
    its.forEach((b, i) => {
      const d = i - S.pos, a = Math.abs(d);
      if (a > 5.5) { b.style.visibility = "hidden"; return; }
      b.style.visibility = "";
      const x = Math.sign(d) * (a < 1 ? a * sp * 1.15 : sp * 1.15 + (a - 1) * sp * .82);
      const s = a < 1 ? 1 - a * .42 : .58 - (a - 1) * .06;
      b.style.transform = `translate3d(${x.toFixed(1)}px, ${(a * a * 6).toFixed(1)}px, ${(-a * 140).toFixed(0)}px) rotateY(${(-d * 16).toFixed(1)}deg) rotateZ(${(d * 3).toFixed(1)}deg) scale(${s.toFixed(3)})`;
      b.style.opacity = Math.max(0, 1 - a * .17).toFixed(3);
      b.style.zIndex = String(100 - Math.round(a * 10));
      b.style.filter = a < .5 ? "" : `brightness(${Math.max(.35, 1 - a * .16).toFixed(2)}) saturate(${Math.max(.4, 1 - a * .12).toFixed(2)})`;
      b.classList.toggle("on", a < .5);
      b.querySelector(".sc-turn").style.setProperty("--flip", `${a < .5 ? S.flip.deg : 0}deg`);
    });
    host.querySelector(".sc-prog i").style.width = `${((S.pos + 1) / list.length * 100).toFixed(2)}%`;
  };

  const L = H.LOCATIONS || [];
  const copy = i => {
    const p = list[i], tot = H.total(p), unit = esc(H.UNITS?.[p.unit] || p.unit || ""), lv = H.level(p), sold = soldOf(p.id) || 0;
    let al = null; try { al = alertFor(p, H.data().products); } catch {}
    const nameEn = esc(p.name), nameAr = esc(H.namesAr?.[p.id] || "");
    const act = al?.moves?.[0] ? T(`Move ${H.qty(al.moves[0].qty)} ${unit} to ${al.moves[0].to === "refuel" ? "Concession" : al.moves[0].to === "mini" ? "Mini Store" : "Store"}`, `انقل ${H.qty(al.moves[0].qty)} ${unit} إلى ${al.moves[0].to === "refuel" ? "الكونسيشن" : al.moves[0].to === "mini" ? "الميني ستور" : "المستودع"}`)
      : al?.order?.now ? T("Order now", "اطلبه الحين") : al?.level === "ok" ? T("Where it should be", "بمكانه الصح") : "";
    const max = Math.max(1, ...L.map(l => Number(p.stock?.[l.id]) || 0));
    return `<p class="sc-cat">${esc(H.catName(p.category))}</p>
      <h2 class="sc-name">${ar && nameAr ? nameAr : nameEn}</h2>${ar && nameAr ? `<p class="sc-alt" dir="ltr">${nameEn}</p>` : nameAr ? `<p class="sc-alt" dir="rtl" lang="ar">${nameAr}</p>` : ""}
      <dl class="sc-stats">
        <div><dt>${T("On hand", "الموجود")}</dt><dd class="data">${H.qty(tot)} <small>${unit}</small></dd></div>
        <div><dt>${T("Value", "القيمة")}</dt><dd class="data">${H.sar(tot * (Number(p.rate) || 0))} <small>SAR</small></dd></div>
        <div><dt>${T("Sold this year", "مباع هذي السنة")}</dt><dd class="data">${H.nf0 ? H.nf0.format(Math.round(sold)) : Math.round(sold)}</dd></div>
        ${al?.cover?.total != null && isFinite(al.cover.total) ? `<div><dt>${T("Lasts", "يكفي")}</dt><dd class="data">${al.cover.total >= 99 ? "99+" : Math.round(al.cover.total)} <small>${T("days", "يوم")}</small></dd></div>` : ""}
      </dl>
      <ul class="sc-locs">${L.map(l => { const q = Number(p.stock?.[l.id]) || 0; return `<li><span>${esc(ar ? LOC_AR[l.id] || l.name : l.name)}</span><i><u style="width:${(q / max * 100).toFixed(1)}%"></u></i><b class="data">${H.qty(q)}</b></li>`; }).join("")}</ul>
      <div class="sc-act">${act ? `<span class="sc-tag lv-${al?.level || "ok"}">${act}</span>` : ""}${lv.state === "crit" || lv.state === "empty" ? `<span class="sc-tag lv-critical">${T("Below par", "تحت الحد")}</span>` : ""}
        <span class="sc-likes"></span><button class="btn hot sc-open">${T("Open product", "افتح المنتج")}</button></div>`;
  };
  const back = i => {
    const p = list[i], uses = usesOf(p), own = KCAL[low(p.sku)], nameEn = esc(p.name), nameAr = esc(H.namesAr?.[p.id] || "");
    let G = []; try { G = placement(p).groups; } catch {}
    const unitOf = u => esc(u === "pcs" ? T("pc", "حبة") : u), when = g => g.left < 0 ? T(`expired ${-g.left} d ago`, `منتهية من ${-g.left} يوم`) : T(`${g.left} d left`, `باقي ${g.left} يوم`);
    return `<p class="sc-cat">${T("The other side · recipe & groups", "الوجه الثاني · الوصفة والمجموعات")}</p>
      <h2 class="sc-name">${ar && nameAr ? nameAr : nameEn}</h2>
      ${own != null ? `<p class="sc-kcal"><b class="data">≈ ${own}</b> ${T("kcal per piece, from its label", "سعرة للحبة حسب الملصق")}</p>` : ""}
      <h3 class="sc-h">${uses.length ? T(`Goes into ${uses.length} menu recipe${uses.length > 1 ? "s" : ""}`, `يدخل في ${plural(uses.length, "وصفة وحدة", "وصفتين", "وصفات", "وصفة")}`) : T("Not used in a menu recipe", "ما يدخل بوصفة منيو")}</h3>
      ${uses.length ? deck(uses.map(u => u.r.name), H, { lang: ar ? "ar" : "en", compact: true, notes: Object.fromEntries(uses.map(u => [u.r.name, `${+u.qty.toFixed(2)} ${unitOf(u.unit)} ${T("each", "للحصة")}`])) }) : ""}
      <h3 class="sc-h">${G.length ? T(`${G.length} expiry group${G.length > 1 ? "s" : ""}`, plural(G.length, "مجموعة صلاحية وحدة", "مجموعتين صلاحية", "مجموعات صلاحية", "مجموعة صلاحية")) : T("No dated groups", "ما فيه مجموعات بتاريخ")}</h3>
      ${G.length ? `<ul class="sc-grp">${G.slice(0, 4).map(g => `<li class="${g.left < 0 ? "bad" : g.left <= 30 ? "warn" : ""}"><span>${esc(ar ? LOC_AR[g.loc] || g.location : LOC_EN[g.loc] || g.location)}</span><b class="data">${H.qty(g.qty)}</b><em>${when(g)}</em></li>`).join("")}</ul>` : ""}
      <p class="sc-note">${T("Calories are estimates from the recipe.", "السعرات تقديرية محسوبة من الوصفة.")}</p>
      <div class="sc-act"><button class="btn sc-unturn">${T("Turn back", "رجّعه")}</button><button class="btn hot sc-open">${T("Open product", "افتح المنتج")}</button></div>`;
  };

  let shown = -1;
  const settle = (i, instant) => {
    if (i === shown) return; shown = i; S.id = list[i].id;
    const box = host.querySelector(".sc-copy"); box.innerHTML = S.side === "back" ? back(i) : copy(i);
    box.classList.toggle("is-back", S.side === "back");
    host.querySelector(".sc-count").textContent = `${i + 1} / ${list.length}`;
    host.querySelector(".sc-open").onclick = () => H.openProduct(list[i].id);
    const ub = host.querySelector(".sc-unturn"); if (ub) ub.onclick = () => turn();
    mountLikes(host.querySelector(".sc-likes"), list[i].id, { compact: true });
    ensureBack(i);
    host.querySelectorAll(".sc-rail button").forEach(b => b.setAttribute("aria-current", b.dataset.cat === list[i].category ? "true" : "false"));
    const img = its[i].querySelector("img"), apply = () => sec.style.setProperty("--tc", `rgb(${tintOf(img)})`);
    img.complete && img.naturalWidth ? apply() : img.addEventListener("load", apply, { once: true });
    const g = S.gsap; if (g && !instant && !still()) g.fromTo(box.children, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .55, stagger: .04, ease: "power3.out", overwrite: true });
  };
  const go = (i, instant) => {
    i = Math.max(0, Math.min(list.length - 1, i));
    const g = S.gsap;
    if (!g || instant || still()) { S.pos = i; layout(); settle(i, instant); return; }
    g.to(S, { pos: i, duration: .75, ease: "power3.out", overwrite: true, onUpdate: () => { layout(); const r = Math.round(S.pos); if (r !== shown) settle(r); }, onComplete: () => settle(i) });
  };

  // the back face is built only for the product in the middle
  function ensureBack(i) {
    const t = its[i].querySelector(".sc-turn");
    if (t.querySelector(".sc-backface")) return;
    const img = t.querySelector(".sc-front");
    // absolute: a url() inside a custom property resolves against the stylesheet that uses it, not this page
    const abs = new URL(img.getAttribute("src"), location.href).href;
    t.insertAdjacentHTML("beforeend", `<span class="sc-backface" aria-hidden="true" style="--m:url('${abs}')"><img src="${img.getAttribute("src")}" alt="" draggable="false"><i></i><b>${T("Recipe", "الوصفة")}</b></span><span class="sc-glare" aria-hidden="true" style="--m:url('${abs}')"></span>`);
  }
  // turn the middle product round; the copy changes side half way, when the product is edge-on
  function turn() {
    const i = Math.round(S.pos), to = S.side === "front" ? 180 : 0, g = S.gsap;
    S.side = to ? "back" : "front";
    const swap = () => { shown = -1; settle(i, true); };
    if (!g || still()) { S.flip.deg = to; layout(); swap(); return; }
    let swapped = false;
    g.to(S.flip, { deg: to, duration: .95, ease: "back.out(1.3)", overwrite: true,
      onUpdate: () => { layout(); if (!swapped && Math.abs(S.flip.deg - 90) < 25) { swapped = true; swap(); g.fromTo(host.querySelectorAll(".sc-copy > *"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .45, stagger: .03 }); } },
      onComplete: () => { if (!swapped) swap(); } });
  }
  host.querySelector(".sc-spin").onclick = () => turn();
  // tilt toward the pointer (the stage only; dragging still moves the line)
  const stage = host.querySelector(".sc-stage");
  stage.addEventListener("pointermove", e => {
    if (still() || S.dragging) return;
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    const t = its[Math.round(S.pos)]?.querySelector(".sc-turn"); if (!t) return;
    t.style.setProperty("--ry", `${(x * 26).toFixed(1)}deg`); t.style.setProperty("--rx", `${(-y * 16).toFixed(1)}deg`);
    t.style.setProperty("--gx", `${((x + .5) * 100).toFixed(0)}%`); t.style.setProperty("--gy", `${((y + .5) * 100).toFixed(0)}%`);
  });
  stage.addEventListener("pointerleave", () => its.forEach(b => { const t = b.querySelector(".sc-turn"); t.style.setProperty("--ry", "0deg"); t.style.setProperty("--rx", "0deg"); }));

  // input: buttons, items, rail, keys, wheel
  host.querySelectorAll(".sc-nav").forEach(b => b.onclick = () => go(Math.round(S.pos) + Number(b.dataset.step)));
  its.forEach((b, i) => b.onclick = () => { if (S.dragged) return; i === Math.round(S.pos) ? turn() : go(i); });
  host.querySelectorAll(".sc-rail button").forEach(b => b.onclick = () => go(list.findIndex(p => p.category === b.dataset.cat)));
  sec.addEventListener("keydown", e => {
    if (e.target.closest("input, select, textarea")) return;
    const k = { ArrowRight: 1, ArrowLeft: -1, Home: -1e9, End: 1e9 }[e.key];
    if (k) { e.preventDefault(); go(Math.abs(k) > 1 ? (k > 0 ? list.length - 1 : 0) : Math.round(S.pos) + k); }
    if (e.key === "Enter" && e.target === sec) H.openProduct(list[Math.round(S.pos)].id);
    if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); turn(); }
  });
  let wheelAt = 0;
  host.querySelector(".sc-stage").addEventListener("wheel", e => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0; // horizontal only, so the page still scrolls
    if (Math.abs(d) < 12 || Date.now() - wheelAt < 260) return; wheelAt = Date.now(); e.preventDefault(); go(Math.round(S.pos) + Math.sign(d));
  }, { passive: false });

  S.layout = layout;
  layout(); settle(at, true);
  sec.classList.toggle("still", still());
  try { S.gsap = await loadLibs(); } catch { return; }
  // Draggable keeps GSAP's ticker listening, so it never sleeps and the page repaints 60 times a second while idle.
  // Put it to sleep whenever nothing is moving; any new tween or drag wakes it again.
  if (!S.nap) S.nap = setInterval(() => { const g = window.gsap; if (!g || S.dragging || document.hidden) return;
    if (!g.globalTimeline.getChildren(true, true, false).some(t => t.isActive())) g.ticker.sleep(); }, 1500); // without the library: buttons, keys and clicks still work, just without motion
  if (!host.isConnected || S.host !== host) return;
  const g = S.gsap;
  if (!still()) g.from(its.filter((b, i) => Math.abs(i - at) < 6), { y: 80, opacity: 0, duration: .9, stagger: .05, ease: "power3.out", clearProps: "opacity" });
  // drag / swipe the stage: a proxy carries the gesture, inertia carries the throw, the result snaps to a product
  const proxy = document.createElement("div");
  S.drag?.kill?.();
  S.drag = window.Draggable.create(proxy, {
    type: "x", trigger: host.querySelector(".sc-stage"), inertia: true, minimumMovement: 6, allowContextMenu: true,
    onPress() { g.killTweensOf(S); g.set(proxy, { x: -S.pos * spacing() }); this.update(); S.dragged = false; },
    onDragStart() { S.dragging = true; },
    onDrag() { S.dragged = true; S.pos = Math.max(-.4, Math.min(list.length - .6, -this.x / spacing())); layout(); const r = Math.round(Math.max(0, Math.min(list.length - 1, S.pos))); if (r !== shown) settle(r); },
    onThrowUpdate() { S.pos = Math.max(-.4, Math.min(list.length - .6, -this.x / spacing())); layout(); const r = Math.round(Math.max(0, Math.min(list.length - 1, S.pos))); if (r !== shown) settle(r); },
    snap: { x: v => -Math.max(0, Math.min(list.length - 1, Math.round(-v / spacing()))) * spacing() },
    onThrowComplete() { go(Math.round(S.pos)); },
    onRelease() { S.dragging = false; setTimeout(() => { S.dragged = false; }, 60); if (!this.tween) go(Math.round(S.pos)); }
  })[0];
}

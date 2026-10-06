// Recipe theater: the one way the site shows a recipe.
//   · deck(names)  → a row of recipe tokens (a small orbit of the ingredients, the name, how many the stock makes)
//   · openRecipe() → a full-screen "reactor": the menu item at the core, its ingredients in orbit (drag to spin it),
//     what the stock can make and which ingredient runs out first, cost per serving and its split, calories,
//     and a planner: pick a number of serves and see what each ingredient needs against what is on hand.
// Motion: GSAP + Draggable + InertiaPlugin (github.com/greensock/GSAP, vendored). Without them everything still works.
import { RECIPES, RAW_MATERIALS } from "../data/recipes-data.js?v=90";
import { KCAL, recipeKcal } from "../data/nutrition.js?v=90";
import { recipeCost } from "../finance/costing.js?v=90";
import { MENU, COMBOS, VAT } from "../data/menu-data.js?v=90";
import { AR as NAMES_AR } from "../core/names-ar.js?v=90";

const low = s => String(s ?? "").toLowerCase();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const RM = new Map(Object.entries(RAW_MATERIALS).map(([k, v]) => [low(k), { key: k, ...v }]));
const BY_NAME = new Map(RECIPES.map(r => [low(r.name), r]));
export const recipeByName = n => BY_NAME.get(low(n)) || null;
const PALETTE = ["#6ccbff", "#ffb547", "#3ed69e", "#5b7bff", "#ff8a5c", "#dce6ff", "#b18cff", "#ff6fb0", "#7de3d0", "#ffd36b", "#8fb4ff", "#c6f36b"];
const PACK = /tub|cup|lid|napkin|straw|stirrer|tray|glass|dip cup|sachet|box|bag/i;
export const CAT = { popcorn: ["Popcorn", "فشار"], combo: ["Combo", "كومبو"], fountain: ["Fountain", "مشروب نافورة"], slush: ["Slush", "سلاش"], nachos: ["Nachos", "ناتشوز"],
  hotdog: ["Hot dog", "هوت دوق"], mocktail: ["Mocktail", "موكتيل"], floss: ["Cotton candy", "غزل البنات"], candy: ["Candy", "حلويات"], packaged: ["Cans & bottles", "معلّب"], refill: ["Refill", "تعبئة"] };
const FL_AR = { salted: "مملح", cheese: "جبن", caramel: "كراميل", "pizza savory": "بيتزا", coke: "كوكاكولا", "coke zero": "كوكاكولا زيرو", fanta: "فانتا", sprite: "سبرايت",
  strawberry: "فراولة", "blue raspberry": "توت أزرق", pomegranate: "رمان", chicken: "دجاج", beef: "لحم", nachos: "ناتشوز", combo: "كومبو", lemonade: "ليمون", mojito: "موهيتو" };
const titleCase = s => low(s).replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bMl\b/g, "ml").replace(/\bOz\b/g, "oz").replace(/\bGm\b/g, "g");

// "Xtra Large Tub Caramel Popcorn - 130 Oz" → "Caramel · 130 oz"; flavours in Arabic on the Arabic site
export function prettyName(name, ar) {
  const size = (name.match(/(\d+)\s*oz/i) || [])[1];
  let f = name.replace(/\b(Xtra Large|Large|Medium|Regular|Family|Small|Tub|Popcorn|Lrg|Reg|Med)\b/gi, " ").replace(/^SLUSH\s*-\s*/i, "").replace(/^HOT DOG\s*/i, "Hot dog ")
    .replace(/-?\s*\d+\s*oz\b/gi, "").replace(/[-·]\s*$/, "").replace(/\s{2,}/g, " ").trim();
  const hd = /^hot dog\s+(\w+)/i.exec(f);
  if (hd) return ar ? `هوت دوق · ${FL_AR[low(hd[1])] || hd[1]}` : `Hot dog · ${hd[1][0].toUpperCase()}${low(hd[1]).slice(1)}`;
  if (f.length < 4) f = name.replace(/-?\s*\d+\s*oz\b/gi, "").trim(); // nothing much left ("SND FAMILY"): keep the whole name
  if (f === f.toUpperCase()) f = titleCase(f);
  if (ar && FL_AR[low(f)]) f = FL_AR[low(f)];
  return size ? `${f} · ${size} ${ar ? "أونصة" : "oz"}` : f;
}
const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const n0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
function amt(n, u, ar) {
  if (!isFinite(n)) return "∞";
  if (u === "g" && Math.abs(n) >= 1000) return `${nf.format(n / 1000)} ${ar ? "كجم" : "kg"}`;
  if (u === "ml" && Math.abs(n) >= 1000) return `${nf.format(n / 1000)} ${ar ? "لتر" : "L"}`;
  if (u === "pcs") return `${nf.format(n)} ${ar ? "حبة" : "pc"}`;
  return `${nf.format(n)} ${ar && u === "g" ? "جم" : ar && u === "ml" ? "مل" : u}`;
}
// a short, stable fingerprint of the recipe (it reads like a token id, and changes when the recipe does)
function hash(r) {
  let h = 0x811c9dc5; const s = r.name + "|" + r.lines.map(l => l.rm + l.qty).join("|");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return "0x" + h.toString(16).padStart(8, "0");
}

// ── the numbers behind one recipe ─────────────────────────────
export function model(r, H) {
  const P = H?.data?.().products || [], total = p => (H?.total ? H.total(p) : 0);
  const rc = recipeCost(r.name);
  const lines = r.lines.map((l, i) => {
    const key = low(l.rm), meta = RM.get(key), conv = meta?.conv || 1;
    const p = P.find(x => low(x.sku) === key || low(x.name) === key) || null;
    const have = p ? total(p) * conv : 0;
    return { i, rm: l.rm, qty: Number(l.qty) || 0, uom: l.uom, conv, stockUnit: meta?.stock || l.uom, p, have, missing: !p,
      makes: l.qty > 0 ? Math.floor(have / l.qty + 1e-9) : Infinity, cost: rc?.lines[i]?.cost ?? (Number(meta?.rate) || 0) * l.qty / conv,
      kcal: KCAL[key] != null ? Math.round(KCAL[key] * l.qty) : null, pack: PACK.test(l.rm), color: PALETTE[i % PALETTE.length] };
  });
  const cost = rc ? rc.total : lines.reduce((a, x) => a + x.cost, 0);
  lines.forEach(x => { x.share = cost > 0 ? x.cost / cost : 1 / lines.length; });
  const finite = lines.filter(x => isFinite(x.makes));
  const limit = finite.length ? finite.reduce((a, b) => (b.makes < a.makes ? b : a)) : null;
  const menu = MENU.find(m => (m.recipes || []).some(n => low(n) === low(r.name))) || COMBOS.find(c => c.recipe && low(c.recipe) === low(r.name)) || null;
  const price = menu?.price ?? null, net = price ? price / (1 + VAT) : null;
  const hero = lines.find(x => x.p && /tub|cup|tray|glass|box/i.test(x.rm)) || [...lines].filter(x => x.p).sort((a, b) => b.share - a.share)[0] || null;
  return { r, lines, limit, makes: limit ? limit.makes : 0, cost, kcal: recipeKcal(r, RAW_MATERIALS), price, net, margin: net ? (net - cost) / net : null, hero, hash: hash(r) };
}
const stateOf = n => (n <= 0 ? "zero" : n < 20 ? "low" : "ok");
const nameOf = (x, ar) => (ar && x.p && NAMES_AR[x.p.id]) || (x.p ? x.p.name : titleCase(x.rm));
const imgOf = (x, H) => x.p?.image ? (H?.src ? H.src(x.p.image) : x.p.image) : "";
const cutOf = s => String(s || "").replace("assets/products/", "assets/cutouts/");
const picHtml = (x, H, cls = "") => { const im = imgOf(x, H); return im
  ? `<img class="${cls}" src="${esc(cutOf(im))}" data-fb="${esc(im)}" alt="" decoding="async" draggable="false">`
  : `<span class="rt-ini ${cls}">${esc(titleCase(x.rm).replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join(""))}</span>`; };

// ── token: the compact form, used wherever a recipe is listed ─
function miniOrbit(m) {
  const n = m.lines.length, R = 23;
  const dots = m.lines.map((x, i) => { const a = -Math.PI / 2 + i / n * Math.PI * 2, cx = 32 + Math.cos(a) * R, cy = 32 + Math.sin(a) * R, r = 2.2 + Math.sqrt(x.share) * 4.2, lim = x === m.limit;
    return `<line x1="32" y1="32" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${x.color}" stroke-opacity=".28"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${lim ? "#ff5468" : x.color}"${lim ? ' class="lim"' : ""}/>`; }).join("");
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${R}" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-dasharray="2 3"/>${dots}<circle cx="32" cy="32" r="7.5" class="core"/></svg>`;
}
export function token(name, H, { lang = "en", note = "" } = {}) {
  const r = recipeByName(name); if (!r) return "";
  const ar = lang === "ar", T = (e, a) => (ar ? a : e), m = model(r, H), st = stateOf(m.makes);
  return `<button type="button" class="rt-tok s-${st}" data-rt="${esc(r.name)}" title="${esc(r.name)}">
    <span class="rt-tok-orb">${miniOrbit(m)}</span>
    <span class="rt-tok-cat">${esc((CAT[r.cat] || [r.cat, r.cat])[ar ? 1 : 0])}${r.ta ? " · TA" : ""}</span>
    <b class="rt-tok-name">${esc(prettyName(r.name, ar))}</b>
    <span class="rt-tok-meta"><em class="data">${isFinite(m.makes) ? n0.format(m.makes) : "∞"}</em>${T("can make", "تكفي")}${m.kcal != null ? `<i class="data">${m.kcal} ${T("kcal", "سعرة")}</i>` : ""}</span>
    ${note ? `<span class="rt-tok-note data">${note}</span>` : ""}</button>`;
}
export function deck(names, H, { lang = "en", compact = false, notes = {} } = {}) {
  const html = [...new Set(names)].map(n => token(n, H, { lang, note: notes[n] || "" })).filter(Boolean).join("");
  return html ? `<div class="rt-deck${compact ? " is-compact" : ""}">${html}</div>` : "";
}
// one listener per container: any token inside opens the theater, with its deck as the prev/next list
export function wire(root, H, opts = {}) {
  if (!root || root.dataset.rtWired) return; root.dataset.rtWired = "1";
  ensureCss();
  root.addEventListener("click", e => {
    const t = e.target.closest?.("[data-rt]"); if (!t || !root.contains(t)) return;
    e.preventDefault(); e.stopPropagation();
    const box = t.closest(".rt-deck, [data-rt-list]") || root;
    const list = [...box.querySelectorAll("[data-rt]")].map(x => x.dataset.rt);
    openRecipe(t.dataset.rt, typeof H === "function" ? H() : H, { ...opts, list, from: t });
  });
}

// ── styles and libraries, loaded with the first use ───────────
let cssDone = false;
export function ensureCss() {
  if (cssDone || document.querySelector("link[data-rt-css]")) { cssDone = true; return; }
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/recipe-theater.css?v=90"; l.dataset.rtCss = "1"; document.head.append(l); cssDone = true;
}
const LIBS = ["vendor/gsap/gsap.min.js", "vendor/gsap/Draggable.min.js", "vendor/gsap/InertiaPlugin.min.js"];
let libP = null;
const loadLibs = () => libP ??= LIBS.filter(src => !(src.endsWith("/gsap.min.js") && window.gsap) && !(src.endsWith("/Draggable.min.js") && window.Draggable) && !(src.endsWith("/InertiaPlugin.min.js") && window.InertiaPlugin))
  .reduce((p, src) => p.then(() => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { libP = null; rej(new Error("gsap")); }; document.head.append(s); })), Promise.resolve())
  .then(() => { window.gsap.registerPlugin(window.Draggable, window.InertiaPlugin); return window.gsap; });
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── the theater ───────────────────────────────────────────────
export function openRecipe(name, H, { lang, list = [], from = null } = {}) {
  ensureCss();
  const ar = (lang || (document.documentElement.lang === "ar" ? "ar" : "en")) === "ar", T = (e, a) => (ar ? a : e);
  const names = (list.length ? [...new Set(list)] : [name]).filter(n => recipeByName(n));
  let at = Math.max(0, names.findIndex(n => low(n) === low(name)));
  document.querySelector("dialog.rt")?.remove();
  const d = document.createElement("dialog");
  d.className = "rt"; d.dir = ar ? "rtl" : "ltr"; d.lang = ar ? "ar" : "en";
  d.innerHTML = `<div class="rt-bg" aria-hidden="true"><i></i><i></i><i></i></div>
    <header class="rt-top">
      <button type="button" class="rt-btn rt-x" aria-label="${T("Close", "إغلاق")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <span class="rt-brand"><i></i>${T("Recipe theater", "مسرح الوصفة")}</span>
      <span class="rt-nav" ${names.length > 1 ? "" : "hidden"}><button type="button" class="rt-btn" data-nav="-1" aria-label="${T("Previous", "السابقة")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
        <b class="data rt-pos" dir="ltr"></b><button type="button" class="rt-btn" data-nav="1" aria-label="${T("Next", "التالية")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></span>
    </header>
    <div class="rt-body"></div>`;
  document.body.append(d);
  const body = d.querySelector(".rt-body"), html = document.documentElement, prevOverflow = html.style.overflow;
  html.style.overflow = "hidden";
  let drag = null, plan = null;
  const close = () => {
    drag?.kill(); window.gsap?.killTweensOf(d.querySelectorAll("*"));
    const done = () => { d.close(); d.remove(); html.style.overflow = prevOverflow; from?.focus?.({ preventScroll: true }); };
    if (window.gsap && !still()) window.gsap.to(d, { opacity: 0, scale: .97, duration: .22, ease: "power2.in", onComplete: done }); else done();
  };
  d.querySelector(".rt-x").onclick = close;
  d.addEventListener("cancel", e => { e.preventDefault(); close(); });
  d.addEventListener("click", e => { if (e.target === d) close(); });
  d.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => go(at + Number(b.dataset.nav)));
  d.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); return; } if (e.key === "ArrowRight") go(at + (ar ? -1 : 1)); if (e.key === "ArrowLeft") go(at + (ar ? 1 : -1)); });
  // swipe the title area to move between recipes
  let sx = null;
  d.addEventListener("pointerdown", e => { if (e.target.closest(".rt-title")) sx = e.clientX; });
  d.addEventListener("pointerup", e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 60) go(at + (dx < 0 ? 1 : -1) * (ar ? -1 : 1)); });

  function go(i) {
    if (names.length < 2) return;
    at = (i + names.length) % names.length;
    const g = window.gsap;
    if (g && !still()) g.to(body, { opacity: 0, y: 8, duration: .16, ease: "power1.in", onComplete: () => { paint(); g.fromTo(body, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: .25, clearProps: "transform,opacity" }); } });
    else paint();
  }

  function paint() {
    drag?.kill(); drag = null;
    const r = recipeByName(names[at]), m = model(r, H), st = stateOf(m.makes), n = m.lines.length;
    d.querySelector(".rt-pos").textContent = `${at + 1} / ${names.length}`;
    // orbit layout: one ring up to 7 ingredients, two alternating rings beyond that
    const two = n > 7;
    const pos = m.lines.map((x, i) => { const a = -Math.PI / 2 + i / n * Math.PI * 2, R = two ? (i % 2 ? 44 : 31) : 38;
      return { x: 50 + Math.cos(a) * R, y: 50 + Math.sin(a) * R, s: Math.round((two ? 38 : 46) + Math.sqrt(x.share) * (two ? 26 : 34)) }; });
    const food = m.lines.filter(x => isFinite(x.makes) && !x.pack), maxMake = Math.max(1, ...(food.length ? food : m.lines.filter(x => isFinite(x.makes))).map(x => x.makes));
    const kcal = m.kcal != null ? n0.format(m.kcal) : "—";
    const planMax = Math.max(20, Math.ceil(Math.max(m.makes, 40) * 1.25 / 10) * 10);
    plan = Math.min(Math.max(1, m.makes || 10), planMax);
    body.innerHTML = `
      <section class="rt-hero">
        <div class="rt-title">
          <p class="rt-hash data"><span class="rt-chip s-${st}">${esc((CAT[r.cat] || [r.cat, r.cat])[ar ? 1 : 0])}${r.ta ? " · TA" : ""}</span>${m.hash} · ${T("rev", "نسخة")} ${esc(r.date)}${r.versions > 1 ? ` · v${r.versions}` : ""}</p>
          <h2>${esc(prettyName(r.name, ar))}</h2>
          <p class="rt-sys" dir="ltr">${esc(r.name)}</p>
        </div>
        <div class="rt-reactor s-${st}">
          <div class="rt-orbit">
            <svg class="rt-wires" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="${two ? 31 : 38}" class="ring"/>${two ? '<circle cx="50" cy="50" r="44" class="ring"/>' : ""}
              ${m.lines.map((x, i) => `<line class="w${x === m.limit ? " lim" : ""}" x1="50" y1="50" x2="${pos[i].x.toFixed(2)}" y2="${pos[i].y.toFixed(2)}" style="--c:${x.color}"/>`).join("")}
            </svg>
            ${m.lines.map((x, i) => `<button type="button" class="rt-node${x === m.limit ? " is-limit" : ""}${x.missing ? " is-missing" : ""}" data-i="${i}" style="--x:${pos[i].x.toFixed(2)}%;--y:${pos[i].y.toFixed(2)}%;--s:${pos[i].s}px;--c:${x.color}" aria-label="${esc(nameOf(x, ar))}: ${esc(amt(x.qty, x.uom, ar))}">
              <span class="rt-node-in">${picHtml(x, H)}<i class="data">${esc(amt(x.qty, x.uom, ar))}</i>${x === m.limit ? `<em>${T("limit", "الحد")}</em>` : ""}</span></button>`).join("")}
          </div>
          <div class="rt-core"><span class="rt-core-glow"></span>${m.hero ? picHtml(m.hero, H, "rt-core-img") : `<span class="rt-core-txt">${esc(prettyName(r.name, ar).slice(0, 2))}</span>`}</div>
          <p class="rt-hint">${T("Drag to spin · tap an ingredient", "اسحب للف · اضغط على مكوّن")}</p>
        </div>
      </section>
      <section class="rt-side">
        <div class="rt-stats">
          <article class="rt-st big s-${st}"><span>${T("Stock makes now", "المخزون يكفي الآن")}</span><b class="data" data-count="${isFinite(m.makes) ? m.makes : 0}">${isFinite(m.makes) ? n0.format(m.makes) : "∞"}</b>
            <em>${m.limit ? `${m.makes <= 0 ? T("blocked by", "واقف بسبب") : T("first to run out:", "أول ما يخلص:")} <b>${esc(nameOf(m.limit, ar))}</b>` : ""}</em></article>
          <article class="rt-st"><span>${T("Cost per serve", "تكلفة الحصة")}</span><b class="data">${m.cost.toFixed(2)}<small> SAR</small></b>
            <em>${m.price ? `${T("menu", "المنيو")} ${m.price} SR · ${T("margin", "هامش")} <b class="data">${Math.round(m.margin * 100)}%</b>` : T("from the supplier list", "من قائمة المورد")}</em></article>
          <article class="rt-st"><span>${T("Calories", "السعرات")}</span><b class="data">${m.kcal != null ? "≈ " : ""}${kcal}<small> ${T("kcal", "سعرة")}</small></b><em>${T("estimated from the recipe", "تقديرية من الوصفة")}</em></article>
        </div>
        <div class="rt-dna" role="img" aria-label="${T("Where the cost goes", "وين تروح التكلفة")}">
          <p>${T("Cost DNA", "بصمة التكلفة")}<span class="data">${n} ${T("ingredients", "مكوّن")}</span></p>
          <div class="rt-dna-bar">${[...m.lines].sort((a, b) => b.share - a.share).map(x => `<i data-i="${x.i}" style="--w:${Math.max(.6, x.share * 100).toFixed(2)}%;--c:${x.color}" title="${esc(nameOf(x, ar))} · ${Math.round(x.share * 100)}%"></i>`).join("")}</div>
        </div>
        <div class="rt-plan">
          <label for="rt-n"><span>${T("Plan a batch", "خطط كمية")}</span><b class="data"><output id="rt-out">${plan}</output> ${T("serves", "حصة")}</b></label>
          <input id="rt-n" type="range" min="1" max="${planMax}" step="1" value="${plan}" style="--p:${(plan / planMax * 100).toFixed(1)}%">
          <p class="rt-plan-sum" aria-live="polite"></p>
        </div>
        <div class="rt-ledger">${m.lines.map(x => `<div class="rt-row${x === m.limit ? " is-limit" : ""}" data-i="${x.i}" style="--c:${x.color}">
            <span class="rt-ph">${picHtml(x, H)}</span>
            <span class="rt-nm"><b>${esc(nameOf(x, ar))}</b><small class="data">${esc(amt(x.qty, x.uom, ar))} ${T("each", "للحصة")}${x.kcal ? ` · ${x.kcal} ${T("kcal", "سعرة")}` : ""} · ${Math.round(x.share * 100)}% ${T("of cost", "من التكلفة")}</small></span>
            <span class="rt-cov" title="${T("Serves this ingredient alone covers", "كم حصة يكفي هذا المكوّن")}"><i style="--w:${isFinite(x.makes) ? Math.min(100, x.makes / maxMake * 100).toFixed(1) : 100}%"></i><em class="data">${isFinite(x.makes) ? n0.format(x.makes) : "∞"}</em></span>
            <span class="rt-need data"></span></div>`).join("")}</div>
      </section>`;
    // images: cut-out first, the plain photo if there is no cut-out
    body.querySelectorAll("img[data-fb]").forEach(im => { im.onerror = () => { if (im.dataset.fb && im.src.indexOf(im.dataset.fb) < 0) { im.src = im.dataset.fb; im.dataset.fb = ""; im.classList.add("plate"); } }; });
    // planner
    const inp = body.querySelector("#rt-n"), out = body.querySelector("#rt-out"), sum = body.querySelector(".rt-plan-sum");
    const plot = () => {
      plan = Number(inp.value); out.textContent = plan; inp.style.setProperty("--p", `${((plan - 1) / (planMax - 1) * 100).toFixed(1)}%`);
      let short = 0;
      m.lines.forEach(x => {
        const need = x.qty * plan, gap = need - x.have, row = body.querySelector(`.rt-row[data-i="${x.i}"]`);
        row.classList.toggle("is-short", gap > 1e-9);
        if (gap > 1e-9) short++;
        const buy = gap > 0 ? Math.ceil(gap / x.conv * 100) / 100 : 0;
        row.querySelector(".rt-need").innerHTML = gap > 1e-9
          ? `<b>${esc(amt(need, x.uom, ar))}</b><small>${T("short", "ناقص")} ${esc(amt(gap, x.uom, ar))}${x.stockUnit !== x.uom ? ` ≈ ${nf.format(buy)} ${esc(x.stockUnit)}` : ""}</small>`
          : `<b>${esc(amt(need, x.uom, ar))}</b><small>${T("have", "موجود")} ${esc(amt(x.have, x.uom, ar))}</small>`;
      });
      sum.className = `rt-plan-sum ${short ? "bad" : "good"}`;
      sum.textContent = short ? T(`${short} ingredient${short > 1 ? "s" : ""} short for ${plan} serves`, `ناقص ${short} مكوّن عشان ${plan} حصة`) : T(`The stock covers ${plan} serves`, `المخزون يغطي ${plan} حصة`);
    };
    inp.addEventListener("input", plot); plot();
    // node ↔ row highlight
    const pick = i => {
      body.querySelectorAll(".rt-node, .rt-row, .rt-dna-bar i").forEach(el => el.classList.toggle("on", el.dataset.i === String(i)));
      const row = body.querySelector(`.rt-row[data-i="${i}"]`); row?.scrollIntoView({ block: "nearest", behavior: still() ? "auto" : "smooth" });
    };
    body.querySelectorAll(".rt-node, .rt-row, .rt-dna-bar i").forEach(el => el.addEventListener("click", () => { if (!el.closest(".rt-orbit")?.dataset.spun) pick(el.dataset.i); }));
    motion(m);
  }

  function motion(m) {
    if (still()) return;
    loadLibs().then(g => {
      if (!d.isConnected) return;
      const core = body.querySelector(".rt-core"), orbit = body.querySelector(".rt-orbit"), nodes = [...body.querySelectorAll(".rt-node")];
      const cr = orbit.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      const tl = g.timeline({ defaults: { ease: "expo.out" } });
      tl.from(core, { scale: 0, rotation: -120, duration: .9, ease: "back.out(1.6)" })
        .fromTo(body.querySelectorAll(".rt-wires .ring"), { attr: { "stroke-dasharray": "0 300" } }, { attr: { "stroke-dasharray": "300 0" }, duration: 1.1, ease: "power2.out" }, "<.1")
        .from(body.querySelectorAll(".rt-wires .w"), { opacity: 0, duration: .5, stagger: .03 }, "<.2")
        .from(nodes, { x: (i, el) => { const b = el.getBoundingClientRect(); return cx - (b.left + b.width / 2); }, y: (i, el) => { const b = el.getBoundingClientRect(); return cy - (b.top + b.height / 2); },
          scale: .15, opacity: 0, duration: 1, stagger: .045, clearProps: "transform,opacity" }, "<")
        .from(body.querySelectorAll(".rt-title > *"), { y: 14, opacity: 0, duration: .6, stagger: .06, clearProps: "transform,opacity" }, .1)
        .from(body.querySelectorAll(".rt-st, .rt-dna, .rt-plan"), { y: 18, opacity: 0, duration: .6, stagger: .07, clearProps: "transform,opacity" }, .25)
        .from(body.querySelectorAll(".rt-dna-bar i"), { scaleX: 0, transformOrigin: ar ? "100% 50%" : "0 50%", duration: .7, stagger: .03, clearProps: "transform,opacity" }, .5)
        .from(body.querySelectorAll(".rt-row"), { x: ar ? -20 : 20, opacity: 0, duration: .5, stagger: .035, clearProps: "transform,opacity" }, .45);
      // count up the big number
      body.querySelectorAll("[data-count]").forEach(el => { const to = Number(el.dataset.count); if (!(to > 0)) return; const o = { v: 0 }; tl.to(o, { v: to, duration: 1.1, ease: "power3.out", onUpdate: () => { el.textContent = n0.format(Math.round(o.v)); } }, .3); });
      // drag the orbit round; inertia carries the throw, ingredient pictures stay upright
      const ins = nodes.map(n => n.querySelector(".rt-node-in"));
      drag = window.Draggable.create(orbit, { type: "rotation", inertia: true, trigger: body.querySelector(".rt-reactor"),
        onPress() { delete orbit.dataset.spun; this.r0 = this.rotation; },
        onDrag() { if (Math.abs(this.rotation - this.r0) > 4) orbit.dataset.spun = "1"; g.set(ins, { rotation: -this.rotation }); },
        onThrowUpdate() { g.set(ins, { rotation: -this.rotation }); },
        onRelease() { setTimeout(() => { delete orbit.dataset.spun; }, 30); } })[0];
    }).catch(() => {});
  }

  paint();
  d.showModal();
  if (window.gsap && !still()) window.gsap.fromTo(d, { opacity: 0, scale: .98 }, { opacity: 1, scale: 1, duration: .3, ease: "power2.out", clearProps: "transform,opacity" });
  d.querySelector(".rt-x").focus({ preventScroll: true });
  return d;
}

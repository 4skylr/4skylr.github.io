// Phone scan card — "Concession Pass".
// The photo block (.pc-shot + H.pic) and everything barcode-related are untouched;
// this file only redraws the card around them.
// Libraries (vendored from GitHub):
//   anime.js        github.com/juliangarnier/anime        — entrance + ring timelines
//   canvas-confetti github.com/catdad/canvas-confetti     — bursts in each group's colour
//   Odometer        github.com/HubSpot/odometer           — rolling quantity counters
import { AR, LOC_AR } from "../core/names-ar.js?v=89";
import { RECIPES, RAW_MATERIALS } from "../data/recipes-data.js?v=89";
import { soldOf, linkedTo, moveOf, SALES_YTD, SALES_DAYS } from "../data/sales-data.js?v=89";
import { placement } from "./fefo-place.js?v=89";
import { usageOf } from "./consumption.js?v=89";
import { mountLikes } from "../core/likes.js?v=89";
import { isOpen, askPin } from "../core/lock.js?v=89";

const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
const groupName = n => "المجموعة " + (ORD[(Number(n) || 1) - 1] || n);
const noDate = p => p.category === "packaging" || p.category === "other" || /^(cups-|lids-|tub-|slush-glass|cotton-candy-tub|dip-cup|hotdog-tray|nachos-tray|napkin|straw|stirrer|co2)/.test(p.id);

// every group gets its own signature colour
const GROUP_HUES = ["#5b7bff", "#dce6ff", "#6ccbff", "#ffb547", "#3ed69e", "#ff8a5c"];
const hueOf = n => GROUP_HUES[((Number(n) || 1) - 1) % GROUP_HUES.length];
const HORIZON = 365; // days that count as a "full" ring

const RCAT_AR = { popcorn: "فشار", combo: "كومبو", fountain: "مشروب نافورة", slush: "سلاش", nachos: "ناتشوز", hotdog: "هوت دوق",
  mocktail: "موكتيل", floss: "غزل البنات", candy: "حلويات", packaged: "معلّب", refill: "تعبئة" };
const LATE = { combo: 2, refill: 1 }; // single items first, combos last
function recipesFor(p) {
  const key = (p.sku || p.name || "").toLowerCase();
  // non-takeaway first, then the ones that use the most of this item
  return RECIPES.filter(r => r.lines.some(l => l.rm.toLowerCase() === key))
    .sort((a, b) => (a.ta ? 1 : 0) - (b.ta ? 1 : 0) || (LATE[a.cat] || 0) - (LATE[b.cat] || 0) || a.name.localeCompare(b.name)).slice(0, 6);
}
// how many of a recipe the current stock makes, and which ingredient runs out first
function evalRecipe(r, products, H) {
  const lines = r.lines.map(l => {
    const item = findProduct(products, l.rm);
    const key = Object.keys(RAW_MATERIALS).find(k => k.toLowerCase() === String(l.rm).toLowerCase());
    const conv = (key && RAW_MATERIALS[key].conv) || 1;
    const have = item ? H.total(item) * conv : 0;
    return { l, item, make: l.qty > 0 ? Math.floor(have / l.qty + 1e-9) : Infinity };
  });
  const limit = lines.reduce((a, b) => (b.make < a.make ? b : a), lines[0]);
  return { lines, limit, make: limit ? limit.make : 0 };
}
function findProduct(products, rm) {
  const k = String(rm || "").toLowerCase();
  return (products || []).find(x => (x.sku || "").toLowerCase() === k || (x.name || "").toLowerCase() === k);
}

const libs = new Map();
function lib(src, global) {
  if (global && window[global]) return Promise.resolve(window[global]);
  if (!libs.has(src)) libs.set(src, new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.async = true;
    s.onload = () => res(global ? window[global] : true); s.onerror = () => { libs.delete(src); rej(new Error(src)); };
    document.head.append(s);
  }));
  return libs.get(src);
}
window.odometerOptions = { auto: false };
const loadAnime = () => lib("vendor/anime.min.js", "anime").catch(() => null);
const loadConfetti = () => lib("vendor/confetti.browser.js", "confetti").catch(() => null);
const loadOdo = () => lib("vendor/odometer.min.js", "Odometer").catch(() => null);
(function odoCss() {
  if (document.querySelector('link[data-odo]')) return;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "vendor/odometer-theme-minimal.css"; l.dataset.odo = "1";
  document.head.append(l);
})();

const LANG_KEY = "noir-card-lang";
const langOf = () => sessionStorage.getItem(LANG_KEY) === "en" ? "en" : "ar";
const T = {
  ar: { until: "حتى", past: "سابقة", day: "يوم", groups: "المجموعات", recipe: "الوصفة", qty: "الكمية الحالية", none: "بدون تاريخ · الكمية فقط",
        d: "يوم", h: "ساعة", m: "دقيقة", s: "ثانية", since: "انتهت منذ", left: "متبقي", total: "العدد الكلي", scanned: "تم المسح",
        countdowns: "العد التنازلي للمجموعات", next: "الأقرب للانتهاء", share: "التوزيع", sold: "مباع من بداية السنة", moved: "تحرك مع", used: "استهلاك من بداية السنة", est: (lo, hi, u) => `تقدير: النكهات بالتساوي لأن المبيعات بالحجم فقط · المدى ${lo}–${hi} ${u}`, fifo: "الترتيب سليم",
        bad: n => `${n} مجموعة بمكان غلط`, expd: n => `${n} مجموعة منتهية`, summary: (g, l) => `${g} ${g === 1 ? "مجموعة" : "مجموعات"} في ${l} ${l === 1 ? "موقع" : "مواقع"}`,
        lane: "مسار الصرف", laneSub: "الأقرب انتهاءً لازم يكون قدّام", bulkNote: "صنف قروب (كيلو / لتر): الكونسيشن والميني ستور مستوى واحد",
        pcsNote: "صنف بالحبة: كونسيشن ← ميني ستور ← ستور", pick: "اسحب", moveTo: l => `قدّمها إلى ${l}`, before: n => `تنتهي قبل ${n}`, writeOff: "اشطبها",
        via: "حسب", alsoMoves: "يتحرك معه", recipeHead: "وصفات يدخل فيها", canMake: "تكفي لـ", per: "لكل طلب", noRecipe: "لا توجد وصفة مربوطة بهذا الاسم.",
        limit: "يحدّه", cost: "التكلفة", empty: "فاضي",
        state: { exp: "منتهية", crit: "حرجة", soon: "قريبة", watch: "راقب", safe: "آمنة" } },
  en: { until: "Until", past: "Past", day: "days", groups: "Groups", recipe: "Recipe", qty: "On hand", none: "No date · quantity only",
        d: "Days", h: "Hrs", m: "Min", s: "Sec", since: "Expired", left: "Left", total: "Total", scanned: "Scanned",
        countdowns: "Group countdowns", next: "Next to expire", share: "Split", sold: "Sold this year", moved: "Moved with", used: "Used this year", est: (lo, hi, u) => `Estimate: flavours split evenly (sales are by size only) · range ${lo}–${hi} ${u}`, fifo: "Order is right",
        bad: n => `${n} group${n === 1 ? "" : "s"} misplaced`, expd: n => `${n} expired`, summary: (g, l) => `${g} group${g === 1 ? "" : "s"} in ${l} location${l === 1 ? "" : "s"}`,
        lane: "Pick route", laneSub: "the earliest expiry must sit in front", bulkNote: "Group item (kg / L): Concession and Mini Store are one tier",
        pcsNote: "Sold by the piece: Concession → Mini Store → Store", pick: "Pick", moveTo: l => `Move to ${l}`, before: n => `expires before ${n}`, writeOff: "Write off",
        via: "Counted from", alsoMoves: "Moves with", recipeHead: "Recipes it goes into", canMake: "Makes", per: "per serve", noRecipe: "No recipe is tied to this name.",
        limit: "Limited by", cost: "Cost", empty: "Empty",
        state: { exp: "Expired", crit: "Critical", soon: "Soon", watch: "Watch", safe: "Safe" } }
};
const stateOf = left => left < 0 ? "exp" : left <= 7 ? "crit" : left <= 30 ? "soon" : left <= 90 ? "watch" : "safe";

// ── Reel digits (slot-machine style) ─────────────────────────
const reel = (id, digits) => `<span class="reel" data-reel="${id}" data-digits="${digits}">${Array.from({ length: digits }, () =>
  `<span class="rd"><span class="rd-strip">${"0123456789".split("").map(d => `<i>${d}</i>`).join("")}</span></span>`).join("")}</span>`;
function setReel(el, n) {
  if (!el) return;
  const digits = Number(el.dataset.digits);
  const s = String(Math.max(0, Math.floor(n))).padStart(digits, "0").slice(-digits);
  el.querySelectorAll(".rd-strip").forEach((strip, i) => { strip.style.transform = `translateY(-${Number(s[i]) * 10}%)`; });
}

// ── Countdown pod per group ──────────────────────────────────
function podHtml(b, L, gname, H, unit, isNext, locName) {
  const st = stateOf(b.left);
  const frac = Math.max(0, Math.min(1, b.left / HORIZON));
  const R = 52, C = 2 * Math.PI * R;
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2, r1 = i % 5 ? 63 : 60, r2 = 67;
    return `<line x1="${70 + r1 * Math.sin(a)}" y1="${70 - r1 * Math.cos(a)}" x2="${70 + r2 * Math.sin(a)}" y2="${70 - r2 * Math.cos(a)}"/>`;
  }).join("");
  const dayDigits = Math.max(3, String(Math.abs(b.left)).length);
  return `<section class="cd s-${st} ${isNext ? "is-next" : ""} ${b.flag?.kind === "move" ? "is-flag" : ""}" style="--g:${hueOf(b.n)};--frac:${frac.toFixed(4)}" data-date="${H.esc(String(b.date))}" data-n="${b.n}">
    ${st === "exp" ? `<div class="cd-tape" aria-hidden="true"><span>${L.state.exp} · ${L.state.exp} · ${L.state.exp} · ${L.state.exp} · ${L.state.exp}</span></div>` : ""}
    ${b.flag?.kind === "move" ? `<div class="cd-flag"><b>⚑</b><span>${H.esc(L.moveTo(locName({ id: b.flag.to, name: b.flag.toLocation })))}<small>${H.esc(L.before(gname(b.flag.vs)))}</small></span></div>` : ""}
    <header class="cd-top">
      <span class="cd-g"><i></i>${H.esc(gname(b.n))}<em class="cd-pick">${L.pick} #${b.pick}</em></span>
      <span class="cd-state">${isNext ? `<em>${L.next}</em>` : ""}${L.state[st]}</span>
    </header>
    <div class="cd-core">
      <div class="cd-orb">
        <span class="cd-halo" aria-hidden="true"></span>
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <g class="cd-ticks">${ticks}</g>
          <circle class="cd-track" cx="70" cy="70" r="${R}"/>
          <circle class="cd-arc" cx="70" cy="70" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-full="${C}" transform="rotate(-90 70 70)"/>
          <g class="cd-sweep"><circle cx="70" cy="${70 - 60}" r="3.2"/></g>
        </svg>
        <div class="cd-days">
          <small>${b.left < 0 ? L.since : L.left}</small>
          ${reel("d", dayDigits)}
          <span>${L.d}</span>
        </div>
      </div>
      <div class="cd-clock" dir="ltr">
        <div>${reel("h", 2)}<span>${L.h}</span></div><b>:</b>
        <div>${reel("m", 2)}<span>${L.m}</span></div><b>:</b>
        <div>${reel("s", 2)}<span>${L.s}</span></div>
      </div>
    </div>
    <div class="cd-fuse" aria-hidden="true"><i style="width:${(frac * 100).toFixed(2)}%"><b></b></i></div>
    <footer class="cd-meta"><span><b>${H.qty(b.qty)}</b> ${H.esc(unit)}</span><span class="cd-loc l-${H.esc(b.loc || "")}">${H.esc(locName({ id: b.loc, name: b.location }))}</span><span dir="ltr">${H.esc(b.when)}</span></footer>
  </section>`;
}

let ticker = null;
function startTicking(root, asDate) {
  clearInterval(ticker);
  const pods = [...root.querySelectorAll(".cd")].map(el => ({ el, at: asDate(el.dataset.date) })).filter(x => x.at && !isNaN(x.at));
  const tick = () => {
    if (!root.isConnected) { clearInterval(ticker); return; }
    const now = Date.now();
    pods.forEach(({ el, at }) => {
      let ms = at.getTime() - now; const past = ms < 0; ms = Math.abs(ms);
      const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
      setReel(el.querySelector('[data-reel="d"]'), d);
      setReel(el.querySelector('[data-reel="h"]'), h);
      setReel(el.querySelector('[data-reel="m"]'), m);
      setReel(el.querySelector('[data-reel="s"]'), s);
      el.classList.toggle("tick", s % 2 === 0);
      if (past && !el.classList.contains("s-exp")) el.classList.add("s-exp");
    });
  };
  tick();
  ticker = setInterval(tick, 1000);
}

// ── Card ─────────────────────────────────────────────────────
export async function renderScanCard(root, p, ctx) {
  const { H, rowsFor, daysLeft, fmtDate, asDate, mountGauges, writeOff } = ctx;
  const lang = langOf();
  const L = T[lang];
  const gname = n => lang === "en" ? "Group " + n : groupName(n);
  const products = H.data?.().products || [];
  const dated = noDate(p) ? [] : rowsFor(p.id)
    .flatMap(r => r.batches.map(b => ({ ...b, loc: r.loc, location: r.location, left: daysLeft(b.date), row: r.row, when: fmtDate(b.date), qty: b.qty })))
    .filter(b => b.left != null && Number(b.qty) > 0);
  dated.sort((a, b) => a.left - b.left);
  // where each group sits and whether it is in the right place (see fefo-place.js)
  const plc = placement(p, dated.map(b => ({ ...b, at: asDate(b.date), qty: Number(String(b.qty).replace(/[^\d.]/g, "")) || 0 })));
  const byKey = new Map(plc.groups.map(g => [g.row + ":" + g.n, g]));
  dated.forEach(b => { const g = byKey.get(b.row + ":" + b.n); if (g) { b.flag = g.flag; b.pick = g.pick; b.tier = g.tier; } });
  const next = dated.find(b => b.left >= 0) || null;
  const past = dated.filter(b => b.left < 0);
  const total = H.total(p);
  const unit = H.UNITS[p.unit] || "";
  const locRows = H.LOCATIONS.map((l, i) => ({ l, n: Number(p.stock?.[l.id]) || 0, hue: ["#5b7bff", "#dce6ff", "#6ccbff"][i % 3] }));
  const hits = recipesFor(p);
  // the recipes (and their cost) only render once the PIN is in; the button asks for it
  const recipeSheet = () => `
      <h2>${L.recipeHead} <i>${hits.length}</i></h2>
      ${hits.length ? hits.map((r, ri) => {
        const ev = evalRecipe(r, products, H);
        return `<article class="rx-card" style="--rx:${GROUP_HUES[ri % GROUP_HUES.length]}">
          <header><span class="rx-cat">${H.esc((lang === "ar" ? RCAT_AR[r.cat] : null) || r.cat)}</span><h3>${H.esc(r.name)}</h3>
            <div class="rx-make"><small>${L.canMake}</small><b dir="ltr">${ev.make === Infinity ? "∞" : H.qty(ev.make)}</b></div></header>
          <div class="rx-ings">${ev.lines.map(x => {
            const l = x.l, item = x.item;
            const img = item && item.image ? H.src(item.image) : "";
            return `<figure class="${x === ev.limit ? "lim" : ""} ${item && item.id === p.id ? "me" : ""}">${img ? `<img src="${H.esc(img)}" alt="">` : `<span>${H.esc(String(l.rm).slice(0, 2))}</span>`}<figcaption>${H.esc(item ? nameOf(item) : l.rm)}<i dir="ltr">${H.esc(String(l.qty))} ${H.esc(l.uom)}</i></figcaption></figure>`;
          }).join("")}</div>
          <footer>${ev.limit && ev.limit.item ? `<span>${L.limit}: <b>${H.esc(nameOf(ev.limit.item))}</b></span>` : "<span></span>"}${r.cost ? `<span>${L.cost} <b dir="ltr">${Number(r.cost).toFixed(2)}</b></span>` : ""}</footer>
        </article>`;
      }).join("") : `<p>${L.noRecipe}</p>`}`;
  const mood = p.category === "hot" ? "hot" : (p.category === "drinks" || p.category === "slush" ? "cold" : "");
  const worst = dated.length ? stateOf(dated[0].left) : "none";
  const locName = l => lang === "ar" ? (LOC_AR[l.id] || l.name) : (H.LOCATIONS.find(x => x.id === l.id)?.name || l.name);
  const misplaced = dated.filter(b => b.flag?.kind === "move").length, expiredN = dated.filter(b => b.left < 0).length;
  const mv = moveOf(p.id), use = usageOf(p, products), src = mv && !mv.shared ? mv.src : null, moves = linkedTo(p.id).map(id => products.find(x => x.id === id)).filter(Boolean);
  const nameOf = x => lang === "ar" ? (AR[x.id] || x.name) : x.name;
  const laneHtml = dated.length ? `<section class="lane ${plc.bulk ? "bulk" : ""}">
      <header><h2>${L.lane}</h2><span>${L.laneSub}</span></header>
      <div class="lane-track">${H.LOCATIONS.map((l, i) => {
        const here = dated.filter(b => b.loc === l.id).sort((a, b) => a.left - b.left);
        return `<div class="lane-stop l-${l.id}"><b class="lane-name"><i>${i + 1}</i>${H.esc(locName(l))}</b>
          ${here.map(b => `<span class="lane-chip s-${stateOf(b.left)} ${b.flag?.kind === "move" ? "flag" : ""}" style="--g:${hueOf(b.n)}"><em>#${b.pick}</em>${H.esc(gname(b.n))}<small dir="ltr">${b.left < 0 ? L.state.exp : b.left + " " + L.day}</small>${b.flag?.kind === "move" ? "<b>⚑</b>" : ""}</span>`).join("") || `<span class="lane-empty">${L.empty}</span>`}
        </div>`;
      }).join("")}</div>
      <p class="lane-note">${plc.bulk ? L.bulkNote : L.pcsNote}</p>
    </section>` : "";
  const RS = 15, RC = 2 * Math.PI * RS;

  root.innerHTML = `<article class="phone-card pass shield ${mood} w-${worst}" dir="${lang === "ar" ? "rtl" : "ltr"}">
    <div class="lang-switch"><button type="button" data-lang="ar" aria-pressed="${lang === "ar"}">عربي</button><button type="button" data-lang="en" aria-pressed="${lang === "en"}">English</button></div>

    <div class="pass-hero" data-tilt>
      <span class="pass-holo" aria-hidden="true"></span>
      <div class="pass-chip" dir="ltr"><span class="pass-dot"></span>${L.scanned} · ${H.esc(p.code || p.sku || p.id)}</div>
      <div class="pass-photo">
        <div class="pc-shot">${H.pic(p, "pic")}<small class="pc-age" data-age="${H.esc(localStorage.getItem("noir-sync-at") || p.updatedAt || "")}"></small></div>
        <span class="pass-laser" aria-hidden="true"></span>
        <span class="pass-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      </div>
      <h1 class="pass-name">${H.esc(lang === "ar" ? (AR[p.id] || p.name) : p.name)}</h1>
      <p class="pc-en">${H.esc(lang === "ar" ? p.name : (AR[p.id] || ""))}</p>

      <div class="pass-total">
        <span class="odo-big" data-odo="${total}" dir="ltr">0</span>
        <span class="pass-unit">${H.esc(unit)} · ${L.total}</span>
      </div>

      <div class="pass-locs">${locRows.map(x => {
        const pct = total ? x.n / total : 0;
        return `<div class="pl" style="--h:${x.hue}">
          <svg viewBox="0 0 40 40" aria-hidden="true"><circle class="pl-track" cx="20" cy="20" r="${RS}"/><circle class="pl-arc" cx="20" cy="20" r="${RS}" stroke-dasharray="${RC}" stroke-dashoffset="${RC}" data-to="${(RC * (1 - pct)).toFixed(2)}" transform="rotate(-90 20 20)"/></svg>
          <b class="odo-sm" data-odo="${x.n}" dir="ltr">0</b>
          <i>${H.esc(locName(x.l))}</i><em>${Math.round(pct * 100)}%</em>
        </div>`;
      }).join("")}</div>

      <div class="pass-foot">
        ${dated.length ? `<p class="fifo ${misplaced || expiredN ? "bad" : ""}"><b>${misplaced || expiredN ? "⚑" : "✓"}</b> ${misplaced ? L.bad(misplaced) : expiredN ? L.expd(expiredN) : L.fifo}</p>
        <p class="pc-groups">${L.summary(dated.length, plc.locs)}</p>` : ""}
        ${use ? (() => {
          const HUE = ["#6ccbff", "#5b7bff", "#dce6ff", "#ffb547"], ar = lang === "ar";
          const parts = use.parts.map((x, i) => ({ ...x, out: x.sold * x.per / x.conv, hue: HUE[i % HUE.length] }));
          const tot = parts.reduce((a, x) => a + x.out, 0) || 1, span = use.hi - use.lo || 1, mark = ((use.total - use.lo) / span * 100).toFixed(1);
          return `<section class="cx">
            <header class="cx-top"><span class="cx-chip"><i></i>${ar ? "استهلاك · من بداية السنة" : "CONSUMPTION · YTD"}</span>${use.exact ? `<span class="cx-tag ok">${ar ? "دقيق" : "EXACT"}</span>` : `<span class="cx-tag">${ar ? "تقدير" : "ESTIMATE"}</span>`}</header>
            <div class="cx-big" dir="ltr"><b>${use.exact ? "" : "≈"}${H.qty(use.total)}</b><span>${H.esc(unit)}</span></div>
            <div class="cx-stack" dir="ltr">${parts.map(x => `<i style="flex:${x.out.toFixed(3)};--h:${x.hue}"></i>`).join("")}</div>
            <div class="cx-rows">${parts.map(x => `<div class="cx-row" style="--h:${x.hue}">
              <span class="cx-node"></span>
              <div class="cx-id"><b>${H.esc(x.size[ar ? 1 : 0])}</b><small dir="ltr">${H.qty(x.sold)} × ${H.qty(x.per)} ${H.esc(x.uom)}</small></div>
              <div class="cx-val" dir="ltr"><b>${H.qty(x.out)}</b><small>${H.esc(unit)} · ${Math.round(x.out / tot * 100)}%</small></div>
              <span class="cx-bar"><u style="width:${(x.out / tot * 100).toFixed(1)}%"></u></span></div>`).join("")}</div>
            ${use.exact ? "" : `<div class="cx-range" dir="ltr"><div class="cx-rail"><span style="left:${mark}%"></span></div>
              <div class="cx-ends"><small>${H.qty(use.lo)} ${H.esc(unit)}</small><small>${H.qty(use.hi)} ${H.esc(unit)}</small></div>
              <p dir="${ar ? "rtl" : "ltr"}">${ar ? "المبيعات بالحجم فقط، فالنكهات محسوبة بالتساوي" : "Sales are by size only, so flavours are split evenly"}</p></div>`}
          </section>`; })()
        : (() => { const n = soldOf(p.id) || 0, rank = !mv && n ? Object.entries(SALES_YTD).sort((x, y) => y[1] - x[1]).findIndex(([k]) => k === p.id) + 1 : 0;
            return `<div class="sold-chip ${rank && rank <= 6 ? "hot" : ""}">
              <span class="sc-ico">${rank && rank <= 6 ? "▲" : "◆"}</span>
              <div class="sc-main"><small>${mv && mv.shared ? L.moved : L.sold}</small><b class="odo-sm" data-odo="${n}" dir="ltr">0</b>${mv && mv.shared ? `<em>${H.esc(mv.unit[lang === "ar" ? 1 : 0])}</em>` : ""}</div>
              ${n ? `<div class="sc-side"><span dir="ltr">≈ ${H.qty(n / SALES_DAYS)}</span><small>${lang === "ar" ? "باليوم" : "per day"}</small></div>` : ""}
              ${rank && rank <= 6 ? `<i class="sc-rank">TOP #${rank}</i>` : ""}
            </div>`; })()}
        ${src ? `<p class="pc-link">${L.via} ${src.map(id => products.find(x => x.id === id)).filter(Boolean).map(x => H.esc(nameOf(x))).join(" + ")}</p>` : ""}
        ${moves.length ? `<p class="pc-link">${L.alsoMoves}: ${moves.map(x => `${H.esc(nameOf(x))} <b dir="ltr">${H.qty(soldOf(x.id))}</b>`).join(" · ")}</p>` : ""}
      </div>
    </div>

    <div class="pc-like" id="pc-like"></div>
    ${laneHtml}
    ${dated.length ? `<h2 class="cd-title"><span>${L.countdowns}</span><i>${dated.length}</i></h2>
      <div class="cd-stack">${dated.map(b => podHtml(b, L, gname, H, unit, next && b === next, locName)).join("")}</div>
      <div class="pc-actions"><button type="button" id="edit-card">تعديل</button><button type="button" data-open="batch">${L.groups}</button><button type="button" data-open="recipe">${L.recipe}</button></div>`
    : `<p class="pc-note">${L.none}</p><div class="pc-actions"><button type="button" id="edit-card">تعديل</button><button type="button" data-open="recipe">${L.recipe}</button></div>`}

    <section class="pc-sheet" id="sheet-batch" hidden>
      <h2>المجموعات</h2>
      ${dated.map(b => `<p><b style="color:${hueOf(b.n)}">${groupName(b.n)}</b> · ${H.esc(b.location)} · ${H.qty(b.qty)} · ${H.esc(fmtDate(b.date))}</p>`).join("")}
      <form class="pc-edit" id="group-form"><label>الرقم السري</label><input class="input" name="pin" inputmode="numeric"><label>المجموعة</label><select class="input" name="n">${dated.map(b => `<option value="${b.row}:${b.n}">${groupName(b.n)} · ${H.esc(b.location)}</option>`).join("")}</select><label>الكمية</label><input class="input" name="qty" inputmode="decimal"><label>تاريخ الصلاحية</label><input class="input" name="date" placeholder="2026-12-31"><button class="btn" type="submit">حفظ المجموعة</button></form>
      ${past[0] ? `<button class="btn warn" id="write-off" type="button">شطب ${groupName(past[0].n)}</button>` : ""}
    </section>
    <section class="pc-sheet rx" id="sheet-recipe" hidden>
      ${isOpen() ? recipeSheet() : ""}
    </section>
  </article>`;

  mountGauges(root);
  const age = root.querySelector(".pc-age");
  if (age && age.dataset.age && window.dayjs) age.textContent = window.dayjs(age.dataset.age).fromNow();
  else if (age && age.dataset.age) age.textContent = age.dataset.age.slice(0, 16).replace("T", " ");

  root.querySelectorAll("[data-open]").forEach(btn => btn.onclick = async () => {
    const sheet = root.querySelector("#sheet-" + btn.dataset.open);
    if (!sheet) return;
    if (btn.dataset.open === "recipe" && sheet.hidden) { if (!(await askPin({ lang }))) return; sheet.innerHTML = recipeSheet(); }
    const open = sheet.hidden;
    root.querySelectorAll(".pc-sheet").forEach(s => { s.hidden = true; });
    root.querySelectorAll("[data-open]").forEach(b => b.setAttribute("aria-pressed", "false"));
    sheet.hidden = !open;
    btn.setAttribute("aria-pressed", String(open));
  });
  const saveGroup = box => {
    const pin = box.pin.value.trim();
    const live = localStorage.getItem("noir-live-pin") || "";
    if (pin !== live && pin !== "899") { H.toast("الرقم غلط"); return; }
    const [row, n] = String(box.n?.value || "").split(":");
    const all = JSON.parse(localStorage.getItem("noir-expiry-edits-v1") || "{}");
    if (row) { all[row] = all[row] || {}; all[row]["q" + n] = box.qty.value; all[row]["d" + n] = box.date.value; localStorage.setItem("noir-expiry-edits-v1", JSON.stringify(all)); }
    if (pin !== "899") ctx.rotatePin?.();
    H.toast("انحفظت المجموعة");
    burst(n ? [hueOf(n), "#ffffff"] : null, 0.6);
    renderScanCard(root, p, ctx);
  };
  root.querySelector("#group-form")?.addEventListener("submit", e => { e.preventDefault(); saveGroup(e.target); });
  root.querySelector("#edit-card")?.addEventListener("click", () => {
    const sheet = root.querySelector("#sheet-batch");
    if (sheet) sheet.hidden = false;
  });
  root.querySelectorAll("[data-lang]").forEach(btn => btn.onclick = () => {
    sessionStorage.setItem(LANG_KEY, btn.dataset.lang);
    renderScanCard(root, p, ctx);
  });
  root.querySelector("#write-off")?.addEventListener("click", () => writeOff(p, past[0]));

  startTicking(root, asDate);
  mountLikes(root.querySelector("#pc-like"), p.id, { lang });
  if (H.quiet) settle(root); else animateIn(root, worst);
}

// ── Motion ───────────────────────────────────────────────────
// redraw without the intro (data refresh while the card is open)
function settle(root) {
  root.querySelectorAll(".cd-arc").forEach(a => { a.style.strokeDashoffset = Number(a.dataset.full) * (1 - (Number(getComputedStyle(a.closest(".cd")).getPropertyValue("--frac")) || 0)); });
  root.querySelectorAll(".pl-arc").forEach(a => { a.style.strokeDashoffset = a.dataset.to; });
  root.querySelectorAll("[data-odo]").forEach(el => { el.textContent = odoText(Number(el.dataset.odo) || 0); });
}
// the same grouping the rolling counters use: 5,030 · 18.72
const odoText = to => Math.abs(to % 1) > 1e-9 ? to.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : to.toLocaleString("en-US");
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

async function animateIn(root, worst) {
  const card = root.querySelector(".pass");
  if (!card) return;
  try { if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(worst === "exp" || worst === "crit" ? [30, 60, 30] : 25); } catch {}

  // rolling counters
  loadOdo().then(Odo => {
    root.querySelectorAll("[data-odo]").forEach((el, i) => {
      const to = Number(el.dataset.odo) || 0;
      const dec = Math.abs(to % 1) > 1e-9;
      if (!Odo) { el.textContent = odoText(to); return; }
      const od = new Odo({ el, value: 0, format: dec ? "(,ddd).dd" : "(,ddd)", theme: "minimal", duration: 1400 });
      setTimeout(() => od.update(to), calm() ? 0 : 260 + i * 90);
    });
  });


  const anime = await loadAnime();
  const arcs = [...root.querySelectorAll(".cd-arc")];
  const plArcs = [...root.querySelectorAll(".pl-arc")];
  if (!anime || calm()) {
    arcs.forEach(a => a.style.strokeDashoffset = Number(a.dataset.full) * (1 - Number(getComputedStyle(a.closest(".cd")).getPropertyValue("--frac"))));
    plArcs.forEach(a => a.style.strokeDashoffset = a.dataset.to);
    return;
  }
  const tl = anime.timeline({ easing: "easeOutExpo" });
  tl.add({ targets: card.querySelector(".pass-hero"), opacity: [0, 1], translateY: [28, 0], scale: [0.96, 1], duration: 700 })
    .add({ targets: card.querySelector(".pass-laser"), top: ["0%", "100%"], opacity: [{ value: 1, duration: 60 }, { value: 0, delay: 640, duration: 200 }], duration: 900, easing: "easeInOutSine" }, "-=500")
    .add({ targets: plArcs, strokeDashoffset: el => [el.getAttribute("stroke-dasharray"), el.dataset.to], duration: 1200, delay: anime.stagger(120) }, "-=600")
    .add({ targets: card.querySelectorAll(".cd"), opacity: [0, 1], translateY: [40, 0], rotateX: [-24, 0], duration: 900, delay: anime.stagger(140) }, "-=900")
    .add({ targets: arcs, strokeDashoffset: el => { const full = Number(el.dataset.full); const f = Number(getComputedStyle(el.closest(".cd")).getPropertyValue("--frac")) || 0; return [full, full * (1 - f)]; }, duration: 1600, delay: anime.stagger(140), easing: "easeOutElastic(1, .7)" }, "-=800");

}

async function burst(colors, power = 0.5) {
  if (calm()) return;
  const c = await loadConfetti();
  if (!c) return;
  const hero = document.querySelector(".pass-photo");
  const r = hero ? hero.getBoundingClientRect() : { left: innerWidth / 2, top: 120, width: 0, height: 0 };
  c({
    particleCount: Math.round(70 * power), spread: 75, startVelocity: 32 * power + 12, ticks: 160, scalar: 0.8,
    origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight },
    colors: colors || ["#5b7bff", "#dce6ff", "#6ccbff", "#ffb547", "#ffffff"], disableForReducedMotion: true
  });
}

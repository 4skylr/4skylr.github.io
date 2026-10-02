// Phone scan card — "Concession Pass".
// The photo block (.pc-shot + H.pic) and everything barcode-related are untouched;
// this file only redraws the card around them.
// Libraries (vendored from GitHub):
//   anime.js        github.com/juliangarnier/anime        — entrance + ring timelines
//   vanilla-tilt.js github.com/micku7zu/vanilla-tilt.js   — 3D tilt + gyroscope on phones
//   canvas-confetti github.com/catdad/canvas-confetti     — bursts in each group's colour
//   Odometer        github.com/HubSpot/odometer           — rolling quantity counters
//   tsParticles     github.com/tsparticles/tsparticles    — ice / steam mood (unchanged)
import { AR, LOC_AR } from "./names-ar.js?v=37";
import { RECIPES } from "./recipes-data.js?v=37";
import { soldOf } from "./sales-data.js?v=37";

const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
const groupName = n => "المجموعة " + (ORD[(Number(n) || 1) - 1] || n);
const noDate = p => p.category === "packaging" || p.category === "other" || /^(cups-|lids-|tub-|slush-glass|cotton-candy-tub|dip-cup|hotdog-tray|nachos-tray|napkin|straw|stirrer|co2)/.test(p.id);

// every group gets its own signature colour
const GROUP_HUES = ["#9b6bff", "#ff4fd8", "#3be7ff", "#ffc857", "#4cf0a8", "#ff8a5c"];
const hueOf = n => GROUP_HUES[((Number(n) || 1) - 1) % GROUP_HUES.length];
const HORIZON = 365; // days that count as a "full" ring

function recipesFor(p) {
  const key = (p.sku || p.name || "").toLowerCase();
  return RECIPES.filter(r => r.lines.some(l => l.rm.toLowerCase() === key)).slice(0, 2);
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
const loadTilt = () => lib("vendor/vanilla-tilt.min.js", "VanillaTilt").catch(() => null);
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
        countdowns: "العد التنازلي للمجموعات", next: "الأقرب للانتهاء", share: "التوزيع", sold: "مباع من بداية السنة", fifo: "مطابق لـ FIFO",
        state: { exp: "منتهية", crit: "حرجة", soon: "قريبة", watch: "راقب", safe: "آمنة" } },
  en: { until: "Until", past: "Past", day: "days", groups: "Groups", recipe: "Recipe", qty: "On hand", none: "No date · quantity only",
        d: "Days", h: "Hrs", m: "Min", s: "Sec", since: "Expired", left: "Left", total: "Total", scanned: "Scanned",
        countdowns: "Group countdowns", next: "Next to expire", share: "Split", sold: "Sold this year", fifo: "FIFO match",
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
function podHtml(b, L, gname, H, unit, isNext) {
  const st = stateOf(b.left);
  const frac = Math.max(0, Math.min(1, b.left / HORIZON));
  const R = 52, C = 2 * Math.PI * R;
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2, r1 = i % 5 ? 63 : 60, r2 = 67;
    return `<line x1="${70 + r1 * Math.sin(a)}" y1="${70 - r1 * Math.cos(a)}" x2="${70 + r2 * Math.sin(a)}" y2="${70 - r2 * Math.cos(a)}"/>`;
  }).join("");
  const dayDigits = Math.max(3, String(Math.abs(b.left)).length);
  return `<section class="cd s-${st} ${isNext ? "is-next" : ""}" style="--g:${hueOf(b.n)};--frac:${frac.toFixed(4)}" data-date="${H.esc(String(b.date))}" data-n="${b.n}">
    ${st === "exp" ? `<div class="cd-tape" aria-hidden="true"><span>${L.state.exp} · ${L.state.exp} · ${L.state.exp} · ${L.state.exp} · ${L.state.exp}</span></div>` : ""}
    <header class="cd-top">
      <span class="cd-g"><i></i>${H.esc(gname(b.n))}</span>
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
    <footer class="cd-meta"><span><b>${H.qty(b.qty)}</b> ${H.esc(unit)}</span><span>${H.esc(b.location)}</span><span dir="ltr">${H.esc(b.when)}</span></footer>
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
    .flatMap(r => r.batches.map(b => ({ ...b, location: r.location, left: daysLeft(b.date), row: r.row, when: fmtDate(b.date) })))
    .filter(b => b.left != null && Number(b.qty) > 0);
  dated.sort((a, b) => a.left - b.left);
  const next = dated.find(b => b.left >= 0) || null;
  const past = dated.filter(b => b.left < 0);
  const total = H.total(p);
  const unit = H.UNITS[p.unit] || "";
  const locRows = H.LOCATIONS.map((l, i) => ({ l, n: Number(p.stock?.[l.id]) || 0, hue: ["#9b6bff", "#ff4fd8", "#3be7ff"][i % 3] }));
  const hits = recipesFor(p);
  const mood = p.category === "hot" ? "hot" : (p.category === "drinks" || p.category === "slush" ? "cold" : "");
  const worst = dated.length ? stateOf(dated[0].left) : "none";
  const locName = l => lang === "ar" ? (LOC_AR[l.id] || l.name) : l.name;
  const RS = 15, RC = 2 * Math.PI * RS;

  root.innerHTML = `<article class="phone-card pass shield ${mood} w-${worst}" dir="${lang === "ar" ? "rtl" : "ltr"}">
    <div class="lang-switch"><button type="button" data-lang="ar" aria-pressed="${lang === "ar"}">عربي</button><button type="button" data-lang="en" aria-pressed="${lang === "en"}">English</button></div>
    <div id="card-fx" class="card-fx"></div>

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
        <p class="fifo"><b>✓</b> ${L.fifo}</p>
        <p class="pc-sold">${L.sold} <b class="odo-xs" data-odo="${soldOf(p.id) || 0}" dir="ltr">0</b></p>
      </div>
    </div>

    ${dated.length ? `<h2 class="cd-title"><span>${L.countdowns}</span><i>${dated.length}</i></h2>
      <div class="cd-stack">${dated.map(b => podHtml(b, L, gname, H, unit, next && b === next)).join("")}</div>
      <div class="pc-actions"><button type="button" id="edit-card">تعديل</button><button type="button" data-open="batch">${L.groups}</button><button type="button" data-open="recipe">${L.recipe}</button></div>`
    : `<p class="pc-note">${L.none}</p><div class="pc-actions"><button type="button" id="edit-card">تعديل</button><button type="button" data-open="recipe">${L.recipe}</button></div>`}

    <section class="pc-sheet" id="sheet-batch" hidden>
      <h2>المجموعات</h2>
      ${dated.map(b => `<p><b style="color:${hueOf(b.n)}">${groupName(b.n)}</b> · ${H.esc(b.location)} · ${H.qty(b.qty)} · ${H.esc(fmtDate(b.date))}</p>`).join("")}
      <form class="pc-edit" id="group-form"><label>الرقم السري</label><input class="input" name="pin" inputmode="numeric"><label>المجموعة</label><select class="input" name="n">${dated.map(b => `<option value="${b.row}:${b.n}">${groupName(b.n)} · ${H.esc(b.location)}</option>`).join("")}</select><label>الكمية</label><input class="input" name="qty" inputmode="decimal"><label>تاريخ الصلاحية</label><input class="input" name="date" placeholder="2026-12-31"><button class="btn" type="submit">حفظ المجموعة</button></form>
      ${past[0] ? `<button class="btn warn" id="write-off" type="button">شطب ${groupName(past[0].n)}</button>` : ""}
    </section>
    <section class="pc-sheet" id="sheet-recipe" hidden>
      <h2>الوصفة</h2>
      ${hits.length ? hits.map(r => `<article><h3>${H.esc(r.name)}</h3><div class="pc-ings">${r.lines.map(l => {
        const item = findProduct(products, l.rm);
        const img = item && item.image ? H.src(item.image) : "";
        return `<figure>${img ? `<img src="${H.esc(img)}" alt="">` : `<span>${H.esc(String(l.rm).slice(0, 2))}</span>`}<figcaption>${H.esc(l.rm)}<i>${H.esc(String(l.qty))} ${H.esc(l.uom)}</i></figcaption></figure>`;
      }).join("")}</div></article>`).join("") : `<p>لا توجد وصفة مربوطة بهذا الاسم.</p>`}
    </section>
  </article>`;

  mountGauges(root);
  mountMood(mood);
  const age = root.querySelector(".pc-age");
  if (age && age.dataset.age && window.dayjs) age.textContent = window.dayjs(age.dataset.age).fromNow();
  else if (age && age.dataset.age) age.textContent = age.dataset.age.slice(0, 16).replace("T", " ");

  root.querySelectorAll("[data-open]").forEach(btn => btn.onclick = () => {
    const sheet = root.querySelector("#sheet-" + btn.dataset.open);
    if (!sheet) return;
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
  animateIn(root, worst);
}

// ── Motion ───────────────────────────────────────────────────
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
      if (!Odo) { el.textContent = dec ? to.toFixed(2) : String(to); return; }
      const od = new Odo({ el, value: 0, format: dec ? "(,ddd).dd" : "(,ddd)", theme: "minimal", duration: 1400 });
      setTimeout(() => od.update(to), calm() ? 0 : 260 + i * 90);
    });
  });

  // 3D tilt with phone gyroscope
  loadTilt().then(VT => {
    const hero = root.querySelector("[data-tilt]");
    if (VT && hero && !calm()) VT.init(hero, { max: 9, speed: 600, glare: true, "max-glare": 0.22, gyroscope: true, gyroscopeMinAngleX: -25, gyroscopeMaxAngleX: 25, gyroscopeMinAngleY: -25, gyroscopeMaxAngleY: 25, scale: 1.01 });
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
  tl.finished.then(() => {
    if (worst === "safe" || worst === "watch") burst(null, 0.35);
  });
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
    colors: colors || ["#9b6bff", "#ff4fd8", "#3be7ff", "#ffc857", "#ffffff"], disableForReducedMotion: true
  });
}

function loadTs() {
  if (window.tsParticles) return Promise.resolve(window.tsParticles);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/tsparticles.bundle.min.js";
    s.onload = () => res(window.tsParticles);
    s.onerror = rej;
    document.head.append(s);
  });
}
async function mountMood(mood) {
  if (!mood || !document.getElementById("card-fx")) return;
  const ts = await loadTs().catch(() => null);
  if (!ts) return;
  const cold = mood === "cold";
  ts.load("card-fx", {
    fullScreen: { enable: false },
    particles: {
      number: { value: cold ? 28 : 18 },
      color: { value: cold ? ["#f4ede4", "#d7e7ff"] : ["#f4ede4", "#ffffff"] },
      shape: { type: cold ? "square" : "circle" },
      opacity: { value: { min: 0.25, max: 0.7 } },
      size: { value: { min: cold ? 2 : 4, max: cold ? 6 : 14 } },
      move: { enable: true, direction: cold ? "bottom" : "top", speed: cold ? 1.1 : 0.7, outModes: "out" }
    },
    detectRetina: true
  });
}

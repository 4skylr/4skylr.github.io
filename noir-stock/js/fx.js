// Product effects when a scan card opens.
// canvas-confetti (github.com/catdad/canvas-confetti) draws emoji shapes on its own
// worker-backed canvas; steam, embers, bubbles and frost are pure CSS layers.
// Everything stops by itself after a few seconds and cleans up after itself.

const CONFETTI = "vendor/confetti.browser.js";
let loading = null;
const loadConfetti = () => window.confetti ? Promise.resolve(window.confetti)
  : (loading ??= new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = CONFETTI; s.async = true;
      s.onload = () => res(window.confetti); s.onerror = () => { loading = null; rej(new Error(CONFETTI)); };
      document.head.append(s);
    }));

const rnd = (a, b) => a + Math.random() * (b - a);
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const POPCORN = /^(corn-|tub-)|^(caramel|cheese-masala|pizza-mix|popcorn-oil|salt|sugar)$/;
const FLOSS = /^(flossine-|cotton-candy)/;

export function themeOf(p) {
  const id = p.id || "";
  if (POPCORN.test(id)) return "popcorn";
  if (FLOSS.test(id)) return "floss";
  if (id === "monster") return "energy";
  if (id === "co2") return "fizz";
  if (p.category === "syrups") return "fizz";
  if (p.category === "drinks" || p.category === "slush") return "frost";
  if (p.category === "snacks") return "choco";
  if (p.category === "hot") return id === "lemon" ? "citrus" : id === "mint" ? "mint" : "steam";
  if (p.category === "food") return /hotdog|ketchup|mustard/.test(id) ? "grill" : "spice";
  return "spark";
}

let stage = null, fire = null, timers = [];
function clear() {
  timers.forEach(clearTimeout); timers = [];
  document.querySelectorAll(".fx-layer").forEach(n => n.remove());
  if (fire) { try { fire.reset(); } catch {} }
}
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

// CSS layer helper: spawns N elements with randomised custom properties
function cssLayer(kind, n, life = 5200) {
  const layer = document.createElement("div");
  layer.className = `fx-layer fx-${kind}`;
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < n; i++) {
    const el = document.createElement("i");
    el.style.setProperty("--x", rnd(0, 100).toFixed(1) + "%");
    el.style.setProperty("--d", rnd(0, 2.2).toFixed(2) + "s");
    el.style.setProperty("--t", rnd(2.4, 4.6).toFixed(2) + "s");
    el.style.setProperty("--s", rnd(.6, 1.4).toFixed(2));
    el.style.setProperty("--w", rnd(-40, 40).toFixed(0) + "px");
    layer.append(el);
  }
  document.body.append(layer);
  later(() => layer.classList.add("out"), life - 900);
  later(() => layer.remove(), life);
  return layer;
}

async function engine() {
  const c = await loadConfetti();
  if (!c) return null;
  if (!stage) {
    stage = document.createElement("canvas");
    stage.className = "fx-canvas"; stage.setAttribute("aria-hidden", "true");
    document.body.append(stage);
    fire = c.create(stage, { resize: true, useWorker: false });
  }
  return { c, fire };
}

function shapes(c, list, scalar) { return list.map(text => c.shapeFromText({ text, scalar })); }

// rain of emoji from the top, for `ms`
function rain(e, list, { ms = 4200, every = 110, gravity = .45, scalar = 1.8, drift = .5 } = {}) {
  const sh = shapes(e.c, list, scalar);
  const end = Date.now() + ms;
  (function step() {
    if (Date.now() > end) return;
    e.fire({ particleCount: 1, startVelocity: 0, ticks: 420, gravity: rnd(gravity * .7, gravity * 1.3), drift: rnd(-drift, drift),
      origin: { x: Math.random(), y: -0.06 }, shapes: [sh[Math.floor(Math.random() * sh.length)]], scalar: rnd(scalar * .7, scalar * 1.2), flat: true });
    later(step, every);
  })();
}

// bursts from below, like kernels popping in a kettle
function pop(e, list, { ms = 3400, scalar = 2.3, kernels = true } = {}) {
  const sh = shapes(e.c, list, scalar);
  const end = Date.now() + ms;
  (function step() {
    if (Date.now() > end) return;
    const x = rnd(.08, .92);
    e.fire({ particleCount: Math.round(rnd(1, 4)), angle: rnd(70, 110), spread: rnd(18, 46), startVelocity: rnd(38, 62), gravity: 1.15, ticks: 260,
      origin: { x, y: 1.02 }, shapes: sh, scalar: rnd(scalar * .8, scalar * 1.2), flat: true });
    if (kernels) e.fire({ particleCount: 6, angle: 90, spread: 70, startVelocity: rnd(20, 34), gravity: 1.3, ticks: 120,
      origin: { x, y: 1.02 }, colors: ["#fff6d8", "#ffe7a3", "#ffffff"], shapes: ["circle"], scalar: .55 });
    later(step, rnd(90, 230));
  })();
}

// one big burst from the product photo
function bloom(e, list, scalar = 2.2, count = 14) {
  const ph = document.querySelector(".pass-photo") || document.querySelector(".pc-shot");
  const r = ph ? ph.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
  e.fire({ particleCount: count, spread: 360, startVelocity: 26, gravity: .9, ticks: 200, scalar,
    origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }, shapes: shapes(e.c, list, scalar), flat: true });
}

export async function playProductFx(p) {
  if (calm() || !p) return;
  clear();
  const theme = themeOf(p);
  document.body.dataset.fx = theme;
  later(() => { if (document.body.dataset.fx === theme) delete document.body.dataset.fx; }, 6000);

  // CSS layers start immediately (no library needed)
  if (theme === "frost") { cssLayer("frost", 1, 5600); }
  if (theme === "fizz" || theme === "energy") cssLayer("bubbles", 26);
  if (theme === "steam" || theme === "mint" || theme === "citrus") cssLayer("steam", 9, 6000);
  if (theme === "grill" || theme === "spice") cssLayer("embers", 30);
  if (theme === "floss") cssLayer("floss", 14, 6000);

  const e = await engine().catch(() => null);
  if (!e) return;
  switch (theme) {
    case "popcorn": bloom(e, ["🍿"], 2.6, 10); pop(e, ["🍿", "🍿", "🌽"]); break;
    case "frost": rain(e, ["❄️", "❄️", "🧊"], { gravity: .32, scalar: 1.7, drift: .8 }); break;
    case "fizz": bloom(e, ["🫧"], 1.8, 12); rain(e, ["❄️", "🧊"], { ms: 2600, every: 220, gravity: .35, scalar: 1.4 }); break;
    case "energy": bloom(e, ["⚡"], 2.4, 16); rain(e, ["⚡", "❄️"], { ms: 2800, every: 160, gravity: .6, scalar: 1.6 }); break;
    case "choco": bloom(e, ["🍫", "🍬"], 2.2, 14); rain(e, ["🍫", "🍬", "🍫"], { gravity: .7, scalar: 1.9, every: 130 }); break;
    case "floss": bloom(e, ["🍭", "✨"], 2.2, 16); rain(e, ["✨", "🩷", "🩵"], { ms: 3200, gravity: .25, scalar: 1.4, every: 150 }); break;
    case "grill": bloom(e, ["🌭", "🔥"], 2.4, 12); pop(e, ["🌭", "🔥"], { ms: 2200, scalar: 2, kernels: false }); break;
    case "spice": bloom(e, ["🌶️", "🧀"], 2.3, 14); pop(e, ["🌶️", "🧀", "🔥"], { ms: 2400, scalar: 2, kernels: false }); break;
    case "steam": bloom(e, ["☕"], 2.2, 8); break;
    case "citrus": bloom(e, ["🍋", "✨"], 2.2, 14); break;
    case "mint": bloom(e, ["🌿", "🍃"], 2.2, 16); rain(e, ["🍃"], { ms: 2400, gravity: .3, scalar: 1.6, every: 200 }); break;
    default: bloom(e, ["✨"], 1.8, 12);
  }
}

// Gauges from progressbar.js (github.com/kimmobrunfeldt/progressbar.js).
const LIB = "vendor/progressbar.min.js";
let ready = null;
function load() {
  ready ??= new Promise((res, rej) => {
    if (window.ProgressBar) return res(window.ProgressBar);
    const s = document.createElement("script"); s.src = LIB; s.onload = () => res(window.ProgressBar); s.onerror = rej;
    document.head.append(s);
  });
  return ready;
}
const rings = [];
export async function mountGauges(root) {
  const PB = await load();
  rings.splice(0).forEach(r => r.destroy());
  root.querySelectorAll("[data-gauge]").forEach(el => {
    const pct = Math.max(0, Math.min(1, Number(el.dataset.gauge) || 0));
    const color = el.dataset.color || "#9b6bff";
    const bar = new PB.Circle(el, {
      color, strokeWidth: 8, trailWidth: 8, trailColor: "rgba(190,170,255,.16)",
      svgStyle: { width: "100%", height: "100%" },
      text: { value: el.dataset.label || "", style: { color: "#f2efff", fontSize: "11px", fontFamily: "JetBrains Mono Web, monospace" } }
    });
    bar.animate(pct, { duration: 700 });
    rings.push(bar);
  });
}

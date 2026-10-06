// Ring gauges for any element with data-gauge="0–1" (data-color, data-label optional). Plain SVG and a CSS transition:
// the old progressbar.js kept a requestAnimationFrame loop running forever once loaded, even with no gauge on the page.
export function mountGauges(root) {
  root?.querySelectorAll("[data-gauge]").forEach(el => {
    const pct = Math.max(0, Math.min(1, Number(el.dataset.gauge) || 0)), color = el.dataset.color || "#5b7bff", R = 46, C = 2 * Math.PI * R;
    el.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%;height:100%" aria-hidden="true"><circle cx="50" cy="50" r="${R}" fill="none" stroke="rgba(150,170,210,.16)" stroke-width="8"/>
      <circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 50 50)" style="transition:stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)"/>
      <text x="50" y="54" text-anchor="middle" fill="#edf1f8" font-size="13" font-family="Geist Mono, monospace">${String(el.dataset.label || "").replace(/[<&]/g, "")}</text></svg>`;
    const arc = el.querySelectorAll("circle")[1];
    requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute("stroke-dashoffset", String(C * (1 - pct)))));
  });
}

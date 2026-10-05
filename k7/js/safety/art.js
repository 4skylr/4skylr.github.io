// Animated line drawings for the safety page, one per device. Plain SVG; the motion is CSS (style.css · "Safety"),
// so it stops for viewers who ask for reduced motion.
const S = (cls, body) => `<svg class="sa ${cls}" viewBox="0 0 160 160" aria-hidden="true" focusable="false">${body}</svg>`;
const drops = (n, cx, cy) => Array.from({ length: n }, (_, i) => {
  const a = (-150 + i * (120 / (n - 1))) * Math.PI / 180, d = 46 + (i % 3) * 8;
  return `<circle class="sa-drop" cx="${cx}" cy="${cy}" r="2.4" style="--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(-Math.sin(a) * d * .9).toFixed(1)}px;--d:${(i * .13).toFixed(2)}s"/>`;
}).join("");

export const ART = {
  camera: () => S("sa-camera", `
    <rect x="14" y="40" width="12" height="40" rx="3" class="sa-line"/><path d="M26 60h18" class="sa-line"/>
    <g class="sa-pan">
      <path d="M150 34 122 58l28 26z" class="sa-cone"/>
      <path d="M40 42h76l7 7H46z" class="sa-line sa-fill-2"/>
      <rect x="42" y="47" width="74" height="26" rx="9" class="sa-line sa-fill"/>
      <circle cx="116" cy="60" r="10" class="sa-line sa-fill-2"/><circle cx="116" cy="60" r="4.5" class="sa-lens"/>
      <circle cx="55" cy="60" r="3.2" class="sa-rec"/><path d="M64 56h30M64 64h22" class="sa-faint"/>
    </g>
    <path d="M20 132h120" class="sa-faint"/>`),

  smoke: () => S("sa-smoke", `
    <path d="M8 30h144" class="sa-faint"/>
    <path d="M70 140c-10-12 10-18 0-30s10-18 0-30" class="sa-wisp" style="--d:0s"/>
    <path d="M86 140c-10-12 10-18 0-30s10-18 0-30" class="sa-wisp" style="--d:.9s"/>
    <path d="M102 140c-10-12 10-18 0-30s10-18 0-30" class="sa-wisp" style="--d:1.8s"/>
    <ellipse cx="80" cy="58" rx="22" ry="6" class="sa-pulse"/>
    <rect x="38" y="30" width="84" height="22" rx="11" class="sa-line sa-fill"/>
    <path d="M52 41h56" class="sa-faint"/><path d="M58 46h44" class="sa-faint"/>
    <circle cx="80" cy="52" r="3.4" class="sa-led"/>`),

  alarm: () => S("sa-alarm", `
    <path d="M38 64a40 40 0 0 0 0 40M28 56a54 54 0 0 0 0 56" class="sa-wave"/>
    <path d="M122 64a40 40 0 0 1 0 40M132 56a54 54 0 0 1 0 56" class="sa-wave"/>
    <circle cx="80" cy="36" r="6" class="sa-line sa-fill-2"/>
    <g class="sa-ring"><path d="M54 104c0-34 8-56 26-60 18 4 26 26 26 60z" class="sa-line sa-bell"/>
      <rect x="46" y="102" width="68" height="9" rx="4.5" class="sa-line sa-fill-2"/><circle cx="80" cy="122" r="6.5" class="sa-line sa-fill"/></g>
    <path d="M30 146h100" class="sa-faint"/>`),

  sprinkler: () => S("sa-sprinkler", `
    <path d="M10 22h140" class="sa-faint"/><path d="M80 22v18" class="sa-line"/>
    <path d="M70 40h20l-3 12H73z" class="sa-line sa-fill-2"/>
    <rect x="76.5" y="52" width="7" height="14" rx="3.5" class="sa-bulb"/>
    <path d="M62 70h36M62 70l-4 4M98 70l4 4M70 70v4M80 70v4M90 70v4" class="sa-line"/>
    <g class="sa-spray">${drops(11, 80, 74)}</g>`),

  hose: () => S("sa-hose", `
    <rect x="18" y="16" width="124" height="128" rx="12" class="sa-line sa-fill"/>
    <path d="M18 34h124" class="sa-faint"/><circle cx="34" cy="25" r="3" class="sa-dot"/>
    <g class="sa-spin"><circle cx="80" cy="84" r="40" class="sa-line"/>
      <circle cx="80" cy="84" r="33" class="sa-coil"/><circle cx="80" cy="84" r="26" class="sa-coil"/><circle cx="80" cy="84" r="19" class="sa-coil"/>
      <path d="M80 44v80M40 84h80" class="sa-faint"/><circle cx="80" cy="84" r="8" class="sa-line sa-fill-2"/></g>
    <path d="M120 84c18 0 22 18 10 30" class="sa-hoseline"/><path d="m126 112 10 10-6 4-8-10z" class="sa-line sa-fill-2"/>`),

  powder: () => S("sa-ext sa-powder", `
    <g class="sa-puff"><circle cx="138" cy="104" r="9"/><circle cx="148" cy="94" r="6"/><circle cx="146" cy="114" r="5"/></g>
    <path d="M90 40c34 0 40 30 34 62" class="sa-line"/><path d="m118 100 12 6-4 6-11-6z" class="sa-line sa-fill-2"/>
    <path d="M62 34h40l-8-9" class="sa-line"/><rect x="70" y="34" width="20" height="16" rx="3" class="sa-line sa-fill-2"/>
    <rect x="54" y="48" width="52" height="98" rx="16" class="sa-body"/>
    <rect x="62" y="80" width="36" height="38" rx="5" class="sa-label"/><text x="80" y="104" class="sa-tag">ABC</text>
    <circle cx="92" cy="42" r="7.5" class="sa-gauge"/><path d="M92 42l4-4" class="sa-needle"/>`),

  co2: () => S("sa-ext sa-co2", `
    <g class="sa-puff sa-frost"><circle cx="140" cy="116" r="10"/><circle cx="150" cy="104" r="6"/><circle cx="130" cy="128" r="6"/></g>
    <path d="M88 38c30 2 38 30 32 56" class="sa-line"/><path d="m116 92 22 22-10 10-20-24z" class="sa-line sa-horn"/>
    <path d="M62 32h38l-8-9" class="sa-line"/><rect x="70" y="32" width="20" height="16" rx="3" class="sa-line sa-fill-2"/>
    <rect x="56" y="46" width="48" height="100" rx="18" class="sa-body"/>
    <rect x="56" y="70" width="48" height="12" class="sa-band"/><text x="80" y="112" class="sa-tag sa-tag-l">CO₂</text>`),

  exit: () => S("sa-exit", `
    <rect x="28" y="14" width="104" height="34" rx="6" class="sa-sign"/>
    <text x="64" y="38" class="sa-exit-t">EXIT</text>
    <path d="M100 24l8 7-8 7M110 24l8 7-8 7" class="sa-chev"/>
    <rect x="50" y="62" width="60" height="86" rx="3" class="sa-line sa-fill"/>
    <g class="sa-door"><rect x="54" y="66" width="52" height="82" class="sa-line sa-fill-2"/><path d="M60 104h16" class="sa-line"/></g>
    <path d="M30 148h100" class="sa-faint"/>`)
};

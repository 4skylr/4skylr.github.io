// The lock screen's vault dial, drawn with Three.js (https://github.com/mrdoob/three.js, MIT; tree-shaken in vendor/three).
// Lazy: only loads on a locked page. Four lights fill as the PIN is typed; a right PIN spins the dial and swings it open,
// a wrong one flashes red. No WebGL, or reduced motion → a still CSS dial (the page still works without any of this).
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const NOOP = { digits() {}, deny() {}, open: () => Promise.resolve() };

export async function mountVault(el) {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let T;
  try { T = await import("../../vendor/three/three-vault.mjs"); } catch { return fallback(el); }
  const cv = document.createElement("canvas");
  let R;
  try { R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "low-power" }); } catch { return fallback(el); }
  if (!el.isConnected) { R.dispose(); return NOOP; }
  el.append(cv); el.classList.add("is-3d");
  R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.15;

  const ICE = new T.Color(css("--ice") || "#6ccbff"), GOOD = new T.Color(css("--good") || "#3ed69e"), BAD = new T.Color(css("--bad") || "#ff5468");
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(34, 1, .1, 50);
  cam.position.set(0, -.15, 8);
  scene.add(new T.AmbientLight(0x8090b0, .55));
  const key = new T.DirectionalLight(0xdce6ff, 2.2); key.position.set(3, 4, 6); scene.add(key);
  const rim = new T.PointLight(css("--chain") || "#5b7bff", 30, 14); rim.position.set(-3.5, -2, 2.5); scene.add(rim);
  const glow = new T.PointLight(ICE, 0, 6); glow.position.set(0, 0, 2.2); scene.add(glow);

  // the dial face: numbers 0–9 and ticks painted onto a canvas
  const face = document.createElement("canvas"); face.width = face.height = 512;
  { const g = face.getContext("2d"), c = 256;
    const grd = g.createRadialGradient(c, c, 40, c, c, 256); grd.addColorStop(0, "#2a3142"); grd.addColorStop(1, "#11151f");
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "#9fb0d0"; g.lineCap = "round";
    for (let i = 0; i < 100; i++) { const a = i / 100 * Math.PI * 2, long = i % 10 === 0, r1 = long ? 196 : 210;
      g.lineWidth = long ? 5 : 2; g.globalAlpha = long ? 1 : .55;
      g.beginPath(); g.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); g.lineTo(c + Math.sin(a) * 236, c - Math.cos(a) * 236); g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = "#dce6ff"; g.font = "600 40px Geist Mono, ui-monospace, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.fillText(String(i), c + Math.sin(a) * 160, c - Math.cos(a) * 160); }
    g.strokeStyle = "rgba(108,203,255,.35)"; g.lineWidth = 3; g.beginPath(); g.arc(c, c, 120, 0, Math.PI * 2); g.stroke(); }
  const faceTex = new T.CanvasTexture(face); faceTex.colorSpace = T.SRGBColorSpace; faceTex.anisotropy = 4;

  const metal = new T.MeshStandardMaterial({ color: 0x4a5368, metalness: .95, roughness: .32 });
  const dark = new T.MeshStandardMaterial({ color: 0x161b26, metalness: .7, roughness: .5 });
  const door = new T.Group(), dial = new T.Group(); scene.add(door); door.add(dial);
  const bezel = new T.Mesh(new T.TorusGeometry(1.72, .16, 24, 96), metal); door.add(bezel);
  const plate = new T.Mesh(new T.CylinderGeometry(1.62, 1.62, .14, 96), [dark, new T.MeshStandardMaterial({ map: faceTex, metalness: .35, roughness: .55 }), dark]);
  plate.rotation.x = Math.PI / 2; dial.add(plate);
  const hub = new T.Mesh(new T.CylinderGeometry(.5, .56, .34, 48), metal); hub.rotation.x = Math.PI / 2; hub.position.z = .2; dial.add(hub);
  for (let i = 0; i < 3; i++) { const spoke = new T.Mesh(new T.BoxGeometry(.12, 1.1, .12), metal); spoke.position.z = .4; spoke.rotation.z = i * Math.PI / 3 * 2; spoke.position.x = -Math.sin(spoke.rotation.z) * .55; spoke.position.y = Math.cos(spoke.rotation.z) * .55; dial.add(spoke); }
  const pointer = new T.Mesh(new T.BoxGeometry(.06, .3, .06), new T.MeshBasicMaterial({ color: ICE })); pointer.position.set(0, 1.98, .1); door.add(pointer);
  // four PIN lights along the bottom of the bezel
  const lights = [0, 1, 2, 3].map(i => { const m = new T.Mesh(new T.SphereGeometry(.09, 20, 14), new T.MeshStandardMaterial({ color: 0x1b2232, emissive: 0x000000, metalness: .2, roughness: .4 }));
    m.position.set((i - 1.5) * .34, -2.22, .12); door.add(m); return m; });

  let lit = 0, tint = ICE, target = 0, spin = 0, shake = 0, swing = 0, swingTo = 0, live = true, t0 = performance.now();
  const paint = () => lights.forEach((m, i) => { const on = i < lit; m.material.emissive.copy(on ? tint : new T.Color(0)); m.material.emissiveIntensity = on ? 2.4 : 0; m.material.color.set(on ? tint : 0x1b2232); });
  const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 220; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  size(); const ro = new ResizeObserver(size); ro.observe(el);
  const frame = now => {
    if (!live) return;
    if (!el.isConnected) { live = false; ro.disconnect(); R.dispose(); faceTex.dispose(); return; }
    const t = (now - t0) / 1000;
    spin += (target - spin) * (still ? 1 : .12);
    dial.rotation.z = -spin;
    swing += (swingTo - swing) * (still ? 1 : .08);
    door.rotation.y = swing * -1.15; door.position.x = swing * -1.2;
    const idle = still ? 0 : Math.sin(t * .6) * .12;
    door.rotation.x = idle * .5 + (shake ? Math.sin(t * 60) * shake * .02 : 0);
    door.rotation.y += idle; door.position.y = shake ? Math.sin(t * 70) * shake * .05 : 0;
    shake *= .9; if (shake < .02) shake = 0;
    glow.intensity += ((lit ? 6 + lit * 2 : 0) - glow.intensity) * .15; glow.color.copy(tint);
    R.render(scene, cam);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  paint();
  return {
    digits(v) { const s = String(v || ""); lit = Math.min(4, s.length); tint = ICE; const d = Number(s.slice(-1)); target = s ? spin + ((((d / 10) * Math.PI * 2 - spin) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) + (s.length % 2 ? Math.PI * 2 : 0) : spin; paint(); },
    deny() { tint = BAD; lit = 4; paint(); shake = 1; setTimeout(() => { lit = 0; tint = ICE; paint(); }, 650); },
    open() { tint = GOOD; lit = 4; paint(); target = spin + Math.PI * 4; return new Promise(res => setTimeout(() => { swingTo = 1; setTimeout(res, still ? 0 : 520); }, still ? 0 : 520)); }
  };
}

function fallback(el) {
  el.innerHTML = `<div class="vault-css" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
  const dots = [...el.querySelectorAll("i")];
  return { digits: v => dots.forEach((d, i) => d.classList.toggle("on", i < String(v || "").length)), deny: () => { el.firstChild.classList.add("bad"); setTimeout(() => el.firstChild?.classList.remove("bad"), 600); }, open: () => Promise.resolve() };
}

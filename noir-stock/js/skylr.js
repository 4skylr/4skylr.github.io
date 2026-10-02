// Settings intro: a "breach" sequence that ends on Skylr.
// Pure canvas + CSS + Web Audio, loaded only when Settings is opened.
// Flashes are kept slow (no fast full-screen strobing) and reduced-motion gets a calm version.

const CSS = `
#skylr{position:fixed;inset:0;z-index:2000;background:#000;color:#ff2a3d;overflow:hidden;font-family:"JetBrains Mono",ui-monospace,monospace;cursor:pointer;
  animation:sk-shake .38s infinite steps(2)}
#skylr.calm{animation:none}
#skylr canvas{position:absolute;inset:0;width:100%;height:100%;opacity:.85}
#skylr .sk-scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.45) 0 2px,transparent 2px 4px);mix-blend-mode:multiply}
#skylr .sk-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 35%,rgba(120,0,10,.55) 75%,#000 100%);animation:sk-pulse 1.1s ease-in-out infinite}
#skylr .sk-term{position:absolute;left:5%;right:5%;top:8%;font-size:clamp(12px,3.4vw,16px);line-height:1.55;text-shadow:0 0 8px #ff1a2e;white-space:pre-wrap;z-index:3}
#skylr .sk-term .ok{color:#39ff88;text-shadow:0 0 8px #39ff88}
#skylr .sk-term .cur{display:inline-block;width:.6em;background:#ff2a3d;animation:sk-blink .7s steps(1) infinite}
#skylr .sk-warn{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-weight:800;letter-spacing:.08em;z-index:4;
  font-size:clamp(26px,8vw,64px);color:#fff;text-shadow:3px 0 #ff003c,-3px 0 #00e5ff;opacity:0}
#skylr .sk-warn.on{animation:sk-warn 1.6s ease-out forwards}
#skylr .sk-face{position:absolute;inset:0;display:grid;place-items:center;z-index:5;opacity:0;transition:opacity .5s}
#skylr .sk-face.on{opacity:1}
#skylr .sk-img{position:relative;width:min(78vw,430px);aspect-ratio:704/1251;filter:contrast(1.25) saturate(1.2);animation:sk-breathe 3.2s ease-in-out infinite}
#skylr .sk-img i{position:absolute;inset:0;background:var(--src) center/cover no-repeat;border-radius:18px}
#skylr .sk-img i:nth-child(1){box-shadow:0 0 80px rgba(255,0,40,.55),0 0 0 1px rgba(255,0,60,.6)}
#skylr .sk-img i:nth-child(2){mix-blend-mode:screen;filter:url(#sk-r);animation:sk-sliceA 2.3s infinite steps(1);opacity:.85}
#skylr .sk-img i:nth-child(3){mix-blend-mode:screen;filter:url(#sk-c);animation:sk-sliceB 1.7s infinite steps(1);opacity:.85}
#skylr .sk-img b{position:absolute;inset:0;border-radius:18px;background:linear-gradient(transparent 60%,rgba(0,0,0,.85));}
#skylr .sk-eye{position:absolute;width:8%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#fff,#ff2bd6 35%,transparent 70%);
  filter:blur(1px);animation:sk-eye 1.4s ease-in-out infinite;mix-blend-mode:screen}
#skylr .sk-say{position:absolute;left:4%;right:4%;bottom:7%;text-align:center;z-index:6;font-family:Inter,system-ui,sans-serif;font-weight:900;text-transform:uppercase;
  font-size:clamp(20px,6.4vw,46px);line-height:1.08;color:#fff;letter-spacing:.02em;opacity:0}
#skylr .sk-say.on{opacity:1;animation:sk-glitch 1.8s infinite}
#skylr .sk-say small{display:block;margin-top:12px;font-size:clamp(12px,3.4vw,15px);letter-spacing:0;color:#ff4d5e;font-weight:600}
#skylr .sk-skip{position:absolute;right:14px;top:14px;z-index:7;font-size:11px;color:#ff6b79;border:1px solid #ff2a3d;padding:5px 10px;border-radius:99px;background:rgba(0,0,0,.6);opacity:0;transition:opacity .4s}
#skylr .sk-skip.on{opacity:1}
@keyframes sk-shake{0%{transform:translate(0,0)}50%{transform:translate(-2px,1px)}100%{transform:translate(2px,-1px)}}
@keyframes sk-pulse{0%,100%{opacity:.75}50%{opacity:1}}
@keyframes sk-blink{50%{opacity:0}}
@keyframes sk-warn{0%{opacity:0;transform:translateY(-50%) scale(1.6)}12%{opacity:1;transform:translateY(-50%) scale(1)}70%{opacity:1}100%{opacity:0;transform:translateY(-50%) scale(.96)}}
@keyframes sk-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
@keyframes sk-sliceA{0%{clip-path:inset(10% 0 80% 0);transform:translate(-8px)}20%{clip-path:inset(55% 0 30% 0);transform:translate(6px)}40%{clip-path:inset(0 0 100% 0)}60%{clip-path:inset(72% 0 12% 0);transform:translate(-10px)}80%{clip-path:inset(30% 0 60% 0);transform:translate(4px)}}
@keyframes sk-sliceB{0%{clip-path:inset(40% 0 45% 0);transform:translate(9px)}30%{clip-path:inset(0 0 100% 0)}55%{clip-path:inset(15% 0 70% 0);transform:translate(-7px)}75%{clip-path:inset(82% 0 4% 0);transform:translate(8px)}}
@keyframes sk-eye{0%,100%{transform:scale(.8);opacity:.7}50%{transform:scale(1.5);opacity:1}}
@keyframes sk-glitch{0%,86%,100%{text-shadow:3px 0 #ff003c,-3px 0 #00e5ff;transform:none}88%{text-shadow:-6px 0 #ff003c,6px 0 #00e5ff;transform:skewX(-8deg) translateX(4px)}92%{text-shadow:8px 2px #ff003c,-8px -2px #00e5ff;transform:skewX(6deg)}96%{transform:translateX(-3px)}}
#skylr.calm *{animation:none!important}
`;

const LINES = [
  ["> noir-stock :: secure shell v6.6.6", ""],
  ["> tracing 10.66.6.13 … ", "locked"],
  ["> bypassing firewall ████████████ ", "OK"],
  ["> injecting payload  skylr.exe … ", "OK"],
  ["> dumping vault: CON · MNI · STR … ", "OK"],
  ["> camera.front … ", "ON"],
  ["> he is watching you.", ""]
];

function sound() {
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)();
    const out = C.createGain(); out.gain.value = 0.0001; out.connect(C.destination);
    out.gain.exponentialRampToValueAtTime(0.22, C.currentTime + 1.2);
    // low drone
    [41, 43.5, 82].forEach((f, i) => { const o = C.createOscillator(); o.type = i === 2 ? "sawtooth" : "sine"; o.frequency.value = f;
      const g = C.createGain(); g.gain.value = i === 2 ? .12 : .5; o.connect(g); g.connect(out); o.start(); o.stop(C.currentTime + 9); });
    // static bursts
    const len = C.sampleRate * 0.4, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    [0.3, 1.9, 3.4, 4.1, 5.2].forEach(t => { const n = C.createBufferSource(); n.buffer = buf; const g = C.createGain(); g.gain.value = .35;
      const bp = C.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; n.connect(bp); bp.connect(g); g.connect(out); n.start(C.currentTime + t); });
    // heartbeat
    [2.6, 3.0, 4.4, 4.8, 6.2, 6.6].forEach(t => { const o = C.createOscillator(); o.frequency.value = 52; const g = C.createGain();
      g.gain.setValueAtTime(0.0001, C.currentTime + t); g.gain.exponentialRampToValueAtTime(.9, C.currentTime + t + .03); g.gain.exponentialRampToValueAtTime(0.0001, C.currentTime + t + .25);
      o.connect(g); g.connect(out); o.start(C.currentTime + t); o.stop(C.currentTime + t + .3); });
    return () => { try { out.gain.cancelScheduledValues(C.currentTime); out.gain.setTargetAtTime(0.0001, C.currentTime, .08); setTimeout(() => C.close(), 400); } catch {} };
  } catch { return () => {}; }
}

export function playSkylr() {
  if (document.getElementById("skylr")) return Promise.resolve();
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ar = (sessionStorage.getItem("noir-lang") || "en") === "ar";
  if (!document.getElementById("skylr-css")) { const st = document.createElement("style"); st.id = "skylr-css"; st.textContent = CSS; document.head.append(st); }
  const el = document.createElement("div");
  el.id = "skylr"; el.className = calm ? "calm" : ""; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Skylr");
  el.innerHTML = `<svg width="0" height="0" style="position:absolute"><filter id="sk-r"><feColorMatrix values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>
      <filter id="sk-c"><feColorMatrix values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/></filter></svg>
    <canvas></canvas><div class="sk-scan"></div><div class="sk-vig"></div>
    <pre class="sk-term"></pre>
    <div class="sk-warn">${ar ? "تم اختراق النظام" : "SYSTEM BREACHED"}</div>
    <div class="sk-face"><div class="sk-img" style="--src:url(assets/skylr.webp)"><i></i><i></i><i></i><b></b>
      <span class="sk-eye" style="left:54%;top:45.8%"></span><span class="sk-eye" style="left:76%;top:49.4%"></span></div></div>
    <div class="sk-say">Skylr wants you to become his friend<small>${ar ? "اضغط للمتابعة" : "tap to continue"}</small></div>
    <button type="button" class="sk-skip">${ar ? "تخطي" : "skip"}</button>`;
  document.body.append(el);
  const stopSound = sound();
  try { navigator.vibrate?.([80, 60, 80, 400, 200, 60, 200]); } catch {}

  // rain of glyphs
  const cv = el.querySelector("canvas"), cx = cv.getContext("2d");
  const fit = () => { cv.width = innerWidth * Math.min(devicePixelRatio, 2); cv.height = innerHeight * Math.min(devicePixelRatio, 2); };
  fit();
  const fs = 16 * Math.min(devicePixelRatio, 2), cols = Math.ceil(cv.width / fs), drops = Array.from({ length: cols }, () => Math.random() * -50);
  const glyph = "01アカサタナハマヤラワ01ABCDEF#$%&*<>/\\|سكايلر☠";
  let raf = 0, alive = true;
  const rain = () => {
    if (!alive) return;
    cx.fillStyle = "rgba(0,0,0,.12)"; cx.fillRect(0, 0, cv.width, cv.height);
    cx.font = `${fs}px monospace`;
    drops.forEach((y, i) => {
      cx.fillStyle = Math.random() > .975 ? "#ffffff" : i % 7 ? "#ff1f3a" : "#39ff88";
      cx.fillText(glyph[(Math.random() * glyph.length) | 0], i * fs, y * fs);
      drops[i] = y * fs > cv.height && Math.random() > .975 ? 0 : y + 1;
    });
    raf = requestAnimationFrame(rain);
  };
  if (!calm) rain(); else { cx.fillStyle = "#000"; cx.fillRect(0, 0, cv.width, cv.height); }

  // terminal typing
  const term = el.querySelector(".sk-term");
  let li = 0, ci = 0, txt = "";
  const timers = [];
  const type = () => {
    if (!alive) return;
    if (li >= LINES.length) { term.innerHTML = txt; return; }
    const [line, ok] = LINES[li];
    if (ci < line.length) { ci++; term.innerHTML = txt + line.slice(0, ci) + '<span class="cur">&nbsp;</span>'; timers.push(setTimeout(type, calm ? 0 : 14 + Math.random() * 26)); return; }
    txt += line + (ok ? `<span class="ok">${ok}</span>` : "") + "\n"; li++; ci = 0;
    timers.push(setTimeout(type, calm ? 0 : 160));
  };
  type();

  const at = (ms, fn) => timers.push(setTimeout(() => alive && fn(), calm ? Math.min(ms, 400) : ms));
  at(2600, () => el.querySelector(".sk-warn").classList.add("on"));
  at(4100, () => { term.style.opacity = ".25"; el.querySelector(".sk-face").classList.add("on"); });
  at(5000, () => el.querySelector(".sk-say").classList.add("on"));
  at(1200, () => el.querySelector(".sk-skip").classList.add("on"));

  return new Promise(resolve => {
    let ready = false; at(1200, () => { ready = true; });
    const close = () => {
      if (!ready) return;
      alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); stopSound();
      el.style.transition = "opacity .45s"; el.style.opacity = "0";
      setTimeout(() => { el.remove(); resolve(); }, 460);
    };
    el.addEventListener("click", close);
    addEventListener("keydown", function k(e) { if (e.key === "Escape" || e.key === "Enter") { ready = true; close(); removeEventListener("keydown", k); } });
    addEventListener("resize", fit);
  });
}

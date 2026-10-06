// Page motion with GSAP (https://github.com/greensock/GSAP, vendored in vendor/gsap): each page's blocks rise in on a
// short stagger when it opens. Loaded once, after the first paint; reduced-motion users get no animation at all.
let gP = null;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function loadGsap() {
  if (window.gsap) return Promise.resolve(window.gsap);
  return gP ??= new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/gsap/gsap.min.js"; s.onload = () => res(window.gsap); s.onerror = () => { gP = null; rej(new Error("gsap")); }; document.head.append(s); });
}
export function enter(view, title) {
  if (!view || still()) return;
  loadGsap().then(g => {
    const kids = [...view.children].flatMap(c => c.children.length > 1 && c.children.length < 12 && !c.matches(".vlock, .sc-stage, canvas") ? [...c.children] : [c]).slice(0, 14);
    g.killTweensOf(kids);
    g.fromTo(kids, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, ease: "power3.out", stagger: .045, clearProps: "transform,opacity,visibility" });
    if (title) g.fromTo(title, { y: 10, autoAlpha: 0, filter: "blur(6px)" }, { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: .6, ease: "power2.out", clearProps: "all" });
  }).catch(() => {});
}

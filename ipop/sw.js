/* Offline shell for the stock app.
   - Same-origin static files (js, css, vendor, assets): stale-while-revalidate → instant repeat opens.
   - Pages and JSON: network first, cache as fallback.
   - Versioned CDN files (Firebase SDK, fonts): cache first.
   - Firestore / auth traffic is never touched, so live sync is not slowed or broken. */
const CACHE = "ipop-v115";
const CORE = ["./", "./index.html", "./css/style.css?v=108", "./css/fonts.css?v=108", "./css/indicators.css?v=108", "./css/scan-card.css?v=108", "./css/scan-pass.css?v=108", "./css/unaizah.css?v=108", "./css/finance.css?v=108", "./css/analyst.css?v=108", "./css/product-card.css?v=108", "./css/recipe-theater.css?v=108", "./css/watch.css?v=108", "./css/loader.css?v=108", "./css/branch-card.css?v=108", "./css/gallery.css?v=108", "./css/dock.css?v=108", "./css/system.css?v=108", "./assets/brand/ipop-hero.webp", "./vendor/fonts/Inter-Variable.woff2"];
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdn\.jsdelivr\.net\/(gh|npm)\/)/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { if (res && res.ok && (res.type === "basic" || res.type === "cors")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;

  if (!same) {
    if (CDN.test(req.url)) e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
    return; // everything else (Firestore, auth, analytics) goes straight to the network
  }
  const isPage = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/") || url.pathname.endsWith(".json");
  if (isPage) {
    e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html"))));
    return;
  }
  // JS and CSS: network first, so an update opens on the next visit instead of a stale shell.
  if (/\.(js|css|webp|svg|woff2)$/.test(url.pathname)) {
    e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => put(req, res)).catch(() => hit);
    return hit || net;
  }));
});

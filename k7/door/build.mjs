// Builds the barcode door: the old address printed on product labels (noir-stock/).
// It opens one product card from its barcode and nothing else: no menu, no other pages, no site data.
//   node k7/door/build.mjs        (needs esbuild: npm i -g esbuild, or NODE_PATH pointing at one)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD || "esbuild");
const here = path.dirname(fileURLToPath(import.meta.url)), site = path.resolve(here, ".."), out = path.resolve(site, "..", "noir-stock");
const V = String(Date.now()).slice(-6);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// one bundle of the app in card-only mode; ?v= query strings are for browser caching only
await esbuild.build({
  entryPoints: [path.join(site, "js/app.js")], bundle: true, format: "esm", minify: true, outfile: path.join(out, "app.js"), legalComments: "none",
  plugins: [{ name: "strip-v", setup(b) {
    b.onResolve({ filter: /^https?:/ }, a => ({ path: a.path, external: true }));
    b.onResolve({ filter: /\?v=\d+$/ }, a => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?v=\d+$/, "")) }));
  } }]
});
fs.writeFileSync(path.join(out, "index.html"), fs.readFileSync(path.join(here, "index.html"), "utf8").replace(/__V__/g, V));
const copy = (rel) => { const s = path.join(site, rel), d = path.join(out, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.cpSync(s, d, { recursive: true }); };
["css/style.css", "css/fonts.css", "css/indicators.css", "css/scan-card.css", "css/scan-pass.css", "css/brand.css", "css/theme.css"].forEach(copy);
["vendor/jsbarcode.all.min.js", "vendor/decimal.min.js", "vendor/anime.min.js", "vendor/confetti.browser.js", "vendor/odometer.min.js", "vendor/odometer-theme-minimal.css",
 "vendor/progressbar.min.js", "vendor/dayjs.min.js", "vendor/relativeTime.js", "vendor/echarts.min.js", "vendor/fuse.min.mjs", "vendor/fonts"].forEach(copy);
["assets/67", "assets/products", "assets/combos", "assets/icons", "assets/pay"].forEach(copy);
// retire the full app's service worker on devices that installed it here
fs.writeFileSync(path.join(out, "sw.js"), `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.map(c => caches.delete(c)))).then(() => self.registration.unregister())));\n`);
fs.writeFileSync(path.join(out, "robots.txt"), "User-agent: *\nDisallow: /\n");
console.log("door built →", path.relative(process.cwd(), out), "v" + V);

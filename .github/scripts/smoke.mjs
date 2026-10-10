// Smoke test for the site (run by .github/workflows/ci.yml, or locally: node .github/scripts/smoke.mjs).
// Serves the repo, opens every page at phone and desktop width (the site is English only), and fails on:
//   a JavaScript error · a missing local file · a page wider than the screen · an empty page.
// // Writes a Markdown table to the GitHub job summary and screenshots to ./smoke-shots.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || ".");
const ROUTES = ["dashboard", "products", "count", "yield", "history", "finance", "profit", "unaizah", "halls", "nightly", "safety", "links", "settings", "alerts"];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".xlsx": "application/octet-stream" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(d); });
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;
const wait = ms => new Promise(r => setTimeout(r, ms));
const NOISE = /Firebase|firestore|ERR_|net::|Failed to load resource|ODS number format|favicon/i;
fs.mkdirSync("smoke-shots", { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const rows = [], failures = [];
for (const lang of ["en"]) for (const width of [390, 1300]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 860 : 900 }, isMobile: width < 500, serviceWorkers: "block" });
  await ctx.route(/googleapis|gstatic\.com|firebaseio/, r => r.abort()); // run against browser storage only
  const page = await ctx.newPage();
  let errs = [], missing = [];
  page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(m.text().slice(0, 160)); });
  page.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE)) missing.push(`${r.status()} ${r.url().slice(BASE.length)}`); });
  // signed in as the admin through the door's local stand-in (Firebase is blocked in this test)
  await page.addInitScript(l => { sessionStorage.setItem("noir-lang", l); localStorage.setItem("noir-tour-v1", "1");
    localStorage.setItem("ipop-door-local", JSON.stringify({ ready: true, accounts: {}, presence: {}, users: { "u-smoke": { name: "Smoke", role: "admin", branch: "unaizah", code: "0000", active: true } } }));
    sessionStorage.setItem("ipop-door-uid", "u-smoke"); }, lang);
  await page.goto(`${BASE}/ipop/#dashboard`); await wait(2500);
  for (const route of ROUTES) {
    errs = []; missing = [];
    await page.goto(`${BASE}/ipop/#${route}`); await page.reload(); await wait(route === "unaizah" || route === "finance" ? 4500 : 2500);
    const st = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, text: document.querySelector("#view")?.innerText.trim().length || 0 }));
    const why = [...errs.map(e => "error: " + e), ...missing.map(m => "missing: " + m), ...(st.over > 1 ? [`${st.over}px wider than the screen`] : []), ...(st.text < 20 ? ["page is empty"] : [])];
    rows.push({ lang, width, route, ok: !why.length, why });
    if (why.length) { failures.push(`${lang} ${width} ${route}: ${why.join("; ")}`); await page.screenshot({ path: `smoke-shots/${lang}-${width}-${route}.png` }); }
  }
  // a label scan opens the product watch, from the current address and from the old printed ones
  if (width < 500) for (const url of ["/ipop/?p=caramel", "/noir-stock/?p=caramel"]) {
    errs = []; missing = [];
    await page.goto(BASE + url); await wait(3000);
    const st = await page.evaluate(() => ({ path: location.pathname, watch: document.querySelectorAll(".nw .nw-display").length, name: document.querySelector(".nw-name")?.textContent || "" }));
    const why = [...errs.map(e => "error: " + e), ...missing.map(m => "missing: " + m), ...(st.path !== "/ipop/" ? [`landed on ${st.path}`] : []), ...(st.watch !== 1 || !st.name ? ["the product watch did not open"] : [])];
    rows.push({ lang, width, route: "scan " + url, ok: !why.length, why });
    if (why.length) { failures.push(`${lang} ${width} scan ${url}: ${why.join("; ")}`); await page.screenshot({ path: `smoke-shots/scan-${url.split("/")[1]}.png` }); }
  }
  await ctx.close();
}
await browser.close(); server.close();

const md = [`### Smoke test: ${rows.filter(r => r.ok).length}/${rows.length} passed`, "", "| Lang | Width | Page | Result |", "|---|---|---|---|",
  ...rows.map(r => `| ${r.lang} | ${r.width} | ${r.route} | ${r.ok ? "✅" : "❌ " + r.why.join("<br>")} |`)].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
console.log(md);
if (failures.length) { console.error("\nFailures:\n" + failures.join("\n")); process.exit(1); }

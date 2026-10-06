// Smoke test for the site (run by .github/workflows/ci.yml, or locally: node .github/scripts/smoke.mjs).
// Serves the repo, opens every page in English and Arabic at phone and desktop width, and fails on:
//   a JavaScript error · a missing local file · a page wider than the screen · an empty page.
// Also checks the barcode door (one product card, no menu, no way into the site, no prices or recipes) and the privacy
// lock (no money on any page without the PIN; the clock PIN opens the locked pages).
// Writes a Markdown table to the GitHub job summary and screenshots to ./smoke-shots.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || ".");
const ROUTES = ["dashboard", "products", "count", "yield", "history", "finance", "profit", "unaizah", "halls", "nightly", "safety", "petty", "links", "settings", "alerts"];
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
for (const lang of ["en", "ar"]) for (const width of [390, 1300]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 860 : 900 }, isMobile: width < 500, serviceWorkers: "block" });
  await ctx.route(/googleapis|gstatic\.com|firebaseio/, r => r.abort()); // run against browser storage only
  const page = await ctx.newPage();
  let errs = [], missing = [];
  page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(m.text().slice(0, 160)); });
  page.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE)) missing.push(`${r.status()} ${r.url().slice(BASE.length)}`); });
  await page.addInitScript(l => { sessionStorage.setItem("noir-lang", l); sessionStorage.setItem("noir-admin", "1"); localStorage.setItem("noir-tour-v1", "1"); }, lang);
  await page.goto(`${BASE}/k7/#dashboard`); await wait(2500);
  for (const route of ROUTES) {
    errs = []; missing = [];
    await page.goto(`${BASE}/k7/#${route}`); await page.reload(); await wait(route === "unaizah" || route === "finance" ? 4500 : 2500);
    const st = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, text: document.querySelector("#view")?.innerText.trim().length || 0 }));
    const why = [...errs.map(e => "error: " + e), ...missing.map(m => "missing: " + m), ...(st.over > 1 ? [`${st.over}px wider than the screen`] : []), ...(st.text < 20 ? ["page is empty"] : [])];
    rows.push({ lang, width, route, ok: !why.length, why });
    if (why.length) { failures.push(`${lang} ${width} ${route}: ${why.join("; ")}`); await page.screenshot({ path: `smoke-shots/${lang}-${width}-${route}.png` }); }
  }
  await ctx.close();
}
// the privacy lock: without the PIN no page shows a money amount, the money/recipe pages show the vault,
// and the clock PIN (HHMM, browser time) opens them
const MONEY = /\d[\d,]*\.\d{2}\s*(SAR|SR|ر\.س)/;
const pinNow = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0"); };
{
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: "block" });
  await ctx.route(/googleapis|gstatic\.com|firebaseio/, r => r.abort());
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  await page.addInitScript(() => { localStorage.setItem("noir-tour-v1", "1"); localStorage.setItem("noir-ui2:showIntro", "true"); });
  for (const route of ROUTES) {
    await page.goto(`${BASE}/k7/#${route}`); await page.reload(); await wait(2200);
    const st = await page.evaluate(() => ({ vault: !!document.querySelector(".vlock"), text: document.querySelector("#view")?.innerText || "" }));
    const must = ["finance", "profit", "unaizah", "nightly", "yield"].includes(route);
    const why = [...(must && !st.vault ? ["not locked"] : []), ...(MONEY.test(st.text) ? [`shows money: ${st.text.match(MONEY)[0]}`] : [])];
    rows.push({ lang: "locked", width: 1300, route, ok: !why.length, why });
    if (why.length) { failures.push(`locked ${route}: ${why.join("; ")}`); await page.screenshot({ path: `smoke-shots/locked-${route}.png` }); }
  }
  await page.goto(`${BASE}/k7/#finance`); await page.reload(); await wait(2000);
  await page.fill("#vlock-form input", "0000"); await wait(600);
  const wrong = await page.locator(".vlock").count();
  await page.fill("#vlock-form input", await page.evaluate(`(${pinNow})()`)); await wait(2200);
  const opened = await page.locator(".vlock").count() === 0;
  const why = [...errs.map(e => "error: " + e), ...(wrong !== 1 ? ["a wrong PIN opened it"] : []), ...(!opened ? ["the clock PIN did not open it"] : [])];
  rows.push({ lang: "locked", width: 1300, route: "PIN", ok: !why.length, why });
  if (why.length) { failures.push(`PIN: ${why.join("; ")}`); await page.screenshot({ path: "smoke-shots/pin.png" }); }
  await ctx.close();
}
// the barcode door must show one card and nothing else
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: "block" });
  await ctx.route(/googleapis|gstatic\.com|firebaseio/, r => r.abort());
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(`${BASE}/noir-stock/?p=tub-46`); await wait(4000);
  const d = await page.evaluate(() => ({ money: /\d[\d,]*\.\d{2}\s*(SAR|SR|ر\.س)/.test(document.body.innerText), recipe: (document.querySelector("#sheet-recipe")?.textContent || "").trim().length, card: document.querySelectorAll(".pass, .phone-card").length, nav: document.querySelectorAll("#nav, .dock-nav, .head").length, links: [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")) }));
  await page.evaluate(() => { location.hash = "dashboard"; }); await wait(1200);
  const still = await page.evaluate(() => document.querySelectorAll(".pass, .phone-card").length);
  const why = [...errs.map(e => "error: " + e), ...(d.card !== 1 ? ["no product card"] : []), ...(d.nav ? ["site menu visible"] : []), ...(d.links.some(h => /k7/.test(h)) ? ["link into the site"] : []), ...(still !== 1 ? ["#dashboard left the card"] : []), ...(d.money ? ["door shows money"] : []), ...(d.recipe ? ["door shows the recipe without the PIN"] : [])];
  rows.push({ lang: "door", width: 390, route: "noir-stock/?p=tub-46", ok: !why.length, why });
  if (why.length) { failures.push(`door: ${why.join("; ")}`); await page.screenshot({ path: "smoke-shots/door.png" }); }
  await ctx.close();
}
await browser.close(); server.close();

const md = [`### Smoke test: ${rows.filter(r => r.ok).length}/${rows.length} passed`, "", "| Lang | Width | Page | Result |", "|---|---|---|---|",
  ...rows.map(r => `| ${r.lang} | ${r.width} | ${r.route} | ${r.ok ? "✅" : "❌ " + r.why.join("<br>")} |`)].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
console.log(md);
if (failures.length) { console.error("\nFailures:\n" + failures.join("\n")); process.exit(1); }

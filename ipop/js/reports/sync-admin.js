// Settings · Edit PIN & expiry — reads the stock PDF (mozilla/pdf.js), imports the monthly expiry sheet (exceljs/exceljs),
// and lists products whose stock does not match their dated groups.
import { isOpen } from "../core/lock.js?v=106";
import { EXPIRY_SHEET, setBranchSheet } from "../data/expiry-data.js?v=114";
import { isHome } from "../core/session.js?v=106";
import { REPORT_NAMES } from "../core/report-names.js?v=106";
import { livePin, setLivePin, requirePin, pinUnlocked, downloadSheet } from "../stock/stock-card.js?v=106";
import { reviewHtml, loadCounts, cachedCounts, updateRow, recountRow, counterName } from "../stock/watch-count.js?v=112";
import { mergeEdits, writeEdits, expiryRows } from "../data/expiry-edits.js?v=106";

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFWORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

export function loadPdf() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = PDFJS;
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWORKER; res(window.pdfjsLib); };
    s.onerror = rej;
    document.head.append(s);
  });
}
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function locOf(line) {
  const s = line.toLowerCase();
  if (s.includes("mini store")) return "mini";
  if (s.includes("refuel")) return "refuel";
  if (s.includes("main store") || s.includes("stores")) return "stores";
  return null;
}
function matchProduct(products, line) {
  const n = norm(line), cells = line.split(/ {3,}/).map(norm), padded = ` ${n} `;
  // exact cell match first (code or report name), then the longest whole-word match,
  // so "BIB Coke Zero" never lands on "BIB COKE" and "SLUSH - Straw With Spoon" never on "Straw"
  const hit = REPORT_NAMES.find(r => (r.code && cells.includes(norm(r.code))) || (r.report && cells.includes(norm(r.report))))
    || REPORT_NAMES.filter(r => (r.code && padded.includes(` ${norm(r.code)} `)) || (r.report && padded.includes(` ${norm(r.report)} `)))
      .sort((a, b) => norm(b.report).length - norm(a.report).length)[0];
  if (hit) return products.find(p => p.id === hit.id) || hit;
  return products.find(p => (p.code && n.includes(norm(p.code))) || (p.sku && n.includes(norm(p.sku))));
}

export async function parseStockPdf(file, products) {
  const pdfjs = await loadPdf();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const text = await page.getTextContent();
    // rebuild each printed row from the item positions (top to bottom, left to right)
    const rows = new Map();
    text.items.filter(it => it.str.trim()).forEach(it => {
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], s: it.str.trim() });
    });
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => lines.push(r.sort((a, b) => a.x - b.x).map(c => c.s).join("   ")));
  }
  let loc = "mini";
  const found = [], unmatched = [];
  lines.forEach(line => {
    const next = locOf(line);
    if (next) loc = next;
    const p = matchProduct(products, line);
    const nums = line.match(/\d[\d,]*\.\d{2}/g);
    // an item row the catalog does not know: listed for the person uploading, never created
    if (!p && nums && !next && /[a-z]{3}/i.test(line) && !/\b(total|page|report|printed|date|warehouse|location|qty|quantity)\b/i.test(line))
      unmatched.push(`${line.replace(/\s{3,}/g, " · ").replace(/[\d,]+\.\d{2}.*$/, "").replace(/[\s·]+$/, "").slice(0, 80)} (${loc === "stores" ? "Main Stores" : loc === "mini" ? "Mini Store" : "Concession"})`);
    if (!p || !nums) return;
    const qty = Number(nums[0].replace(/,/g, ""));
    if (!Number.isFinite(qty)) return;
    found.push({ id: p.id, loc, qty, name: p.name, code: p.code || p.sku });
  });
  found.unmatched = unmatched;
  return found;
}

const rowsFor = id => expiryRows(id);
export function reviewGaps(products) {
  return products.map(p => {
    const rows = rowsFor(p.id);
    const batchQty = rows.reduce((a, r) => a + r.batches.reduce((s, b) => s + (Number(b.qty) || 0), 0), 0);
    const stock = ["mini", "refuel", "stores"].reduce((a, k) => a + (Number(p.stock?.[k]) || 0), 0);
    const gap = Math.abs(stock - batchQty);
    return gap > 0.05 && batchQty > 0 ? { p, stock, batchQty, gap } : null;
  }).filter(Boolean);
}

function gate(root) { root.innerHTML = `<section class="slab"><h2>Admin</h2><p class="note">For supervisors and the admin.</p></section>`; }
// keep the last uploaded copy of each system file on this device
export async function keepFile(key, file) {
  const buf = await file.arrayBuffer();
  const db = await new Promise((res, rej) => { const r = indexedDB.open("noir-uploads", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put({ name: file.name, type: file.type, at: new Date().toISOString(), buf }, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
// Expiry sheet. Unaizah: the uploaded sheet's groups go onto the rows of the sheet the site ships with.
// Any other branch: the uploaded sheet becomes that branch's own sheet (all its rows), saved in its Firestore.
// Either way the dated quantity per product and place comes back, so the caller can diff it against stock.
export async function importExpiry(file, loadExcel, products = [], save = null) {
  await keepFile("dates", file);
  await loadExcel();
  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const { readSheet } = await import("../data/expiry-sheet.js?v=114");
  const read = readSheet(wb, products), stocked = new Map();
  const add = r => { const total = r.batches.reduce((a, b) => a + (Number(b.qty) || 0), 0);
    if (r.productId && r.loc) { const k = r.productId + ":" + r.loc; stocked.set(k, { id: r.productId, loc: r.loc, qty: (stocked.get(k)?.qty || 0) + total }); } };
  let items = 0;
  if (isHome()) {
    const key = s => String(s || "").toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim(), edits = {};
    for (const r of read.rows) {
      const hit = EXPIRY_SHEET.rows.find(h => key(h.name) === key(r.name) && (!r.loc || h.loc === r.loc));
      if (!hit) continue;
      const edit = {}; r.batches.forEach(b => { if (b.qty !== "") edit["q" + b.n] = b.qty; if (b.date) edit["d" + b.n] = b.date; });
      for (let n = r.batches.length + 1; n <= hit.batches.length; n++) { edit["q" + n] = 0; edit["d" + n] = ""; }
      edits[String(hit.row)] = edit; add({ ...r, productId: hit.productId, loc: hit.loc });
    }
    mergeEdits(edits); items = Object.keys(edits).length;
  } else {
    const sheet = { file: file.name, sheet: read.sheet, rows: read.rows, at: new Date().toISOString() };
    setBranchSheet(sheet); writeEdits({});
    read.rows.forEach(add); items = read.rows.length;
    if (save) await save(sheet);
  }
  const found = [...stocked.values()].filter(x => products.some(p => p.id === x.id));
  return { items, found, unmatched: read.rows.filter(r => !r.productId).map(r => r.name) };
}
export function renderAdmin(root, H) {
  if (!isOpen()) return gate(root, H);
  draw(root, H);
}
// The admin panel: the watch count reports (match → Update, otherwise Recount), the edit PIN, the expiry sheet,
// and items whose stock and dated groups disagree.
// Opening the panel takes the admin PIN; writing a product's stock takes the edit PIN as well (stock-card.js requirePin),
// so the clock PIN alone never changes stock.
function draw(root, H) {
  const gaps = reviewGaps(H.data().products), hasPin = !!livePin();
  root.innerHTML = `<div id="wc-admin">${reviewHtml(cachedCounts(), H)}</div>
  <section class="slab">
    <div class="slab-h"><h2>Edit PIN &amp; dated groups</h2></div>
    <p class="note" style="margin-top:0">The edit PIN unlocks stock writes on this device for a few hours: Update on a watch count, Commit on a count sheet. It is never shown on screen.</p>
    <form class="pin-set" id="pin-set">
      ${hasPin ? `<input class="input data" name="cur" type="password" inputmode="numeric" autocomplete="off" placeholder="Current edit PIN" aria-label="Current edit PIN">` : ""}
      <input class="input data" name="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="New edit PIN, 6 digits" aria-label="New edit PIN">
      <button class="btn" type="submit">${hasPin ? "Change edit PIN" : "Set edit PIN"}</button>
    </form>
    <div class="review">
      <h3>Check: stock against dated groups · ${gaps.length}</h3>
      ${gaps.slice(0, 12).map(g => `<article class="use">${H.pic ? H.pic(g.p, "pic") : ""}<span><b>${H.esc(g.p.name)}</b><i>${H.esc(g.p.code || g.p.sku)}</i></span><em>stock ${H.qty(g.stock)} · dated ${H.qty(g.batchQty)}</em></article>`).join("") || `<p class="note">Every item matches its dated groups.</p>`}
    </div>
  </section>`;
  root.querySelector("#pin-set").onsubmit = e => {
    e.preventDefault(); const f = e.target, next = f.pin.value.trim();
    if (hasPin && f.cur.value.trim() !== livePin()) { f.cur.value = ""; H.toast("The current edit PIN is wrong", true); return; }
    if (!/^\d{6}$/.test(next)) { H.toast("The edit PIN is 6 digits", true); return; }
    setLivePin(next); H.toast("Edit PIN saved on this device"); draw(root, H);
  };
  wireCounts(root, H);
  loadCounts(true).then(() => paintCounts(root, H)).catch(() => {});
}
function paintCounts(root, H) { const host = root.querySelector("#wc-admin"); if (!host || host.contains(document.activeElement) && document.activeElement !== document.body) return; host.innerHTML = reviewHtml(cachedCounts(), H); wireCounts(root, H); }
function wireCounts(root, H) {
  const host = root.querySelector("#wc-admin"); if (!host) return;
  host.querySelector("#wc-xlsx")?.addEventListener("click", () => downloadSheet().then(() => H.toast("Excel downloaded with the updated quantities and dates")).catch(e => H.toast(e.message, true)));
  const run = async (b, fn, done) => {
    b.disabled = true;
    try { await fn(b.dataset.wcUp || b.dataset.wcRe, b.dataset.loc, counterName() || "admin"); H.toast(done); }
    catch (e) { H.toast(e.message, true); }
    host.innerHTML = reviewHtml(cachedCounts(), H); wireCounts(root, H);
  };
  host.querySelectorAll("[data-wc-up]").forEach(b => b.onclick = async () => {
    if (!livePin()) { H.toast("Set an edit PIN below first", true); return; }
    if (!pinUnlocked() && !await requirePin()) return;
    run(b, updateRow, "Stock updated · ready for Excel");
  });
  host.querySelectorAll("[data-wc-re]").forEach(b => b.onclick = () => run(b, recountRow, "Sent back for a recount · stock unchanged"));
}

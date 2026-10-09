// Settings · Edit PIN & expiry — reads the stock PDF (mozilla/pdf.js), imports the monthly expiry sheet (exceljs/exceljs),
// and lists products whose stock does not match their dated groups.
import { isOpen, unlock } from "../core/lock.js?v=106";
import { EXPIRY_SHEET } from "../data/expiry-data.js?v=106";
import { REPORT_NAMES } from "../core/report-names.js?v=106";
import { livePin, setLivePin, requirePin, pinUnlocked, downloadSheet } from "../stock/stock-card.js?v=106";
import { reviewHtml, loadCounts, cachedCounts, updateRow, recountRow, counterName } from "../stock/watch-count.js?v=112";
import { mergeEdits, expiryRows } from "../data/expiry-edits.js?v=106";

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

function gate(root, H) {
  root.innerHTML = `<section class="slab"><h2>Admin</h2><form id="adm"><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="Admin PIN" aria-label="Admin PIN"><button class="btn" type="submit">Open</button></form></section>`;
  root.querySelector("#adm").onsubmit = e => { e.preventDefault(); if (!unlock(e.target.pin.value)) { e.target.pin.value = ""; H.toast("Wrong PIN", true); return; } draw(root, H); };
}
// keep the last uploaded copy of each system file on this device
export async function keepFile(key, file) {
  const buf = await file.arrayBuffer();
  const db = await new Promise((res, rej) => { const r = indexedDB.open("noir-uploads", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put({ name: file.name, type: file.type, at: new Date().toISOString(), buf }, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
const cellText = v => String(v?.result ?? v?.text ?? v ?? "").trim();
const cellDate = v => v instanceof Date && !isNaN(v) ? v.toISOString().slice(0, 10) : (cellText(v).slice(0, 10) || "");
// Expiry sheet: groups 1–5 use the sheet columns (qty 5, date 6, then 7/8 …). Names match even with extra spaces.
// The dated quantity for that location is written onto system stock, so the file and the stock figure agree.
export async function importExpiry(file, loadExcel, products = [], saveProduct) {
  await keepFile("dates", file);
  await loadExcel();
  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = wb.worksheets[0], edits = {}, stocked = new Map();
  sheet.eachRow((row, n) => {
    if (n < 3) return;
    const name = cellText(row.getCell(2).value || row.getCell(3).value).toLowerCase().replace(/\s+/g, " ");
    const loc = cellText(row.getCell(3).value).toLowerCase();
    const hit = EXPIRY_SHEET.rows.find(r => name && (r.name || "").toLowerCase().replace(/\s+/g, " ") === name && (!loc || (r.location || "").toLowerCase().includes(loc) || loc.includes((r.loc || ""))));
    if (!hit) return;
    const edit = edits[String(hit.row)] || {};
    let total = 0;
    for (let g = 1; g <= 5; g++) {
      const qty = row.getCell(4 + g * 2 - 1).value, date = row.getCell(4 + g * 2).value;
      if (qty != null && qty !== "") { edit["q" + g] = qty; total += Number(qty) || 0; }
      const d = cellDate(date);
      if (d) edit["d" + g] = d;
    }
    if (Object.keys(edit).length) edits[String(hit.row)] = edit;
    if (hit.productId && hit.loc && total) stocked.set(hit.productId + ":" + hit.loc, { id: hit.productId, loc: hit.loc, qty: (stocked.get(hit.productId + ":" + hit.loc)?.qty || 0) + total });
  });
  mergeEdits(edits);
  let wrote = 0;
  if (saveProduct) {
    for (const { id, loc, qty } of stocked.values()) {
      const p = products.find(x => x.id === id);
      if (!p) continue;
      p.stock = { ...(p.stock || {}), [loc]: qty };
      await saveProduct(p, { silent: true });
      wrote++;
    }
  }
  return { items: Object.keys(edits).length, stock: wrote };
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

// Settings · Edit PIN & expiry — reads the stock PDF (mozilla/pdf.js), imports the monthly expiry sheet (exceljs/exceljs),
// and lists products whose stock does not match their dated groups.
import { isOpen, unlock } from "../core/lock.js?v=96";
import { EXPIRY_SHEET } from "../data/expiry-data.js?v=96";
import { REPORT_NAMES } from "../core/report-names.js?v=96";
import { livePin, rotatePin, downloadSheet } from "../stock/stock-card.js?v=96";

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
  const found = [];
  lines.forEach(line => {
    const next = locOf(line);
    if (next) loc = next;
    const p = matchProduct(products, line);
    const nums = line.match(/\d[\d,]*\.\d{2}/g);
    if (!p || !nums) return;
    const qty = Number(nums[0].replace(/,/g, ""));
    if (!Number.isFinite(qty)) return;
    found.push({ id: p.id, loc, qty, name: p.name, code: p.code || p.sku });
  });
  return found;
}

function rowsFor(id) {
  const over = JSON.parse(localStorage.getItem("noir-expiry-edits-v1") || "{}");
  return EXPIRY_SHEET.rows.filter(r => r.productId === id).map(r => ({ ...r, batches: r.batches.map(b => ({ ...b, qty: over[String(r.row)]?.["q" + b.n] ?? b.qty, date: over[String(r.row)]?.["d" + b.n] ?? b.date })) }));
}
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
  const ar = AR();
  root.innerHTML = `<section class="slab"><h2>${ar ? "خانة الأدمن" : "Admin"}</h2><form id="adm"><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="${ar ? "رقم الأدمن" : "Admin PIN"}"><button class="btn" type="submit">${ar ? "دخول" : "Open"}</button></form></section>`;
  root.querySelector("#adm").onsubmit = e => { e.preventDefault(); if (!unlock(e.target.pin.value)) { e.target.pin.value = ""; H.toast(ar ? "الرقم غلط" : "Wrong PIN", true); return; } draw(root, H); };
}
const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
// keep the last uploaded copy of each system file on this device
export async function keepFile(key, file) {
  const buf = await file.arrayBuffer();
  const db = await new Promise((res, rej) => { const r = indexedDB.open("noir-uploads", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put({ name: file.name, type: file.type, at: new Date().toISOString(), buf }, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
// Expiry sheet (Excel): quantity and date of each item's first group, matched by item name
export async function importExpiry(file, loadExcel) {
  await keepFile("dates", file);
  await loadExcel();
  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = wb.worksheets[0], edits = {};
  sheet.eachRow((row, n) => {
    if (n < 3) return;
    const name = String(row.getCell(2).value || row.getCell(3).value || "");
    const hit = EXPIRY_SHEET.rows.find(r => name && (r.name || "").toLowerCase() === name.toLowerCase());
    if (!hit) return;
    edits[String(hit.row)] = edits[String(hit.row)] || {};
    const qty = row.getCell(4).value, date = row.getCell(5).value;
    if (qty != null && qty !== "") edits[String(hit.row)].q1 = qty;
    if (date) edits[String(hit.row)].d1 = String(date).slice(0, 10);
  });
  localStorage.setItem("noir-expiry-edits-v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("noir-expiry-edits-v1") || "{}"), ...edits }));
  return Object.keys(edits).length;
}
export function renderAdmin(root, H) {
  if (!isOpen()) return gate(root, H);
  draw(root, H);
}
// Edit PIN for the product cards, the expiry sheet download, and items whose stock and dated groups disagree
function draw(root, H) {
  const ar = AR(), pin = livePin(), gaps = reviewGaps(H.data().products);
  root.innerHTML = `<section class="slab">
    <div class="slab-h"><h2>${ar ? "رقم التعديل والتواريخ" : "Edit PIN & expiry"}</h2></div>
    <p class="note" style="margin-top:0">${ar ? "رقم الموظف لتعديل بطاقة المنتج. بعد أي تعديل يتغير ولا يرجع القديم يفتح." : "Staff PIN for editing a product card. It changes after every edit; the old one stops working."}</p>
    <p class="pc-qty"><b id="live-pin">${pin}</b></p>
    <div class="btns">
      <button class="btn" id="new-pin" type="button">${ar ? "إصدار رقم جديد" : "New PIN"}</button>
      <button class="btn" id="dl-dates" type="button">${ar ? "تحميل ملف التواريخ بالتعديلات" : "Download the expiry sheet"}</button>
    </div>
    <div class="review">
      <h3>${ar ? "مراجعة: الكمية مقابل المجموعات المؤرخة" : "Check: stock against dated groups"} · ${gaps.length}</h3>
      ${gaps.slice(0, 12).map(g => `<article class="use">${H.pic ? H.pic(g.p, "pic") : ""}<span><b>${H.esc(g.p.name)}</b><i>${H.esc(g.p.code || g.p.sku)}</i></span><em>${ar ? "ستوك" : "stock"} ${H.qty(g.stock)} · ${ar ? "تواريخ" : "dated"} ${H.qty(g.batchQty)}</em></article>`).join("") || `<p class="note">${ar ? "الكمية تطابق مجموع المجموعات لكل صنف." : "Every item's stock matches its dated groups."}</p>`}
    </div>
  </section>`;
  root.querySelector("#new-pin").onclick = () => { root.querySelector("#live-pin").textContent = rotatePin(); H.toast(ar ? "رقم جديد. الرقم السابق توقف" : "New PIN. The old one has stopped"); };
  root.querySelector("#dl-dates").onclick = () => downloadSheet().then(() => H.toast(ar ? "ملف التواريخ نزل بالتعديلات" : "Expiry sheet downloaded")).catch(e => H.toast(e.message, true));
}

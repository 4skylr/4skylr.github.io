// Admin sync. PDF text: mozilla/pdf.js · Excel write-back: exceljs/exceljs · time: iamkun/dayjs
import { EXPIRY_SHEET } from "./expiry-data.js?v=44";
import { REPORT_NAMES } from "./report-names.js?v=44";
import { livePin, rotatePin, downloadSheet } from "./stock-card.js?v=28";

const SYNC_AT = "noir-sync-at";
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFWORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

function loadPdf() {
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
  const n = norm(line);
  const hit = REPORT_NAMES.find(r => (r.code && n.includes(norm(r.code))) || (r.report && n.includes(norm(r.report))));
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
    text.items.map(it => it.str).join(" ").split(/\s{2,}|\n/).forEach(bit => lines.push(bit));
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

const ADMIN = "899";
function gate(root, H) {
  root.innerHTML = `<section class="slab"><h2>خانة الأدمن</h2><form id="adm"><input class="input" name="pin" inputmode="numeric" placeholder="رقم الأدمن"><button class="btn" type="submit">دخول</button></form></section>`;
  root.querySelector("#adm").onsubmit = e => { e.preventDefault(); if (e.target.pin.value.trim() !== ADMIN) { H.toast("الرقم غلط"); return; } sessionStorage.setItem("noir-admin", "1"); draw(root, H); };
}
async function keepFile(key, file) {
  const buf = await file.arrayBuffer();
  const db = await new Promise((res, rej) => { const r = indexedDB.open("noir-uploads", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put({ name: file.name, type: file.type, at: new Date().toISOString(), buf }, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
export function renderAdmin(root, H) {
  if (sessionStorage.getItem("noir-admin") !== "1") return gate(root, H);
  draw(root, H);
}
function draw(root, H) {
  const pin = livePin();
  const at = localStorage.getItem(SYNC_AT);
  root.innerHTML = `<section class="slab">
    <div class="slab-h"><h2>مزامنة الجرد</h2><span class="tag">${at ? H.when(at) : "لا يوجد رفع"}</span></div>
    <p class="note">رقم الموظف الحالي. بعد أي تعديل على البطاقة يتغير ولا يعود القديم يفتح.</p>
    <p class="pc-qty"><b id="live-pin">${pin}</b></p>
    <div class="btns">
      <button class="btn" id="new-pin" type="button">إصدار رقم جديد</button>
      <button class="btn" id="dl-dates" type="button">تحميل ملف التواريخ بعد التعديل</button>
    </div>
    <div class="btns" style="margin-top:10px">
      <label class="btn" for="up-dates">رفع ملف التواريخ</label><input id="up-dates" type="file" accept=".xlsx,.xls" hidden>
      <label class="btn hot" for="up-stock">رفع تقرير الستوك PDF</label><input id="up-stock" type="file" accept="application/pdf,.pdf" hidden>
    </div>
    <div id="review"></div>
  </section>`;
  root.querySelector("#new-pin").onclick = () => {
    root.querySelector("#live-pin").textContent = rotatePin();
    H.toast("رقم جديد. الرقم السابق توقف");
  };
  root.querySelector("#dl-dates").onclick = () => downloadSheet().then(() => H.toast("ملف التواريخ نزل بالتعديلات")).catch(e => H.toast(e.message, true));
  root.querySelector("#up-dates").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    await keepFile("dates", f);
    await H.loadExcel();
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(await f.arrayBuffer());
    const sheet = wb.worksheets[0];
    const edits = {};
    sheet.eachRow((row, n) => {
      if (n < 3) return;
      const name = String(row.getCell(2).value || row.getCell(3).value || "");
      const hit = EXPIRY_SHEET.rows.find(r => name && (r.name || "").toLowerCase() === name.toLowerCase());
      if (!hit) return;
      edits[String(hit.row)] = edits[String(hit.row)] || {};
      const qty = row.getCell(4).value;
      const date = row.getCell(5).value;
      if (qty != null && qty !== "") edits[String(hit.row)].q1 = qty;
      if (date) edits[String(hit.row)].d1 = String(date).slice(0, 10);
    });
    localStorage.setItem("noir-expiry-edits-v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("noir-expiry-edits-v1") || "{}"), ...edits }));
    H.toast("ملف التواريخ اندمج");
    e.target.value = "";
  };
  root.querySelector("#up-stock").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    await keepFile("stock", f);
    const products = H.data().products;
    const found = await parseStockPdf(f, products);
    const byId = {};
    found.forEach(row => {
      byId[row.id] = byId[row.id] || { ...products.find(p => p.id === row.id) };
      byId[row.id].stock = { ...byId[row.id].stock, [row.loc]: row.qty };
    });
    for (const doc of Object.values(byId)) await H.saveProduct(doc, { silent: true });
    localStorage.setItem(SYNC_AT, new Date().toISOString());
    const gaps = reviewGaps(H.data().products);
    root.querySelector("#review").innerHTML = `<h3>مراجعة الفروقات · ${gaps.length}</h3>` + gaps.slice(0, 12).map(g => `<article class="use"><img class="pic" src="${H.esc(H.src(g.p.image || ""))}" alt=""><span><b>${H.esc(g.p.name)}</b><i>${H.esc(g.p.code || g.p.sku)}</i></span><em>ستوك ${H.qty(g.stock)} · تواريخ ${H.qty(g.batchQty)}</em></article>`).join("") || `<p class="note">لا فروقات بين الكمية ومجموع المجموعات.</p>`;
    H.toast(`تحدث ${Object.keys(byId).length} منتج من تقرير الستوك`);
    e.target.value = "";
  };
}

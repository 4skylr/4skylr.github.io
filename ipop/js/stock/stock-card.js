// Product card, barcode labels, scanner, 3-hour edit pin, Excel write-back.
// Libraries (jsDelivr builds of GitHub repos):
//   JsBarcode     github.com/lindell/JsBarcode
//   html5-qrcode  github.com/mebjas/html5-qrcode
//   ExcelJS       github.com/exceljs/exceljs
import { EXPIRY_SHEET, PIN_HOURS } from "../data/expiry-data.js?v=104";
import { BARCODES } from "../data/barcodes.js?v=104";
import { mountGauges } from "./indicators.js?v=104";
import { renderScanCard } from "./scan-view.js?v=104";
import { readEdits, writeEdits, expiryRows } from "../data/expiry-edits.js?v=104";

const UNLOCK = "noir-edit-until";
const LIB = {
  bar: "vendor/jsbarcode.all.min.js",
  zxingLib: "vendor/zxing-library.js",
  zxing: "vendor/zxing-browser.js",
  pdf: "vendor/pdf-lib.min.js",
  xlsx: "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"
};
const SITE = "https://4skylr.github.io/ipop/";
const loading = new Map();
const loadScript = src => loading.get(src) || loading.set(src, new Promise((res, rej) => {
  const s = document.createElement("script"); s.src = src; s.async = true;
  s.onload = () => res(); s.onerror = () => { loading.delete(src); rej(new Error(src)); };
  document.head.append(s);
})).get(src);

let H = null;
const edits = readEdits, saveEdits = writeEdits;
export function livePin() {
  let pin = localStorage.getItem("noir-live-pin");
  if (!pin) { pin = String(Math.floor(100000 + Math.random() * 900000)); localStorage.setItem("noir-live-pin", pin); }
  return pin;
}
export function rotatePin() {
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  localStorage.setItem("noir-live-pin", pin);
  localStorage.removeItem(UNLOCK);
  return pin;
}
export const pinUnlocked = () => Number(localStorage.getItem(UNLOCK) || 0) > Date.now();
export const pinLeft = () => Math.max(0, Number(localStorage.getItem(UNLOCK) || 0) - Date.now());

export function productUrl(id) { return `${SITE}?p=${id}`; }
export function idFromCode(raw) {
  const s = String(raw || "").trim();
  const q = s.match(/[?&]p=([a-z0-9-]+)/i);
  if (q) return q[1];
  const hash = s.match(/#p\/([a-z0-9-]+)/i);
  if (hash) return hash[1];
  const m = s.match(/^NC-(.+)$/i);
  return m ? m[1] : s;
}

const rowsFor = id => expiryRows(id);
function fmtDate(v) {
  if (!v) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) {
    const [y, m, d] = String(v).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return String(v);
}
function asDate(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) return new Date(String(v).slice(0, 10) + "T00:00:00");
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(v))) { const [d, m, y] = String(v).split("/"); return new Date(`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}T00:00:00`); }
  return null;
}
function daysLeft(v) {
  const dt = asDate(v);
  if (!dt || isNaN(dt)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0); // whole days from today, so the count does not flip at noon
  return Math.round((dt - today) / 86400000);
}
export function requirePin() {
  if (pinUnlocked()) return Promise.resolve(true);
  return new Promise(resolve => {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="veil"><div class="sheet narrow" role="dialog" aria-modal="true">
      <h2>Edit <span class="voice">lock</span></h2>
      <p class="lede">A pin opens edits for ${PIN_HOURS} hours. Scanning a barcode never changes stock.</p>
      <form id="pin-form" class="form"><div class="fields"><div class="fl full"><label for="pin">Secret pin</label>
        <input class="input data" id="pin" inputmode="numeric" autocomplete="off" placeholder="6 digits"></div></div>
        <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn hot" type="submit">Unlock</button></div></form>
    </div></div>`;
    let done = false;
    const close = ok => { if (done) return; done = true; obs.disconnect(); root.innerHTML = ""; resolve(ok); };
    // Cancel, a tap on the dimmed page, or the sheet being closed some other way (Escape) all mean "no"
    const veil = root.querySelector(".veil");
    veil.onclick = e => { if (e.target === veil || e.target.closest("[data-close]")) close(false); };
    const obs = new MutationObserver(() => { if (!root.contains(veil)) { done = true; obs.disconnect(); resolve(false); } });
    obs.observe(root, { childList: true });
    setTimeout(() => root.querySelector("#pin")?.focus(), 40);
    root.querySelector("#pin-form").onsubmit = e => {
      e.preventDefault();
      if (root.querySelector("#pin").value.trim() !== livePin()) { const n=root.querySelector(".lede"); if(n) n.textContent="Wrong pin."; return; }
      localStorage.setItem(UNLOCK, String(Date.now() + PIN_HOURS * 3600000));
      H?.toast?.(`Unlocked for ${PIN_HOURS} hours`);
      close(true);
    };
  });
}

export function openProductCard(p, helpers) {
  H = helpers;
  if (!p) return;
  const host = document.createElement("div");
  H.openModal("", "wide");
  const sheet = document.querySelector("#modal-root .sheet");
  sheet.innerHTML = ""; sheet.append(host);
  renderScanCard(host, p, { H, rowsFor, daysLeft, fmtDate, asDate, savedMark, mountGauges, writeOff });
}

export async function applyCountToSheet(locationId, counts) {
  const all = edits();
  Object.entries(counts || {}).forEach(([id, qty]) => {
    const row = EXPIRY_SHEET.rows.find(r => r.productId === id && r.loc === locationId);
    if (!row) return;
    all[String(row.row)] = all[String(row.row)] || {};
    all[String(row.row)].q1 = qty;
  });
  saveEdits(all);
}

export async function downloadSheet() {
  await loadScript(LIB.xlsx);
  const res = await fetch("assets/expiry-template.xlsx");
  if (!res.ok) throw new Error("Expiry template missing");
  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  const ws = wb.getWorksheet(EXPIRY_SHEET.sheet) || wb.worksheets[0];
  // the sheet with every saved change: counts from the watch, edits on the card, imports (groups 1–5, emptied groups, added rows)
  const put = (row, b) => {
    const raw = b.qty, num = Number(String(raw ?? "").replace(/g$/i, ""));
    if (raw === 0 && b.date === "") { ws.getCell(row, b.qtyCol).value = null; ws.getCell(row, b.dateCol).value = null; return; }
    if (raw != null && raw !== "") ws.getCell(row, b.qtyCol).value = Number.isFinite(num) && !/[a-z]/i.test(String(raw)) ? num : raw;
    // Excel dates carry no time zone: write midnight UTC, or the sheet shows the day before in Riyadh
    if (b.date) ws.getCell(row, b.dateCol).value = /^\d{4}-\d{2}-\d{2}/.test(b.date) ? new Date(b.date.slice(0, 10) + "T00:00:00Z") : b.date;
  };
  const all = edits(), rows = expiryRows(null, all);
  let last = Math.max(...EXPIRY_SHEET.rows.map(r => r.row)), sr = Math.max(...EXPIRY_SHEET.rows.map(r => Number(r.sr) || 0));
  rows.forEach(r => {
    if (r.added) {
      last++; sr++;
      ws.getCell(last, 2).value = sr; ws.getCell(last, 3).value = r.name; ws.getCell(last, 4).value = r.location;
      r.batches.forEach(b => put(last, b));
    } else if (all[String(r.row)]) r.batches.forEach(b => put(r.row, b));
  });
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = "MONTHLY EXPIRY MONITORING SHEET September 2026.xlsx";
  a.click();
}

function batchSummary(id) {
  const rows = rowsFor(id);
  const batches = rows.flatMap(r => r.batches.filter(b => b.qty != null && b.qty !== "" && Number(b.qty) !== 0).map(b => ({ ...b, location: r.location })));
  return { rows, batches, count: batches.length };
}
export function savedMark(id) { return BARCODES[id] || { code: `NC-${id}`, url: productUrl(id), barcode: "", qr: "" }; }
export async function mountLabelSheet(root, products, helpers) {
  H = helpers;
  root.innerHTML = `<p class="note no-print">Saved barcodes. Phone scan opens only that product card. Cut on the dashed line, 8 × 8 cm.</p><div class="label-sheet" id="label-sheet"></div>`;
  const box = root.querySelector("#label-sheet");
  box.innerHTML = products.map(p => {
    const m = savedMark(p.id);
    const img = p.image ? H.src(p.image) : "";
    const sum = batchSummary(p.id);
    return `<article class="cut"><img class="logo" alt="" src="${H.esc(img)}"><img class="qr" alt="Scan ${H.esc(p.name)}" src="${H.esc(m.qr)}"><b>${H.esc(p.name)}</b></article>`;
  }).join("");
}
export async function mountProductPage(root, p, helpers) {
  H = helpers;
  renderScanCard(root, p, { H, rowsFor, daysLeft, fmtDate, asDate, savedMark, mountGauges, writeOff, requirePin, rotatePin });
}

async function writeOff(p, batch) {
  if (!await requirePin()) return;
  const all = edits();
  const row = rowsFor(p.id).find(r => r.location === batch.location);
  if (!row) return;
  all[String(row.row)] = all[String(row.row)] || {};
  all[String(row.row)][`q${batch.n}`] = 0;
  saveEdits(all);
  H.toast("Batch written off · Excel download includes it");
  mountProductPage(document.getElementById("scan-root") || document.getElementById("view"), p, H);
}
export async function printBarcodes() { location.hash = "labels"; }

// Camera scanner for the printed labels (QR with the product link, Code 128 "NC-<id>"). The labels themselves are unchanged.
// Reads with the phone's own BarcodeDetector when it has one, else zxing-cpp (Sec-ant/zxing-wasm, vendor/zxing-reader.mjs),
// else the older ZXing JS reader. Frames are read a few times a second; the first hit closes the camera.
let scanner = null;
const ZXW = "../../vendor/zxing-reader.mjs";
let zxwP = null;
const zxw = () => zxwP ??= import(/* @vite-ignore */ ZXW).then(m => { m.prepareZXingModule({ overrides: { locateFile: (f, prefix) => f.endsWith(".wasm") ? new URL("../../vendor/zxing_reader.wasm", import.meta.url).href : prefix + f } }); return m; });
export async function openScanner(helpers, onId) {
  H = helpers; scanner?.stop(); // a second open never leaves the first camera running
  const ar = (sessionStorage.getItem("noir-lang") || "en") === "ar";
  H.openModal(`<h2>${ar ? "امسح" : "Scan"} <span class="voice">${ar ? "الملصق" : "a label"}</span></h2><p class="lede">${ar ? "وجّه الكاميرا على الباركود أو الـ QR. تنفتح بطاقة المنتج مباشرة." : "Point the camera at the barcode or QR. The product opens straight away."}</p>
    <div style="position:relative"><video id="zx" style="width:100%;border-radius:16px;background:#000;display:block" playsinline muted autoplay></video>
    <p id="zx-msg" class="note" style="text-align:center"></p></div><div class="form-actions"><button class="btn ghost" data-close type="button">${ar ? "إغلاق" : "Close"}</button></div>`);
  const video = document.getElementById("zx"), msg = document.getElementById("zx-msg");
  let stream = null, done = false, timer = 0;
  const stop = () => { done = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  scanner = { stop };
  document.querySelector("#modal-root [data-close]")?.addEventListener("click", stop);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (e) { msg.textContent = ar ? "ما قدرنا نفتح الكاميرا. اسمح للموقع باستخدامها من إعدادات المتصفح." : "The camera could not start. Allow camera access for this site in the browser settings."; throw e; }
  if (!document.body.contains(video)) { stop(); return; }
  video.srcObject = stream; await video.play().catch(() => {});
  // pick a reader
  let read = null;
  if ("BarcodeDetector" in window) {
    try { const fm = await window.BarcodeDetector.getSupportedFormats(); if (fm.includes("qr_code")) { const det = new window.BarcodeDetector({ formats: ["qr_code", "code_128"].filter(f => fm.includes(f)) }); read = async c => (await det.detect(c))[0]?.rawValue || null; } } catch {}
  }
  if (!read) { try { const zx = await zxw(); read = async c => { const g = c.getContext("2d", { willReadFrequently: true }); const r = await zx.readBarcodes(g.getImageData(0, 0, c.width, c.height), { formats: ["QRCode", "Code128"], tryHarder: true, maxNumberOfSymbols: 1 }); return r.find(x => x.isValid)?.text || null; }; } catch {} }
  if (!read) {
    await loadScript(LIB.zxingLib); await loadScript(LIB.zxing);
    const R = new window.ZXingBrowser.BrowserMultiFormatReader();
    read = async c => { try { return R.decodeFromCanvas(c).getText(); } catch { return null; } };
  }
  const canvas = document.createElement("canvas");
  const tick = async () => {
    if (done) return;
    if (!document.body.contains(video)) { stop(); return; }
    if (video.readyState >= 2 && video.videoWidth) {
      const w = Math.min(1280, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
      if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
      canvas.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0, w, h);
      const text = await read(canvas).catch(() => null);
      if (text && !done) { stop(); onId(idFromCode(text)); return; }
    }
    timer = setTimeout(tick, 180);
  };
  tick();
}
export async function exportLabelsPdf(products) {
  await loadScript(LIB.pdf);
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const size = 8 / 2.54 * 72;
  const pageW = 595.28, pageH = 841.89, gap = 6, cols = 3;
  let page = pdf.addPage([pageW, pageH]);
  let x = 28, y = pageH - 28 - size;
  for (const p of products) {
    const m = savedMark(p.id);
    if (x + size > pageW - 20) { x = 28; y -= size + gap; }
    if (y < 28) { page = pdf.addPage([pageW, pageH]); x = 28; y = pageH - 28 - size; }
    page.drawRectangle({ x, y, width: size, height: size, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.4 });
    if (m.qr) {
      const bytes = await fetch(m.qr).then(r => r.arrayBuffer());
      const img = await pdf.embedPng(bytes);
      page.drawImage(img, { x: x + 28, y: y + 52, width: 62, height: 62 });
    }
    const name = String(p.name || p.id).slice(0, 28);
    if (p.image) {
      try {
        const bytes = await fetch(p.image).then(r => r.arrayBuffer());
        const photo = p.image.endsWith(".png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        page.drawImage(photo, { x: x + 8, y: y + size - 78, width: 62, height: 62 });
      } catch {}
    }
    page.drawText(name, { x: x + 6, y: y + 16, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
    x += size + gap;
  }
  const blob = new Blob([await pdf.save()], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ipop-labels.pdf";
  a.click();
}

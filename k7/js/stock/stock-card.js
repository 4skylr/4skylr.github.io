// Product card, barcode labels, scanner, 3-hour edit pin, Excel write-back.
// Libraries (jsDelivr builds of GitHub repos):
//   JsBarcode     github.com/lindell/JsBarcode
//   html5-qrcode  github.com/mebjas/html5-qrcode
//   ExcelJS       github.com/exceljs/exceljs
import { EXPIRY_SHEET, PIN_HOURS } from "../data/expiry-data.js?v=93";
import { BARCODES } from "../data/barcodes.js?v=93";
import { mountGauges } from "./indicators.js?v=93";
import { saveEdits as saveEditsDb } from "../finance/ledger-store.js?v=93";
import { renderScanCard } from "./scan-view.js?v=93";

const KEY = "noir-expiry-edits-v1";
const UNLOCK = "noir-edit-until";
const LIB = {
  bar: "vendor/jsbarcode.all.min.js",
  zxingLib: "vendor/zxing-library.js",
  zxing: "vendor/zxing-browser.js",
  dayjs: "vendor/dayjs.min.js",
  relative: "vendor/relativeTime.js",
  pdf: "vendor/pdf-lib.min.js",
  xlsx: "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"
};
const SITE = "https://4skylr.github.io/noir-stock/";
const loading = new Map();
const loadScript = src => loading.get(src) || loading.set(src, new Promise((res, rej) => {
  const s = document.createElement("script"); s.src = src; s.async = true;
  s.onload = () => res(); s.onerror = () => { loading.delete(src); rej(new Error(src)); };
  document.head.append(s);
})).get(src);

let H = null;
const edits = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const saveEdits = e => localStorage.setItem(KEY, JSON.stringify(e));
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

function rowsFor(id) {
  const over = edits();
  return EXPIRY_SHEET.rows.filter(r => r.productId === id).map(r => {
    const o = over[String(r.row)] || {};
    return { ...r, batches: r.batches.map(b => ({ ...b, qty: o[`q${b.n}`] ?? b.qty, date: o[`d${b.n}`] ?? b.date })) };
  });
}
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
  return Math.round((dt - new Date()) / 86400000);
}
export function requirePin() {
  if (pinUnlocked()) return Promise.resolve(true);
  return new Promise(resolve => {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-back" data-close><div class="sheet" role="dialog" aria-modal="true">
      <h2>Edit <span class="voice">lock</span></h2>
      <p class="lede">A pin opens edits for ${PIN_HOURS} hours. Scanning a barcode never changes stock.</p>
      <form id="pin-form" class="form"><div class="fields"><div class="fl full"><label for="pin">Secret pin</label>
        <input class="input data" id="pin" inputmode="numeric" autocomplete="off" placeholder="6 digits"></div></div>
        <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn hot" type="submit">Unlock</button></div></form>
    </div></div>`;
    const close = ok => { root.innerHTML = ""; resolve(ok); };
    root.querySelectorAll("[data-close]").forEach(n => n.onclick = e => { if (e.target === n || n.hasAttribute("data-close")) close(false); });
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
  if (sheet) { sheet.innerHTML = ""; sheet.append(host); renderScanCard(host, p, { H, rowsFor, daysLeft, fmtDate, asDate, savedMark, mountGauges, writeOff }); return; }

  const rows = rowsFor(p.id);
  const locRows = H.LOCATIONS.map(l => {
    const n = Number(p.stock?.[l.id]) || 0;
    const sheet = rows.find(r => r.loc === l.id);
    return { l, n, sheet };
  });
  const soon = rows.flatMap(r => r.batches.map(b => ({ ...b, location: r.location, left: daysLeft(b.date) }))).filter(b => b.left != null && b.left <= 45);
  const html = `<div class="card-top">${H.pic(p, "pic")}<div>
      <p class="kicker">${H.esc(p.sku || "")}</p><h2>${H.esc(p.name)}</h2>
      <p class="lede">${H.qty(H.total(p))} ${H.esc(H.UNITS[p.unit] || "")} across all warehouses · phone QR</p>
      <img class="scan-qr" alt="" id="card-qr">
    </div></div>
    <section class="yield-panel"><div class="slab-h"><h2>On hand</h2><span class="tag">does not rename the product</span></div>
      <div class="uses">${locRows.map(x => `<div class="use"><span class="u-name">${H.esc(x.l.name)}</span><span class="u-per">${x.sheet ? H.esc(x.sheet.location) : ""}</span><b class="data">${H.qty(x.n)}</b></div>`).join("")}
      <div class="use"><span class="u-name">All warehouses</span><span class="u-per">total</span><b class="data">${H.qty(H.total(p))}</b></div></div></section>
    <section class="yield-panel"><div class="slab-h"><h2>Expiry batches</h2><span class="tag">${soon.length ? soon.length + " inside 45 days" : "from the September sheet"}</span></div>
      ${rows.length ? rows.map(r => `<p class="note" style="margin:10px 0 4px">${H.esc(r.location)} · row ${r.sr}</p><div class="uses">${r.batches.map(b => {
        return `<div class="use"><span class="u-name">Batch ${b.n}</span><span class="u-per data">${H.esc(fmtDate(b.date))}<i data-exp="${H.esc(asDate(b.date)?.toISOString() || "")}"></i></span><b class="data">${H.esc(b.qty ?? "—")}</b></div>`;
      }).join("") || `<p class="note">No batch on file.</p>`}</div>`).join("") : `<p class="note">This item is not on the September expiry sheet.</p>`}
      ${pinUnlocked() ? `<div class="form-actions" style="margin-top:12px"><button class="btn sm" id="edit-exp" type="button">Edit batches</button></div>` : `<p class="note">Batch edits need the pin. Unlock lasts ${PIN_HOURS} hours.</p><button class="btn sm" id="unlock" type="button">Unlock edits</button>`}
    </section>
    <div class="form-actions"><button class="btn ghost" data-close type="button">Close</button><button class="btn" id="print-one" type="button">Print this barcode</button></div>`;
  H.openModal(html, "wide");
  const mark = savedMark(p.id); const img = document.getElementById("card-qr"); if (img) img.src = mark.qr;
  document.getElementById("print-one")?.addEventListener("click", () => { location.hash = "labels"; });
  document.getElementById("unlock")?.addEventListener("click", async () => { if (await requirePin()) openProductCard(p, H); });
  document.getElementById("edit-exp")?.addEventListener("click", () => editBatches(p));
}

function editBatches(p) {
  const rows = rowsFor(p.id);
  const fields = rows.flatMap(r => r.batches.map(b => `<div class="fl"><label>Batch ${b.n} qty · ${H.esc(r.location)}</label><input class="input data" data-row="${r.row}" data-k="q${b.n}" value="${H.esc(b.qty ?? "")}"></div>
    <div class="fl"><label>Batch ${b.n} expiry</label><input class="input data" data-row="${r.row}" data-k="d${b.n}" value="${H.esc(b.date ?? "")}" placeholder="2027-04-19"></div>`)).join("");
  H.openModal(`<h2>Batches · ${H.esc(p.name)}</h2><p class="lede">Saved into the September sheet and included in the next Excel download.</p>
    <form id="bf" class="form"><div class="fields">${fields || `<p class="note">No batches to edit.</p>`}</div>
    <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn hot" type="submit">Save to sheet</button></div></form>`, "wide");
  document.getElementById("bf")?.addEventListener("submit", e => {
    e.preventDefault();
    const all = edits();
    document.querySelectorAll("#bf [data-row]").forEach(inp => {
      const row = inp.dataset.row; all[row] = all[row] || {}; all[row][inp.dataset.k] = inp.value.trim();
    });
    saveEdits(all);
    rotatePin(); H.toast("انحفظ وتغير الرقم السري");
    openProductCard(p, H);
  });
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
  const all = edits();
  EXPIRY_SHEET.rows.forEach(r => {
    const o = all[String(r.row)]; if (!o) return;
    r.batches.forEach(b => {
      if (o[`q${b.n}`] != null && o[`q${b.n}`] !== "") {
        const raw = o[`q${b.n}`];
        const num = Number(String(raw).replace(/g$/i, ""));
        ws.getCell(r.row, b.qtyCol).value = Number.isFinite(num) && String(raw).trim() !== "" && !/[a-z]/i.test(String(raw)) ? num : raw;
      }
      if (o[`d${b.n}`]) {
        const v = o[`d${b.n}`];
        ws.getCell(r.row, b.dateCol).value = /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.slice(0, 10) + "T00:00:00") : v;
      }
    });
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
  await loadScript("vendor/decimal.min.js").catch(() => {});
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
  await saveEditsDb(all);
  H.toast("Batch written off · Excel download includes it");
  mountProductPage(document.getElementById("scan-root") || document.getElementById("view"), p, H);
}
export async function printBarcodes() { location.hash = "labels"; }

let scanner = null;
export async function openScanner(helpers, onId) {
  H = helpers;
  await loadScript(LIB.zxingLib);
  await loadScript(LIB.zxing);
  H.openModal(`<h2>Scan <span class="voice">a label</span></h2><p class="lede">ZXing reads the saved barcode. It opens that card only.</p><video id="zx" style="width:100%;border-radius:16px;background:#000" playsinline></video><div class="form-actions"><button class="btn ghost" data-close type="button">Close</button></div>`);
  const Reader = window.ZXingBrowser?.BrowserMultiFormatReader;
  if (!Reader) throw new Error("ZXing missing");
  const reader = new Reader();
  let done = false;
  const controls = await reader.decodeFromVideoDevice(undefined, "zx", (result) => {
    if (done || !result) return;
    done = true;
    controls.stop();
    onId(idFromCode(result.getText()));
  });
  scanner = controls;
  document.querySelector("#modal-root [data-close]")?.addEventListener("click", () => controls.stop());
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
  a.download = "noir-stock-labels.pdf";
  a.click();
}

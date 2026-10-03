// The smart reader: PDF or photo in, ledger fields out.
//   1. pdf.js (mozilla/pdf.js) renders each page and gives the text layer when the PDF has one
//   2. zxing-wasm (Sec-ant/zxing-wasm, the zxing-cpp engine) finds the ZATCA e-invoice QR, tried at several sizes and crops
//   3. Tesseract.js (naptha/tesseract.js) reads scans and photos in Arabic + English when there is no text layer
//   4. extract.js turns the text into fields; the QR overrides anything it carries (it is exact)
import { decodeZatca } from "./zatca.js";
import { extract } from "./extract.js";

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFWORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
let pdfP = null, zxP = null, ocrP = null;
function pdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfP ??= new Promise((res, rej) => { const s = document.createElement("script"); s.src = PDFJS; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWORKER; res(window.pdfjsLib); }; s.onerror = () => { pdfP = null; rej(new Error("Could not load the PDF reader")); }; document.head.append(s); });
}
function zxing() {
  return zxP ??= import("../vendor/zxing-reader.mjs").then(m => {
    m.prepareZXingModule({ overrides: { locateFile: (p, prefix) => p.endsWith(".wasm") ? new URL("../vendor/zxing_reader.wasm", import.meta.url).href : prefix + p } });
    return m;
  });
}
function ocr(onProgress) {
  return ocrP ??= import("../vendor/tesseract.esm.min.js").then(async m => {
    const T = m.default || m;
    const w = await T.createWorker(["ara", "eng"], 1, { logger: x => x.status === "recognizing text" && reader.onOcr?.(x.progress) });
    await w.setParameters({ preserve_interword_spaces: "1", tessedit_pageseg_mode: "6" });
    return w;
  }).catch(e => { ocrP = null; throw e; });
}
export const reader = { onOcr: null };

const canvasOf = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
function scaled(src, width, crop) {
  const sx = crop?.x || 0, sy = crop?.y || 0, sw = crop?.w || src.width, sh = crop?.h || src.height;
  const k = width / sw, c = canvasOf(Math.round(sw * k), Math.round(sh * k)), g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high"; g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
// grey + stretch contrast: helps both the QR and the OCR on faded thermal paper
function enhance(c) {
  const g = c.getContext("2d", { willReadFrequently: true }), im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  let lo = 255, hi = 0; const grey = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; grey[j] = v; }
  const hist = new Uint32Array(256); grey.forEach(v => hist[v]++);
  let acc = 0; const n = grey.length; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.01 && lo === 255) lo = v; if (acc > n * 0.99) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = Math.max(0, Math.min(255, (grey[j] - lo) * 255 / span)); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
}
// Otsu threshold: pure black text on white for a second OCR pass
function binarize(c) {
  const g = c.getContext("2d", { willReadFrequently: true }), im = g.getImageData(0, 0, c.width, c.height), d = im.data, hist = new Float64Array(256);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  const n = d.length / 4; let sum = 0; for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sB = 0, wB = 0, best = 0, th = 128;
  for (let v = 0; v < 256; v++) { wB += hist[v]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += v * hist[v]; const mB = sB / wB, mF = (sum - sB) / wF, between = wB * wF * (mB - mF) ** 2; if (between > best) { best = between; th = v; } }
  for (let i = 0; i < d.length; i += 4) { const v = d[i] > th ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(im, 0, 0); return c;
}
async function findQr(src) {
  const zx = await zxing();
  const tryC = async (c, o = {}) => { const g = c.getContext("2d", { willReadFrequently: true }); const r = await zx.readBarcodes(g.getImageData(0, 0, c.width, c.height), { formats: ["QRCode"], tryHarder: true, tryRotate: true, tryDownscale: true, maxNumberOfSymbols: 4, ...o }); return r.map(x => x.text); };
  const W = src.width, plans = [[Math.min(W, 1600)], [Math.max(1200, W * 2)], [Math.max(1200, W * 2), { binarizer: "GlobalHistogram" }], [Math.max(1600, W * 3), { tryDenoise: true }]];
  for (const [w, o] of plans) {
    const texts = await tryC(enhance(scaled(src, Math.min(w, 4000))), o);
    const z = texts.map(decodeZatca).find(Boolean); if (z) return { ...z, raw: texts.find(t => decodeZatca(t)) };
  }
  // receipts are long: look at overlapping thirds
  const H = src.height, step = Math.round(H / 6);
  for (let y = 0; y < H - step; y += step) {
    const texts = await tryC(enhance(scaled(src, Math.min(2400, W * 3), { x: 0, y, w: W, h: Math.min(Math.round(H / 3), H - y) })));
    const z = texts.map(decodeZatca).find(Boolean); if (z) return { ...z, raw: texts.find(t => decodeZatca(t)) };
  }
  return null;
}
async function pdfPages(file) {
  const lib = await pdfjs(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
    const page = await doc.getPage(i), v = page.getViewport({ scale: 1 }), k = Math.min(3, 2000 / v.width);
    const c = canvasOf(Math.round(v.width * k), Math.round(v.height * k));
    await page.render({ canvasContext: c.getContext("2d"), viewport: page.getViewport({ scale: k }) }).promise;
    const tc = await page.getTextContent(), rows = new Map();
    tc.items.forEach(it => { if (!it.str.trim()) return; const y = Math.round(it.transform[5]); const key = [...rows.keys()].find(q => Math.abs(q - y) <= 2) ?? y; if (!rows.has(key)) rows.set(key, []); rows.get(key).push({ x: it.transform[4], s: it.str }); });
    const text = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(c => c.s).join("  ")).join("\n");
    pages.push({ canvas: c, text });
  }
  await doc.destroy();
  return pages;
}
async function imagePages(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 2400 / bmp.width), c = canvasOf(Math.round(bmp.width * k), Math.round(bmp.height * k));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return [{ canvas: c, text: "" }];
}
const jpeg = (c, w = 900, q = 0.78) => scaled(c, Math.min(w, c.width)).toDataURL("image/jpeg", q);
async function sha(file) { const h = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32); }

// stage(name) is called as the work moves: render · qr · text · ocr · fields
export async function readInvoice(file, { mem, stage = () => {}, forceOcr = false } = {}) {
  const t0 = performance.now(), isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  stage("render");
  const pages = isPdf ? await pdfPages(file) : await imagePages(file);
  if (!pages.length) throw new Error("Empty file");
  stage("qr");
  let qr = null;
  for (const p of pages) { qr = await findQr(p.canvas).catch(() => null); if (qr) break; }
  let text = pages.map(p => p.text).join("\n"), source = "text";
  const usable = t => (t.match(/\d/g) || []).length > 20 && t.replace(/\s/g, "").length > 80;
  if (forceOcr || !usable(text)) {
    stage("ocr"); source = "ocr";
    const w = await ocr();
    const parts = [];
    const widthFor = W => W < 1000 ? Math.round(W * 2) : Math.min(2400, Math.max(1600, W));
    for (const p of pages) parts.push((await w.recognize(enhance(scaled(p.canvas, widthFor(p.canvas.width))))).data.text);
    text = parts.join("\n");
    // second look when the key fields did not come out: another scale, pure black and white.
    // The first reading stays; the second only fills what the first missed.
    let fields = extract(text, { qr, mem, source });
    const weak = f => !f.vatNo || !f.date || !f.total || f.total.src === "derived" || !f.supplierEn || f.supplierEn.conf < 0.5;
    if (weak(fields)) {
      reader.onOcr?.(0);
      const second = [];
      for (const p of pages) second.push((await w.recognize(binarize(enhance(scaled(p.canvas, Math.min(2800, Math.round(widthFor(p.canvas.width) * 1.4))))))).data.text);
      const f2 = extract(second.join("\n"), { qr, mem, source });
      const better = (a, b) => !a || (b && (b.conf ?? 0) > (a.conf ?? 0) + 0.05);
      for (const k of Object.keys(f2)) if (better(fields[k], f2[k])) fields[k] = fields[k] ? f2[k] : { ...f2[k], conf: Math.min(0.45, f2[k].conf ?? 0.45) }; // second-pass only: ask to check
      if (fields.total?.src === "derived" && f2.total && f2.total.src !== "derived") ["total", "vat", "net", "vatRate"].forEach(k => { if (f2[k]) fields[k] = f2[k]; });
      text += "\n---\n" + second.join("\n");
    }
    stage("fields");
    if (window.__pettyDebug) window.__pettyDebug.push({ name: file.name, text, qr });
    return { fields, qr, text, source, image: jpeg(pages[0].canvas), hash: await sha(file), pages: pages.length, ms: Math.round(performance.now() - t0) };
  }
  stage("fields");
  const fields = extract(text, { qr, mem, source });
  if (window.__pettyDebug) window.__pettyDebug.push({ name: file.name, text, qr });
  return { fields, qr, text, source, image: jpeg(pages[0].canvas), hash: await sha(file), pages: pages.length, ms: Math.round(performance.now() - t0) };
}

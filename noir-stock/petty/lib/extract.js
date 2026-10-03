// Invoice text (+ ZATCA QR when found) → ledger fields, each with where it came from:
//   "qr" read from the e-invoice QR (exact) · "text" from the PDF text layer · "ocr" from the scan · "rule" worked out · "learned" from past entries
import { SUPPLIERS, OWN_VAT, GLOSSARY, CATEGORIES, transliterate } from "./knowledge.js";

const AR_DIGITS = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "۰": 0, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9 };
export function normalize(t) {
  return String(t || "").replace(/[‎‏‪-‮⁦-⁩]/g, "").replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]).replace(/٫/g, ".").replace(/٬/g, ",")
    .replace(/[ \t ]+/g, " ").split("\n").map(l => l.trim()).filter(Boolean).join("\n");
}
const r2 = n => Math.round(n * 100) / 100;
const pad = n => String(n).padStart(2, "0");
const vatDist = (a, b) => [...a].reduce((d, c, i) => d + (c !== b[i]), 0);

// learned memory from saved entries: supplier by VAT, category by supplier and by item
export function learn(entries = []) {
  const mem = { byVat: {}, catBySupplier: {}, catByItem: {}, lastDesc: {} };
  entries.forEach(e => {
    if (e.vatNo && /^3\d{13}3$/.test(e.vatNo)) mem.byVat[e.vatNo] = { en: e.supplierEn, ar: e.supplierAr, cat: e.category };
    const s = (e.supplierEn || "").toLowerCase();
    if (s && e.category) ((mem.catBySupplier[s] ??= {})[e.category] = (mem.catBySupplier[s][e.category] || 0) + 1);
    if (e.descEn && e.category) (mem.catByItem[e.descEn.toLowerCase()] = e.category);
    if (s && e.descEn) mem.lastDesc[s] = { en: e.descEn, ar: e.descAr };
  });
  return mem;
}
const top = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1])[0]?.[0];

function findSupplier(vat, text, mem) {
  if (vat) {
    const m = mem?.byVat?.[vat]; if (m?.en) return { ...m, vat, how: "learned" };
    let s = SUPPLIERS.find(x => x.vat === vat); if (s) return { ...s, how: "vat" };
    s = SUPPLIERS.find(x => x.vat && vatDist(x.vat, vat) <= 2); if (s) return { ...s, how: "vat≈", fixedVat: s.vat };
  }
  const low = text.toLowerCase();
  const s = SUPPLIERS.find(x => x.keys.some(k => low.includes(k.toLowerCase())));
  return s ? { ...s, how: "name" } : null;
}

const MONEY1 = /\d{1,6}(?:,\d{3})*\.\d{2}/g, MONEY2 = /(?<![\d,.])\d{1,4},\d{2}(?![\d,])/g;
const KW = {
  total: /(إجمالي|اجمالي|الإجمالي|الاجمالي|الاجمالى|الإجمالى|المجموع|total|invoice value|قيمة الفاتورة|المطلوب|شامل|الصافي|الصافى|net amount|amount due|grand)/i,
  vat: /(ضريبة|الضريبة|ضريبه|vat|uat|tax|القيمة المضافة)/i,
  net: /(قبل الضريبة|قبل الضريبه|before tax|ex ?vat|excl|غير شامل|subtotal|sub total|المجموع الفرعي)/i,
  skip: /(نقدا|نقدًا|نقداً|المتبقي|الباقي|باقي|tendered|change|cash\s*:|المدفوع|المستلم|paid|card\s|مدى|الخصم|discount|rrn|auth|الكمية|qty|السعر الإفرادي|unit)/i
};
function amounts(lines) {
  const out = [];
  lines.forEach((line, i) => {
    let rest = line.replace(/\b\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ");
    const found = [];
    // OCR glues "15.0" (the VAT rate) to the amount after it: 15.02.10 → also try 2.10
    for (const m of rest.matchAll(/(\d+)\.(\d)(\d{1,3}\.\d{2})(?!\d)/g)) found.push(Number(m[3]));
    rest = rest.replace(MONEY1, m => { found.push(Number(m.replace(/,/g, ""))); return " "; });
    rest.replace(MONEY2, m => { found.push(Number(m.replace(",", "."))); return " "; });
    const k = { total: KW.total.test(line), vat: KW.vat.test(line), net: KW.net.test(line), skip: KW.skip.test(line) };
    found.forEach(v => { if (v >= 0 && v < 1e6) out.push({ v, line: i, ...k }); });
  });
  return out;
}

// pick net / VAT / total that agree with each other at 15% (or 0%)
function solveMoney(list, qr) {
  if (qr?.total != null) {
    const total = r2(qr.total), vat = r2(qr.tax ?? total * 15 / 115);
    return { total, vat, net: r2(total - vat), rate: vat ? 0.15 : 0, src: "qr" };
  }
  const vals = [...new Set(list.map(a => a.v).filter(v => v > 0))].sort((a, b) => b - a);
  const has = x => vals.find(v => Math.abs(v - x) <= 0.02);
  const weight = v => list.filter(a => a.v === v).reduce((s, a) => s + (a.total ? 3 : 0) + (a.skip ? -4 : 0) + 1, 0);
  let best = null;
  for (const t of vals) for (const v of vals) {
    if (v >= t || v <= 0) continue;
    const n = has(t - v);
    if (n != null && Math.abs(v - 0.15 * n) <= 0.03 + 0.002 * n) {
      const score = weight(t) + weight(v) + weight(n) + 5 + (list.some(a => a.v === v && a.vat) ? 4 : 0);
      if (!best || score > best.score) best = { score, total: t, vat: v, net: r2(n), rate: 0.15, src: "rule" };
    }
  }
  if (best) return best;
  for (const t of vals) for (const v of vals) {
    if (v >= t || v <= 0) continue;
    if (Math.abs(v - t * 15 / 115) <= 0.02 && list.some(a => a.v === v && a.vat)) {
      const score = weight(t) + weight(v);
      if (!best || score > best.score) best = { score, total: t, vat: v, net: r2(t - v), rate: 0.15, src: "rule" };
    }
  }
  if (best) return best;
  const cands = list.filter(a => a.total && !a.skip && a.v > 0);
  const t = cands.length ? Math.max(...cands.map(a => a.v)) : (() => { const c = {}; list.filter(a => !a.skip).forEach(a => { c[a.v] = (c[a.v] || 0) + 1; }); const rep = Object.entries(c).filter(([, k]) => k > 1).map(([v]) => Number(v)); return rep.length ? Math.max(...rep) : list.length ? Math.max(...list.map(a => a.v)) : null; })();
  if (t == null) return null;
  const zero = list.some(a => a.vat && a.v === 0) || /(vat|ضريبة)[^\n]{0,20}\b0\.00\b/i.test(list.text || "");
  const vat = zero ? 0 : r2(t * 15 / 115);
  return { total: t, vat, net: r2(t - vat), rate: zero ? 0 : 0.15, src: "derived" };
}

function findDate(text) {
  const now = new Date(), maxY = now.getFullYear() + 1;
  const cands = [];
  const push = (y, m, d, i) => { if (y < 100) y += 2000; const dt = new Date(y, m - 1, d); if (y >= 2023 && y <= maxY && dt.getMonth() === m - 1 && dt.getDate() === d) cands.push({ iso: `${y}-${pad(m)}-${pad(d)}`, i }); };
  for (const m of text.matchAll(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/g)) push(+m[1], +m[2], +m[3], m.index);
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) { if (+m[2] > 12 && +m[1] <= 12) push(+m[3], +m[1], +m[2], m.index); else push(+m[3], +m[2], +m[1], m.index); }
  if (!cands.length) return null;
  const count = {}; cands.forEach(c => { count[c.iso] = (count[c.iso] || 0) + 1; });
  return cands.sort((a, b) => count[b.iso] - count[a.iso] || a.i - b.i)[0].iso;
}
function findTime(text) {
  for (const m of text.matchAll(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|ص|م)?/gi)) {
    let h = +m[1]; const mi = +m[2], ap = (m[4] || "").toLowerCase();
    if (h > 23 || mi > 59) continue;
    if ((ap === "pm" || ap === "م") && h < 12) h += 12; if ((ap === "am" || ap === "ص") && h === 12) h = 0;
    return `${pad(h)}:${pad(mi)}`;
  }
  return null;
}
const INV_KW = /(ر?[قه]م\s*ال?فات[وو]?[رز][ةه]|إلى ورة|\bقم\b|فاتورة\s*:|\bnumber\b|رقم الفاتورة|رقم\/?\s*تاريخ الفاتورة|الفاتورة\s*#|فاتورة رقم|رقم الإيصال|رقم الايصال|invoice\s*(no|number|#)|inv\s*#|receipt\s*(#|no|:)|bill\s*no|trans\s*no|رقم\s*الفاتوره)/i;
function findInvoiceNo(lines, vat, date, sup) {
  const all = lines.join("\n");
  const oth = all.match(/\b\d{3}-\d{4}-\d{3}-\d{1,4}\b/); if (oth) return { v: oth[0], how: "pattern" };
  if (sup?.inv) { const m = all.replace(/\s/g, "").match(sup.inv); if (m) return { v: m[1], how: "supplier" }; }
  const bad = t => t === vat || /^0?5\d{8}$/.test(t) || /^9200/.test(t) || /^3\d{13}3$/.test(t) || (date && t.replace(/\D/g, "") === date.replace(/\D/g, ""));
  for (let i = 0; i < lines.length; i++) {
    if (!INV_KW.test(lines[i])) continue;
    for (const l of [lines[i], lines[i + 1] || "", lines[i - 1] || ""]) {
      const toks = (l.replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{1,2}:\d{2}(:\d{2})?/g, " ").match(/\d[\d-]{2,18}\d/g) || []).filter(t => !bad(t));
      if (toks.length) return { v: toks.sort((a, b) => b.length - a.length)[0], how: "keyword" };
    }
  }
  // a short number printed twice (header and barcode) is the receipt number
  const nums = (all.replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{1,2}:\d{2}(:\d{2})?/g, " ").match(/(?<![\d.,])\d{4,8}(?![\d.,])/g) || []).filter(t => !bad(t) && !/^20(2\d)$/.test(t));
  const c = {}; nums.forEach(n => { c[n] = (c[n] || 0) + 1; });
  const twice = Object.keys(c).filter(n => c[n] > 1).sort((a, b) => b.length - a.length)[0];
  if (twice) return { v: twice, how: "repeat" };
  // a number alone on its line below the totals is the receipt number under the barcode
  const totalAt = lines.findIndex(l => KW.total.test(l));
  const alone = lines.map((l, i) => ({ l: l.replace(/[^\d]/g, ""), raw: l.trim(), i })).filter(x => x.i > totalAt && totalAt >= 0 && /^\.?\d{4,8}$/.test(x.raw) && !bad(x.l));
  if (alone.length) return { v: alone.at(-1).l, how: "repeat" };
  const first = lines.slice(0, 14).join(" ").replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{1,2}:\d{2}(:\d{2})?/g, " ").match(/(?<![\d.,])\d{4,8}(?![\d.,])/g)?.filter(t => !bad(t) && !/^20(2\d)$/.test(t))[0];
  return first ? { v: first, how: "guess" } : null;
}
function describe(text, sup) {
  let t = text; (sup?.keys || []).forEach(k => { t = t.split(k).join(" "); });
  const hits = [];
  GLOSSARY.forEach(([re, en, ar, cat]) => { const m = t.match(re); if (m) hits.push({ en, ar, cat, at: m.index }); });
  hits.sort((a, b) => a.at - b.at);
  const uniq = []; hits.forEach(h => { if (!uniq.some(u => u.en === h.en)) uniq.push(h); });
  return uniq.slice(0, 3);
}
function supplierLine(lines) {
  return lines.slice(0, 8).map(l => l.replace(/[^؀-ۿA-Za-z .&-]/g, " ").replace(/\s+/g, " ").trim())
    .find(l => l.length >= 4 && !/(فاتورة|ضريبية|مبسطة|invoice|tax|الرقم|vat|cr\b|tel|هاتف|جوال)/i.test(l)) || "";
}

export function extract(rawText, { qr = null, mem = null, source = "ocr" } = {}) {
  const text = normalize(rawText), lines = text.split("\n");
  const F = {}, set = (k, value, src, conf = src === "qr" ? 1 : src === "text" ? 0.9 : src === "learned" ? 0.85 : 0.6) => { if (value != null && value !== "") F[k] = { value, src, conf }; };
  // VAT number of the seller
  let vat = qr?.vat || null, vatSrc = qr?.vat ? "qr" : source;
  if (!vat) { const all = [...text.replace(/\s/g, "").matchAll(/3\d{13}3/g)].map(m => m[0]).filter(v => !OWN_VAT.includes(v)); vat = all[0] || null; }
  const sup = findSupplier(vat, text, mem);
  if (sup?.fixedVat) { vat = sup.fixedVat; vatSrc = "rule"; }
  set("vatNo", vat, vatSrc);
  if (sup) { const src = sup.how === "learned" ? "learned" : vatSrc === "qr" ? "qr" : "rule"; set("supplierEn", sup.en, src); set("supplierAr", sup.ar, src); }
  else {
    const name = qr?.seller || supplierLine(lines);
    const isAr = /[؀-ۿ]/.test(name);
    set("supplierAr", isAr ? name : "", qr?.seller ? "qr" : source, 0.5);
    set("supplierEn", isAr ? transliterate(name) : name, "rule", 0.4);
  }
  // date and time
  const date = qr?.date || findDate(text), time = qr?.time || findTime(text);
  set("date", date, qr?.date ? "qr" : source); set("time", time, qr?.time ? "qr" : source);
  // invoice number
  const inv = findInvoiceNo(lines, vat, date, sup);
  if (inv) set("invoiceNo", inv.v, inv.how === "guess" ? "rule" : source, inv.how === "guess" ? 0.35 : inv.how === "repeat" ? 0.55 : 0.7);
  // money
  const list = amounts(lines); list.text = text;
  const money = solveMoney(list, qr);
  if (money) { const s = money.src === "qr" ? "qr" : money.src === "rule" ? "rule" : "derived"; set("total", money.total, s, s === "derived" ? 0.45 : undefined); set("vat", money.vat, s, s === "derived" ? 0.45 : undefined); set("net", money.net, s, s === "derived" ? 0.45 : undefined); set("vatRate", money.rate, s); }
  // items and category
  const items = describe(text, sup);
  if (items.length) { set("descEn", items.map(i => i.en).join(", "), "rule", 0.6); set("descAr", items.map(i => i.ar).join("، "), "rule", 0.6); }
  else if (sup && mem?.lastDesc?.[sup.en.toLowerCase()]) { const d = mem.lastDesc[sup.en.toLowerCase()]; set("descEn", d.en, "learned", 0.4); set("descAr", d.ar, "learned", 0.4); }
  const learnedItem = items.map(i => mem?.catByItem?.[i.en.toLowerCase()]).find(Boolean);
  const supCat = sup && (top(mem?.catBySupplier?.[sup.en.toLowerCase()]) || sup.cat);
  const itemCat = items.length ? top(items.reduce((a, i) => (a[i.cat] = (a[i.cat] || 0) + 1, a), {})) : null;
  // a shop that sells one kind of thing decides the category; a supermarket goes by the items
  const cat = learnedItem || (sup && !sup.multi ? supCat : itemCat || supCat) || "Other";
  set("category", CATEGORIES.some(c => c.id === cat) ? cat : "Other", learnedItem ? "learned" : "rule", 0.7);
  set("payment", /(mada|مدى|card|بطاقة|شبكة|visa|master)/i.test(text) ? "Card" : /(نقد|cash|كاش)/i.test(text) ? "Cash" : null, source, 0.6);
  return F;
}

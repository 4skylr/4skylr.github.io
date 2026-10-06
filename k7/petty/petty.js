// Petty Cash · بيتي كاش — scan an invoice, check what the reader found, save it to the month's ledger,
// export the branch workbook. Self-contained: everything it needs lives in this folder.
// The host app passes H = { putDoc, allDocs, localDocs, putRemote, getRemote, deleteRemote, deleteLocalDoc, uploadFile, toast, log }.
import { readInvoice, reader } from "./lib/reader.js";
import { learn } from "./lib/extract.js";
import { CATEGORIES, transliterate } from "./lib/knowledge.js";
import { archiveInvoice, imageOf, removeInvoice, archiveWorkbook, workbookBlob } from "./lib/archive.js";

const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const T = (en, ar) => AR() ? ar : en;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n, d = 2) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n) || 0);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const pad = n => String(n).padStart(2, "0");
const DAYS = [["Sun", "الأحد"], ["Mon", "الاثنين"], ["Tue", "الثلاثاء"], ["Wed", "الأربعاء"], ["Thu", "الخميس"], ["Fri", "الجمعة"], ["Sat", "السبت"]];
const dayOf = d => { if (!d) return ""; const x = new Date(d + "T12:00:00"); return Number.isNaN(+x) ? "" : DAYS[x.getDay()][AR() ? 1 : 0]; };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthName = m => { const [y, k] = m.split("-").map(Number); return `${(AR() ? MONTHS_AR : MONTHS)[k - 1]} ${y}`; };
const catAr = id => CATEGORIES.find(c => c.id === id)?.ar || id;
const SRC = { qr: ["QR ✓", "QR ✓"], text: ["PDF text", "نص PDF"], ocr: ["OCR", "قراءة ضوئية"], rule: ["worked out", "محسوب"], derived: ["estimated", "تقديري"], learned: ["learned", "متعلَّم"], you: ["edited", "معدّل"] };

// ── lock: four digits, the current time as HHMM ──────────────
const UNLOCK = "noir-petty-until", IDLE = 20 * 60e3;
function pinOk(v) {
  const now = Date.now(), ok = new Set();
  for (const d of [-1, 0, 1]) { const t = new Date(now + d * 60e3), h = t.getHours(), m = t.getMinutes(); ok.add(pad(h) + pad(m)); ok.add(pad(h % 12 || 12) + pad(m)); }
  return ok.has(String(v).trim());
}
const unlocked = () => Number(sessionStorage.getItem(UNLOCK) || 0) > Date.now();
const touch = () => sessionStorage.setItem(UNLOCK, String(Date.now() + IDLE));

const S = { entries: [], month: null, queue: [], H: null, host: null, float: 4783, archive: [] };

export async function renderPetty(host, H) {
  S.host = host; S.H = H;
  if (!document.getElementById("petty-css")) { const l = document.createElement("link"); l.id = "petty-css"; l.rel = "stylesheet"; l.href = new URL("./petty.css?v=88", import.meta.url).href; document.head.append(l); }
  if (!unlocked()) return lockScreen(host);
  touch();
  host.innerHTML = `<div class="pc"><p class="pc-empty">…</p></div>`;
  const [docs, xl, cfg] = await Promise.all([H.allDocs("petty").catch(() => H.localDocs("petty")), H.allDocs("pettyXlsx").catch(() => H.localDocs("pettyXlsx")), H.allDocs("pettyCfg").catch(() => [])]);
  S.entries = docs.filter(d => !d.deleted);
  S.archive = xl.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  S.float = Number(cfg.find(c => c.id === "main")?.float) || 4783;
  const months = [...new Set(S.entries.map(e => (e.date || "").slice(0, 7)).filter(Boolean))].sort();
  const now = new Date(), cur = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  S.month ??= months.includes(cur) || !months.length ? cur : months.at(-1);
  draw();
}

function lockScreen(host) {
  host.innerHTML = `<div class="pc-lock">
    <div class="pc-lock-card">
      <div class="pc-lock-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.4"/></svg></div>
      <h2>${T("Petty Cash", "بيتي كاش")}</h2><p>${T("Enter the 4-digit code", "أدخل الرقم السري من 4 أرقام")}</p>
      <form id="pc-pin" autocomplete="off"><div class="pc-pin-boxes">${[0, 1, 2, 3].map(() => "<i></i>").join("")}</div>
        <input name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="PIN" autofocus></form>
    </div></div>`;
  const f = host.querySelector("#pc-pin"), inp = f.pin, boxes = [...f.querySelectorAll("i")];
  const paint = () => boxes.forEach((b, i) => { b.textContent = inp.value[i] ? "•" : ""; b.classList.toggle("on", i === inp.value.length); });
  inp.addEventListener("input", () => {
    inp.value = inp.value.replace(/\D/g, "").slice(0, 4); paint();
    if (inp.value.length === 4) {
      if (pinOk(inp.value)) { touch(); f.classList.add("ok"); setTimeout(() => renderPetty(host, S.H), 260); }
      else { f.classList.remove("bad"); void f.offsetWidth; f.classList.add("bad"); setTimeout(() => { inp.value = ""; paint(); }, 380); }
    }
  });
  host.querySelector(".pc-pin-boxes").onclick = () => inp.focus();
  paint(); setTimeout(() => inp.focus(), 50);
}

// ── main view ────────────────────────────────────────────────
function monthEntries() { return S.entries.filter(e => (e.date || "").startsWith(S.month)).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))); }
function draw() {
  const host = S.host, list = monthEntries();
  const spent = r2(list.reduce((a, e) => a + (Number(e.total) || 0), 0)), vat = r2(list.reduce((a, e) => a + (Number(e.vat) || 0), 0));
  const bal = r2(S.float - spent), used = Math.min(1, spent / (S.float || 1)), qrN = list.filter(e => e.qr).length;
  const months = [...new Set([S.month, ...S.entries.map(e => (e.date || "").slice(0, 7)).filter(Boolean)])].sort();
  const byCat = {}; list.forEach(e => { byCat[e.category || "Other"] = r2((byCat[e.category || "Other"] || 0) + (Number(e.total) || 0)); });
  const bySup = {}; list.forEach(e => { const k = e.supplierEn || "—"; bySup[k] = r2((bySup[k] || 0) + (Number(e.total) || 0)); });
  const maxCat = Math.max(1, ...Object.values(byCat)), maxSup = Math.max(1, ...Object.values(bySup));
  host.innerHTML = `<div class="pc">
    <section class="pc-hero">
      <div class="pc-hero-l">
        <span class="pc-k">${T("PETTY CASH · UNAIZAH", "بيتي كاش · عنيزة")}</span>
        <div class="pc-months">${months.map(m => `<button data-m="${m}" class="${m === S.month ? "on" : ""}">${monthName(m)}</button>`).join("")}</div>
        <div class="pc-big"><b class="data">${fmt(spent)}</b><small>SAR ${T("spent", "مصروف")}</small></div>
        <div class="pc-bar"><u style="width:${(used * 100).toFixed(1)}%"></u></div>
        <p class="pc-sub">${T("Float", "العهدة")} <b class="data">${fmt(S.float)}</b> · ${T("Balance", "المتبقي")} <b class="data ${bal < 0 ? "neg" : ""}">${fmt(bal)}</b> <button class="pc-link" id="pc-float">${T("change", "تعديل")}</button></p>
      </div>
      <div class="pc-ring" style="--p:${(used * 100).toFixed(1)}"><div><b class="data">${Math.round(used * 100)}%</b><span>${T("of float used", "من العهدة")}</span></div></div>
      <div class="pc-kpis">
        <div><span>${T("Invoices", "الفواتير")}</span><b class="data">${list.length}</b></div>
        <div><span>${T("VAT paid", "الضريبة المدفوعة")}</span><b class="data">${fmt(vat)}</b></div>
        <div><span>${T("Read from QR", "مقروءة من QR")}</span><b class="data">${qrN}/${list.length}</b></div>
      </div>
    </section>

    <section class="pc-scan" id="pc-drop">
      <div class="pc-scan-beam"></div>
      <div class="pc-scan-in">
        <div class="pc-scan-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/></svg></div>
        <div><h3>${T("Scan an invoice", "امسح فاتورة")}</h3><p>${T("PDF or photo, Arabic or English. The reader finds the e-invoice QR, reads the text, and fills the ledger line for you to check.", "PDF أو صورة، عربي أو إنجليزي. القارئ يدوّر رمز QR للفاتورة الإلكترونية، يقرأ النص، ويعبّي سطر الدفتر وأنت تراجعه.")}</p></div>
        <div class="pc-scan-btns">
          <label class="pc-btn hot" for="pc-file">${T("Upload invoices", "ارفع فواتير")}</label><input id="pc-file" type="file" accept="application/pdf,image/*" multiple hidden>
          <label class="pc-btn" for="pc-cam">${T("Camera", "الكاميرا")}</label><input id="pc-cam" type="file" accept="image/*" capture="environment" hidden>
        </div>
      </div>
      <div class="pc-queue" id="pc-queue"></div>
    </section>

    <section class="pc-card">
      <header class="pc-h"><h3>${T("Ledger", "الدفتر")} · ${monthName(S.month)}</h3>
        <div class="pc-acts"><button class="pc-btn hot" id="pc-xlsx">${T("Download Excel", "تحميل الإكسل")}</button>
          <label class="pc-btn ghost" for="pc-import">${T("Import workbook", "استيراد ملف إكسل")}</label><input id="pc-import" type="file" accept=".xlsx" hidden></div></header>
      ${list.length ? `<div class="pc-list">${list.map((e, i) => rowHtml(e, i)).join("")}</div>
        <div class="pc-total"><span>${T("Total", "المجموع")}</span><b class="data">${fmt(list.reduce((a, e) => a + (Number(e.net) || 0), 0))}</b><b class="data">${fmt(vat)}</b><b class="data hot">${fmt(spent)}</b></div>`
      : `<p class="pc-empty">${T("No invoices this month yet.", "ما فيه فواتير لهالشهر.")}</p>`}
    </section>

    <div class="pc-two">
      <section class="pc-card"><header class="pc-h"><h3>${T("By category", "حسب النوع")}</h3></header>
        ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="pc-bars"><span>${esc(AR() ? catAr(k) : k)}</span><i><u style="width:${(v / maxCat * 100).toFixed(1)}%"></u></i><b class="data">${fmt(v)}</b></div>`).join("") || `<p class="pc-empty">—</p>`}</section>
      <section class="pc-card"><header class="pc-h"><h3>${T("By supplier", "حسب المورد")}</h3></header>
        ${Object.entries(bySup).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `<div class="pc-bars sup"><span dir="auto">${esc(k)}</span><i><u style="width:${(v / maxSup * 100).toFixed(1)}%"></u></i><b class="data">${fmt(v)}</b></div>`).join("") || `<p class="pc-empty">—</p>`}</section>
    </div>

    <section class="pc-card"><header class="pc-h"><h3>${T("Archive", "الأرشيف")}</h3><span class="pc-note">${T("Every exported workbook is kept here and in Firebase.", "كل ملف إكسل يتحمّل ينحفظ هنا وفي فايربيس.")}</span></header>
      ${S.archive.length ? `<div class="pc-arch">${S.archive.slice(0, 12).map(a => `<button class="pc-arch-i" data-x="${esc(a.id || a.name)}"><b>${esc(a.name)}</b><span class="data">${esc((a.at || "").slice(0, 16).replace("T", " "))} · ${a.count ?? "?"} ${T("invoices", "فاتورة")}</span></button>`).join("")}</div>` : `<p class="pc-empty">${T("Nothing exported yet.", "ما تم تصدير شي للحين.")}</p>`}
    </section>
    <div id="pc-modal"></div>
  </div>`;
  host.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { S.month = b.dataset.m; draw(); });
  host.querySelector("#pc-file").onchange = e => { enqueue([...e.target.files]); e.target.value = ""; };
  host.querySelector("#pc-cam").onchange = e => { enqueue([...e.target.files]); e.target.value = ""; };
  const drop = host.querySelector("#pc-drop");
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); enqueue([...e.dataTransfer.files]); });
  host.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openEntry(S.entries.find(x => x.id === b.dataset.open)));
  host.querySelector("#pc-xlsx").onclick = exportMonth;
  host.querySelector("#pc-import").onchange = e => { importWorkbook(e.target.files[0]); e.target.value = ""; };
  host.querySelector("#pc-float").onclick = async () => {
    const v = prompt(T("Petty cash float (SAR)", "مبلغ العهدة (ريال)"), S.float); if (v == null) return;
    const n = Number(String(v).replace(/,/g, "")); if (!(n > 0)) return;
    S.float = n; await S.H.putDoc("pettyCfg", "main", { float: n, at: new Date().toISOString() }); draw();
  };
  host.querySelectorAll("[data-x]").forEach(b => b.onclick = () => downloadArchived(S.archive.find(a => (a.id || a.name) === b.dataset.x)));
  paintQueue();
  host.addEventListener("pointerdown", touch, { passive: true });
}

function rowHtml(e, i) {
  const ok = !(e.vatRate > 0) || Math.abs(r2((e.net || 0) * e.vatRate) - (e.vat || 0)) <= 0.02;
  return `<button class="pc-row" data-open="${esc(e.id)}">
    <span class="pc-n data">${String(i + 1).padStart(2, "0")}</span>
    <span class="pc-when"><b class="data">${esc(e.date?.slice(8, 10) || "--")}</b><i>${esc(dayOf(e.date))}</i><em class="data">${esc(e.time || "")}</em></span>
    <span class="pc-who"><b dir="auto">${esc(e.supplierEn || "—")}</b><i dir="rtl">${esc(e.supplierAr || "")}</i><em dir="auto"><span class="data">#${esc(e.invoiceNo || "—")}</span> · ${esc(AR() ? (e.descAr || e.descEn || "") : (e.descEn || e.descAr || ""))}</em></span>
    <span class="pc-cat">${esc(AR() ? catAr(e.category) : e.category || "")}</span>
    <span class="pc-amt"><b class="data">${fmt(e.total)}</b><i class="data">VAT ${fmt(e.vat)}</i></span>
    <span class="pc-flags">${e.qr ? `<i class="qr">QR</i>` : ""}${ok ? "" : `<i class="warn">VAT?</i>`}${e.review ? `<i class="warn">${T("check", "راجع")}</i>` : ""}</span>
  </button>`;
}

// ── scanning queue ───────────────────────────────────────────
const STAGES = ["render", "qr", "ocr", "fields"];
const STAGE_NAME = { render: ["Opening", "فتح الملف"], qr: ["QR code", "رمز QR"], ocr: ["Reading text", "قراءة النص"], fields: ["Filling fields", "تعبئة الحقول"] };
function enqueue(files) {
  files.filter(f => /pdf|image/.test(f.type) || /\.(pdf|jpe?g|png|heic|webp)$/i.test(f.name)).forEach(f => S.queue.push({ id: Math.random().toString(36).slice(2), file: f, stage: "wait", pct: 0 }));
  paintQueue(); pump();
}
let running = false;
async function pump() {
  if (running) return; running = true;
  const mem = learn(S.entries);
  for (const q of S.queue) {
    if (q.stage !== "wait") continue;
    try {
      reader.onOcr = p => { q.pct = p; paintQueue(); };
      q.res = await readInvoice(q.file, { mem, stage: s => { q.stage = s; paintQueue(); } });
      q.stage = "done";
    } catch (e) { console.error(e); q.stage = "error"; q.err = e.message; }
    paintQueue();
  }
  running = false;
  const next = S.queue.find(q => q.stage === "done");
  if (next && !document.querySelector(".pc-review")) review(next);
}
function paintQueue() {
  const el = S.host?.querySelector("#pc-queue"); if (!el) return;
  el.innerHTML = S.queue.map(q => {
    const at = STAGES.indexOf(q.stage);
    return `<div class="pc-q s-${q.stage}" data-q="${q.id}">
      <span class="pc-q-ic">${q.res?.image ? `<img src="${q.res.image}" alt="">` : `<i></i>`}</span>
      <span class="pc-q-t"><b>${esc(q.file.name)}</b>
        <span class="pc-steps">${STAGES.map((s, i) => `<i class="${q.stage === "done" || (at > i) ? "done" : at === i ? "now" : ""}">${STAGE_NAME[s][AR() ? 1 : 0]}${s === "ocr" && at === i && q.pct ? ` ${Math.round(q.pct * 100)}%` : ""}</i>`).join("")}</span>
        ${q.stage === "error" ? `<em class="neg">${esc(q.err)}</em>` : q.stage === "done" ? `<em>${q.res.qr ? T("QR found · exact", "لقى QR · دقيق") : q.res.source === "text" ? T("Read from the PDF text", "انقرأ من نص الـPDF") : T("Read by OCR · please check", "قراءة ضوئية · راجعها")} · ${(q.res.ms / 1000).toFixed(1)}s</em>` : ""}</span>
      ${q.stage === "done" ? `<button class="pc-btn hot" data-rv="${q.id}">${T("Review", "راجع")}</button>` : q.stage === "error" ? `<button class="pc-btn ghost" data-rm="${q.id}">✕</button>` : `<span class="pc-spin"></span>`}
    </div>`;
  }).join("");
  el.querySelectorAll("[data-rv]").forEach(b => b.onclick = () => review(S.queue.find(q => q.id === b.dataset.rv)));
  el.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { S.queue = S.queue.filter(q => q.id !== b.dataset.rm); paintQueue(); });
}

// ── review form ──────────────────────────────────────────────
const FIELDS = ["date", "time", "supplierEn", "supplierAr", "vatNo", "invoiceNo", "descEn", "descAr", "category", "payment", "net", "vatRate", "vat", "discount", "total", "notes"];
function review(q) {
  const F = q.res.fields, v = k => F[k]?.value ?? "";
  const draft = { id: "pc-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...Object.fromEntries(FIELDS.map(k => [k, v(k)])), discount: 0,
    qr: !!q.res.qr, qrRaw: q.res.qr?.raw || null, hash: q.res.hash, fileName: q.file.name, source: q.res.source, scanMs: q.res.ms,
    src: Object.fromEntries(Object.entries(F).map(([k, x]) => [k, x.src])), conf: Object.fromEntries(Object.entries(F).map(([k, x]) => [k, x.conf])) };
  if (draft.supplierAr && !draft.supplierEn) draft.supplierEn = transliterate(draft.supplierAr);
  if (draft.vatRate === "") draft.vatRate = 0.15;
  openForm(draft, { image: q.res.image, file: q.file, q });
}
async function openEntry(e) { if (!e) return; openForm({ ...e }, { image: await imageOf(S.H, e.id), file: null, existing: true }); }

function openForm(d, ctx) {
  const m = S.host.querySelector("#pc-modal");
  const dupe = S.entries.find(x => x.id !== d.id && ((d.hash && x.hash === d.hash) || (d.invoiceNo && x.invoiceNo === d.invoiceNo && (x.vatNo === d.vatNo || x.supplierEn === d.supplierEn))));
  const chip = k => { const s = d.src?.[k]; if (!s) return ""; const c = d.conf?.[k] ?? 1; return `<i class="pc-src s-${s} ${c < 0.5 ? "low" : ""}">${SRC[s]?.[AR() ? 1 : 0] || s}</i>`; };
  const fld = (k, label, type = "text", extra = "") => `<label class="pc-f ${d.conf?.[k] != null && d.conf[k] < 0.5 ? "low" : ""}"><span>${label}${chip(k)}</span><input name="${k}" type="${type}" value="${esc(d[k] ?? "")}" ${extra}></label>`;
  m.innerHTML = `<div class="pc-review" role="dialog" aria-modal="true">
    <div class="pc-rv-img">${ctx.image ? `<img src="${ctx.image}" alt="invoice">` : `<p class="pc-empty">${T("No image archived", "ما فيه صورة مؤرشفة")}</p>`}
      ${ctx.existing && d.fileUrl ? `<a class="pc-btn ghost" href="${esc(d.fileUrl)}" target="_blank" rel="noopener">${T("Original file", "الملف الأصلي")} ↗</a>` : ""}</div>
    <form class="pc-rv-form" id="pc-form">
      <header><h3>${ctx.existing ? T("Edit invoice", "تعديل فاتورة") : T("Check and save", "راجع واحفظ")}</h3>
        ${d.qr ? `<span class="pc-badge qr">ZATCA QR ✓</span>` : `<span class="pc-badge">${d.source === "text" ? T("PDF text", "نص PDF") : T("OCR · check the yellow fields", "قراءة ضوئية · راجع الحقول الصفراء")}</span>`}
        <button type="button" class="pc-x" id="pc-close" aria-label="Close">✕</button></header>
      ${dupe ? `<p class="pc-dupe">⚠ ${T("Looks like a duplicate of", "يشبه فاتورة محفوظة")}: ${esc(dupe.supplierEn)} #${esc(dupe.invoiceNo)} · ${esc(dupe.date)} · ${fmt(dupe.total)}</p>` : ""}
      <div class="pc-grid">
        ${fld("date", T("Date", "التاريخ"), "date")}
        <label class="pc-f"><span>${T("Day", "اليوم")}</span><input name="day" value="${esc(dayOf(d.date))}" readonly tabindex="-1"></label>
        ${fld("time", T("Time", "الوقت"), "time")}
        ${fld("invoiceNo", T("Invoice no.", "رقم الفاتورة"))}
        ${fld("supplierEn", T("Supplier (English)", "المورد (إنجليزي)"))}
        ${fld("supplierAr", T("Supplier (Arabic)", "المورد (عربي)"), "text", 'dir="rtl"')}
        ${fld("vatNo", T("Supplier VAT no.", "الرقم الضريبي للمورد"), "text", 'inputmode="numeric"')}
        <label class="pc-f"><span>${T("Paid by", "طريقة الدفع")}${chip("payment")}</span><select name="payment">${["Cash", "Card"].map(p => `<option ${d.payment === p ? "selected" : ""} value="${p}">${p === "Cash" ? T("Cash", "كاش") : T("Card", "شبكة")}</option>`).join("")}</select></label>
        ${fld("descEn", T("Item (English)", "الصنف (إنجليزي)"))}
        ${fld("descAr", T("Item (Arabic)", "الصنف (عربي)"), "text", 'dir="rtl"')}
        <label class="pc-f wide"><span>${T("Category", "النوع")}${chip("category")}</span><select name="category">${CATEGORIES.map(c => `<option value="${esc(c.id)}" ${d.category === c.id ? "selected" : ""}>${esc(c.id)} · ${esc(c.ar)}</option>`).join("")}</select></label>
      </div>
      <div class="pc-money">
        ${fld("net", T("Net", "الصافي"), "number", 'step="0.01"')}
        <label class="pc-f"><span>${T("VAT %", "نسبة الضريبة")}</span><select name="vatRate"><option value="0.15" ${Number(d.vatRate) !== 0 ? "selected" : ""}>15%</option><option value="0" ${Number(d.vatRate) === 0 ? "selected" : ""}>0% · ${T("exempt", "معفى")}</option></select></label>
        ${fld("vat", T("VAT", "الضريبة"), "number", 'step="0.01"')}
        ${fld("discount", T("Discount", "الخصم"), "number", 'step="0.01"')}
        ${fld("total", T("Total", "الإجمالي"), "number", 'step="0.01"')}
      </div>
      <p class="pc-check" id="pc-check"></p>
      <label class="pc-f wide"><span>${T("Notes", "ملاحظات")}</span><input name="notes" value="${esc(d.notes || "")}"></label>
      <footer>
        ${ctx.existing ? `<button type="button" class="pc-btn ghost danger" id="pc-del">${T("Delete", "حذف")}</button>` : `<button type="button" class="pc-btn ghost" id="pc-skip">${T("Skip", "تخطي")}</button>`}
        <button type="submit" class="pc-btn hot">${T("Save to ledger", "احفظ بالدفتر")}</button>
      </footer>
    </form></div>`;
  const f = m.querySelector("#pc-form"), num = n => Number(f[n].value) || 0;
  const check = () => {
    const rate = Number(f.vatRate.value), exp = r2(num("net") * rate), ok = Math.abs(exp - num("vat")) <= 0.02, sum = Math.abs(r2(num("net") + num("vat") - num("discount")) - num("total")) <= 0.02;
    m.querySelector("#pc-check").innerHTML = `<i class="${ok && sum ? "ok" : "bad"}">${ok && sum ? "✓" : "!"}</i> ${T("Net", "الصافي")} ${fmt(num("net"))} + ${T("VAT", "الضريبة")} ${fmt(num("vat"))} − ${fmt(num("discount"))} = <b class="data">${fmt(num("net") + num("vat") - num("discount"))}</b> ${sum ? "" : `≠ ${fmt(num("total"))}`}${ok ? "" : ` · ${T("VAT should be", "الضريبة المفروض")} ${fmt(exp)}`}`;
  };
  const mark = n => { d.src = { ...(d.src || {}), [n]: "you" }; d.conf = { ...(d.conf || {}), [n]: 1 }; f[n].closest(".pc-f")?.classList.remove("low"); };
  f.total.addEventListener("input", () => { const rate = Number(f.vatRate.value), t = num("total") + num("discount"); f.net.value = r2(t / (1 + rate)); f.vat.value = r2(t - r2(t / (1 + rate))); mark("total"); check(); });
  f.net.addEventListener("input", () => { const rate = Number(f.vatRate.value); f.vat.value = r2(num("net") * rate); f.total.value = r2(num("net") + num("vat") - num("discount")); mark("net"); check(); });
  f.vat.addEventListener("input", () => { f.total.value = r2(num("net") + num("vat") - num("discount")); mark("vat"); check(); });
  f.discount.addEventListener("input", () => { f.total.value = r2(num("net") + num("vat") - num("discount")); check(); });
  f.vatRate.addEventListener("change", () => { f.net.dispatchEvent(new Event("input")); });
  f.date.addEventListener("change", () => { f.day.value = dayOf(f.date.value); mark("date"); });
  f.supplierAr.addEventListener("change", () => { if (!f.supplierEn.value.trim()) f.supplierEn.value = transliterate(f.supplierAr.value); mark("supplierAr"); });
  ["time", "invoiceNo", "supplierEn", "vatNo", "descEn", "descAr", "category", "payment"].forEach(n => f[n].addEventListener("change", () => mark(n)));
  check();
  const close = () => { m.innerHTML = ""; };
  m.querySelector("#pc-close").onclick = close;
  m.querySelector("#pc-skip")?.addEventListener("click", () => { S.queue = S.queue.filter(x => x !== ctx.q); close(); paintQueue(); nextReview(); });
  m.querySelector("#pc-del")?.addEventListener("click", async () => {
    if (!confirm(T("Delete this invoice from the ledger?", "حذف الفاتورة من الدفتر؟"))) return;
    await removeInvoice(S.H, d.id); S.entries = S.entries.filter(x => x.id !== d.id); close(); draw();
  });
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = T("Saving…", "جاري الحفظ…");
    const out = { ...d };
    FIELDS.forEach(k => { out[k] = f[k].value; });
    ["net", "vat", "discount", "total", "vatRate"].forEach(k => { out[k] = r2(out[k]); });
    out.vatRate = Number(f.vatRate.value);
    out.day = DAYS[new Date(out.date + "T12:00:00").getDay()]?.[0] || "";
    out.savedAt = new Date().toISOString();
    out.review = Object.values(out.conf || {}).some(c => c < 0.5) && !ctx.existing ? true : false;
    if (ctx.image) { const im = await dims(ctx.image); out.imgW = im.w; out.imgH = im.h; }
    try {
      await archiveInvoice(S.H, out, { image: ctx.existing ? null : ctx.image, file: ctx.file });
      S.entries = [...S.entries.filter(x => x.id !== out.id), out];
      S.H.log?.("petty", `Petty cash · ${out.supplierEn} #${out.invoiceNo} · ${fmt(out.total)} SAR`);
      S.H.toast?.(T("Saved to the ledger", "انحفظت بالدفتر"));
      if (ctx.q) S.queue = S.queue.filter(x => x !== ctx.q);
      S.month = (out.date || S.month).slice(0, 7);
      close(); draw(); nextReview();
    } catch (err) { console.error(err); btn.disabled = false; btn.textContent = T("Save to ledger", "احفظ بالدفتر"); S.H.toast?.(err.message, true); }
  };
}
const nextReview = () => { const n = S.queue.find(q => q.stage === "done"); if (n) setTimeout(() => review(n), 200); };
const dims = src => new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 0, h: 0 }); i.src = src; });

// ── Excel ────────────────────────────────────────────────────
const b64bytes = u => Uint8Array.from(atob(u.split(",")[1]), c => c.charCodeAt(0));
async function exportMonth() {
  const btn = S.host.querySelector("#pc-xlsx"); btn.disabled = true; const label = btn.textContent; btn.textContent = T("Building…", "جاري التجهيز…");
  try {
    const { buildLedger, ledgerName } = await import("./lib/ledger-xlsx.js");
    const tpl = new Uint8Array(await (await fetch(new URL("./template/Petty_Cash_Template.xlsx", import.meta.url))).arrayBuffer());
    const list = monthEntries(), images = {};
    for (const e of list) { const u = await imageOf(S.H, e.id); if (u) { const dm = e.imgW ? { w: e.imgW, h: e.imgH } : await dims(u); images[e.id] = { bytes: b64bytes(u), ...dm }; } }
    const blob = await buildLedger(tpl, list, { month: S.month, float: S.float, images });
    const name = ledgerName(S.month);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    await archiveWorkbook(S.H, name, blob, { month: S.month, count: list.length, total: r2(list.reduce((s, e) => s + (Number(e.total) || 0), 0)) });
    S.archive = [{ id: name.replace(/\.xlsx$/i, ""), name, at: new Date().toISOString(), count: list.length }, ...S.archive.filter(x => x.name !== name)];
    draw();
  } catch (e) { console.error(e); S.H.toast?.(e.message, true); btn.disabled = false; btn.textContent = label; }
}
async function downloadArchived(a) {
  if (!a) return;
  const blob = await workbookBlob(a.id || a.name.replace(/\.xlsx$/i, ""));
  const href = blob ? URL.createObjectURL(blob) : a.url;
  if (!href) return S.H.toast?.(T("This copy is only on the device that made it", "هالنسخة موجودة بس بالجهاز اللي سواها"), true);
  const l = document.createElement("a"); l.href = href; l.download = a.name; if (!blob) l.target = "_blank"; l.click();
}

// ── import the branch's own workbook (ledger rows + the scanned images) ──
async function importWorkbook(file) {
  if (!file) return;
  try {
    const { unzipSync, strFromU8 } = await import("./vendor/fflate.mjs");
    const z = unzipSync(new Uint8Array(await file.arrayBuffer())), x = p => z[p] ? strFromU8(z[p]) : "";
    const ss = [...x("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
    const sh = x("xl/worksheets/sheet1.xml"), rows = {};
    for (const r of sh.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = {};
      for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const t = c[2].match(/t="(\w+)"/)?.[1], v = c[3]?.match(/<v>([\s\S]*?)<\/v>/)?.[1], is = c[3]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
        cells[c[1]] = t === "s" ? ss[Number(v)] : t === "inlineStr" ? is : t === "str" ? v : v != null ? Number(v) : null;
      }
      rows[r[1]] = cells;
    }
    // images in the order they sit on the Invoice Images sheet
    const sheets = [...x("xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)];
    const wbRels = x("xl/_rels/workbook.xml.rels"), imgSheet = sheets.find(s => /image/i.test(s[1]));
    let pics = [];
    if (imgSheet) {
      const target = wbRels.match(new RegExp(`Id="${imgSheet[2]}"[^>]*Target="([^"]+)"`))?.[1] || wbRels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${imgSheet[2]}"`))?.[1];
      const shPath = "xl/" + target.replace(/^\/?xl\//, ""), relPath = shPath.replace(/worksheets\//, "worksheets/_rels/") + ".rels";
      const drawT = x(relPath).match(/Target="([^"]*drawings\/[^"]+)"/)?.[1];
      if (drawT) {
        const dPath = "xl/drawings/" + drawT.split("/").pop(), dRels = x(dPath.replace("drawings/", "drawings/_rels/") + ".rels"), dXml = x(dPath);
        pics = [...dXml.matchAll(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="(rId\d+)"/g)].map(m => ({ row: Number(m[1]), path: "xl/media/" + (dRels.match(new RegExp(`Id="${m[2]}"[^>]*Target="([^"]+)"`))?.[1] || dRels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${m[2]}"`))?.[1] || "").split("/").pop() })).sort((a, b) => a.row - b.row);
      }
    }
    const toIso = n => { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5); return d.toISOString().slice(0, 10); };
    const toTime = n => { const m = Math.round((n % 1) * 1440); return m ? `${pad(Math.floor(m / 60))}:${pad(m % 60)}` : ""; };
    let n = 0, pic = 0, same = 0;
    const floatCell = rows["6"]?.B; if (Number(floatCell) > 0 && Number(floatCell) !== S.float) { S.float = Number(floatCell); await S.H.putDoc("pettyCfg", "main", { float: S.float, at: new Date().toISOString() }); }
    for (let r = 9; r < 400; r++) {
      const c = rows[r]; if (!c) continue;
      if (typeof c.A !== "number" || typeof c.B !== "number") continue;
      if (!c.C && !c.E && c.L == null) continue;
      const net = typeof c.H === "number" ? c.H : null, vat = typeof c.J === "number" ? c.J : null, disc = Number(c.K) || 0;
      let total = typeof c.L === "number" ? c.L : null; if (net != null) total = r2(net + (vat || 0) - disc);
      const rate = typeof c.I === "number" ? c.I : 0.15;
      const e = { id: `pc-imp-${toIso(c.B)}-${String(c.E || r).replace(/\W/g, "")}`, date: toIso(c.B), time: toTime(c.B), supplierEn: c.C || "", supplierAr: c.D || "", invoiceNo: String(c.E ?? ""),
        descEn: c.F || "", descAr: "", category: c.G || "Other", net: net ?? r2(total / (1 + rate)), vatRate: rate, vat: vat ?? r2(total - total / (1 + rate)), discount: disc, total, notes: c.O || "",
        payment: "Cash", qr: false, source: "import", review: net == null, savedAt: new Date().toISOString(), src: {} };
      e.day = DAYS[new Date(e.date + "T12:00:00").getDay()][0];
      let image = null;
      const hasPic = typeof c.N === "string" && /view/i.test(c.N) && pics[pic];
      // already in the ledger (scanned or imported before): keep what is there
      const twin = S.entries.find(x => x.id !== e.id && x.date === e.date && x.invoiceNo && x.invoiceNo === e.invoiceNo);
      if (twin) { if (hasPic) pic++; same++; continue; }
      if (hasPic) {
        const bytes = z[pics[pic].path]; pic++;
        if (bytes) { image = "data:image/jpeg;base64," + btoa(Array.from(bytes, b => String.fromCharCode(b)).join("")); const dm = await dims(image); e.imgW = dm.w; e.imgH = dm.h; }
      }
      await archiveInvoice(S.H, e, { image, file: null });
      S.entries = [...S.entries.filter(x => x.id !== e.id), e]; n++;
    }
    S.H.toast?.(T(`Imported ${n} invoices${same ? ` · ${same} already in the ledger` : ""}`, `انستورد ${n} فاتورة${same ? ` · ${same} موجودة من قبل` : ""}`));
    const months = [...new Set(S.entries.map(e => e.date.slice(0, 7)))].sort(); S.month = months.at(-1) || S.month;
    draw();
  } catch (e) { console.error(e); S.H.toast?.(T("Could not read that workbook", "ما قدرت أقرأ ملف الإكسل"), true); }
}

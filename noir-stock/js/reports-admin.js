// Settings · Required reports — every system report the site reads, by section, with when it was last uploaded.
// Excel files are read with SheetJS (github.com/SheetJS/sheetjs), loaded only when a file is picked.
export const REPORTS = [
  { key: "stock", sec: ["Stock", "المخزون"], name: "Current Stock Position Report", fmt: "PDF", hint: ["Inventory system, today's date", "من نظام المخزون بتاريخ اليوم"], accept: ".pdf,application/pdf" },
  { key: "sales", sec: ["Stock", "المخزون"], name: "Sales RM Consumed", fmt: "PDF", hint: ["1 January → today", "من 1 يناير لليوم"], accept: ".pdf,application/pdf" },
  { key: "expiry", sec: ["Stock", "المخزون"], name: "Expiry dates sheet", fmt: "Excel", hint: ["Upload in the sync section below", "يُرفع من قسم المزامنة تحت"], accept: null },
  { key: "nightly", sec: ["Nightly reports", "التقارير الليلية"], name: "Performance Analysis", fmt: "PDF", hint: ["The nightly email, one file per day", "إيميل الليلة، ملف لكل يوم"], go: "nightly" },
  { key: "halls", sec: ["Halls", "القاعات"], name: "User Transaction Log - Payment Type wise", fmt: "PDF", hint: ["Type: ALL · 1 January → today", "Type: ALL · من 1 يناير لليوم"], accept: ".pdf,application/pdf" },
  { key: "dcs", sec: ["Finance · Unaizah", "المالية · عنيزة"], name: "DCS - <Month> <Year>", fmt: "Excel .xls / .xlsx / .ods", hint: ["The month's workbook, one sheet per day. Several files at once is fine.", "ملف الشهر، شيت لكل يوم. تقدر ترفع أكثر من ملف."], accept: ".xls,.xlsx,.ods", multiple: true },
  { key: "rdr", sec: ["Finance · Unaizah", "المالية · عنيزة"], name: "RDR Exception Register", fmt: "Excel", hint: ["User: ALL · 1 January → today", "User: ALL · من 1 يناير لليوم"], accept: ".xls,.xlsx" }
];

let XLSXp = null;
export function loadXLSX() {
  return XLSXp ??= window.XLSX ? Promise.resolve(window.XLSX) : new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "vendor/xlsx.full.min.js";
    s.onload = () => res(window.XLSX); s.onerror = () => { XLSXp = null; rej(new Error("Could not load the Excel reader")); }; document.head.append(s);
  });
}

// last upload: the upload log first, else what the data itself says
async function lastSeen(H) {
  const json = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
  const [seats, rdr, ledger, remote] = await Promise.all([json("halls/seats.json"), json("finance/rdr.json"), json("unaizah/ledger.json"), Promise.race([H.allDocs("uploads").catch(() => []), new Promise(r => setTimeout(() => r([]), 2500))])]);
  const log = Object.fromEntries([...remote, ...H.localDocs("uploads")].map(d => [d.id, d]));
  const newest = (name, f) => H.localDocs(name).map(f).filter(Boolean).sort().pop();
  const fb = {
    stock: newest("stockHistory", d => d.at) || null,
    nightly: newest("nightly", d => d.savedAt || (d.date ? d.date + "T23:59:00" : null)),
    halls: newest("halls", d => d.savedAt) || seats?.savedAt,
    dcs: newest("dcs", d => d.at) || (ledger?.built ? ledger.built.replace("Z", ":00Z") : null),
    rdr: newest("rdr", d => d.savedAt) || rdr?.savedAt,
    sales: H.salesTo ? H.salesTo + "T00:00:00" : null
  };
  const out = {};
  REPORTS.forEach(r => { const l = log[r.key]; out[r.key] = l ? { at: l.at, file: l.file } : fb[r.key] ? { at: fb[r.key], file: null, guess: true } : null; });
  // the data range each report covers
  out.range = { halls: seats ? `${seats.from} → ${seats.to}` : null, rdr: rdr ? `${rdr.from} → ${rdr.to}` : null, dcs: ledger ? `→ ${ledger.days.at(-1).date}` : null };
  const dcsUp = H.localDocs("dcs").flatMap(d => d.days || []).map(d => d.date).sort().pop();
  if (dcsUp && (!ledger || dcsUp > ledger.days.at(-1).date)) out.range.dcs = `→ ${dcsUp}`;
  const rdrUp = H.localDocs("rdr").sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""))[0];
  if (rdrUp) out.range.rdr = `${rdrUp.from} → ${rdrUp.to}`;
  return out;
}

const ago = (iso, ar) => {
  const m = (Date.now() - Date.parse(iso)) / 6e4;
  if (!Number.isFinite(m)) return "";
  if (m < 60) return ar ? `قبل ${Math.max(1, Math.round(m))} دقيقة` : `${Math.max(1, Math.round(m))} min ago`;
  if (m < 1440) return ar ? `قبل ${Math.round(m / 60)} ساعة` : `${Math.round(m / 60)} h ago`;
  return ar ? `قبل ${Math.round(m / 1440)} يوم` : `${Math.round(m / 1440)} days ago`;
};
const stamp = iso => { const d = new Date(iso); return Number.isNaN(+d) ? "" : `${d.toLocaleDateString("en-CA")} ${d.toTimeString().slice(0, 5)}`; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export async function renderReports(host, H) {
  const ar = true, seq = host._rqSeq = (host._rqSeq || 0) + 1; // Settings is written in Arabic
  if (!host.querySelector(".rqs")) host.innerHTML = `<section class="slab rqs"><div class="slab-h"><h2>التقارير المطلوبة</h2><span class="tag">Required reports</span></div><p class="note">…</p></section>`;
  const seen = await lastSeen(H);
  if (seq !== host._rqSeq || !host.isConnected) return; // a newer render (after another upload) owns the list
  let sec = "";
  host.innerHTML = `<section class="slab rqs">
    <div class="slab-h"><h2>التقارير المطلوبة</h2><span class="tag">Required reports</span></div>
    <p class="note" style="margin-top:0">كل قسم بالموقع والتقرير اللي ينسحب له من النظام، وآخر مرة انرفع.</p>
    <div class="rq-list">${REPORTS.map(r => {
      const s = seen[r.key], days = s ? (Date.now() - Date.parse(s.at)) / 864e5 : Infinity;
      const tone = !s ? "none" : days <= 1.5 ? "fresh" : days <= 8 ? "warm" : "stale";
      const head = r.sec[1] !== sec ? `<h3 class="rq-sec">${r.sec[1]} <small>${r.sec[0]}</small></h3>` : ""; sec = r.sec[1];
      return `${head}<article class="rq-row t-${tone}" data-key="${r.key}">
        <div class="rq-main"><p class="rq-name" dir="ltr"><b>${esc(r.name)}</b><span>${esc(r.fmt)}</span></p>
          <p class="rq-hint">${esc(r.hint[1])}${seen.range?.[r.key] ? ` · <span class="data" dir="ltr">${esc(seen.range[r.key])}</span>` : ""}</p></div>
        <div class="rq-last"><i></i><span>${s ? `<b class="data">${stamp(s.at)}</b><em>${ago(s.at, ar)}${s.file ? ` · <span dir="ltr">${esc(s.file)}</span>` : s.guess ? " · من البيانات" : ""}</em>` : `<b>ما انرفع</b>`}</span></div>
        <div class="rq-act">${r.accept ? `<label class="btn ${tone === "fresh" ? "" : "hot"}" for="rq-${r.key}">رفع</label><input id="rq-${r.key}" type="file" accept="${r.accept}" ${r.multiple ? "multiple" : ""} hidden>`
          : r.go ? `<button class="btn" data-go="${r.go}">افتح</button>` : ""}</div>
        <div class="rq-prog" hidden><u></u><span></span></div>
      </article>`; }).join("")}</div>
  </section>`;
  host.querySelectorAll("[data-go]").forEach(b => b.onclick = () => H.go(b.dataset.go));
  REPORTS.filter(r => r.accept).forEach(r => {
    const input = host.querySelector(`#rq-${r.key}`), row = input.closest(".rq-row"), bar = row.querySelector(".rq-prog");
    const step = (i, n, label) => { bar.hidden = false; bar.querySelector("u").style.width = (n ? i / n * 100 : 30).toFixed(1) + "%"; bar.querySelector("span").textContent = label || `${i} / ${n}`; };
    input.onchange = async e => {
      const files = [...e.target.files]; if (!files.length) return;
      try {
        step(0, 1, files.map(f => f.name).join(", "));
        await H.handlers[r.key](files, step);
        await H.markUpload(r.key, files.map(f => f.name).join(", "));
        renderReports(host, H);
      } catch (err) { bar.hidden = true; H.toast(err.message || "ما قدرت أقرأ الملف", true); }
      e.target.value = "";
    };
  });
}

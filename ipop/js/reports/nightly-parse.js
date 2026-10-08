// Reads the nightly "Performance Analysis" PDF (Vista report) into one day record.
// Text with positions comes from mozilla/pdf.js; labels are matched to the number in the same
// column band and line, the film and concession tables are rebuilt line by line.
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFWORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
let pdfP = null;
function loadPdf() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  pdfP ??= new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = PDFJS;
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWORKER; res(window.pdfjsLib); };
    s.onerror = () => { pdfP = null; rej(new Error("Could not load the PDF reader")); };
    document.head.append(s);
  });
  return pdfP;
}

const num = s => { const n = Number(String(s).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const isNum = s => /^-?[\d,]+(\.\d+)?$/.test(String(s).trim());
// label → key, grouped by the report's three columns
const LABELS = {
  summary: { "Total Admits": "admits", "Total Transactions": "transactions", "Total Seats In Cinema": "seats", "Total Screen": "screens", "Total No of Shows": "shows",
    "Avg. of Shows": "avgShows", "Total Capacity Available": "capacity", "Total Revenue": "totalRevenue", "Items Per Admit": "itemsPerAdmit", "Items Per Transaction": "itemsPerTrx",
    "Transaction Strike Rate": "trxStrike", "Gross Box Revenue Per Seat": "grossBoxPerSeat", "Nett Box Revenue Per Seat": "netBoxPerSeat", "Total Revenue Per Seat": "totalPerSeat",
    "Average Sale Per Transaction": "avgSalePerTrx", "Average Sale Per Patron": "avgSalePerPatron" },
  box: { "Box Office Revenue(BOR)": "bor", "VAT": "boVat", "Net BOR": "netBor", "3D Gross": "gross3d", "3D Nett": "nett3d", "Transactions": "boTrx", "ATP": "atp", "Net ATP": "netAtp",
    "Occupancy %": "occupancy", "GCAM": "gcam", "Effective Nett": "effectiveNett", "Internet Service Charge": "serviceCharge" },
  conc: { "Gross Revenue": "conc", "VAT": "concVat", "Concession Net Revenue": "concNet", "Spend Per Head": "sph", "Cost of Goods Sold": "cost", "Food Cost": "foodCost",
    "Transactions": "trx", "Admission Strike Rate": "asr", "Average. Value Per Transaction": "avgValuePerTrx", "Quantity of Item Sold": "items", "Average. Cost Per Admits": "avgCostPerAdmit",
    "Cost Per Admits": "costPerAdmit", "Profit at Standard Cost": "profit", "Profit %": "profitPct", "Profit per Item": "profitPerItem", "Profit Per Admit": "profitPerAdmit",
    "Price Per Transaction": "pricePerTrx" }
};
const clean = s => String(s).replace(/\s*:\s*$/, "").trim();

async function pagesOf(file) {
  const pdfjs = await loadPdf();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(tc.items.filter(t => t.str && t.str.trim()).map(t => ({ s: t.str.trim(), x: t.transform[4], y: t.transform[5] })));
  }
  return pages;
}
function linesOf(items, minY = -1, maxY = 1e9) {
  const rows = [];
  items.filter(t => t.y > minY && t.y < maxY).forEach(t => { let r = rows.find(r => Math.abs(r.y - t.y) < 2.5); if (!r) rows.push(r = { y: t.y, it: [] }); r.it.push(t); });
  rows.forEach(r => r.it.sort((a, b) => a.x - b.x));
  return rows.sort((a, b) => b.y - a.y);
}
const toISO = s => { const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null; };

export async function parsePerformancePdf(file) {
  const pages = await pagesOf(file);
  const p1 = pages[0] || [];
  const out = { source: file.name, parsedAt: new Date().toISOString() };
  // header: business day = the "From" date (6:00 AM → 5:59 AM next day)
  const fromIdx = p1.findIndex(t => /^From:?$/.test(t.s));
  const fromVal = p1.find(t => fromIdx >= 0 && Math.abs(t.y - p1[fromIdx].y) < 3 && t.x > p1[fromIdx].x && /\d\/\d/.test(t.s));
  out.date = toISO(fromVal?.s || p1.map(t => t.s).join(" ").match(/From:\s*([\d/]+)/)?.[1] || "");
  const asOn = p1.find(t => /\d{2}\/\d{2}\/\d{4}.*(AM|PM)/.test(t.s) && t.y < (fromVal?.y ?? 0) - 15);
  out.asOn = asOn?.s || "";
  out.cinema = p1.find(t => /Cinema/.test(t.s) && t.y > 560)?.s || "";
  // label/value pairs in three column bands
  const heads = ["Summary", "Box Office", "Concessions"].map(h => p1.find(t => t.s === h));
  const lowHeads = ["Performance Indicators", "Miscellaneous", "Concessions Profit Performance"].map(h => p1.find(t => t.s === h));
  const labels = p1.filter(t => /:\s*$/.test(t.s) && t.y < (heads[0]?.y ?? 500));
  // each column starts where its labels start; values sit to the right of their label, before the next column
  const starts = [...new Set(labels.map(l => Math.round(l.x / 10) * 10))].sort((a, b) => a - b)
    .filter((x, i, arr) => !i || x - arr[i - 1] > 60).slice(0, 3);
  const bands = [0, (starts[1] ?? 317) - 3, (starts[2] ?? 583) - 3];
  const band = x => x < bands[1] ? 0 : x < bands[2] ? 1 : 2;
  const nums = p1.filter(t => isNum(t.s));
  labels.forEach(l => {
    const b = band(l.x), key = clean(l.s);
    const cands = nums.filter(n => band(n.x) === b && n.x > l.x && Math.abs(n.y - l.y) <= 13).sort((a, c) => Math.abs(a.y - l.y) - Math.abs(c.y - l.y));
    // a value that sits exactly on another label's line belongs to that label
    const v = cands.find(n => Math.abs(n.y - l.y) < 2.5 || !labels.some(o => o !== l && band(o.x) === b && Math.abs(o.y - n.y) < 2.5));
    if (!v) return;
    const lower = lowHeads[0] && l.y < lowHeads[0].y + 2;
    const map = b === 0 ? LABELS.summary : b === 1 ? LABELS.box : LABELS.conc;
    let k = map[key]; if (!k) return;
    if (b === 2 && key === "Transactions") k = "trx";
    if (b === 2 && lower && key === "Profit %") k = "profitPct";
    if (out[k] == null) out[k] = num(v.s);
  });
  // films (page with "Film" header)
  const filmPage = pages.find(p => p.some(t => t.s === "Film") && p.some(t => t.s === "Nett BOR"));
  out.films = [];
  if (filmPage) {
    const top = filmPage.find(t => t.s === "Film").y - 4;
    const L = linesOf(filmPage, 0, top);
    let cur = null;
    L.forEach(r => {
      const name = r.it.filter(t => t.x < 150 && !isNum(t.s)).map(t => t.s).join(" ");
      const vals = r.it.filter(t => t.x >= 150 && isNum(t.s)).map(t => num(t.s));
      if (name && !vals.length) { cur = { name, rows: [] }; out.films.push(cur); }
      else if (vals.length >= 9 && cur) cur.rows.push(vals);
    });
    out.films = out.films.map(f => {
      // each film: per-format rows, then its subtotal (the last row); the very last film also carries the grand total
      let rows = f.rows;
      if (f === out.films[out.films.length - 1] && rows.length >= 2) rows = rows.slice(0, -1);
      const v = rows[rows.length - 1] || [];
      const has = v.length >= 10;
      return { name: f.name, shows: v[0], admits: v[1], capacity: v[2], occupancy: has ? v[3] : (v[2] ? v[1] / v[2] * 100 : 0),
        bor: v[has ? 4 : 3], vat: v[has ? 5 : 4], service: v[has ? 6 : 5], nett: v[has ? 7 : 6], atp: v[has ? 8 : 7], netAtp: v[has ? 9 : 8] };
    }).filter(f => f.shows != null);
  }
  // concession items (pages with "Qty Sold")
  out.groups = [];
  let group = null, pend = null;
  pages.filter(p => p.some(t => t.s === "Qty Sold")).forEach(p => {
    const top = p.find(t => t.s === "Qty Sold").y - 8;
    const L = linesOf(p, 0, top);
    L.forEach((r, i) => {
      const name = r.it.filter(t => t.x < 170).map(t => t.s).join(" ").trim();
      const vals = r.it.filter(t => t.x >= 170 && isNum(t.s)).map(t => num(t.s));
      const next = L[i + 1], prev = L[i - 1];
      if (/^(F&B|Grand Total)/i.test(name)) return;
      if (name && vals.length >= 10) { group?.items.push(item(name, vals)); pend = null; return; }
      if (!name && vals.length >= 10) {
        if (pend && prev && Math.abs(prev.y - r.y) <= 6.5) {
          const cont = next && !next.it.some(t => t.x >= 170) && Math.abs(next.y - r.y) <= 6.5 ? next.it.map(t => t.s).join(" ") : "";
          group?.items.push(item((pend + " " + cont).trim(), vals)); if (cont) next.used = true; pend = null;
        } else if (group) group.total = { qty: vals[0], sales: vals[7], profit: vals[9] };
        return;
      }
      if (name && !vals.length && !r.used) {
        const wrapsNext = next && !next.it.some(t => t.x < 170) && next.it.length >= 10 && Math.abs(next.y - r.y) <= 6.5;
        if (wrapsNext) pend = name;
        else { group = { name, items: [] }; out.groups.push(group); pend = null; }
      }
    });
  });
  out.groups = out.groups.filter(g => g.items.length);
  function item(name, v) { return { name: name.replace(/\s+/g, " "), qty: v[0], price: v[1], stdProfit: v[2], stdProfitPct: v[3], per100: v[4], sales: v[7], mix: v[8], profit: v[9], profitMix: v[10] }; }
  if (!out.date) throw new Error("This PDF does not look like a Performance Analysis report");
  return out;
}

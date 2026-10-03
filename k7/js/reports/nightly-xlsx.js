// Writes the nightly days into the original "NC Performance Unaizah" workbook, cell by cell, inside
// the .xlsx zip (101arrowz/fflate), so every style, formula, logo and summary sheet stays as it is.
// Only the input columns of each day row are filled; Excel recalculates the formulas when it opens.
// A month that has no sheet yet is cloned from the latest month sheet (logo included).
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const INPUT = { E: "shows", F: "capacity", G: "admits", H: "bor", M: "gcam", P: "conc", R: "trx", V: "items", X: "cost" };
const FIRST_ROW = 13;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const serial = iso => { const [y, m, d] = iso.split("-").map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
const colNum = c => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const splitRef = r => { const m = r.match(/^([A-Z]+)(\d+)$/); return [m[1], Number(m[2])]; };

function xml(s) { return new DOMParser().parseFromString(s, "application/xml"); }
const ser = d => new XMLSerializer().serializeToString(d);
const dec = new TextDecoder(), enc = new TextEncoder();

// find or create <c r="..."> in a sheet document
function cell(doc, ref) {
  const [col, rowN] = splitRef(ref);
  const sheetData = doc.getElementsByTagNameNS(NS, "sheetData")[0];
  let row = [...sheetData.getElementsByTagNameNS(NS, "row")].find(r => Number(r.getAttribute("r")) === rowN);
  if (!row) {
    row = doc.createElementNS(NS, "row"); row.setAttribute("r", rowN);
    const after = [...sheetData.getElementsByTagNameNS(NS, "row")].find(r => Number(r.getAttribute("r")) > rowN);
    sheetData.insertBefore(row, after || null);
  }
  let c = [...row.getElementsByTagNameNS(NS, "c")].find(x => x.getAttribute("r") === ref);
  if (!c) {
    c = doc.createElementNS(NS, "c"); c.setAttribute("r", ref);
    const after = [...row.getElementsByTagNameNS(NS, "c")].find(x => colNum(splitRef(x.getAttribute("r"))[0]) > colNum(col));
    row.insertBefore(c, after || null);
  }
  return c;
}
function setNum(doc, ref, v) {
  const c = cell(doc, ref);
  while (c.firstChild) c.removeChild(c.firstChild);
  c.removeAttribute("t");
  if (v == null || v === "") return;
  const n = doc.createElementNS(NS, "v"); n.textContent = String(v); c.appendChild(n);
}
function setStr(doc, ref, s) {
  const c = cell(doc, ref);
  while (c.firstChild) c.removeChild(c.firstChild);
  if (s == null) { c.removeAttribute("t"); return; }
  c.setAttribute("t", "inlineStr");
  const is = doc.createElementNS(NS, "is"), t = doc.createElementNS(NS, "t"); t.textContent = s; is.appendChild(t); c.appendChild(is);
}
function setFormula(doc, ref, f) {
  const c = cell(doc, ref);
  while (c.firstChild) c.removeChild(c.firstChild);
  c.removeAttribute("t");
  const n = doc.createElementNS(NS, "f"); n.textContent = f; c.appendChild(n);
}

export async function buildWorkbook(days, { template = "nightly/NC_Performance_Unaizah.xlsx" } = {}) {
  const { unzipSync, zipSync } = await import("../../vendor/fflate.mjs");
  const files = unzipSync(new Uint8Array(await (await fetch(template, { cache: "no-cache" })).arrayBuffer()));
  const read = p => dec.decode(files[p]), write = (p, d) => { files[p] = enc.encode(typeof d === "string" ? d : ser(d)); };

  const wb = xml(read("xl/workbook.xml")), rels = xml(read("xl/_rels/workbook.xml.rels")), types = xml(read("[Content_Types].xml"));
  const relTarget = id => [...rels.getElementsByTagNameNS(PKG, "Relationship")].find(r => r.getAttribute("Id") === id)?.getAttribute("Target");
  const sheetsEl = wb.getElementsByTagNameNS(NS, "sheets")[0];
  const sheets = () => [...sheetsEl.getElementsByTagNameNS(NS, "sheet")].map(s => ({ name: s.getAttribute("name"), path: "xl/" + relTarget(s.getAttributeNS(RNS, "id")).replace(/^\/?xl\//, "") }));
  const docs = {};
  const open = path => (docs[path] ??= xml(read(path)));
  // month sheet = the sheet whose B13 is the 1st of that month
  const monthSheet = {};
  sheets().forEach(s => {
    const d = open(s.path), v = [...d.getElementsByTagNameNS(NS, "c")].find(c => c.getAttribute("r") === "B13")?.getElementsByTagNameNS(NS, "v")[0]?.textContent;
    if (!v || !/^\d+(\.0+)?$/.test(v)) return;
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000);
    monthSheet[`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`] = s;
  });
  const lastKey = () => Object.keys(monthSheet).sort().pop();

  function cloneMonth(key) {
    const src = monthSheet[lastKey()];
    const [y, m] = key.split("-").map(Number), name = `${MON[m - 1]} ${y}`;
    const nums = Object.keys(files).map(p => p.match(/^xl\/worksheets\/sheet(\d+)\.xml$/)?.[1]).filter(Boolean).map(Number);
    const n = Math.max(...nums) + 1, path = `xl/worksheets/sheet${n}.xml`;
    const d = xml(read(src.path));
    setNum(d, "I5", serial(`${key}-01`));
    const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let i = 0; i < 31; i++) {
      const r = FIRST_ROW + i;
      Object.keys(INPUT).forEach(c => setNum(d, c + r, null));
      if (i < len) { const iso = `${key}-${String(i + 1).padStart(2, "0")}`; setNum(d, "B" + r, serial(iso)); setStr(d, "C" + r, DAYS[new Date(iso + "T00:00:00Z").getUTCDay()]); }
      else { setNum(d, "B" + r, null); setStr(d, "C" + r, null); }
    }
    // drop cached formula results so the copy never shows last month's numbers
    [...d.getElementsByTagNameNS(NS, "c")].forEach(c => { if (c.getElementsByTagNameNS(NS, "f").length) [...c.getElementsByTagNameNS(NS, "v")].forEach(v => c.removeChild(v)); });
    docs[path] = d;
    // logo drawing
    const srcRels = src.path.replace(/worksheets\//, "worksheets/_rels/") + ".rels";
    if (files[srcRels]) {
      const r = xml(read(srcRels));
      [...r.getElementsByTagNameNS(PKG, "Relationship")].forEach(rel => {
        const t = rel.getAttribute("Target"); if (!/drawing/.test(t)) return;
        const dn = Math.max(...Object.keys(files).map(p => p.match(/^xl\/drawings\/drawing(\d+)\.xml$/)?.[1]).filter(Boolean).map(Number)) + 1;
        const srcD = "xl/drawings/" + t.split("/").pop();
        files[`xl/drawings/drawing${dn}.xml`] = files[srcD];
        const dr = srcD.replace("drawings/", "drawings/_rels/") + ".rels";
        if (files[dr]) files[`xl/drawings/_rels/drawing${dn}.xml.rels`] = files[dr];
        rel.setAttribute("Target", `../drawings/drawing${dn}.xml`);
        const o = types.createElementNS(types.documentElement.namespaceURI, "Override");
        o.setAttribute("PartName", `/xl/drawings/drawing${dn}.xml`); o.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.drawing+xml");
        types.documentElement.appendChild(o);
      });
      write(path.replace(/worksheets\//, "worksheets/_rels/") + ".rels", r);
    }
    const o = types.createElementNS(types.documentElement.namespaceURI, "Override");
    o.setAttribute("PartName", "/" + path); o.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");
    types.documentElement.appendChild(o);
    const rid = "rId" + (Math.max(...[...rels.getElementsByTagNameNS(PKG, "Relationship")].map(r => Number(r.getAttribute("Id").replace(/\D/g, "")) || 0)) + 1);
    const rel = rels.createElementNS(PKG, "Relationship");
    rel.setAttribute("Id", rid); rel.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"); rel.setAttribute("Target", `worksheets/sheet${n}.xml`);
    rels.documentElement.appendChild(rel);
    const sh = wb.createElementNS(NS, "sheet");
    sh.setAttribute("name", name); sh.setAttribute("sheetId", String(Math.max(...[...sheetsEl.getElementsByTagNameNS(NS, "sheet")].map(s => Number(s.getAttribute("sheetId")))) + 1));
    sh.setAttributeNS(RNS, "r:id", rid);
    sheetsEl.appendChild(sh);
    monthSheet[key] = { name, path };
    // YTD summary row for the month
    const ytd = sheets().find(s => /^YTD/i.test(s.name));
    if (ytd) {
      const yd = open(ytd.path), r = 13 + m;
      [["C", "G"], ["D", "I"], ["E", "J"], ["F", "H"], ["G", "P"], ["H", "Q"], ["I", "S"], ["J", "W"], ["K", "Y"]].forEach(([c, s]) => setFormula(yd, c + r, `'${name}'!${s}44`));
    }
  }

  // fill the day rows
  const byMonth = {};
  days.filter(d => d.date && d.admits != null).forEach(d => { (byMonth[d.date.slice(0, 7)] ??= []).push(d); });
  Object.keys(byMonth).sort().forEach(key => {
    if (!monthSheet[key]) cloneMonth(key);
    const d = open(monthSheet[key].path);
    byMonth[key].forEach(day => {
      const r = FIRST_ROW + Number(day.date.slice(8)) - 1;
      Object.entries(INPUT).forEach(([c, k]) => { if (day[k] != null) setNum(d, c + r, day[k]); });
    });
  });

  // month-to-date sheet follows the latest month
  const latest = Object.keys(byMonth).sort().pop();
  const mtd = sheets().find(s => /^MTD/i.test(s.name));
  if (mtd && latest && monthSheet[latest]) {
    const md = open(mtd.path), name = monthSheet[latest].name;
    [...md.getElementsByTagNameNS(NS, "f")].forEach(f => { f.textContent = f.textContent.replace(/'(?:[A-Z][a-z]{2}\s?\d{4})'!/g, `'${name}'!`); });
    [...md.getElementsByTagNameNS(NS, "c")].forEach(c => { if (c.getElementsByTagNameNS(NS, "f").length) [...c.getElementsByTagNameNS(NS, "v")].forEach(v => c.removeChild(v)); });
    setNum(md, "L5", serial(`${latest}-01`));
    const [y, m] = latest.split("-").map(Number), len = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let i = 0; i < 31; i++) setNum(md, "B" + (14 + i), i < len ? serial(`${latest}-${String(i + 1).padStart(2, "0")}`) : null);
  }

  // no stale numbers: drop every cached formula result so Excel, Numbers and LibreOffice all recompute
  sheets().forEach(sh => { const d = open(sh.path); [...d.getElementsByTagNameNS(NS, "c")].forEach(c => { if (c.getElementsByTagNameNS(NS, "f").length) { [...c.getElementsByTagNameNS(NS, "v")].forEach(v => c.removeChild(v)); if (c.getAttribute("t") === "str" || c.getAttribute("t") === "e") c.removeAttribute("t"); } }); });
  // recalc everything on open; the old calc chain no longer matches
  delete files["xl/calcChain.xml"];
  [...rels.getElementsByTagNameNS(PKG, "Relationship")].filter(r => /calcChain/.test(r.getAttribute("Target"))).forEach(r => r.parentNode.removeChild(r));
  [...types.documentElement.childNodes].filter(n => n.getAttribute && /calcChain/.test(n.getAttribute("PartName") || "")).forEach(n => n.parentNode.removeChild(n));
  let calc = wb.getElementsByTagNameNS(NS, "calcPr")[0];
  if (!calc) { calc = wb.createElementNS(NS, "calcPr"); wb.documentElement.appendChild(calc); }
  calc.setAttribute("fullCalcOnLoad", "1");

  Object.entries(docs).forEach(([p, d]) => write(p, d));
  write("xl/workbook.xml", wb); write("xl/_rels/workbook.xml.rels", rels); write("[Content_Types].xml", types);
  return new Blob([zipSync(files, { level: 6 })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

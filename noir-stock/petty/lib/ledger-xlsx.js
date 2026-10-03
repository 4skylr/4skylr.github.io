// One month of petty cash → the Petty Cash workbook, in the same look as the branch's own file.
// The template (template/Petty_Cash_Template.xlsx) holds the styles, column widths and sheet setup;
// rows, formulas, hyperlinks and the invoice images are written here as XML (fflate, github.com/101arrowz/fflate).
import { unzipSync, zipSync, strToU8, strFromU8 } from "../vendor/fflate.mjs";
import { CATEGORIES } from "./knowledge.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const COLS = "ABCDEFGHIJKLMNO".split("");
// zebra rows: [odd row style, even row style] per column A..O (taken from the branch workbook)
const ZEBRA = [[7, 17], [61, 62], [9, 19], [10, 20], [11, 21], [9, 19], [9, 19], [12, 22], [13, 23], [12, 22], [12, 22], [14, 24], [7, 17], [15, 25], [16, 26]];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const serial = (date, time) => { const [y, m, d] = date.split("-").map(Number); const [h, mi] = (time || "00:00").split(":").map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5 + ((h || 0) * 60 + (mi || 0)) / 1440; };
const cell = {
  s: (ref, s, v) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`,
  n: (ref, s, v) => v == null || v === "" || Number.isNaN(Number(v)) ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}"><v>${Number(v)}</v></c>`,
  f: (ref, s, f, str) => `<c r="${ref}" s="${s}"${str ? ' t="str"' : ""}><f>${esc(f)}</f></c>`,
  e: (ref, s) => `<c r="${ref}" s="${s}"/>`
};
const row = (r, cells, attrs = "") => `<row r="${r}"${attrs}>${cells.join("")}</row>`;
const head = (xml) => xml.slice(0, xml.indexOf("<sheetData"));
const tailOf = (xml) => { const i = xml.indexOf("<pageMargins"); return xml.slice(i); };

// entries: [{ date, time, supplierEn, supplierAr, invoiceNo, descEn, descAr, category, net, vatRate, vat, discount, total, notes, payment, src }]
// images: { [entry.id]: { bytes: Uint8Array (jpeg), w, h } }
export async function buildLedger(templateBytes, entries, { month, float = 4783, branch = "Unaizah – Al Muntazah", images = {} } = {}) {
  const z = unzipSync(templateBytes), get = p => strFromU8(z[p]);
  const [Y, M] = month.split("-").map(Number), last = new Date(Y, M, 0).getDate();
  const list = entries.slice().sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const first = 9, end = first + Math.max(list.length, 1) - 1;
  const period = `01 ${MONTHS[M - 1]} ${Y} – ${String(last).padStart(2, "0")} ${MONTHS[M - 1]} ${Y}`;

  // ── Images sheet layout first: the ledger links to it ──
  const imgRows = []; let r3 = 4; const anchors = [];
  list.forEach((e, i) => {
    const img = images[e.id];
    imgRows.push({ i, cap: r3, back: r3 + 1, img });
    const hpx = img ? Math.round(img.h * (560 / img.w)) : 0;
    if (img) anchors.push({ i, row: r3 + 1, w: 560, h: hpx });
    r3 += 2 + (img ? Math.ceil(hpx / 19.3) + 3 : 1);
  });

  // ── Sheet 1 · Petty Cash Ledger ──
  const s1 = [];
  s1.push(row(1, [cell.s("A1", 47, "CINEMA OPERATIONS  —  PETTY CASH LEDGER"), ...COLS.slice(1).map(c => cell.e(`${c}1`, 47))], ' ht="30" customHeight="1"'));
  s1.push(row(2, [cell.s("A2", 3, "Branch:"), cell.s("B2", 4, branch)]));
  s1.push(row(3, [cell.s("A3", 3, "Period:"), cell.s("B3", 4, period)]));
  s1.push(row(4, [cell.s("A4", 3, "Currency:"), cell.s("B4", 4, "SAR")]));
  s1.push(row(5, [cell.s("A5", 3, "Prepared:"), cell.n("B5", 5, Math.floor(serial(new Date().toISOString().slice(0, 10))))]));
  s1.push(row(6, [cell.s("A6", 3, "Petty cash a/c:"), cell.n("B6", 4, float)]));
  const H8 = ["#", "Date · Day · Time", "Supplier (English)", "Supplier (Arabic)", "Invoice / Receipt No.", "Item Description", "Category", "Net Amount\n(excl. VAT)", "VAT %", "VAT Amount", "Discount", "Total\n(incl. VAT)", "VAT Check", "Invoice", "Notes"];
  s1.push(row(8, H8.map((h, i) => cell.s(`${COLS[i]}8`, 6, h)), ' ht="33.75" customHeight="1"'));
  const links = [];
  list.forEach((e, i) => {
    const r = first + i, z2 = i % 2, st = k => ZEBRA[k][z2];
    const desc = [e.descEn, e.descAr].filter(Boolean).join(" · ");
    const notes = [e.notes, e.payment ? `Paid by ${e.payment}` : "", e.qr ? "ZATCA QR verified" : ""].filter(Boolean).join(" · ");
    const ir = imgRows[i];
    links.push(`<hyperlink ref="N${r}" location="'Invoice Images'!A${ir.cap}" display="View #${i + 1}"/>`);
    s1.push(row(r, [
      cell.n(`A${r}`, st(0), i + 1), cell.n(`B${r}`, st(1), e.date ? serial(e.date, e.time) : null), cell.s(`C${r}`, st(2), e.supplierEn), cell.s(`D${r}`, st(3), e.supplierAr),
      cell.s(`E${r}`, st(4), e.invoiceNo), cell.s(`F${r}`, st(5), desc), cell.s(`G${r}`, st(6), e.category),
      cell.n(`H${r}`, st(7), e.net), cell.n(`I${r}`, st(8), e.vatRate ?? 0.15), cell.n(`J${r}`, st(9), e.vat), cell.n(`K${r}`, st(10), e.discount || 0),
      cell.f(`L${r}`, st(11), `H${r}+J${r}-K${r}`), cell.f(`M${r}`, st(12), `IF(I${r}=0,"Exempt",IF(ABS(ROUND(H${r}*I${r},2)-J${r})<=0.02,"OK","Review"))`, true),
      cell.s(`N${r}`, st(13), `View #${i + 1}`), cell.s(`O${r}`, st(14), notes)
    ]));
  });
  if (!list.length) s1.push(row(first, [cell.s(`C${first}`, 9, "No invoices this month")]));
  const t = end + 2;
  s1.push(row(t, [cell.s(`F${t}`, 35, "TOTAL"), cell.e(`G${t}`, 35), cell.f(`H${t}`, 37, `SUM(H${first}:H${end})`), cell.e(`I${t}`, 35), cell.f(`J${t}`, 37, `SUM(J${first}:J${end})`), cell.f(`K${t}`, 37, `SUM(K${first}:K${end})`), cell.f(`L${t}`, 37, `SUM(L${first}:L${end})`)]));
  s1.push(row(t + 1, [cell.s(`F${t + 1}`, 3, "Petty cash float"), cell.f(`L${t + 1}`, 14, "B6")]));
  s1.push(row(t + 2, [cell.s(`F${t + 2}`, 3, "Balance on hand"), cell.f(`L${t + 2}`, 14, `L${t + 1}-L${t}`)]));
  const qrN = list.filter(e => e.qr).length, review = list.filter(e => Math.abs(Math.round((e.net || 0) * (e.vatRate ?? 0.15) * 100) / 100 - (e.vat || 0)) > 0.02 && (e.vatRate ?? 0.15) > 0).length;
  const notes = [
    "•  Net, VAT % and VAT are read from each invoice; Total = Net + VAT − Discount. Date shows the day and the time printed on the invoice.",
    "•  VAT Check flags any line where the printed VAT differs from Net × VAT % by more than 0.02 SAR.",
    `•  ${qrN} of ${list.length} invoices were read from the ZATCA e-invoice QR code (seller, VAT number, time, total and VAT are exact).`,
    review ? `•  ${review} line(s) need review on the VAT check.` : "•  Every line passes the VAT check.",
    "•  Generated by 67 Stock · Petty Cash reader. Original invoices are archived with each entry."
  ];
  const n0 = t + 4;
  s1.push(row(n0, [cell.s(`A${n0}`, 27, "Reconciliation notes")]));
  notes.forEach((x, k) => s1.push(row(n0 + 1 + k, [cell.s(`A${n0 + 1 + k}`, 46, x), ...COLS.slice(1).map(c => cell.e(`${c}${n0 + 1 + k}`, 46))])));
  const merges1 = ["A1:O1", ...notes.map((_, k) => `A${n0 + 1 + k}:O${n0 + 1 + k}`)];
  const sh1 = get("xl/worksheets/sheet1.xml");
  z["xl/worksheets/sheet1.xml"] = strToU8(head(sh1).replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:O${n0 + notes.length}"/>`) +
    `<sheetData>${s1.join("")}</sheetData><autoFilter ref="A8:O${end}"/><mergeCells count="${merges1.length}">${merges1.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` +
    (links.length ? `<hyperlinks>${links.join("")}</hyperlinks>` : "") + tailOf(sh1));

  // ── Sheet 2 · Category Summary ──
  const L = `'Petty Cash Ledger'!`, rng = c => `${L}$${c}$${first}:$${c}$${end}`;
  const cats = [...new Set([...CATEGORIES.map(c => c.id).filter(c => c !== "Other"), ...list.map(e => e.category).filter(Boolean)])];
  const sups = [...new Set(list.map(e => e.supplierEn).filter(Boolean))].sort();
  const s2 = [row(1, [cell.s("A1", 48, `SPEND BY CATEGORY  —  ${new Date(Y, M - 1, 1).toLocaleString("en-US", { month: "long" })} ${Y}`), ...["B", "C", "D", "E"].map(c => cell.e(`${c}1`, 48))], ' ht="19"')];
  const hdr = (r, a) => row(r, [cell.s(`A${r}`, 28, a), cell.s(`B${r}`, 28, "Invoices"), cell.s(`C${r}`, 28, "Net (excl. VAT)"), cell.s(`D${r}`, 28, "VAT"), cell.s(`E${r}`, 28, "Total (incl. VAT)")]);
  const sumRow = (r, key, col, k) => { const z2 = k % 2 ? [32, 33, 34] : [29, 30, 31];
    return row(r, [cell.s(`A${r}`, z2[0], key), cell.f(`B${r}`, z2[1], `COUNTIF(${rng(col)},$A${r})`), cell.f(`C${r}`, z2[2], `SUMIF(${rng(col)},$A${r},${rng("H")})`), cell.f(`D${r}`, z2[2], `SUMIF(${rng(col)},$A${r},${rng("J")})`), cell.f(`E${r}`, z2[2], `SUMIF(${rng(col)},$A${r},${rng("L")})`)]); };
  s2.push(hdr(3, "Category"));
  cats.forEach((c, k) => s2.push(sumRow(4 + k, c, "G", k)));
  const ct = 4 + cats.length;
  s2.push(row(ct, [cell.s(`A${ct}`, 35, "TOTAL"), cell.f(`B${ct}`, 36, `SUM(B4:B${ct - 1})`), cell.f(`C${ct}`, 37, `SUM(C4:C${ct - 1})`), cell.f(`D${ct}`, 37, `SUM(D4:D${ct - 1})`), cell.f(`E${ct}`, 37, `SUM(E4:E${ct - 1})`)]));
  s2.push(row(ct + 2, [cell.s(`A${ct + 2}`, 38, "Cross-check against ledger total")]));
  s2.push(row(ct + 3, [cell.s(`A${ct + 3}`, 2, "Ledger total (incl. VAT)"), cell.f(`C${ct + 3}`, 39, `${L}L${t}`)]));
  s2.push(row(ct + 4, [cell.s(`A${ct + 4}`, 2, "Difference"), cell.f(`C${ct + 4}`, 39, `E${ct}-C${ct + 3}`)]));
  const sh = ct + 6;
  s2.push(row(sh, [cell.s(`A${sh}`, 38, "SPEND BY SUPPLIER")]));
  s2.push(hdr(sh + 1, "Supplier"));
  sups.forEach((s, k) => s2.push(sumRow(sh + 2 + k, s, "C", k)));
  const st2 = sh + 2 + sups.length;
  s2.push(row(st2, [cell.s(`A${st2}`, 43, "TOTAL"), cell.f(`B${st2}`, 44, `SUM(B${sh + 2}:B${st2 - 1})`), cell.f(`C${st2}`, 45, `SUM(C${sh + 2}:C${st2 - 1})`), cell.f(`D${st2}`, 45, `SUM(D${sh + 2}:D${st2 - 1})`), cell.f(`E${st2}`, 45, `SUM(E${sh + 2}:E${st2 - 1})`)]));
  const sh2 = get("xl/worksheets/sheet2.xml");
  z["xl/worksheets/sheet2.xml"] = strToU8(head(sh2).replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:E${st2}"/>`) + `<sheetData>${s2.join("")}</sheetData><mergeCells count="1"><mergeCell ref="A1:E1"/></mergeCells>` + tailOf(sh2));

  // ── Sheet 3 · Invoice Images ──
  const s3 = [row(1, [cell.s("A1", 1, "SCANNED INVOICES  —  in date order")], ' ht="19"'), row(2, [cell.s("A2", 2, "Each invoice below matches the same line number in the ledger.")])];
  const merges3 = [], links3 = [];
  imgRows.forEach(({ i, cap, back, img }) => {
    const e = list[i];
    s3.push(row(cap, [cell.s(`A${cap}`, 50, `${i + 1}.  ${e.date || ""} ${e.time || ""}   |   ${e.supplierEn || ""}   |   Invoice ${e.invoiceNo || "—"}   |   ${e.descEn || ""}${img ? "" : "   (image not archived)"}`), cell.e(`B${cap}`, 50)], ' ht="19.5" customHeight="1"'));
    s3.push(row(back, [cell.s(`A${back}`, 49, "← back to ledger"), cell.e(`B${back}`, 49)]));
    merges3.push(`A${cap}:B${cap}`, `A${back}:B${back}`);
    links3.push(`<hyperlink ref="A${back}" location="'Petty Cash Ledger'!N${first + i}" display="← back to ledger"/>`);
  });
  const sh3 = get("xl/worksheets/sheet3.xml"), drawTag = sh3.match(/<drawing [^>]*\/>/)?.[0] || "";
  z["xl/worksheets/sheet3.xml"] = strToU8(head(sh3).replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:B${r3}"/>`) + `<sheetData>${s3.join("")}</sheetData>` +
    (merges3.length ? `<mergeCells count="${merges3.length}">${merges3.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") +
    (links3.length ? `<hyperlinks>${links3.join("")}</hyperlinks>` : "") + tailOf(sh3).replace(/<drawing [^>]*\/>/, "") .replace("</worksheet>", `${anchors.length ? drawTag : ""}</worksheet>`));
  const EMU = 9525, rels = [], pics = [];
  anchors.forEach((a, k) => {
    const id = `rId${k + 1}`, file = `inv${k + 1}.jpeg`;
    z[`xl/media/${file}`] = images[list[a.i].id].bytes;
    rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${file}"/>`);
    pics.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${a.w * EMU}" cy="${a.h * EMU}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${k + 2}" name="Invoice ${a.i + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${a.w * EMU}" cy="${a.h * EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
  });
  z["xl/drawings/drawing1.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${pics.join("")}</xdr:wsDr>`);
  z["xl/drawings/_rels/drawing1.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`);

  // workbook: filter range for the ledger, recalculate on open
  let wb = get("xl/workbook.xml");
  wb = wb.replace("</sheets>", `</sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Petty Cash Ledger'!$A$8:$O$${end}</definedName></definedNames>`);
  z["xl/workbook.xml"] = strToU8(wb);
  const core = get("docProps/core.xml").replace(/<dc:creator>[^<]*<\/dc:creator>/, "<dc:creator>67 Stock</dc:creator>").replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, "<cp:lastModifiedBy>67 Stock · Petty Cash</cp:lastModifiedBy>")
    .replace(/<dcterms:modified[^>]*>[^<]*<\/dcterms:modified>/, `<dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:modified>`);
  z["docProps/core.xml"] = strToU8(core);
  return new Blob([zipSync(z, { level: 6 })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
export const ledgerName = month => { const [y, m] = month.split("-").map(Number); return `Petty_Cash_Unaizah_${MONTHS[m - 1]}${y}.xlsx`; };

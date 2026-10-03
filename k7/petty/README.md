# Petty Cash · بيتي كاش

A self-contained page of 67 Stock: scan an invoice (PDF or photo), check what the reader found, save it to the month's ledger, and download the branch workbook. Everything for it lives in this folder; the main app only loads `petty.js` and passes it the store helpers.

## Files

| File | Job |
|---|---|
| `petty.js` | The page: time lock, month view, scanner queue, review form, ledger, charts, archive, Excel export, workbook import |
| `petty.css` | Its styles (uses the site's colour tokens, falls back to its own) |
| `lib/reader.js` | PDF/photo → fields. pdf.js renders and gives the text layer; zxing-wasm finds the ZATCA QR; Tesseract.js reads scans in Arabic + English, with a second pass when key fields are missing |
| `lib/zatca.js` | Decodes the Saudi e-invoice QR (TLV: seller, VAT number, time, total, VAT) |
| `lib/extract.js` | Text → date, time, supplier, VAT number, invoice number, net / VAT / total (solved so they agree at 15%), item, category. Every field records where it came from |
| `lib/knowledge.js` | Categories, known suppliers by VAT number, Arabic/English item words, Arabic → English spelling |
| `lib/ledger-xlsx.js` | Writes the month into `template/Petty_Cash_Template.xlsx`: ledger with formulas and VAT check, category and supplier summary, invoice images sheet |
| `lib/archive.js` | IndexedDB on the device; Firestore (`petty`, `pettyImg`, `pettyXlsx`, `pettyCfg`) and Storage (`petty/invoices/…`, `petty/excel/…`) |
| `vendor/` | zxing-wasm 3.1.4 reader + wasm, Tesseract.js 7.0.0 (ESM), fflate |

Tesseract's worker, core and the Arabic/English models load from jsDelivr the first time and are cached by the browser.

## Libraries (GitHub)

- Tesseract.js: naptha/tesseract.js. OCR, Arabic + English (`ara`, `eng`, LSTM best_int models)
- zxing-wasm: Sec-ant/zxing-wasm. The zxing-cpp barcode engine in WebAssembly, used for the e-invoice QR
- pdf.js: mozilla/pdf.js
- fflate: 101arrowz/fflate. Reads and writes the .xlsx package

## Lock

Four digits: the current time as HHMM (24-hour or 12-hour, the minute before and after also work). The page locks again after 20 minutes without use. It is a convenience lock in the browser, not real security: the code is public.

## Trial scan (the 25 July invoices from the branch workbook)

The workbook's images are 560 px wide, much smaller than a real scan, so this is a hard test.

| Field | Correct |
|---|---|
| Supplier | 25 / 25 |
| Total incl. VAT | 23 / 25 |
| VAT | 23 / 25 |
| Category | 24 / 25 |
| Invoice number | 22 / 25 |
| Date | 22 / 25 |

The ZATCA QR was decoded on 16 of 25; those lines are exact. Two "misses" are the ledger disagreeing with the receipt: #7 (Sama Al Nazafah 81051) is 96.60 on the receipt and its QR but 96.00 in the ledger; #23 (Al Othaim) is 10.01 in the QR and 10.00 in the ledger.

## Fixing things

- A supplier is read wrongly: add it to `SUPPLIERS` in `lib/knowledge.js` (its VAT number is the key). Saved entries also teach the reader.
- An item lands in the wrong category: add or change a line in `GLOSSARY`.
- The workbook layout: `template/Petty_Cash_Template.xlsx` holds the styles; `lib/ledger-xlsx.js` holds the rows.

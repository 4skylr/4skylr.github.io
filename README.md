# 67 Stock · Noir Cinema Unaizah

[![CI](https://github.com/4skylr/4skylr.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/4skylr/4skylr.github.io/actions/workflows/ci.yml)

Back-office web app for the concession and the branch: stock across the three locations, counts, recipes and yield,
product profit, the nightly report, the halls, the Unaizah ledger, safety checks and petty cash. Arabic and English,
phone first, works offline once opened.

`noir-stock/` is the address printed on the product labels: it opens one product card from its barcode and nothing else.
It is built from the app (`k7/door/build.mjs`); do not edit it by hand.

## Layout

| Folder | What lives there |
|---|---|
| `k7/js/core` | shell services: store (Firestore + browser storage), clock, quick find, Arabic layer, links |
| `k7/js/data` | data generated from system reports: stock seed, sales, recipes, menu, expiry, price list, safety register |
| `k7/js/stock` | stock pages, product card, showcase, alerts, analytics, Menu Lab |
| `k7/js/finance` | budget, Unaizah ledger and audit, product profit |
| `k7/js/reports` | nightly report, halls, the required-reports uploads |
| `k7/js/safety` | safety & maintenance board and its drawings |
| `k7/petty` | petty cash: invoice reader and the monthly workbook (self-contained) |
| `k7/vendor` | third-party libraries, vendored so the app works offline |

## Checks

Every push that touches the site runs [CI](.github/workflows/ci.yml): ESLint, then a Playwright smoke test that opens every
page in English and Arabic at phone and desktop width and checks the barcode door. Locally:

```sh
npx eslint@9 .
npm i --no-save playwright && npx playwright install chromium
node .github/scripts/smoke.mjs .
```

Changes per version: [CHANGELOG.md](CHANGELOG.md). Problems and ideas: open an issue with the forms under **Issues → New issue**.

## Open-source libraries

[GSAP](https://github.com/greensock/GSAP) ·
[Apache ECharts](https://github.com/apache/echarts) ·
[pdf.js](https://github.com/mozilla/pdf.js) ·
[SheetJS](https://github.com/SheetJS/sheetjs) ·
[ExcelJS](https://github.com/exceljs/exceljs) ·
[zxing-wasm](https://github.com/Sec-ant/zxing-wasm) ·
[Tesseract.js](https://github.com/naptha/tesseract.js) ·
[Fuse.js](https://github.com/krisk/Fuse) ·
[driver.js](https://github.com/kamranahmedse/driver.js) ·
[Odometer](https://github.com/HubSpot/odometer) ·
[anime.js](https://github.com/juliangarnier/anime) ·
[fflate](https://github.com/101arrowz/fflate) ·
[idb-keyval](https://github.com/jakearchibald/idb-keyval) ·
[Geist](https://github.com/vercel/geist-font) ·
[IBM Plex](https://github.com/IBM/plex) ·
product photos upscaled with [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) and cut out with [rembg](https://github.com/danielgatis/rembg).

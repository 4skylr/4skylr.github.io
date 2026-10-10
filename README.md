# 67 Stock · Noir Cinema Unaizah

[![CI](https://github.com/4skylr/4skylr.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/4skylr/4skylr.github.io/actions/workflows/ci.yml)

Back-office web app for the concession and the branch: stock across the three locations, counts, recipes and yield,
product profit, the nightly report, the halls, the Unaizah ledger and safety checks. Arabic and English,
phone first, works offline once opened.

`noir-stock/` only redirects old printed labels to `/ipop/`.

## Layout

| Folder | What lives there |
|---|---|
| `ipop/js/core` | shell services: store (Firestore + browser storage), clock, quick find, Arabic layer, links |
| `ipop/js/data` | data generated from system reports: stock seed, sales, recipes, menu, expiry, price list, safety register |
| `ipop/js/stock` | stock pages, product card, the product watch and its count mission, showcase, alerts, analytics, Menu Lab |
| `ipop/js/finance` | budget, Unaizah ledger and audit, product profit |
| `ipop/js/reports` | nightly report, halls, the required-reports uploads |
| `ipop/js/safety` | safety & maintenance board and its drawings |
| `ipop/vendor` | third-party libraries, vendored so the app works offline |

## Security

Settings and the audit tools open with the clock PIN. The site is static and this repository is public, so everything
under `ipop/js/data` can be read by anyone; keep sensitive files (invoices, card data, personal details) out of it.

## Checks

Every push that touches the site runs [CI](.github/workflows/ci.yml): ESLint, a check that the start-up modulepreload list
is current (`node .github/scripts/preload.mjs`), then a Playwright smoke test that opens every
page in English and Arabic at phone and desktop width and checks the barcode door. Locally:

```sh
npx eslint@9 .
npm i --no-save playwright && npx playwright install chromium
node .github/scripts/smoke.mjs .
```

Changes per version: [CHANGELOG.md](CHANGELOG.md). Problems and ideas: open an issue with the forms under **Issues → New issue**.

## Sign-in and branches

iPop opens only with a code. Each code is a Firebase Authentication account (the code is never stored in the site), and
each person's role and branch are in the database, written only by the admin.

| Branch | Data |
|---|---|
| Unaizah | the original collections (products, counts, history, reports) |
| Al Mithnab | `branches/almithnab/…` only |
| Al Khafji | `branches/alkhafji/…` only |

Prices, product photos, recipes and the menu are shared. Stock, counts, history and uploaded reports belong to one branch.

**Turn it on (Firebase console, project alwaleed-36b21):**
1. Authentication → Sign-in method → **Email/Password → Enable**.
2. Open the site and enter the admin code. The first code entered becomes the admin (once).
3. Firestore Database → Rules → paste [`firestore.rules`](firestore.rules) → **Publish**. Storage → Rules → paste [`storage.rules`](storage.rules) → **Publish**.
4. Settings → People: add each person with a 4-digit code, a role and a branch.

Until step 3 is done the database is still open; Settings → People and the lock sheet say which state it is in.

## Open-source libraries

[GSAP](https://github.com/greensock/GSAP) ·
[Ionicons](https://github.com/ionic-team/ionicons) ·
[Apache ECharts](https://github.com/apache/echarts) ·
[pdf.js](https://github.com/mozilla/pdf.js) ·
[SheetJS](https://github.com/SheetJS/sheetjs) ·
[ExcelJS](https://github.com/exceljs/exceljs) ·
[zxing-wasm](https://github.com/Sec-ant/zxing-wasm) ·
[Fuse.js](https://github.com/krisk/Fuse) ·
[driver.js](https://github.com/kamranahmedse/driver.js) ·
[Odometer](https://github.com/HubSpot/odometer) ·
[anime.js](https://github.com/juliangarnier/anime) ·
[fflate](https://github.com/101arrowz/fflate) ·
[Inter](https://github.com/rsms/inter) ·
[IBM Plex](https://github.com/IBM/plex) ·
product photos upscaled with [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) and cut out with [rembg](https://github.com/danielgatis/rembg).

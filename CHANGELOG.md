# Changelog

## v88 · 2026-10-06 · Two-sided products, likes, sharper photos

- **Showcase products turn round** (tap, T, or the Turn button): the back shows the menu recipes the product goes into, calories per serving and its expiry groups; the front product tilts toward the pointer with a moving glare. · **المنتج يلف**: وراه الوصفة والسعرات والمجموعات.
- **Likes**: anyone who opens a product (barcode card or showcase) can like it under their name, once per name; the Overview shows the most-liked products. · **الإعجاب** باسم الشخص.
- **Calories** per serving, estimated from each recipe's ingredients (packs from their label), on the showcase back and the Profit page. · **السعرات الحرارية** محسوبة من الوصفة.
- **All 71 product photos re-made**: Real-ESRGAN (general-x4v3, run as ONNX) upscaling, ISNet masks refined with a guided filter, 1200 px cut-outs. · **صور المنتجات بجودة أعلى.**
- Fix caught by CI: mask images in CSS variables resolved against the stylesheet (404).

## v87 · 2026-10-06 · Shift brief, quick actions, accessibility, CI

### What's new · الجديد

- **Shift brief** on the Overview: stock, expiry, safety checks and system-report freshness in one row, each opening its page. · **موجز الوردية** بأول صفحة النظرة.
- **Quick find runs actions** (Ctrl K): start a count, today's transfer list, log a safety check, upload a report, print barcodes, switch language. · **البحث السريع ينفّذ إجراءات.**
- **Accessibility pass** (axe-core): all text now meets WCAG AA contrast; keyboard access to scrolling tables; seat maps fixed for screen readers. · **وضوح أعلى للنصوص** على كل الصفحات.
- **Colour clean-up**: hall heat map, analyst score and link cards now use the theme. · **توحيد الألوان.**

### Earlier in this cycle · قبلها

- v86 Safety & maintenance board · لوحة السلامة والصيانة
- v85 All 71 product photos rebuilt to one standard · توحيد صور المنتجات
- v84 Product profit from the supplier price list, interactive stock showcase · الربحية وعرض المنتجات التفاعلي
- v83 Projection-booth theme · الثيم الجديد
- v82 Stock alerts, header clock, file layout · التنبيهات والساعة

### Engineering

- CI on every push: ESLint + Playwright smoke test of every page (AR/EN × phone/desktop) and the barcode door; results table in the job summary, screenshots on failure.
- Dependabot keeps the workflow actions current (first update merged: #1).
- Issue forms for problems and ideas.

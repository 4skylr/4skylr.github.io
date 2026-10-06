# Changelog

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

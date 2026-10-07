# Changelog

## v98 · 2026-10-07 · Inter everywhere, clean-up and fixes

- **Inter is the site's only Latin font**, from the Inter 4 files supplied: variable weight 100–900 with optical sizes, upright and italic. It replaces Geist, Geist Mono, the system fonts and monospace in the pages, the watch, the charts, the launch screen and the team brief image. IBM Plex Sans Arabic still draws the Arabic. · **اعتماد خط Inter بالكامل.**
- **Fixed:**
  - The edit-PIN dialog closed on any tap, so a count could not be committed. It now stays open, shows "Wrong pin", and Escape cancels it cleanly.
  - If Firebase refused the live connection, every save waited forever. The app now falls back to local mode.
  - The Excel expiry import turned real dates into unreadable text, and it wiped a row's second group. Dates are read correctly and rows are merged.
  - A sales PDF gave a product with no SKU a made-up figure.
  - "Days left" flipped at noon. It now counts whole days from midnight.
  - The transfer checklist reset at 03:00 instead of midnight.
  - An empty PIN box could save an expiry group.
  - Typing in a field (a new link, a PIN) was wiped when another device synced. The page now waits until you leave the field.
  - Charts left in memory after you leave a page are now disposed, and ECharts loads once instead of once per page.
  - Petty-cash files added while others were still being read could stay waiting forever.
  - Invoice image addresses are escaped. The settings intro removes its listeners when it closes, and it only vibrates after a tap.
  - Opening the scanner again stops the earlier camera.
- **Removed what the site did not use:**
  - Libraries: Day.js, decimal.js, idb-keyval, a second copy of fflate, and the Geist fonts.
  - An unused IndexedDB copy of expiry edits, dead product-card code, and unused functions (including an old hard-coded PIN).
  - The old shutter launch screen and background glow markup.
  - 135 CSS rules for classes nothing uses, including the grid.js styles.
  - A stray root theme.css.
  - From the barcode page: the copies of ECharts, Fuse, anime.js, confetti and Odometer it never loads.
- The barcodes, QR codes, labels and their links are unchanged; all 71 open the watch.

## v97 · 2026-10-07 · Apple-style design

- **The whole site follows Apple's Human Interface Guidelines and iOS UI kit** (developer.apple.com/design/resources), with no Apple logo or artwork. · **تصميم الموقع كامل بأسلوب أبل.**
  - **Type:** the device's own system font: SF Pro and SF Arabic on iPhone, iPad and Mac. Other devices use Inter and IBM Plex Sans Arabic. No SF font files are shipped; Apple licenses them for its own platforms only.
  - **Colour:** the iOS system colours and grouped backgrounds in Light and Dark, with flat cards on the gray (or black) background. Text uses the readable versions of each colour; the contrast scan passes.
  - **Bars:** a floating Liquid Glass tab bar with labels; the current tab is tinted blue with a filled icon. The header buttons are glass circles.
  - **Controls:** capsule buttons (gray, blue or text-only), gray rounded text fields and search, iOS segmented controls, and filter chips.
  - **Windows:** sheets slide up from the bottom on a phone, with a grabber and a round close button, and appear as a centred card on a big screen. Messages drop in at the top like an iOS notification, with a green check or a red mark.
  - **Icons:** Ionicons in the iOS style, filled when selected. Charts use the iOS system colours.
  - **Launch screen:** the plain background with the logo.
- Unchanged: the logo, the watch screen, the product cards, the barcodes and their links, and the product photos.

## v96 · 2026-10-06 · Scanner fix

- **The in-app Scan button opens the product again.** After a code was read, the camera sheet stayed on top of the product, so nothing seemed to happen; it now closes. Reading is more reliable: the phone's own barcode detector where there is one, else zxing-cpp (Sec-ant/zxing-wasm), else the older ZXing reader, for both the QR and the Code 128 on each label. Tested with a camera feed of a label QR and barcode. · **إصلاح المسح من داخل الموقع.**
- The printed barcodes and QR codes, and the link they open, are unchanged; all 71 decode to their product and open on the barcode page.

## v95 · 2026-10-06 · Product cards

- **Stock → Cards uses Smit-Prajapati's product card (Uiverse.io)**, without any "buy": the image with the unit price, the heart (a like under your name), category and name; **colours** are the stores the product is in now (tap a dot for the quantity there); **sizes** are the product's other sizes (tubs, cups, lids, glasses, pack sizes…; tap one to flip the card to it); **stars** rank sales since 1 January against the other products, with the number sold. The yellow button opens the product, the small one its barcode card. White and Night versions. · **بطاقات المنتجات الجديدة.**

## v94 · 2026-10-06 · Glass theme, White and Night

- **New theme from marcelodolza's glass card (Uiverse.io)**: frosted panels with white inner light and soft indigo shadows, lavender blobs behind the page, and a pink → periwinkle → blue accent for the main action and the page you are on. · **ثيم زجاجي جديد.**
- **Two versions**: White and Night, switched from the sun / moon button in the header; the choice is remembered on the device, and the first visit follows the phone's setting. Charts follow the theme too. · **نسختين: أبيض وليلي** من زر الشمس/القمر.
- **Fonts**: Inter for Latin text and numbers (tabular figures), IBM Plex Sans Arabic for Arabic. · **خط جديد.**
- Every hard-coded night colour in the style sheets now goes through theme tokens (≈1,000 values), so both versions pass the WCAG AA contrast scan.
- Fixes: the product 360 sheet and the Nightly page were wider than a phone screen (a recipe deck and the chart grid stretched them); the Stock page's action row no longer widens the page.

## v93 · 2026-10-06 · New logo

- **New site logo** (the glasses loader by anand_4957 on Uiverse.io): in the header in place of the old 67 logo, and on the opening screen. The full shutters play on the first open of a visit; every later open or refresh (including the refresh button) shows the logo on black for a moment, then fades. The barcode door opens with it too. The old logo and its images are removed. · **شعار جديد** بالأعلى وعند الفتح والتحديث.
- Fix: a stray CSS fragment in style.css swallowed the product-360 sheet width rule.

## v92 · 2026-10-06 · Scan opens the watch alone

- A label scan now shows only the watch, on the design's own cream page: no card, frame or other sections. The face adds the product name; the grey side button switches Arabic / English. The full card stays for the product card inside the app. · **المسح يفتح الساعة فقط.**

## v91 · 2026-10-06 · Product watch on the barcode card

- **The product photo now sits on a watch** (design after chase2k25 on Uiverse.io): the face shows the photo, how many expiry groups the product has, the next expiry date with the days left as a ring, and the quantity on hand. Swipe the screen up (or press the crown, or tap the dots) for: recipes (each opens the recipe theater), stock by location as activity rings, the groups one by one, and sales. The yellow side button goes back to the face. · **صورة المنتج على شاشة ساعة**: المجموعات والانتهاء، واسحب لفوق للوصفة والمعلومات.
- The photo element itself (`.pc-shot` + its image) is unchanged; it is placed on the watch screen.

## v90 · 2026-10-06 · Recipe theater, a faster site, the lock removed

- **Recipe theater** replaces every old recipe display (barcode card sheet, showcase back, product 360, Yield menu rows and popcorn board, Profit breakdown). Recipes now appear as tokens; one tap opens a full-screen reactor: the menu item at the core, its ingredients in orbit (drag to spin, with inertia), what the stock makes and which ingredient runs out first, cost per serve and its split ("cost DNA"), menu margin, calories, and a batch planner that shows what each ingredient needs against what is on hand. Swipe or use the arrows to move through the list. · **مسرح الوصفة**: بديل كل طرق عرض الوصفة القديمة.
- **Privacy lock removed**: money, prices and recipes show as they did before v89. The admin sign-in for Settings and the audits is unchanged (clock PIN). · **إلغاء قفل الأسعار والمنتجات.**
- **Speed** · **أسرع**:
  - The header clock no longer re-lays out the page 24 times a second (its frame counter is now a compositor animation). Idle CPU on the Overview: 396 ms → 17 ms per 5 s.
  - The showcase lets GSAP's ticker sleep when nothing moves (455 ms → 27 ms idle).
  - The barcode card dropped progressbar.js, which ran an animation loop forever, and its spinning borders now rotate on the compositor (idle 580 ms → 5–117 ms).
  - Finance/Unaizah status lights animate opacity instead of box-shadow (908 ms → 17 ms idle).
  - Start-up modules are preloaded in parallel, Yield and the recipe theater load only when opened, and the opening shutters play once per visit. First paint on a throttled phone: 1.2 s → 0.9 s.
- **Checks**: all 71 barcodes and QR codes decoded and matched to their products; every product opens on the barcode door. Dead code removed (unused product panel, old recipe cards and their CSS). CI checks the preload list.

## v89 · 2026-10-06 · Privacy lock, vault dial, Lucide icons

- **Money and recipes are locked** with the clock PIN (HHMM): stock values, unit costs, menu prices, margins, revenue, recipes and their cost show as •••• until the PIN is in. Quantities, expiry dates, locations and barcodes stay open to everyone. The lock closes after 30 minutes without a tap, or from the lock button in the header. · **الأموال والوصفات مقفلة بالرقم السري** (الساعة والدقايق). الكميات والتواريخ والمواقع والباركود مفتوحة للجميع.
- **Whole pages behind the lock**: Budget, Profit, Unaizah, Nightly report and Yield open on a 3D vault dial (Three.js); one PIN opens them all, petty cash included. CSV exports with costs ask for the PIN. · صفحات المالية تفتح على خزنة ثلاثية الأبعاد.
- **Barcode card**: the recipe button asks for the PIN; the recipes are not on the page until it is given. · **بطاقة الباركود**: الوصفة بالرقم السري.
- **Icons are now Lucide**; pages rise in with GSAP. · أيقونات Lucide وحركة GSAP.
- **Clean-up**: three dead modules removed (old FEFO report, servings, last count) and dead code in the stock card; ESLint warnings 11 → 3 (the 3 left are in the label code, which is kept as is).
- **CI** now also checks that no page shows a money amount without the PIN, that the clock PIN opens the locked pages, and that the barcode door shows no prices or recipes.

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

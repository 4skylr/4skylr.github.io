// Arabic layer for the pages that are still written in English (overview, stock, count, yield, ledger, settings).
// It only rewrites visible text and a few attributes after a page renders, so the page code, images,
// barcodes and saved data stay exactly as they are. Product names are left in English to match the report.

const U = { pcs: "حبة", kg: "كجم", L: "لتر", ml: "مل", g: "جم", oz: "أونصة", Oz: "أونصة", box: "كرتون" };
const UNIT = "(pcs|kg|L|ml|g|box)";
const N = "(-?[\\d.,]+)";

const D = {
  // shell
  "English": "English", "Noir Cinema": "نوار سينما", "· Othaim Mall, Onaizah": "· العثيم مول، عنيزة",
  "Local node · this browser": "محلي · هذا المتصفح", "Firebase · synced": "Firebase · متزامن", "Connecting…": "جارٍ الاتصال…",
  "Data is stored in this browser only. Add your Firebase config to sync.": "البيانات محفوظة في هذا المتصفح فقط.",
  "Data is stored in Firestore and syncs live": "البيانات محفوظة في Firebase وتتزامن مباشرة",
  "Live stock ticker": "شريط المخزون المباشر", "67 Stock home": "الرئيسية", "Main": "القائمة", "Close": "إغلاق",
  // locations & categories
  "Mini Store": "الميني ستور", "Concession": "الكونسيشن", "Main Stores": "المستودع الرئيسي", "Store": "المستودع",
  "Mini": "ميني", "Stores": "المستودع", "Refuel": "الكونسيشن",
  "BIB Syrups": "شراب BIB", "Drinks & Water": "مشروبات ومياه", "Candy & Snacks": "حلويات وسناكات", "Popcorn & Floss": "فشار وغزل بنات",
  "Food & Sauces": "أطعمة وصوصات", "Slush": "سلاش", "Slush & Mocktails": "سلاش وموكتيل", "Ice Cream": "آيس كريم", "Hot Drinks": "مشروبات ساخنة", "Packaging": "التغليف",
  "Removals": "مستبعدات", "Other": "أخرى",
  // overview
  "Start a count": "ابدأ جرد", "Total inventory value · net of VAT": "إجمالي قيمة المخزون · بدون الضريبة", "SAR": "ريال",
  "units on hand": "وحدة متوفرة", "counts committed": "جرد معتمد", "three vaults": "ثلاث مستودعات",
  "Value by category": "القيمة حسب الفئة", "where the money sits": "أين تتركز الأموال", "Top holdings": "الأعلى قيمة", "Top movers": "الأكثر حركة", "View all": "عرض الكل",
  "Signals": "التنبيهات", "OUT": "نفد", "All quiet.": "لا توجد تنبيهات.", "Activity chain": "سجل النشاط", "latest first": "الأحدث أولاً",
  "just now": "الآن", "No activity yet.": "لا يوجد نشاط بعد.",
  "Set a minimum level on any product to get low-stock signals here.": "حدد حداً أدنى لأي منتج لتظهر تنبيهات النقص هنا.",
  "Current stock count": "عدد المخزون الحالي", "Current stock bar": "أعلى الكميات", "Value dashboard": "لوحة القيمة",
  "Stock by vault": "المخزون حسب المستودع", "Inventory grid": "جدول المخزون",
  "Units on hand across every location. Library: inorganik/countUp.js": "الوحدات المتوفرة في كل المواقع. المكتبة: inorganik/countUp.js",
  "Top quantities on hand. Library: chartjs/Chart.js": "أعلى الكميات المتوفرة. المكتبة: chartjs/Chart.js",
  "Read-only view of the current ledger. Library: gridjs/gridjs": "عرض للقراءة فقط من السجل الحالي. المكتبة: gridjs/gridjs",
  "Value share by location": "حصة القيمة حسب الموقع", "Category value distribution": "توزيع القيمة حسب الفئة",
  "Product": "المنتج", "Report name": "الاسم في التقرير", "On hand": "المتوفر", "Unit": "الوحدة", "Value SAR": "القيمة ريال",
  "Showing": "عرض", "to": "إلى", "of": "من", "results": "نتيجة", "Previous": "السابق", "Next": "التالي",
  "Type a keyword...": "اكتب كلمة للبحث…", "Sort column ascending": "ترتيب تصاعدي", "Sort column descending": "ترتيب تنازلي",
  // stock
  "Scan": "مسح", "Print barcodes": "طباعة الباركود", "Excel": "Excel", "CSV": "CSV", "All locations": "كل المواقع",
  "By category": "حسب الفئة", "Highest value": "الأعلى قيمة", "Highest quantity": "الأعلى كمية", "A → Z": "أ ← ي", "Recently edited": "آخر تعديل",
  "Cards": "بطاقات", "Ledger": "جدول", "Analysis": "تحليل", "Lab": "لاب", "Everything": "الكل", "Low": "منخفض", "Level": "المستوى", "Out": "نفد",
  "not on report": "غير موجود بالتقرير", "set a full level": "حدد المستوى الكامل",
  "Search name, report name or code": "ابحث بالاسم أو اسم التقرير أو الكود", "Search products": "بحث المنتجات",
  "Location": "الموقع", "Sort": "الترتيب", "View": "العرض", "Categories": "الفئات", "Category": "الفئة",
  "Product name": "اسم المنتج", "Name on stock report": "الاسم في تقرير الجرد", "Item code": "كود الصنف", "Unit cost · SAR": "تكلفة الوحدة · ريال",
  "Full level (par)": "المستوى الكامل", "Low-stock alert at": "تنبيه النقص عند", "Drop a photo": "أسقط صورة", "Remove photo": "حذف الصورة",
  "or click, or paste from clipboard": "أو اضغط، أو الصق من الحافظة", "Token": "الرمز", "Total": "الإجمالي",
  "The quantity that counts as 100% on the level gauge": "الكمية التي تمثل 100% في مؤشر المستوى",
  "Cancel": "إلغاء", "Done": "تم", "Back": "رجوع", "Print": "طباعة", "PDF": "PDF", "Delete": "حذف",
  "Last count": "آخر جرد", "Expiry batches": "دفعات الصلاحية", "Edit batches": "تعديل الدفعات", "Expired": "منتهي",
  "No batch on file.": "لا توجد دفعات.", "No batches to edit.": "لا توجد دفعات للتعديل.", "All warehouses": "كل المستودعات",
  "7 days": "7 أيام", "14 days": "14 يوم", "30 days": "30 يوم", "No committed count for this item yet.": "لا يوجد جرد معتمد لهذا الصنف بعد.",
  "Save to sheet": "حفظ في الشيت", "Unlock edits": "فتح التعديل", "Unlock": "فتح", "Secret pin": "الرمز السري",
  "This stock can sell": "هذا المخزون يكفي لبيع", "Print this barcode": "طباعة هذا الباركود",
  "This item is not on the September expiry sheet.": "هذا الصنف غير موجود في شيت صلاحية سبتمبر.",
  "Saved into the September sheet and included in the next Excel download.": "تم الحفظ في شيت سبتمبر وسيظهر في تنزيل Excel القادم.",
  // count
  "New count": "جرد جديد", "pick a vault": "اختر المستودع", "Counted by": "بواسطة", "Your name": "اسمك",
  "Only list items the system has at this location": "اعرض فقط الأصناف الموجودة بالنظام في هذا الموقع",
  "Open count sheet": "افتح ورقة الجرد", "Drafts": "المسودات", "Nothing half-done.": "لا يوجد جرد معلّق.",
  "Counts you save without committing wait here.": "الجرد المحفوظ بدون اعتماد يظهر هنا.", "Resume": "متابعة",
  "Close sheet": "إغلاق الورقة", "Draft": "مسودة", "Committed": "معتمد", "Find an item": "ابحث عن صنف", "All categories": "كل الفئات",
  "Items on system only": "أصناف النظام فقط", "System": "النظام", "Variance": "الفرق", "count": "العدد", "match": "مطابق",
  "Minus one": "ناقص واحد", "Plus one": "زائد واحد", "No match.": "لا توجد نتائج.", "Try another search or category.": "جرّب بحثاً أو فئة أخرى.",
  "Counted": "المعدود", "With variance": "بها فرق", "Variance SAR": "الفرق ريال", "Save draft": "حفظ مسودة", "Commit count": "اعتماد الجرد",
  "Close anyway": "أغلق على أي حال", "Commit": "اعتماد",
  "This sheet has counts that aren't saved. Save it as a draft first if you want to come back to it.": "في هذه الورقة أرقام غير محفوظة. احفظها كمسودة إذا تبي ترجع لها.",
  // yield
  "Popcorn board": "لوحة الفشار", "tubs you can fill right now": "عدد العلب التي يمكن تعبئتها الآن", "oz": "أونصة",
  "Regular": "عادي", "Medium": "وسط", "Large": "كبير", "X-Large": "كبير جداً", "limited by": "محدود بـ", "limited by ": "محدود بـ ",
  "Oil": "الزيت", "Salted": "مملح", "Cheese": "جبن", "Caramel": "كراميل", "Pizza Savory": "بيتزا", "Pizza mix": "خلطة البيتزا",
  "Oil, corn & flavourings": "الزيت والذرة والنكهات", "how far each one stretches": "كم يكفي كل صنف",
  "Popcorn you can sell": "الفشار الممكن بيعه", "by size and flavour": "حسب الحجم والنكهة", "What runs out first": "ما الذي ينفد أولاً",
  "items each ingredient caps": "الأصناف التي يحدها كل مكوّن", "Menu explorer": "مستكشف المنيو", "All": "الكل", "Popcorn": "فشار",
  "Combos": "كومبو", "Fountain drinks": "مشروبات النافورة", "Nachos": "ناتشوز", "Hot dogs": "هوت دوق", "Mocktails": "موكتيل",
  "Cotton candy": "غزل البنات", "Candy": "حلويات", "Cans & bottles": "علب وقوارير", "Refills": "إعادة تعبئة", "blocked by": "متوقف بسبب",
  "Stock scope": "نطاق المخزون", "Search menu": "بحث المنيو", "Menu categories": "فئات المنيو", "not stocked": "غير متوفر",
  "Search a menu item or ingredient, typos are fine": "ابحث عن صنف أو مكوّن، الأخطاء الإملائية مقبولة",
  "No menu item matches.": "لا يوجد صنف مطابق.", "About this item": "عن هذا الصنف", "What the current stock makes": "ما ينتجه المخزون الحالي",
  "from the raw material list": "من قائمة المواد الخام", "all locations": "كل المواقع",
  "Charts need an internet connection to load.": "الرسوم تحتاج اتصال إنترنت.",
  // ledger
  "The ledger is empty.": "السجل فارغ.", "Committed and draft counts show up here.": "الجرد المعتمد والمسودات تظهر هنا.",
  "Run the first count": "ابدأ أول جرد", "Tx hash": "الرمز", "Opened": "التاريخ", "Status": "الحالة", "Items": "الأصناف", "Off": "فروقات",
  "Item": "الصنف", "Resume counting": "متابعة الجرد", "Export CSV": "تصدير CSV",
  "The record of this count will be removed. Stock that was already committed doesn't change.": "سيُحذف سجل هذا الجرد. المخزون المعتمد لا يتغير.",
  // settings
  "Backup & export": "النسخ والتصدير", "Backup JSON": "نسخة JSON", "Stock CSV": "مخزون CSV", "Copy JSON": "نسخ JSON", "Import JSON": "استيراد JSON",
  "Import adds or updates products by ID. It never deletes anything.": "الاستيراد يضيف أو يحدّث المنتجات ولا يحذف شيئاً.",
  "Genesis data": "البيانات الأصلية", "where it started": "نقطة البداية", "Reload report data": "إعادة تحميل بيانات التقرير",
  "Every edit and count saved in this browser will be wiped and replaced with the original report.": "كل تعديل وجرد محفوظ في هذا المتصفح سيُمسح ويُستبدل بالتقرير الأصلي.",
  "Reload": "إعادة تحميل",
  // toasts
  "Backup downloaded": "تم تنزيل النسخة", "CSV exported": "تم تصدير CSV", "Copied to clipboard": "تم النسخ", "Draft saved": "تم حفظ المسودة",
  "Entry deleted": "تم الحذف", "Expiry sheet downloaded": "تم تنزيل شيت الصلاحية", "Give the product a name first": "اكتب اسم المنتج أولاً",
  "Import complete": "تم الاستيراد", "Label PDF downloaded": "تم تنزيل ملف الملصقات", "No product for that code": "لا يوجد منتج بهذا الكود",
  "Product deleted": "تم حذف المنتج", "Report data reloaded": "تمت إعادة التحميل", "Stock CSV exported": "تم تصدير المخزون",
  "Count committed · sheet updated": "تم اعتماد الجرد · تحديث الشيت", "Your browser blocked copying. Use the download instead.": "المتصفح منع النسخ، استخدم التنزيل.",
  "Saved": "تم الحفظ",
  // tools
  "Reorder list": "قائمة الطلب", "Quick find": "بحث سريع", "Install app": "تثبيت التطبيق"
};

const loc = s => D[s] || s, unit = u => U[u] || u;
const P = [
  [/^(.+) is running low$/, (m, a) => `${a} قارب على النفاد`],
  [new RegExp(`^${N}% · ${N} left$`), (m, a, b) => `${a}% · متبقي ${b}`],
  [new RegExp(`^${N} of ${N} ${UNIT} left$`), (m, a, b, u) => `متبقي ${a} من ${b} ${unit(u)}`],
  [new RegExp(`^${N} ${UNIT}$`), (m, a, u) => `${a} ${unit(u)}`],
  [new RegExp(`^/${UNIT}$`), (m, u) => `/${unit(u)}`],
  [/^of (\d+) SKUs in stock$/, (m, a) => `من ${a} صنف متوفر`],
  [/^(\d+) SKUs stocked$/, (m, a) => `${a} صنف مخزّن`],
  [/^(\d+) SKUs on system$/, (m, a) => `${a} صنف بالنظام`],
  [/^Count (Mini|Concession|Stores)$/, (m, a) => `جرد ${loc(a)}`],
  [/^(\d+) locations$/, (m, a) => `${a} مواقع`],
  [/^(\d+) open$/, (m, a) => `${a} مفتوح`],
  [/^(\d+) saved$/, (m, a) => `${a} محفوظة`],
  [/^BLOCK (\d+)$/, (m, a) => `كتلة ${a}`],
  [/^Loaded (\d+) products from the stock report$/, (m, a) => `تم تحميل ${a} منتج من تقرير الجرد`],
  [/^Saved (.+) draft$/, (m, a) => `حفظ مسودة ${loc(a)}`],
  [/^Committed (.+) count$/, (m, a) => `اعتماد جرد ${loc(a)}`],
  [/^(\d+) items$/, (m, a) => `${a} صنف`],
  [/^(\d+) counted$/, (m, a) => `${a} معدود`],
  [new RegExp(`^${N} SAR$`), (m, a) => `${a} ريال`],
  [/^([\d.,]+) (L|kg) on hand$/, (m, a, u) => `${a} ${unit(u)} متوفر`],
  [/^([\d.,]+) (ml|g) each$/, (m, a, u) => `${a} ${unit(u)} للواحدة`],
  [/^(\d+) (?:oz|Oz)$/, (m, a) => `${a} أونصة`],
  [/^(\d+) oz tub$/i, (m, a) => `علبة ${a} أونصة`],
  [/^Stocked in (L|kg), used in (ml|g) \(1 \w+ = 1,000 \w+\)\. Purchase rate ([\d.,]+) SAR per (?:L|kg)\. Goes into (\d+) menu items\.$/,
    (m, a, b, r, n) => `يُخزّن بـ${unit(a)} ويُستخدم بـ${unit(b)} (1 ${unit(a)} = 1,000 ${unit(b)}). سعر الشراء ${r} ريال لكل ${unit(a)}. يدخل في ${n} صنف من المنيو.`],
  [/^(\d+) items? can't be made right now$/, (m, a) => `${a} صنف لا يمكن تحضيره الآن`],
  [/^Show all (\d+) menu items$/, (m, a) => `عرض كل الأصناف (${a})`],
  [/^Recipes as of (.+) · (\d+) menu items · each number assumes the stock goes to that item alone$/,
    (m, d, n) => `الوصفات بتاريخ ${d} · ${n} صنف · كل رقم يفترض أن المخزون يذهب لهذا الصنف وحده`],
  [/^Page (\d+)$/, (m, a) => `صفحة ${a}`],
  [/^Page (\d+) of (\d+)$/, (m, a, b) => `صفحة ${a} من ${b}`],
  [/^(\d+) items · (.+)$/, (m, a, b) => `${a} صنف · ${tr(b)}`],
  [/^Stocktake$/, () => "الجرد"],
];

function one(s) {
  if (Object.prototype.hasOwnProperty.call(D, s)) return D[s];
  for (const [re, fn] of P) { const m = s.match(re); if (m) return fn(...m); }
  return null;
}
function tr(s) {
  const t = s.trim(); if (!t || !/[A-Za-z]/.test(t)) return s;
  let out = one(t);
  if (out == null && t.includes(" · ")) {
    const parts = t.split(" · "), mapped = parts.map(p => one(p.trim()));
    if (mapped.some(x => x != null)) out = parts.map((p, i) => mapped[i] ?? p).join(" · ");
  }
  if (out == null) return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
  return lead + out + trail;
}

// Never touch the scan card, the barcode label sheet, finance pages (already Arabic), code or charts.
const SKIP = "script,style,svg,canvas,code,textarea,.pass,#labels,.lbl,.qr,.scan-qr,#curtain,.marquee,.uz,.fx,.hash-chip,.data.hash,[data-noar],.p360,.ml,.nr,.sl,.b-stage,.brief-sheet";
const ATTRS = ["placeholder", "aria-label", "title"];

function walk(root) {
  if (!root || root.nodeType !== 1 || root.closest?.(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const todo = [];
  let n; while ((n = w.nextNode())) { const v = tr(n.nodeValue); if (v !== n.nodeValue) todo.push([n, v]); }
  todo.forEach(([node, v]) => { node.nodeValue = v; });
  [root, ...root.querySelectorAll("[placeholder],[aria-label],[title],option")].forEach(el => {
    if (el.closest(SKIP)) return;
    ATTRS.forEach(a => { const v = el.getAttribute(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } });
  });
}

let queued = new Set(), raf = 0;
function flush() { raf = 0; const list = [...queued]; queued.clear(); list.forEach(walk); }
function queue(el) { if (el) queued.add(el); if (!raf) raf = requestAnimationFrame(flush); }

export function startArabic() {
  document.documentElement.classList.add("ar");
  const v = document.getElementById("view"); if (v) v.dir = "rtl";
  walk(document.body);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === "characterData") queue(m.target.parentElement);
      else if (m.type === "attributes") queue(m.target);
      else m.addedNodes.forEach(x => queue(x.nodeType === 1 ? x : x.parentElement));
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
export { tr as translate };

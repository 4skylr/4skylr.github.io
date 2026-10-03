// What the reader knows before it sees an invoice: categories, known suppliers (by VAT number),
// item words in Arabic and English, and how to spell an Arabic name in English.
// Everything saved later teaches it more (see learn() in extract.js).

export const CATEGORIES = [
  { id: "Cleaning & Housekeeping", ar: "النظافة والتدبير" },
  { id: "Concession - Food & Beverage", ar: "الكونسيشن - أطعمة ومشروبات" },
  { id: "Concession - Repairs", ar: "الكونسيشن - إصلاحات" },
  { id: "Health & Safety", ar: "الصحة والسلامة" },
  { id: "Office Supplies", ar: "مستلزمات مكتبية" },
  { id: "Repairs & Maintenance", ar: "الصيانة والإصلاح" },
  { id: "Staff Supplies", ar: "مستلزمات الموظفين" },
  { id: "Staff Water", ar: "مياه الموظفين" },
  { id: "Other", ar: "أخرى" }
];

// our own company VAT number shows as the buyer on B2B invoices: never the supplier
export const OWN_VAT = ["300047016410003"];

export const SUPPLIERS = [
  { vat: "300057178310003", en: "Abdullah Al Othaim Markets", ar: "العثيم", cat: "Concession - Food & Beverage", multi: true, keys: ["othaim", "العثيم", "عثيم"] },
  { vat: "300991174100003", en: "Sama Al Nazafah Est.", ar: "سما النظافة", cat: "Cleaning & Housekeeping", keys: ["سما النظافة", "النظافة التجارية"] },
  { vat: "311268073800003", en: "United Systems for Computers", ar: "أنظمة المتحدة للكمبيوتر", cat: "Office Supplies", keys: ["united systems", "الأنظمة المتحدة", "انظمة المتحدة"] },
  { vat: "310914676800003", en: "Rukn Areej", ar: "ركن أريج", cat: "Concession - Repairs", keys: ["ركن أريج", "ركن اريج", "فرصه عنيزه"] },
  { vat: "300779285200003", en: "Al Amer Bookstore", ar: "مكتبة العامر", cat: "Concession - Repairs", inv: /(1\d{4})00226/, keys: ["العامر", "amer bookshop", "al amer"] },
  { vat: "300427438500003", en: "Madawi Accessories", ar: "مضاوي للكماليات", cat: "Staff Supplies", keys: ["al laamee", "مضاوي", "الكماليات"] },
  { vat: "300256004410003", en: "Bait Al Sehha Pharmacy", ar: "بيت الصحة", cat: "Health & Safety", keys: ["health house", "بيت الصحة"] },
  { vat: "305004958100003", en: "Bina Al Sultan Building Materials", ar: "بناء السلطان", cat: "Repairs & Maintenance", keys: ["بناء السلطان", "بناء الشلطان"] },
  { vat: "301364658600003", en: "Al Ikhtisas Electrical", ar: "الاختصاص", cat: "Repairs & Maintenance", keys: ["الاختصاص", "الإختصاص"] },
  { vat: "313001559100003", en: "Bait Al Itqan", ar: "بيت الاتقان", cat: "Repairs & Maintenance", keys: ["بيت الاتقان", "بيت الإتقان", "الإتقان"] },
  { vat: "300914671300003", en: "Al Shafi Foodstuff", ar: "الشافي الغذائية", cat: "Staff Water", keys: ["الشافي", "الشاف", "al badai", "asfar dist", "مستودع الشا"] },
  { vat: null, en: "Jarir Bookstore", ar: "جرير", cat: "Office Supplies", keys: ["jarir", "جرير"] }
];

// item words → English, Arabic, and the category they point to
export const GLOSSARY = [
  [/خبز|صامولي|buns?\b|bread/i, "Hot dog buns", "خبز هوت دوق", "Concession - Food & Beverage"],
  [/نعناع|mint/i, "Fresh mint", "نعناع", "Concession - Food & Beverage"],
  [/ليمون|lemon/i, "Lemon", "ليمون", "Concession - Food & Beverage"],
  [/كاتشب|كتشب|ketchup/i, "Tomato ketchup", "كاتشب", "Concession - Food & Beverage"],
  [/مستردة|مسترد|mustard/i, "Mustard", "مستردة", "Concession - Food & Beverage"],
  [/ثلج|\bice\b/i, "Ice", "ثلج", "Concession - Food & Beverage"],
  [/سكر|sugar/i, "Sugar", "سكر", "Concession - Food & Beverage"],
  [/بيرين|berain/i, "Berain water", "مياه بيرين", "Concession - Food & Beverage"],
  [/مياه|\bماء\b|water|نوفا|\bnova\b|aquafina|اكوافينا/i, "Drinking water", "مياه شرب", "Staff Water"],
  [/اكواب|أكواب|كاسات|كوب|cups?\b/i, "Cups", "أكواب", "Staff Supplies"],
  [/مناديل|منديل|tissue|napkin/i, "Tissues", "مناديل", "Staff Supplies"],
  [/قفاز|قفازات|جوانتي|gloves?|gluves/i, "Gloves", "قفازات", "Health & Safety"],
  [/نفايات|أكياس|اكياس|garbage|bags?\b/i, "Garbage bags", "أكياس نفايات", "Cleaning & Housekeeping"],
  [/ممسحة|مساحة|مكنسة|سلك|اسفنج|إسفنج|منظف|كلوركس|فلاش|ديتول|صابون|شامبو|cleaner|sponge|mop|detergent|shampoo|clorox/i, "Cleaning materials", "مواد تنظيف", "Cleaning & Housekeeping"],
  [/حبر|تونر|toner|ink/i, "Printer toner", "حبر طابعة", "Office Supplies"],
  [/دبابيس|دباسة|staple/i, "Staples", "دبابيس", "Office Supplies"],
  [/\bورق\b|\ba4\b|paper/i, "Paper", "ورق", "Office Supplies"],
  [/قلم|أقلام|اقلام|pen\b|marker/i, "Pens", "أقلام", "Office Supplies"],
  [/تغليف|حراري|laminat/i, "Laminating roll", "رول تغليف", "Concession - Repairs"],
  [/لاصق|لزق|علاق|hook|adhesive/i, "Adhesive hooks", "علاقات لاصقة", "Concession - Repairs"],
  [/شريط|تفلون|tape/i, "Tape", "شريط", "Repairs & Maintenance"],
  [/سيليكون|سيلكون|silicone/i, "Silicone sealant", "سيليكون", "Repairs & Maintenance"],
  [/فيش|افياش|أفياش|مفتاح|مفاتيح|سوكت|كهرب|socket|switch|plug/i, "Sockets & switches", "أفياش ومفاتيح", "Repairs & Maintenance"],
  [/لمبة|لمبات|\bليد\b|\bled\b|bulb/i, "Light bulbs", "لمبات", "Repairs & Maintenance"],
  [/بطارية|بطاريات|battery/i, "Batteries", "بطاريات", "Repairs & Maintenance"],
  [/قطن|شاش|cotton|bandage|plaster|بلاستر|اسعاف|إسعاف/i, "First aid", "إسعافات أولية", "Health & Safety"],
  [/شراب|سيرب|syrup/i, "Syrup", "شراب", "Concession - Food & Beverage"]
];

// Arabic → English spelling for names the reader has never seen
const WORDS = [
  [/^(مؤسسة|موسسة|مؤسسه)$/, "Est."], [/^(شركة|شركه)$/, "Co."], [/^(مكتبة|مكتبه)$/, "Bookstore"], [/^(صيدلية|صيدليه)$/, "Pharmacy"],
  [/^(أسواق|اسواق)$/, "Markets"], [/^(التجارية|التجاريه)$/, "Trading"], [/^(الغذائية|الغذائيه)$/, "Foodstuff"], [/^مستودع$/, "Warehouse"],
  [/^مطعم$/, "Restaurant"], [/^(مخبز|مخابز)$/, "Bakery"], [/^محل$/, "Shop"], [/^(الكهربائية|للكهربائيات)$/, "Electrical"],
  [/^(مواد|للمواد)$/, "Materials"], [/^البناء$/, "Building"], [/^(مركز)$/, "Center"], [/^(بيت)$/, "Bait"], [/^(ركن)$/, "Rukn"],
  [/^(للتجارة)$/, "Trading"], [/^(المحدودة|المحدوده)$/, "Ltd."], [/^(فرع)$/, "Branch"], [/^(و)$/, "&"]
];
const LETTERS = { "ا": "a", "أ": "a", "إ": "i", "آ": "aa", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "i", "ى": "a", "ئ": "e", "ؤ": "o", "ء": "" };
export function transliterate(ar) {
  return String(ar || "").replace(/[ـً-ْ]/g, "").split(/\s+/).filter(Boolean).map(w => {
    const hit = WORDS.find(([re]) => re.test(w)); if (hit) return hit[1];
    if (!/[؀-ۿ]/.test(w)) return w;
    let pre = "";
    if (w.startsWith("ال")) { pre = "Al "; w = w.slice(2); }
    else if (w.startsWith("لل")) { pre = "Al "; w = w.slice(2); }
    let s = [...w].map((c, i, a) => c === "و" && i > 0 && i < a.length - 1 ? "o" : c === "ي" && i > 0 && i < a.length - 1 ? "ee" : LETTERS[c] ?? c).join("");
    s = s.replace(/aa+/g, "a").replace(/ee+/g, "ee");
    return pre + (s ? s[0].toUpperCase() + s.slice(1) : s);
  }).join(" ").replace(/\s+/g, " ").trim();
}

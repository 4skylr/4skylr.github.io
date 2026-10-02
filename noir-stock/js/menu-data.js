// Noir Cinema concession menu boards (prices include 15% VAT), linked to the recipe costs and to the
// containers the sales report counts. "recipes" are matched by name in recipes-data.js; several names
// = flavours, averaged. "sold" lists the sales-report ids whose units are this item (combos included).
export const VAT = 0.15;
export const MENU = [
  { id: "pop-m", group: "snacks", en: "Popcorn · Medium", ar: "فشار · وسط", price: 24, sold: ["tub-64"], stock: "tub-64",
    recipes: ["Medium Tub Salted Popcorn - 64 Oz", "Medium Tub Cheese Popcorn - 64 Oz", "Medium Tub Caramel Popcorn - 64 Oz", "Medium Tub Pizza Savory Popcorn-64 Oz"] },
  { id: "pop-l", group: "snacks", en: "Popcorn · Large", ar: "فشار · كبير", price: 27, sold: ["tub-85"], stock: "tub-85",
    recipes: ["Large Tub Salted Popcorn - 85 Oz", "Large Tub Cheese Popcorn - 85 Oz", "Large Tub Caramel Popcorn - 85 Oz", "Large Tub Pizza Savory Popcorn-85 Oz"] },
  { id: "pop-xl", group: "snacks", en: "Popcorn · X Large", ar: "فشار · عائلي", price: 30, sold: ["tub-130"], stock: "tub-130",
    recipes: ["Xtra Large Tub Salted Popcorn - 130 Oz", "Xtra Large Tub Cheese Popcorn - 130 Oz", "Xtra Large Tub Caramel Popcorn - 130 Oz", "Xtra Large Tub Pizza Savory Popcorn-130 Oz"] },
  { id: "nachos-r", group: "snacks", en: "Nachos · Regular", ar: "ناتشوز · عادي", price: 40, sold: ["nachos-tray-3"], recipes: ["Nachos Regular with Salsa & Cheese"] },
  { id: "nachos-f", group: "snacks", en: "Nachos · Family", ar: "ناتشوز · عائلي", price: 45, sold: ["nachos-tray-4"], recipes: ["Nachos Family with Salsa & Cheese"] },
  { id: "cheese", group: "snacks", en: "Extra cheese", ar: "إضافة جبن", price: 5, sold: ["dip-cup-4"], recipes: ["ADD ON CHEESE SAUCE"] },
  { id: "hotdog", group: "snacks", en: "Hot dog · chicken / beef", ar: "هوت دوق · دجاج / لحم", price: 20, sold: ["hotdog-tray"], recipes: ["HOT DOG CHICKEN", "HOT DOG BEEF"] },

  { id: "soft-m", group: "drinks", en: "Soft drink · Medium", ar: "مشروب غازي · وسط", price: 20, sold: ["cups-24"], recipes: ["Medium Coke - 24 Oz", "Medium Coke Zero - 24 Oz", "Medium Fanta - 24 Oz", "Medium Sprite - 24 Oz"] },
  { id: "soft-l", group: "drinks", en: "Soft drink · Large", ar: "مشروب غازي · كبير", price: 22, sold: ["cups-30"], recipes: ["Large Coke - 30 Oz", "Large Coke Zero - 30 Oz", "Large Fanta - 30 Oz", "Large Sprite - 30 Oz"] },
  { id: "slush-m", group: "drinks", en: "Slush · Medium", ar: "سلاش · وسط", price: 25, sold: ["slush-glass-12"], recipes: ["SLUSH - Blue Raspberry 12 OZ", "SLUSH - Strawberry 12 OZ", "SLUSH - Pomegranate 12 OZ"] },
  { id: "slush-l", group: "drinks", en: "Slush · Large", ar: "سلاش · كبير", price: 27, sold: ["slush-glass-16"], recipes: ["SLUSH - Blue Raspberry 16 OZ", "SLUSH - Strawberry 16 OZ", "SLUSH - Pomegranate 16 OZ"] },
  { id: "monster", group: "drinks", en: "Monster", ar: "مونستر", price: 25, sold: ["monster"], recipes: ["Monster Energy - 250Ml"] },
  { id: "arwa", group: "drinks", en: "Arwa water / zero", ar: "مياه أروى", price: 7, sold: ["arwa-500", "arwa-zero"], recipes: ["Arwa - 500 ML", "Arwa Zero - 500Ml"] },
  { id: "rani", group: "drinks", en: "Rani juice", ar: "عصير راني", price: 10, sold: ["rani"], recipes: ["RANI MANGO FLOAT"] },
  { id: "vimto", group: "drinks", en: "Vimto", ar: "فيمتو", price: 10, sold: ["vimto-can", "vimto-pet"], recipes: ["VIMTO CAN - 250 ML", "VIMTO PET - 250 ML"] },
  { id: "barbican", group: "drinks", en: "Barbican", ar: "باربيكان", price: 15, sold: ["barbican"], recipes: ["BARBICAN MALT"] },
  { id: "schweppes", group: "drinks", en: "Schweppes", ar: "شويبس", price: 12, sold: ["schweppes"], recipes: ["Schweppes Pomegranate - 250Ml"] },

  { id: "mm-s", group: "sweets", en: "M&M's · Small", ar: "إم آند إمز · صغير", price: 8, sold: ["mm-choco-45", "mm-peanut-45"], recipes: ["M&M CHOCO 45GM", "M&M PEANUT 45GM"] },
  { id: "mm-l", group: "sweets", en: "M&M's · Large", ar: "إم آند إمز · كبير", price: 28, sold: ["mm-choco-150", "mm-peanut-150"], recipes: ["M&M CHOCO 150 GM", "M&M PEANUT 150 GM"] },
  { id: "mal-s", group: "sweets", en: "Maltesers · Small", ar: "مالتيزرز · صغير", price: 8, sold: ["maltesers-37"], recipes: ["MALTESERS 37GM"] },
  { id: "mal-l", group: "sweets", en: "Maltesers · Large", ar: "مالتيزرز · كبير", price: 28, sold: ["maltesers-175"], recipes: ["MALTESERS 175GM"] },
  { id: "floss", group: "sweets", en: "Cotton candy", ar: "غزل البنات", price: 20, sold: ["cotton-candy-tub"], recipes: ["Vanilla Pink Flossine", "Blue Raspberry Flossine"] }
];

// combos: parts are menu ids; drinks are assumed to match the popcorn size (medium with medium, large with large)
export const COMBOS = [
  // new combos (posters in assets/combos); cost comes from the matching recipe in the Recipe Master List
  { id: "c-heroes", en: "Heroes combo", ar: "كومبو الأبطال", price: 35, parts: ["pop-r", "slush-m", "mm-s"], isNew: true, img: "assets/combos/heroes.webp", color: "#8a3fc0",
    lines: [["1 small popcorn", "1 فشار صغير"], ["1 slush", "1 سلاش"], ["1 chocolate", "1 شوكولاتة"]], recipe: "Hero Combo (RegPop+ RegSlush+Small Chocolate)",
    extra: { "pop-r": { price: 0, recipes: ["Regular Tub Salted Popcorn - 46 Oz", "Regular Tub Cheese Popcorn - 46 Oz", "Regular Tub Caramel Popcorn - 46 Oz", "Regular Tub Pizza Savory Popcorn-46 Oz"] } } },
  { id: "c-duo", en: "Duo combo", ar: "كومبو الثنائي", price: 69, parts: ["pop-l", "slush-l", "slush-l"], isNew: true, img: "assets/combos/duo.webp", color: "#f06a7c",
    lines: [["1 large popcorn", "1 فشار كبير"], ["2 slush", "2 سلاش"]], recipe: "Duo Combo (LrgPop+2 LrgSlush)" },
  { id: "c-lamma", en: "Gathering combo", ar: "كومبو اللمة", price: 99, parts: ["pop-m", "pop-m", "slush-l", "slush-l", "nachos-r"], isNew: true, img: "assets/combos/lamma.webp", color: "#1f62d6",
    lines: [["2 medium popcorn", "2 فشار وسط"], ["2 slush", "2 سلاش"], ["1 nachos", "1 ناتشوز"]], recipe: "Group Combo (2Med Pop +RegNachos+2Lrg Slush)" },
  { id: "c-couple", en: "Couple combo", ar: "كومبو شخصين", price: 65, parts: ["pop-l", "pop-l", "soft-l", "soft-l"] },
  { id: "c-xl", en: "XL combo", ar: "كومبو اكسترا لارج", price: 40, parts: ["pop-xl", "soft-l"] },
  { id: "c-medium", en: "Medium combo", ar: "كومبو الوسط", price: 38, parts: ["pop-m", "soft-m"] },
  { id: "c-nachos", en: "Nachos combo", ar: "كومبو الناتشوز", price: 45, parts: ["nachos-r", "soft-m"] },
  { id: "c-hotdog", en: "Hot dog combo", ar: "كومبو الهوت دوق", price: 30, parts: ["hotdog", "soft-m"] },
  { id: "c-kids", en: "Kids combo", ar: "كومبو الأطفال", price: 30, parts: ["pop-r", "rani", "mm-s"], extra: { "pop-r": { price: 0, recipes: ["Regular Tub Salted Popcorn - 46 Oz", "Regular Tub Cheese Popcorn - 46 Oz", "Regular Tub Caramel Popcorn - 46 Oz", "Regular Tub Pizza Savory Popcorn-46 Oz"] } } }
];
export const GROUPS = { snacks: ["Cinema snacks", "سناكات السينما"], drinks: ["Drink picks", "مشروب من اختيارك"], sweets: ["Sweet picks", "الحلويات"] };

// promo posters shown with the combos
export const PROMOS = [{ id: "p-slush", en: "Slush your mood", ar: "خذ سلاشك على مزاجك", price: "25 / 27", img: "assets/combos/slush.webp", color: "#f2b31b", items: ["slush-m", "slush-l"] }];

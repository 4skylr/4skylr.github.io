// Readable recipe names and categories, shared by the recipe theater and the product watch.
const low = s => String(s ?? "").toLowerCase();
export const CAT = { popcorn: ["Popcorn", "فشار"], combo: ["Combo", "كومبو"], fountain: ["Fountain", "مشروب نافورة"], slush: ["Slush", "سلاش"], nachos: ["Nachos", "ناتشوز"],
  hotdog: ["Hot dog", "هوت دوق"], mocktail: ["Mocktail", "موكتيل"], floss: ["Cotton candy", "غزل البنات"], candy: ["Candy", "حلويات"], packaged: ["Cans & bottles", "معلّب"], refill: ["Refill", "تعبئة"] };
const FL_AR = { salted: "مملح", cheese: "جبن", caramel: "كراميل", "pizza savory": "بيتزا", coke: "كوكاكولا", "coke zero": "كوكاكولا زيرو", fanta: "فانتا", sprite: "سبرايت",
  strawberry: "فراولة", "blue raspberry": "توت أزرق", pomegranate: "رمان", chicken: "دجاج", beef: "لحم", nachos: "ناتشوز", combo: "كومبو", lemonade: "ليمون", mojito: "موهيتو" };
export const titleCase = s => low(s).replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bMl\b/g, "ml").replace(/\bOz\b/g, "oz").replace(/\bGm\b/g, "g");

// "Xtra Large Tub Caramel Popcorn - 130 Oz" → "Caramel · 130 oz"; flavours in Arabic on the Arabic site
export function prettyName(name, ar) {
  const size = (name.match(/(\d+)\s*oz/i) || [])[1];
  let f = name.replace(/\b(Xtra Large|Large|Medium|Regular|Family|Small|Tub|Popcorn|Lrg|Reg|Med)\b/gi, " ").replace(/^SLUSH\s*-\s*/i, "").replace(/^HOT DOG\s*/i, "Hot dog ")
    .replace(/-?\s*\d+\s*oz\b/gi, "").replace(/[-·]\s*$/, "").replace(/\s{2,}/g, " ").trim();
  const hd = /^hot dog\s+(\w+)/i.exec(f);
  if (hd) return ar ? `هوت دوق · ${FL_AR[low(hd[1])] || hd[1]}` : `Hot dog · ${hd[1][0].toUpperCase()}${low(hd[1]).slice(1)}`;
  if (f.length < 4) f = name.replace(/-?\s*\d+\s*oz\b/gi, "").trim(); // nothing much left ("SND FAMILY"): keep the whole name
  if (f === f.toUpperCase()) f = titleCase(f);
  if (ar && FL_AR[low(f)]) f = FL_AR[low(f)];
  return size ? `${f} · ${size} ${ar ? "أونصة" : "oz"}` : f;
}

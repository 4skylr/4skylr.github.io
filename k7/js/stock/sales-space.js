// Sales-space advice for one product: where it should sit on the floor, what to do now, and why.
// The Concession is stock that is ready to sell right away; the Mini Store is the next refill;
// the Store is reserve. Advice is in English and Arabic.
import { placement } from "./fefo-place.js?v=85";

const SPACE = {
  drinks: ["Concession fridge, front row", "ثلاجة الكونسيشن، الصف الأمامي"],
  snacks: ["Candy rack beside the till", "رف الحلويات جنب الكاشير"],
  popcorn: ["Popcorn station", "محطة الفشار"],
  food: ["Nachos & hot dog station", "محطة الناتشوز والهوت دوق"],
  slush: ["Slush machine & mocktail bar", "مكينة السلاش وركن الموكتيل"],
  syrups: ["Fountain line (BIB rack)", "خط النافورة (رف الـBIB)"],
  hot: ["Hot drinks corner", "ركن المشروبات الساخنة"],
  packaging: ["Beside the station that uses it", "جنب المحطة اللي تستخدمه"],
  icecream: ["Ice cream freezer", "فريزر الآيس كريم"],
  other: ["Back of house", "خلف الكاونتر"]
};
const FRONT_DAYS = 3, TARGET = 7;
const r1 = n => Math.round(n * 10) / 10;

export function salesSpace(p, { total, daily, rank = 0 }) {
  const s = id => Number(p.stock?.[id]) || 0;
  const ready = s("refuel"), mini = s("mini"), store = s("stores");
  const bulk = p.unit === "kg" || p.unit === "ltr";
  const front = bulk ? ready + mini : ready;                     // group items: Concession = Mini Store
  const fDays = daily > 0 ? front / daily : null, tDays = daily > 0 ? total / daily : null;
  const pl = placement(p), soon = pl.groups.filter(g => g.left >= 0 && g.left <= 45).sort((a, b) => a.left - b.left)[0];
  const space = SPACE[p.category] || SPACE.other;
  const why = [], tips = [];
  let act = null, tone = "ok";

  if (total <= 0) { act = ["Out of stock: order before it is missed", "نفد: اطلبه قبل ما ينطلب"]; tone = "bad"; }
  else if (daily > 0 && fDays < FRONT_DAYS && (bulk ? store : mini + store) > 0) {
    const need = Math.ceil(daily * TARGET - front), from = !bulk && mini > 0 ? ["Mini Store", "الميني ستور"] : ["Store", "المستودع"];
    act = [`Refill the sales space with ${need} from the ${from[0]}`, `عبّي نقطة البيع بـ ${need} من ${from[1]}`]; tone = "warn";
    why.push([`Ready to sell lasts ${r1(fDays)} days at ${r1(daily)} a day`, `الجاهز للبيع يكفي ${r1(fDays)} يوم بمعدل ${r1(daily)} باليوم`]);
  } else if (soon) {
    act = [`Put group ${soon.n} at the front`, `قدّم المجموعة ${soon.n} للواجهة`]; tone = "warn";
    why.push([`It expires in ${soon.left} days`, `تنتهي بعد ${soon.left} يوم`]);
  } else if (tDays != null && tDays > 365) {
    act = ["Feature it: combo, bundle or promo shelf", "أبرزه: كومبو أو عرض أو رف العروض"]; tone = "info";
    why.push([`Stock covers ${Math.round(tDays / 30)} months of sales`, `المخزون يكفي ${Math.round(tDays / 30)} شهر`]);
  } else if (!daily && total > 0) {
    act = ["Give it a visible spot and track it", "حطه بمكان واضح وتابع حركته"]; tone = "info";
    why.push(["No sales recorded for it this year", "ما فيه مبيعات مسجلة له هالسنة"]);
  } else act = ["Keep it where it is", "خلّه بمكانه"];

  if (rank) { tips.push([`Top seller #${rank}: eye level, never empty`, `الأكثر مبيعاً #${rank}: بمستوى النظر ولا يفضى أبد`]); }
  if (pl.flagged.length) tips.push([`${pl.flagged.length} group(s) sit behind a later-expiring one`, `${pl.flagged.length} مجموعة خلف مجموعة تنتهي بعدها`]);

  const summary = [
    `Concession ${fmt(ready)} ready to sell${daily > 0 ? ` (${r1(ready / daily)} days)` : ""} · Mini Store ${fmt(mini)} next refill · Store ${fmt(store)} reserve`,
    `الكونسيشن ${fmt(ready)} جاهز للبيع${daily > 0 ? ` (${r1(ready / daily)} يوم)` : ""} · الميني ستور ${fmt(mini)} للتعبئة الجاية · المستودع ${fmt(store)} احتياط`
  ];
  return { space, act, why, tips, tone, ready, mini, store, fDays, summary };
}
const fmt = n => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

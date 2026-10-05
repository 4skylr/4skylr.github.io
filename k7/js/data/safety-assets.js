// Safety & maintenance register — the branch's devices (from info.ods) and the checks each one needs.
// Intervals follow the usual NFPA cadence: NFPA 10 (extinguishers), NFPA 25 (sprinklers, hose),
// NFPA 72 (detection & alarm), NFPA 101 (exits & emergency lighting). Civil Defense / contractor schedules override.
// every = days between checks · who = "staff" (building team) or "tech" (licensed contractor) · info = no log, shown as a reminder
export const SAFETY_SOURCE = "info.ods";
export const SYSTEMS = {
  suppression: { en: "Fire suppression", ar: "إطفاء الحريق", tone: "signal" },
  detection: { en: "Detection & alarm", ar: "الكشف والإنذار", tone: "tungsten" },
  egress: { en: "Exits", ar: "مخارج الطوارئ", tone: "mint" },
  security: { en: "Security", ar: "المراقبة", tone: "ice" }
};
export const ASSETS = [
  { id: "sprinkler", system: "suppression", count: 135, en: "Fire sprinklers", ar: "رشاشات الحريق", art: "sprinkler",
    about: ["Ceiling heads over every hall, corridor and the concession.", "رؤوس بالسقف فوق القاعات والممرات والكونسيشن."],
    tasks: [
      { id: "valves", every: 30, who: "staff", en: "Control valves open and sealed, gauges read normal", ar: "صمامات التحكم مفتوحة ومختومة والعدادات طبيعية" },
      { id: "quarter", every: 91, who: "tech", en: "Heads, pipes and alarm valve inspected", ar: "فحص الرؤوس والأنابيب وصمام الإنذار" },
      { id: "annual", every: 365, who: "tech", en: "Main drain flow test and alarm devices", ar: "اختبار التصريف الرئيسي وأجهزة الإنذار" },
      { id: "pipes", every: 1826, who: "tech", info: true, en: "Internal pipe inspection (every 5 years)", ar: "فحص داخلي للأنابيب (كل 5 سنوات)" }] },
  { id: "smoke", system: "detection", count: 58, en: "Smoke detectors", ar: "كواشف الدخان", art: "smoke",
    about: ["Ceiling detectors linked to the fire alarm panel.", "كواشف سقفية مربوطة بلوحة الإنذار."],
    tasks: [
      { id: "visual", every: 30, who: "staff", en: "No cover, dust or paint on any head; LEDs normal", ar: "ما فيه غطاء أو غبار أو صبغ على الكواشف واللمبات طبيعية" },
      { id: "annual", every: 365, who: "tech", en: "Every detector tested with test smoke", ar: "اختبار كل كاشف بدخان الاختبار" }] },
  { id: "alarm", system: "detection", count: 4, en: "Fire alarm", ar: "إنذار الحريق", art: "alarm",
    about: ["Alarm panel, bells and pull stations.", "لوحة الإنذار والأجراس ونقاط السحب."],
    tasks: [
      { id: "panel", every: 30, who: "staff", en: "Panel shows normal, no trouble lights; bells and pull stations reachable", ar: "اللوحة طبيعية بدون أعطال، والأجراس ونقاط السحب واضحة" },
      { id: "annual", every: 365, who: "tech", en: "Full alarm test and battery check", ar: "اختبار كامل للإنذار وفحص البطاريات" }] },
  { id: "hose", system: "suppression", count: 5, en: "Fire hose reels", ar: "خراطيم الحريق", art: "hose",
    about: ["Hose reel cabinets on the walls.", "صناديق الخراطيم على الجدران."],
    tasks: [
      { id: "visual", every: 30, who: "staff", en: "Cabinet reachable, hose and nozzle in place, no leaks", ar: "الصندوق واضح، الخرطوم والفوهة بمكانهم، ما فيه تسريب" },
      { id: "annual", every: 365, who: "tech", en: "Hose unrolled, flow tested, valve serviced", ar: "فرد الخرطوم واختبار التدفق وصيانة الصمام" }] },
  { id: "ext-powder", system: "suppression", count: 12, split: [11, 1], en: "Powder extinguishers", ar: "طفايات بودرة", art: "powder",
    about: ["Dry powder (ABC). The sheet lists them on two lines: 11 + 1.", "بودرة جافة (ABC). مكتوبة بالملف بسطرين: 11 + 1."],
    tasks: [
      { id: "monthly", every: 30, who: "staff", en: "In place, gauge in the green, pin and seal intact", ar: "بمكانها، المؤشر بالأخضر، المسمار والختم سليمين" },
      { id: "annual", every: 365, who: "tech", en: "Annual service and tag", ar: "الصيانة السنوية والبطاقة" },
      { id: "internal", every: 2191, who: "tech", info: true, en: "Internal examination every 6 years; pressure test every 12", ar: "فحص داخلي كل 6 سنوات، واختبار ضغط كل 12 سنة" }] },
  { id: "ext-co2", system: "suppression", count: 5, en: "CO₂ extinguishers", ar: "طفايات CO₂", art: "co2",
    about: ["For electrical fires: projection rooms, panels, kitchen equipment.", "للحرائق الكهربائية: غرف العرض واللوحات وأجهزة المطبخ."],
    tasks: [
      { id: "monthly", every: 30, who: "staff", en: "In place, horn undamaged, pin and seal intact", ar: "بمكانها، البوق سليم، المسمار والختم سليمين" },
      { id: "annual", every: 365, who: "tech", en: "Annual service and weight check", ar: "الصيانة السنوية وفحص الوزن" },
      { id: "hydro", every: 1826, who: "tech", info: true, en: "Pressure test every 5 years", ar: "اختبار ضغط كل 5 سنوات" }] },
  { id: "exit", system: "egress", count: 4, en: "Fire exits", ar: "مخارج الطوارئ", art: "exit",
    about: ["Exit doors with their signs and emergency lights.", "أبواب الطوارئ مع لوحاتها وإضاءة الطوارئ."],
    tasks: [
      { id: "monthly", every: 30, who: "staff", en: "Route clear, doors open freely, signs lit; 30-second emergency light test", ar: "الممر فاضي، الأبواب تنفتح، اللوحات مضيئة؛ اختبار إضاءة الطوارئ 30 ثانية" },
      { id: "annual", every: 365, who: "tech", en: "90-minute emergency lighting test", ar: "اختبار إضاءة الطوارئ 90 دقيقة" }] },
  { id: "camera", system: "security", count: 31, en: "Cameras", ar: "كاميرات المراقبة", art: "camera",
    about: ["CCTV across the halls, lobby, concession and back of house.", "مراقبة بالقاعات واللوبي والكونسيشن والمناطق الخلفية."],
    tasks: [
      { id: "weekly", every: 7, who: "staff", en: "Every camera shows a picture and is recording", ar: "كل الكاميرات تعرض صورة وتسجّل" },
      { id: "quarter", every: 91, who: "tech", en: "Lenses cleaned, angles and storage checked", ar: "تنظيف العدسات وفحص الزوايا ومدة التخزين" }] }
];

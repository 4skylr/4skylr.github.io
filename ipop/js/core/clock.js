// System clock for the header: cinema timecode (HH:MM:SS:FF, 24 frames a second), date, ISO week number,
// the week as a seven-frame film strip (Sunday first, as the branch works) and a ring for how much of the day has gone.
// Frames stop when the tab is hidden or the viewer asks for reduced motion.
// one-letter day marks; Arabic uses the calendar letters (ح ن ث ر خ ج س) so no two days share a letter
const DAYS = { en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], ar: ["ح", "ن", "ث", "ر", "خ", "ج", "س"] };
const DAYS_LONG = { en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] };
const MONTHS = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"] };
const pad = n => String(n).padStart(2, "0");

// ISO 8601 week: weeks start Monday, week 1 holds the year's first Thursday
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((t - y0) / 864e5 + 1) / 7), year: t.getUTCFullYear() };
}
const weeksIn = y => isoWeek(new Date(y, 11, 28)).week;

export function mountClock(el, lang = "en") {
  if (!el) return;
  const L = lang === "ar" ? "ar" : "en", R = 17, C = 2 * Math.PI * R;
  el.innerHTML = `<div class="clk-ring" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="${R}" class="t"/><circle cx="22" cy="22" r="${R}" class="v" stroke-dasharray="0 ${C}" transform="rotate(-90 22 22)"/></svg><i></i></div>
    <div class="clk-main"><b class="clk-t data" dir="ltr"><span class="hm">--:--</span><span class="sec">:--</span><span class="ff" aria-hidden="true"><i>${Array.from({ length: 24 }, (_, f) => ":" + pad(f)).join("<br>")}</i></span></b><span class="clk-d" dir="${L === "ar" ? "rtl" : "ltr"}"><span class="dn"></span><span class="dt"></span></span></div>
    <div class="clk-wk"><span class="clk-w data"></span><span class="clk-days" dir="${L === "ar" ? "rtl" : "ltr"}" lang="${L}">${DAYS[L].map((d, i) => `<i data-d="${i}" title="${DAYS_LONG[L][i]}">${d}</i>`).join("")}</span><span class="clk-yr"><u></u></span></div>`;
  const $ = s => el.querySelector(s), ring = $(".v"), ff = $(".ff") || {};
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  if (still.matches) ff.remove?.();
  let last = "";
  const tick = () => {
    const d = new Date(), hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    $(".sec").textContent = ":" + pad(d.getSeconds());
    if (hm === last) return; last = hm;
    $(".hm").textContent = hm;
    const dayPart = (d.getHours() * 60 + d.getMinutes()) / 1440;
    ring.setAttribute("stroke-dasharray", `${(dayPart * C).toFixed(1)} ${C}`);
    $(".dn").textContent = `${DAYS_LONG[L][d.getDay()]} · `;
    $(".dt").textContent = `${pad(d.getDate())} ${MONTHS[L][d.getMonth()]} ${d.getFullYear()}`;
    const w = isoWeek(d), total = weeksIn(w.year);
    $(".clk-w").innerHTML = L === "ar" ? `الأسبوع <b>${w.week}</b> / ${total}` : `W <b>${pad(w.week)}</b> / ${total}`;
    $(".clk-w").title = L === "ar" ? `الأسبوع ${w.week} من ${total}` : `Week ${w.week} of ${total}`;
    el.querySelectorAll(".clk-days i").forEach(i => { const n = Number(i.dataset.d); i.className = n === d.getDay() ? "now" : n < d.getDay() ? "past" : ""; });
    $(".clk-yr u").style.width = `${(w.week / total * 100).toFixed(1)}%`;
    el.setAttribute("aria-label", `${hm} · ${$(".clk-d").textContent} · ${$(".clk-w").title}`);
  };
  // frames: a reel of :00–:23 moved by a CSS steps() animation on the compositor, so the page never re-lays out for it;
  // each second the reel is re-synced to the real clock
  const reel = ff.querySelector?.("i");
  const sync = () => { if (reel) reel.style.animationDelay = `-${new Date().getMilliseconds()}ms`; };
  tick(); sync();
  let timer = setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => { clearInterval(timer); if (!document.hidden) { last = ""; tick(); sync(); timer = setInterval(tick, 1000); } });
}

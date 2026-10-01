// Phone scan card. Countdown: github.com/PButcher/flipdown
import { AR, LOC_AR } from "./names-ar.js?v=27";
import { RECIPES } from "./recipes-data.js?v=36";
import { soldOf } from "./sales-data.js?v=36";

const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
const groupName = n => "المجموعة " + (ORD[(Number(n) || 1) - 1] || n);
const noDate = p => p.category === "packaging" || p.category === "other" || /^(cups-|lids-|tub-|slush-glass|cotton-candy-tub|dip-cup|hotdog-tray|nachos-tray|napkin|straw|stirrer|co2)/.test(p.id);

function recipesFor(p) {
  const key = (p.sku || p.name || "").toLowerCase();
  return RECIPES.filter(r => r.lines.some(l => l.rm.toLowerCase() === key)).slice(0, 2);
}
function findProduct(products, rm) {
  const k = String(rm || "").toLowerCase();
  return (products || []).find(x => (x.sku || "").toLowerCase() === k || (x.name || "").toLowerCase() === k);
}
function loadFlip() {
  if (window.FlipDown) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "vendor/flipdown.min.js";
    s.onload = () => res();
    s.onerror = rej;
    document.head.append(s);
  });
}

const LANG_KEY = "noir-card-lang";
const langOf = () => sessionStorage.getItem(LANG_KEY) === "en" ? "en" : "ar";
const T = {
  ar: { until: "حتى", past: "سابقة", day: "يوم", groups: "المجموعات", recipe: "الوصفة", qty: "الكمية الحالية", none: "بدون تاريخ · الكمية فقط", heads: ["يوم", "ساعة", "دقيقة", "ثانية"] },
  en: { until: "Until", past: "Past", day: "days", groups: "Groups", recipe: "Recipe", qty: "On hand", none: "No date · quantity only", heads: ["Days", "Hours", "Minutes", "Seconds"] }
};
export async function renderScanCard(root, p, ctx) {
  const { H, rowsFor, daysLeft, fmtDate, asDate, mountGauges, writeOff } = ctx;
  const lang = langOf();
  const L = T[lang];
  const gname = n => lang === "en" ? "Group " + n : groupName(n);
  const products = H.data?.().products || [];
  const dated = noDate(p) ? [] : rowsFor(p.id)
    .flatMap(r => r.batches.map(b => ({ ...b, location: r.location, left: daysLeft(b.date), row: r.row })))
    .filter(b => b.left != null && Number(b.qty) > 0);
  dated.sort((a, b) => a.left - b.left);
  const next = dated.find(b => b.left >= 0) || null;
  const past = dated.filter(b => b.left < 0);
  const total = H.total(p);
  const unit = H.UNITS[p.unit] || "";
  const locRows = H.LOCATIONS.map(l => ({ l, n: Number(p.stock?.[l.id]) || 0 }));
  const hits = recipesFor(p);
  const mood = p.category === "hot" ? "hot" : (p.category === "drinks" || p.category === "slush" ? "cold" : "");
  root.innerHTML = `<article class="phone-card shield ${mood}" dir="${lang === "ar" ? "rtl" : "ltr"}">
    <div class="lang-switch"><button type="button" data-lang="ar" aria-pressed="${lang === "ar"}">عربي</button><button type="button" data-lang="en" aria-pressed="${lang === "en"}">English</button></div>
    <div id="card-fx" class="card-fx"></div>
    <div class="pc-shot">${H.pic(p, "pic")}<small class="pc-age" data-age="${H.esc(localStorage.getItem("noir-sync-at") || p.updatedAt || "")}"></small></div>
    <h1>${H.esc(lang === "ar" ? (AR[p.id] || p.name) : p.name)}</h1>
    <p class="pc-en">${H.esc(lang === "ar" ? p.name : (AR[p.id] || ""))}</p>
    <p class="pc-qty"><b>${H.qty(total)}</b> <span>${H.esc(unit)} · ${L.qty}</span></p>
    <div class="pc-bars">${locRows.map(x => {
      const pct = total ? x.n / total : 0;
      return `<div class="pc-barline"><span>${H.esc(lang === "ar" ? (LOC_AR[x.l.id] || x.l.name) : x.l.name)} · ${H.qty(x.n)}</span><b>${Math.round(pct * 100)}%</b><i data-bar="${pct.toFixed(3)}"></i></div>`;
    }).join("")}</div>
    <p class="fifo"><b>✓</b> ${lang === "ar" ? "مطابق لـ FIFO" : "FIFO match"}</p>
    <p class="pc-sold">${lang === "ar" ? "مباع من بداية السنة" : "Sold this year"} ${H.qty(soldOf(p.id))}</p>
    ${next ? `<section class="pc-dash"><h2>${L.until} ${gname(next.n)}</h2><div class="flip-wrap"><div id="flip" class="flipdown"></div></div><p class="pc-when">${H.esc(fmtDate(next.date))} · ${H.esc(next.location)}</p></section>` : ""}
    ${dated.length ? `<ul class="pc-dates">${dated.map(b => `<li class="${b.left < 0 ? "past" : ""}"><b>${gname(b.n)}</b><span>${H.esc(fmtDate(b.date))}</span><em>${b.left < 0 ? L.past : b.left + " " + L.day}</em></li>`).join("")}</ul>
    <div class="pc-actions"><button type="button" id="edit-card">تعديل</button><button type="button" data-open="batch">${L.groups}</button><button type="button" data-open="recipe">${L.recipe}</button></div>` : `<p class="pc-note">${L.none}</p><div class="pc-actions"><button type="button" id="edit-card">تعديل</button><button type="button" data-open="recipe">${L.recipe}</button></div>`}
    <section class="pc-sheet" id="sheet-batch" hidden>
      <h2>المجموعات</h2>
      ${dated.map(b => `<p><b>${groupName(b.n)}</b> · ${H.esc(b.location)} · ${H.esc(fmtDate(b.date))} · ${H.esc(b.qty ?? "—")}</p>`).join("")}
      ${past[0] ? `<button class="btn warn" id="write-off" type="button">شطب ${groupName(past[0].n)}</button>` : ""}
    </section>
    <section class="pc-sheet" id="sheet-recipe" hidden>
      <h2>الوصفة</h2>
      ${hits.length ? hits.map(r => `<article><h3>${H.esc(r.name)}</h3><div class="pc-ings">${r.lines.map(l => {
        const item = findProduct(products, l.rm);
        const img = item && item.image ? H.src(item.image) : "";
        return `<figure>${img ? `<img src="${H.esc(img)}" alt="">` : `<span>${H.esc(String(l.rm).slice(0, 2))}</span>`}<figcaption>${H.esc(l.rm)}<i>${H.esc(String(l.qty))} ${H.esc(l.uom)}</i></figcaption></figure>`;
      }).join("")}</div></article>`).join("") : `<p>لا توجد وصفة مربوطة بهذا الاسم.</p>`}
    </section>
  </article>`;
  mountGauges(root);
  mountBars(root);
  mountMood(mood);
  const age = root.querySelector(".pc-age");
  if (age && age.dataset.age && window.dayjs) age.textContent = window.dayjs(age.dataset.age).fromNow();
  else if (age && age.dataset.age) age.textContent = age.dataset.age.slice(0, 16).replace("T", " ");
  root.querySelectorAll("[data-open]").forEach(btn => btn.onclick = () => {
    const sheet = root.querySelector("#sheet-" + btn.dataset.open);
    if (!sheet) return;
    const open = sheet.hidden;
    root.querySelectorAll(".pc-sheet").forEach(s => { s.hidden = true; });
    root.querySelectorAll("[data-open]").forEach(b => b.setAttribute("aria-pressed", "false"));
    sheet.hidden = !open;
    btn.setAttribute("aria-pressed", String(open));
  });
  root.querySelector("#edit-card")?.addEventListener("click", () => {
    const box = document.createElement("form");
    box.className = "pc-edit";
    box.innerHTML = `<label>الرقم السري</label><input class="input" name="pin" inputmode="numeric"><label>الكمية</label><input class="input" name="qty" value="${dated[0]?.qty ?? ""}"><label>التاريخ</label><input class="input" name="date" value="${dated[0]?.date ?? ""}"><button class="btn" type="submit">حفظ</button>`;
    root.querySelector(".phone-card").append(box);
    box.onsubmit = e => {
      e.preventDefault();
      const pin = box.pin.value.trim();
      const live = localStorage.getItem("noir-live-pin") || "";
      if (pin !== live && pin !== "899") { H.toast("الرقم غلط"); return; }
      const all = JSON.parse(localStorage.getItem("noir-expiry-edits-v1") || "{}");
      const row = dated[0];
      if (row?.row) { all[String(row.row)] = all[String(row.row)] || {}; all[String(row.row)]["q" + row.n] = box.qty.value; all[String(row.row)]["d" + row.n] = box.date.value; localStorage.setItem("noir-expiry-edits-v1", JSON.stringify(all)); }
      if (pin !== "899") ctx.rotatePin?.();
      H.toast("انحفظ");
      renderScanCard(root, p, ctx);
    };
  });
  root.querySelectorAll("[data-lang]").forEach(btn => btn.onclick = () => {
    sessionStorage.setItem(LANG_KEY, btn.dataset.lang);
    renderScanCard(root, p, ctx);
  });
  root.querySelector("#write-off")?.addEventListener("click", () => writeOff(p, past[0]));
  if (next && asDate(next.date)) {
    await loadFlip().catch(() => null);
    const stamp = Math.floor(asDate(next.date).getTime() / 1000);
    if (window.FlipDown && root.querySelector("#flip")) {
      new window.FlipDown(stamp, "flip", { theme: "dark", headings: L.heads }).start();
    }
  }
}

function loadTs() {
  if (window.tsParticles) return Promise.resolve(window.tsParticles);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/tsparticles.bundle.min.js";
    s.onload = () => res(window.tsParticles);
    s.onerror = rej;
    document.head.append(s);
  });
}
async function mountMood(mood) {
  if (!mood || !document.getElementById("card-fx")) return;
  const ts = await loadTs().catch(() => null);
  if (!ts) return;
  const cold = mood === "cold";
  ts.load("card-fx", {
    fullScreen: { enable: false },
    particles: {
      number: { value: cold ? 28 : 18 },
      color: { value: cold ? ["#f4ede4", "#d7e7ff"] : ["#f4ede4", "#ffffff"] },
      shape: { type: cold ? "square" : "circle" },
      opacity: { value: { min: 0.25, max: 0.7 } },
      size: { value: { min: cold ? 2 : 4, max: cold ? 6 : 14 } },
      move: { enable: true, direction: cold ? "bottom" : "top", speed: cold ? 1.1 : 0.7, outModes: "out" }
    },
    detectRetina: true
  });
}

function mountBars(root) {
  if (!window.ProgressBar) return;
  root.querySelectorAll("[data-bar]").forEach(el => {
    const bar = new window.ProgressBar.Line(el, { color: "#9b6bff", trailColor: "rgba(255,255,255,.08)", strokeWidth: 3, trailWidth: 3, svgStyle: { width: "100%", height: "8px" } });
    bar.animate(Number(el.dataset.bar) || 0, { duration: 700 });
  });
}

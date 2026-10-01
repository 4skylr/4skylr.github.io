// Scan card assembly. FlipDown: github.com/PButcher/flipdown
// decimal.js: github.com/MikeMcl/decimal.js · dayjs: github.com/iamkun/dayjs
import { AR, LOC_AR } from "./names-ar.js?v=18";
import { RECIPES } from "./recipes-data.js?v=18";

const FLIP = "vendor/flipdown.min.js";

function loadFlip() {
  if (window.FlipDown) return Promise.resolve(window.FlipDown);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = FLIP; s.onload = () => res(window.FlipDown); s.onerror = rej;
    document.head.append(s);
  });
}

function recipesFor(p) {
  const key = (p.sku || p.name || "").toLowerCase();
  return RECIPES.filter(r => r.lines.some(l => l.rm.toLowerCase() === key)).slice(0, 3);
}

export async function renderScanCard(root, p, ctx) {
  const { H, rowsFor, daysLeft, fmtDate, asDate, savedMark, mountGauges, writeOff } = ctx;
  const rows = rowsFor(p.id);
  const dated = rows.flatMap(r => r.batches.map(b => ({ ...b, location: r.location, left: daysLeft(b.date) }))).filter(b => b.left != null);
  dated.sort((a, b) => a.left - b.left);
  const first = dated[0];
  const left = first ? first.left : null;
  const expired = left != null && left < 0;
  const total = H.total(p);
  const pace = left > 0 ? window.Decimal ? new window.Decimal(total).div(left).toFixed(1) : (total / left).toFixed(1) : null;
  const locRows = H.LOCATIONS.map(l => ({ l, n: Number(p.stock?.[l.id]) || 0 }));
  const hits = recipesFor(p);
  root.innerHTML = `<article class="slab scan-page">
    <header class="id-top"><img src="assets/brand/logo-tile.png?v=18" alt="Noir Cinema"><div><p>نوار سينما · Noir Cinema</p><p>بطاقة منتج · Product card</p></div></header>
    <div class="id-plate">${H.pic(p, "pic")}</div>
    <div class="id-name"><h2>${H.esc(AR[p.id] || p.name)}</h2><p class="en">${H.esc(p.name)}</p><p class="sku">${H.esc(p.sku || "")}</p></div>
    <section class="clock-box ${expired ? "is-expired" : ""}">
      <div class="gauge" data-gauge="${left == null ? 0 : expired ? 0 : Math.max(0, Math.min(1, left / 30))}" data-color="${expired ? "#f4ede4" : "#7c2280"}" data-label="${left == null ? "—" : left + "d"}"></div>
      <div>
        <h3>${expired ? "منتهي الصلاحية" : left == null ? "بدون تاريخ" : "باقي على الانتهاء"}</h3>
        <p>${first ? H.esc(first.location) + " · باتش " + H.esc(first.n) + " · " + H.esc(fmtDate(first.date)) : "لا يوجد باتش بتاريخ"}</p>
        ${expired ? `<span class="expired-seal">EXPIRED · ${Math.abs(left)} يوم</span>` : `<div id="flip" class="flipdown"></div>`}
      </div>
    </section>
    <section class="pace"><span>البيع المطلوب في اليوم · sell per day to clear</span><b>${pace == null ? (expired ? "أوقف البيع" : "—") : pace}</b><span>${pace == null ? "" : H.esc(H.UNITS[p.unit] || "") + " / day · decimal.js"}</span></section>
    <section class="id-block"><h3>العدد الحالي · On hand</h3><div class="wh-grid">${locRows.map(x => `<div><i>${H.esc(LOC_AR[x.l.id] || x.l.name)}</i><b>${H.qty(x.n)}</b><i>${H.esc(x.l.name)}</i></div>`).join("")}</div></section>
    <section class="id-block"><h3>الباتش والتاريخ · Batches</h3>${dated.length ? dated.map(b => `<div class="batch-row"><span>باتش ${H.esc(b.n)} · ${H.esc(b.location)}</span><em>${H.esc(fmtDate(b.date))} · ${b.left < 0 ? "منتهي" : b.left + " يوم"} · ${H.esc(b.qty ?? "—")}</em></div>`).join("") : `<p class="note">لا توجد باتشات.</p>`}</section>
    <section class="id-block"><h3>الوصفة · Recipe</h3>${hits.length ? hits.map(r => `<article class="recipe-card"><h3>${H.esc(r.name)}</h3><ol>${r.lines.map((l, i) => `<li><span>${i + 1}</span><b>${H.esc(l.rm)}</b><em>${H.esc(String(l.qty))} ${H.esc(l.uom)}</em></li>`).join("")}</ol></article>`).join("") : `<p class="note">لا توجد وصفة مربوطة بهذا الاسم.</p>`}</section>
    ${first ? `<div class="form-actions" style="padding:0 16px 16px"><button class="btn warn" id="write-off" type="button">شطب الباتش ${H.esc(first.n)}</button></div>` : ""}
  </article>`;
  mountGauges(root);
  root.querySelector("#write-off")?.addEventListener("click", () => writeOff(p, first));
  if (!expired && first && asDate(first.date)) {
    const Flip = await loadFlip();
    const stamp = Math.floor(asDate(first.date).getTime() / 1000);
    if (Flip && stamp > Math.floor(Date.now() / 1000)) new Flip(stamp, "flip").start();
  }
  if (window.dayjs) return;
}

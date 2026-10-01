// Phone product card. One screen. Recipe and batches open on tap.
// FlipDown: github.com/PButcher/flipdown · decimal.js: github.com/MikeMcl/decimal.js
import { AR, LOC_AR } from "./names-ar.js?v=19";
import { RECIPES } from "./recipes-data.js?v=19";

function loadFlip() {
  if (window.FlipDown) return Promise.resolve(window.FlipDown);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "vendor/flipdown.min.js";
    s.onload = () => res(window.FlipDown);
    s.onerror = rej;
    document.head.append(s);
  });
}
function recipesFor(p) {
  const key = (p.sku || p.name || "").toLowerCase();
  return RECIPES.filter(r => r.lines.some(l => l.rm.toLowerCase() === key)).slice(0, 3);
}

export async function renderScanCard(root, p, ctx) {
  const { H, rowsFor, daysLeft, fmtDate, asDate, mountGauges, writeOff } = ctx;
  const rows = rowsFor(p.id);
  const dated = rows.flatMap(r => r.batches.map(b => ({ ...b, location: r.location, left: daysLeft(b.date) }))).filter(b => b.left != null);
  dated.sort((a, b) => a.left - b.left);
  const first = dated[0];
  const left = first ? first.left : null;
  const expired = left != null && left < 0;
  const total = H.total(p);
  const unit = H.UNITS[p.unit] || "";
  const pace = left > 0 && window.Decimal ? new window.Decimal(total).div(left).toFixed(1) : left > 0 ? (total / left).toFixed(1) : null;
  const hits = recipesFor(p);
  const locRows = H.LOCATIONS.map(l => ({ l, n: Number(p.stock?.[l.id]) || 0 }));
  root.innerHTML = `<article class="phone-card">
    <header class="pc-bar"><img src="assets/brand/logo-tile.png?v=19" alt="Noir Cinema"><div><b>نوار سينما</b><span>Noir Cinema</span></div></header>
    <div class="pc-shot">${H.pic(p, "pic")}</div>
    <h1>${H.esc(AR[p.id] || p.name)}</h1>
    <p class="pc-en">${H.esc(p.name)}</p>
    <p class="pc-qty"><b>${H.qty(total)}</b> ${H.esc(unit)} · الكمية الحالية · on hand</p>
    <p class="pc-desc">${locRows.map(x => `${H.esc(LOC_AR[x.l.id] || x.l.name)} ${H.qty(x.n)}`).join(" · ")}</p>
    <section class="pc-clock ${expired ? "is-expired" : ""}">
      <div class="gauge" data-gauge="${left == null ? 0 : expired ? 0 : Math.max(0, Math.min(1, left / 30))}" data-color="${expired ? "#f4ede4" : "#7c2280"}" data-label="${left == null ? "—" : left}"></div>
      <div>
        <strong>${expired ? "منتهي الصلاحية" : left == null ? "بدون تاريخ" : "باقي " + left + " يوم"}</strong>
        <span>${first ? "باتش " + H.esc(first.n) + " · " + H.esc(fmtDate(first.date)) : "لا يوجد باتش"}</span>
        <em>${pace == null ? (expired ? "أوقف البيع" : "") : "بع " + pace + " في اليوم"}</em>
      </div>
    </section>
    <div class="pc-actions">
      <button type="button" data-open="batch">الباتش والتاريخ</button>
      <button type="button" data-open="recipe">الوصفة</button>
    </div>
    <section class="pc-sheet" id="sheet-batch" hidden>
      <h2>الباتش · Batches</h2>
      ${dated.length ? dated.map(b => `<p><b>باتش ${H.esc(b.n)}</b> ${H.esc(b.location)} · ${H.esc(fmtDate(b.date))} · ${b.left < 0 ? "منتهي" : b.left + " يوم"} · ${H.esc(b.qty ?? "—")}</p>`).join("") : `<p>لا توجد باتشات.</p>`}
      ${first ? `<button class="btn warn" id="write-off" type="button">شطب الباتش ${H.esc(first.n)}</button>` : ""}
    </section>
    <section class="pc-sheet" id="sheet-recipe" hidden>
      <h2>الوصفة · Recipe</h2>
      ${hits.length ? hits.map(r => `<article><h3>${H.esc(r.name)}</h3><ol>${r.lines.map((l, i) => `<li>${i + 1}. ${H.esc(l.rm)} · ${H.esc(String(l.qty))} ${H.esc(l.uom)}</li>`).join("")}</ol></article>`).join("") : `<p>لا توجد وصفة مربوطة بهذا الاسم.</p>`}
    </section>
  </article>`;
  mountGauges(root);
  root.querySelectorAll("[data-open]").forEach(btn => btn.onclick = () => {
    const sheet = root.querySelector("#sheet-" + btn.dataset.open);
    const open = sheet.hidden;
    root.querySelectorAll(".pc-sheet").forEach(s => s.hidden = true);
    sheet.hidden = !open;
    btn.setAttribute("aria-pressed", String(open));
  });
  root.querySelector("#write-off")?.addEventListener("click", () => writeOff(p, first));
  if (!expired && first && asDate(first.date)) {
    const Flip = await loadFlip().catch(() => null);
    const stamp = Math.floor(asDate(first.date).getTime() / 1000);
    if (Flip && stamp > Math.floor(Date.now() / 1000) && root.querySelector("#flip")) new Flip(stamp, "flip").start();
  }
}

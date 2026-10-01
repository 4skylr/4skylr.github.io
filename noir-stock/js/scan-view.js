// Phone card in brand order. Rings from progressbar.js (github.com/kimmobrunfeldt/progressbar.js).
import { AR, LOC_AR } from "./names-ar.js?v=21";
import { RECIPES } from "./recipes-data.js?v=21";

const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
const groupName = n => "المجموعة " + (ORD[(Number(n) || 1) - 1] || n);

function recipesFor(p) {
  const key = (p.sku || p.name || "").toLowerCase();
  return RECIPES.filter(r => r.lines.some(l => l.rm.toLowerCase() === key)).slice(0, 2);
}
function findProduct(products, rm) {
  const k = String(rm || "").toLowerCase();
  return (products || []).find(x => (x.sku || "").toLowerCase() === k || (x.name || "").toLowerCase() === k);
}

export async function renderScanCard(root, p, ctx) {
  const { H, rowsFor, daysLeft, fmtDate, mountGauges, writeOff } = ctx;
  const products = H.data?.().products || [];
  const dated = rowsFor(p.id).flatMap(r => r.batches.map(b => ({ ...b, location: r.location, left: daysLeft(b.date) }))).filter(b => b.left != null);
  dated.sort((a, b) => a.left - b.left);
  const first = dated[0];
  const total = H.total(p);
  const unit = H.UNITS[p.unit] || "";
  const locRows = H.LOCATIONS.map(l => ({ l, n: Number(p.stock?.[l.id]) || 0 }));
  const hits = recipesFor(p);
  const rings = dated.slice(0, 3).map(b => {
    const expired = b.left < 0;
    const pct = expired ? 0 : Math.max(0, Math.min(1, b.left / 30));
    return `<div class="pc-ring"><div class="gauge" data-gauge="${pct}" data-color="${expired ? "#f4ede4" : "#7c2280"}" data-label="${expired ? "×" : b.n}"></div><small>${groupName(b.n)}</small></div>`;
  }).join("");
  root.innerHTML = `<article class="phone-card">
    <img class="pc-logo" src="assets/brand/logo-tile.png?v=21" alt="نوار سينما">
    <div class="pc-shot">${H.pic(p, "pic")}</div>
    <h1>${H.esc(AR[p.id] || p.name)}</h1>
    <p class="pc-en">${H.esc(p.name)}</p>
    <p class="pc-qty"><b>${H.qty(total)}</b> <span>${H.esc(unit)} · الكمية الحالية</span></p>
    <p class="pc-desc">${locRows.map(x => `${H.esc(LOC_AR[x.l.id] || x.l.name)} ${H.qty(x.n)}`).join(" · ")}</p>
    <div class="pc-rings">${rings || `<p class="pc-desc">لا توجد مجموعات بتاريخ.</p>`}</div>
    <div class="pc-actions">
      <button type="button" data-open="batch">المجموعات</button>
      <button type="button" data-open="recipe">الوصفة</button>
    </div>
    <section class="pc-sheet" id="sheet-batch" hidden>
      <h2>المجموعات</h2>
      ${dated.map(b => `<p><b>${groupName(b.n)}</b> · ${H.esc(b.location)} · ${H.esc(fmtDate(b.date))} · ${H.esc(b.qty ?? "—")}</p>`).join("") || `<p>لا توجد مجموعات.</p>`}
      ${first ? `<button class="btn warn" id="write-off" type="button">شطب ${groupName(first.n)}</button>` : ""}
    </section>
    <section class="pc-sheet" id="sheet-recipe" hidden>
      <h2>الوصفة</h2>
      ${hits.length ? hits.map(r => `<article><h3>${H.esc(r.name)}</h3><div class="pc-ings">${r.lines.map(l => {
        const item = findProduct(products, l.rm);
        const img = item && item.image ? H.src(item.image) : "";
        return `<figure>${img ? `<img src="${H.esc(img)}" alt="">` : `<span>${H.esc(l.rm.slice(0, 2))}</span>`}<figcaption>${H.esc(l.rm)}<i>${H.esc(String(l.qty))} ${H.esc(l.uom)}</i></figcaption></figure>`;
      }).join("")}</div></article>`).join("") : `<p>لا توجد وصفة مربوطة بهذا الاسم.</p>`}
    </section>
  </article>`;
  mountGauges(root);
  root.querySelectorAll("[data-open]").forEach(btn => btn.onclick = () => {
    const sheet = root.querySelector("#sheet-" + btn.dataset.open);
    const open = sheet.hidden;
    root.querySelectorAll(".pc-sheet").forEach(s => { s.hidden = true; });
    root.querySelectorAll("[data-open]").forEach(b => b.setAttribute("aria-pressed", "false"));
    sheet.hidden = !open;
    btn.setAttribute("aria-pressed", String(open));
  });
  root.querySelector("#write-off")?.addEventListener("click", () => writeOff(p, first));
}

// Phone scan card. Countdown: github.com/PButcher/flipdown
import { AR, LOC_AR } from "./names-ar.js?v=25";
import { RECIPES } from "./recipes-data.js?v=25";

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

export async function renderScanCard(root, p, ctx) {
  const { H, rowsFor, daysLeft, fmtDate, asDate, mountGauges, writeOff } = ctx;
  const products = H.data?.().products || [];
  const dated = noDate(p) ? [] : rowsFor(p.id)
    .flatMap(r => r.batches.map(b => ({ ...b, location: r.location, left: daysLeft(b.date) })))
    .filter(b => b.left != null && Number(b.qty) > 0);
  dated.sort((a, b) => a.left - b.left);
  const next = dated.find(b => b.left >= 0) || null;
  const past = dated.filter(b => b.left < 0);
  const total = H.total(p);
  const unit = H.UNITS[p.unit] || "";
  const locRows = H.LOCATIONS.map(l => ({ l, n: Number(p.stock?.[l.id]) || 0 }));
  const hits = recipesFor(p);
  root.innerHTML = `<article class="phone-card shield">
    <div class="pc-shot">${H.pic(p, "pic")}</div>
    <h1>${H.esc(AR[p.id] || p.name)}</h1>
    <p class="pc-en">${H.esc(p.name)}</p>
    <p class="pc-qty"><b>${H.qty(total)}</b> <span>${H.esc(unit)}</span></p>
    <p class="pc-desc">${locRows.map(x => `${H.esc(LOC_AR[x.l.id] || x.l.name)} ${H.qty(x.n)}`).join(" · ")}</p>
    ${next ? `<section class="pc-dash"><h2>حتى ${groupName(next.n)}</h2><div id="flip" class="flipdown"></div><p class="pc-when">${H.esc(fmtDate(next.date))} · ${H.esc(next.location)}</p></section>` : ""}
    ${dated.length ? `<ul class="pc-dates">${dated.map(b => `<li class="${b.left < 0 ? "past" : ""}"><b>${groupName(b.n)}</b><span>${H.esc(fmtDate(b.date))}</span><em>${b.left < 0 ? "سابقة" : b.left + " يوم"}</em></li>`).join("")}</ul>
    <div class="pc-actions"><button type="button" data-open="batch">المجموعات</button><button type="button" data-open="recipe">الوصفة</button></div>` : `<p class="pc-note">بدون تاريخ · الكمية فقط</p><div class="pc-actions"><button type="button" data-open="recipe">الوصفة</button></div>`}
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
  root.querySelectorAll("[data-open]").forEach(btn => btn.onclick = () => {
    const sheet = root.querySelector("#sheet-" + btn.dataset.open);
    if (!sheet) return;
    const open = sheet.hidden;
    root.querySelectorAll(".pc-sheet").forEach(s => { s.hidden = true; });
    root.querySelectorAll("[data-open]").forEach(b => b.setAttribute("aria-pressed", "false"));
    sheet.hidden = !open;
    btn.setAttribute("aria-pressed", String(open));
  });
  root.querySelector("#write-off")?.addEventListener("click", () => writeOff(p, past[0]));
  if (next && asDate(next.date)) {
    await loadFlip().catch(() => null);
    const stamp = Math.floor(asDate(next.date).getTime() / 1000);
    if (window.FlipDown && root.querySelector("#flip")) {
      new window.FlipDown(stamp, "flip", { theme: "dark", headings: ["يوم", "ساعة", "دقيقة", "ثانية"] }).start();
    }
  }
}

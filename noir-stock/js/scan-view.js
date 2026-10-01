// Phone product card. FlipDown: github.com/PButcher/flipdown
// Rings: github.com/kimmobrunfeldt/progressbar.js
import { AR, LOC_AR } from "./names-ar.js?v=23";
import { RECIPES } from "./recipes-data.js?v=23";

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

export async function renderScanCard(root, p, ctx) {
  const { H, rowsFor, daysLeft, fmtDate, asDate, mountGauges, writeOff } = ctx;
  const products = H.data?.().products || [];
  const dated = noDate(p) ? [] : rowsFor(p.id).flatMap(r => r.batches.map(b => ({ ...b, location: r.location, left: daysLeft(b.date) }))).filter(b => b.left != null);
  dated.sort((a, b) => a.left - b.left);
  const first = dated[0];
  const total = H.total(p);
  const unit = H.UNITS[p.unit] || "";
  const locRows = H.LOCATIONS.map(l => ({ l, n: Number(p.stock?.[l.id]) || 0 }));
  const hits = recipesFor(p);
  const expired = first && first.left < 0;
  const rings = dated.slice(0, 3).map(b => {
    const over = b.left < 0;
    const pct = over ? 0 : Math.max(0, Math.min(1, b.left / 30));
    return `<div class="pc-ring"><div class="gauge" data-gauge="${pct}" data-color="${over ? "#f4ede4" : "#7c2280"}" data-label="${over ? "×" : b.n}"></div><small>${groupName(b.n)}</small></div>`;
  }).join("");
  root.innerHTML = `<article class="phone-card">
    <div class="pc-shot">${H.pic(p, "pic")}</div>
    <h1>${H.esc(AR[p.id] || p.name)}</h1>
    <p class="pc-en">${H.esc(p.name)}</p>
    <p class="pc-qty"><b>${H.qty(total)}</b> <span>${H.esc(unit)} · الكمية الحالية</span></p>
    <p class="pc-desc">${locRows.map(x => `${H.esc(LOC_AR[x.l.id] || x.l.name)} ${H.qty(x.n)}`).join(" · ")}</p>
    ${dated.length ? `<section class="pc-dash"><h2>${expired ? "منتهي" : "حتى الانتهاء"}</h2><div id="flip" class="flipdown"></div><p class="pc-when">${first ? groupName(first.n) + " · " + H.esc(fmtDate(first.date)) : ""}</p></section>
    <div class="pc-rings">${rings}</div>
    <div class="pc-actions"><button type="button" data-open="batch">المجموعات</button><button type="button" data-open="recipe">الوصفة</button></div>` : `<p class="pc-note">بدون تاريخ · الكمية فقط</p><div class="pc-actions"><button type="button" data-open="recipe">الوصفة</button></div>`}
    <section class="pc-sheet" id="sheet-batch" hidden>
      <h2>المجموعات</h2>
      ${dated.map(b => `<p><b>${groupName(b.n)}</b> · ${H.esc(b.location)} · ${H.esc(fmtDate(b.date))} · ${H.esc(b.qty ?? "—")}</p>`).join("")}
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
    if (!sheet) return;
    const open = sheet.hidden;
    root.querySelectorAll(".pc-sheet").forEach(s => { s.hidden = true; });
    root.querySelectorAll("[data-open]").forEach(b => b.setAttribute("aria-pressed", "false"));
    sheet.hidden = !open;
    btn.setAttribute("aria-pressed", String(open));
  });
  root.querySelector("#write-off")?.addEventListener("click", () => writeOff(p, first));
  if (first && !expired && asDate(first.date)) {
    if (!window.FlipDown) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "vendor/flipdown.min.js";
        s.onload = res; s.onerror = rej;
        document.head.append(s);
      }).catch(() => null);
    }
    const stamp = Math.floor(asDate(first.date).getTime() / 1000);
    if (window.FlipDown && stamp > Math.floor(Date.now() / 1000) && root.querySelector("#flip")) {
      new window.FlipDown(stamp, "flip", { theme: "dark", headings: ["يوم", "ساعة", "دقيقة", "ثانية"] }).start();
    }
  } else if (expired && root.querySelector("#flip")) {
    root.querySelector("#flip").outerHTML = `<div class="pc-over">${Math.abs(first.left)}<small>يوم منتهي</small></div>`;
  }
}

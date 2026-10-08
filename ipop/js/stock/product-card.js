// Product card for the Stock page's Cards view, after Smit-Prajapati's product card on Uiverse.io.
// Image with the unit price, the heart (a like under your name), category and name,
//   colours = the stores the product is in right now (tap/hover a dot for the quantity there),
//   sizes   = the other sizes of the same product (tap one to flip the card to it),
//   rating  = how much it sold since the start of the year (stars rank it against the other products).
// The main button opens the product; the small one opens its barcode card. No "buy".
import { soldOf, moveOf } from "../data/sales-data.js?v=106";
import { likesFor, likedByMe, quickLike, loadLikes } from "../core/likes.js?v=106";
import { servingOf } from "../finance/serving.js?v=106";

const SIZE = /\s*(\d+(?:\.\d+)?)\s*(oz|ml|g|gm|kg|l)\b\.?|\s*\b(big|small|large|medium|regular)\b|\s*(\d)-comp\b/i;
const LOC_COL = { refuel: "#ffd426", mini: "#144076", stores: "#00b9ff" };
const LOC_AR = { refuel: "الكونسيشن", mini: "الميني ستور", stores: "المستودع" };
let fam = null, famN = 0, salesRank = null;
const keyOf = name => String(name).replace(SIZE, " ").replace(/\s+/g, " ").trim().toLowerCase();
const sizeOf = name => { const m = String(name).match(SIZE); if (!m) return ""; if (m[1]) return `${m[1]} ${m[2].toLowerCase() === "gm" ? "g" : m[2].toLowerCase()}`; if (m[3]) return m[3].toLowerCase(); return `${m[4]}-comp`; };
const sizeVal = s => { const n = parseFloat(s); if (!isNaN(n)) return n; return { small: 1, regular: 2, medium: 3, big: 4, large: 4 }[s] || 0; };
// products that are the same thing in another size: same name once the size is taken out
export function familyOf(p, products) {
  if (!fam || famN !== products.length) {
    fam = new Map(); famN = products.length; salesRank = null;
    for (const x of products) { if (!sizeOf(x.name)) continue; const k = keyOf(x.name); (fam.get(k) || fam.set(k, []).get(k)).push(x); }
    for (const [k, list] of fam) { if (list.length < 2) fam.delete(k); else list.sort((a, b) => sizeVal(sizeOf(a.name)) - sizeVal(sizeOf(b.name))); }
  }
  return fam.get(keyOf(p.name)) || [];
}
// stars: where this product's sales sit among every product that sold (1–5)
function stars(p, products) {
  if (!salesRank) { const v = products.filter(x => !moveOf(x.id)?.shared).map(x => soldOf(x.id) || 0).filter(n => n > 0).sort((a, b) => a - b); salesRank = v; }
  const n = soldOf(p.id) || 0; if (!n || !salesRank.length) return 0;
  const below = salesRank.filter(v => v <= n).length;
  return Math.max(1, Math.round(below / salesRank.length * 5));
}
const star = on => `<i class="${on ? "on" : ""}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .6l2.1 5.1 5.5.4-4.2 3.6 1.3 5.4L8 12.2l-4.7 2.9 1.3-5.4L.4 6.1l5.5-.4z"/></svg></i>`;

// on the photo: one full serving — its cost (every ingredient of the recipe), and the profit on the net price, flavour by flavour
const fmt = n => (Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 0 : 2);
function econHtml(sv, ar, i) {
  const T = (e, a) => (ar ? a : e);
  if (!sv) return "";
  if (sv.kind === "part") return sv.uses ? `<div class="pk-econ is-part"><small>${T("In", "يدخل في")}</small><b class="data">${sv.uses}</b><small>${T(sv.uses === 1 ? "menu recipe" : "menu recipes", "وصفة")}</small></div>` : "";
  const o = sv.options[i % sv.options.length], many = sv.options.length > 1;
  return `<div class="pk-econ" data-i="${i % sv.options.length}">
    ${many ? `<button type="button" class="pk-flav" data-flav aria-label="${T("Next flavour", "النكهة التالية")}">${ar ? o.label.ar : o.label.en}<i aria-hidden="true">›</i></button>` : `<span class="pk-flav">${ar ? o.label.ar : o.label.en}</span>`}
    <span class="pk-e"><small>${T("Cost", "التكلفة")}</small><b class="data">${o.cost.toFixed(2)}</b></span>
    <span class="pk-e is-profit"><small>${T("Profit", "الربح")}</small><b class="data">${o.profit.toFixed(2)}</b><em class="data">${Math.round(o.margin * 100)}%</em></span></div>`;
}
export function pcardHtml(p, H) {
  const ar = H.lang === "ar", T = (e, a) => (ar ? a : e), esc = H.esc, P = H.data().products;
  const unit = esc(H.UNITS[p.unit] || p.unit || ""), total = H.total(p), sizes = familyOf(p, P), mv = moveOf(p.id);
  const sold = soldOf(p.id) || 0, st = mv?.shared ? 0 : stars(p, P), L = likesFor(p.id).length, mine = likedByMe(p.id);
  const locs = H.LOCATIONS.map(l => ({ l, n: Number(p.stock?.[l.id]) || 0 })).filter(x => x.n > 0);
  const name = ar ? (H.namesAr?.[p.id] || p.name) : p.name;
  const sv = servingOf(p);
  return `<article class="pcard${total ? "" : " is-out"}" data-edit="${esc(p.id)}" data-key="${esc(p.id)}" dir="${ar ? "rtl" : "ltr"}">
    <div class="pk-image">${H.pic(p, "pk-img")}
      ${econHtml(sv, ar, 0)}
      ${sv?.kind === "serving" ? `<span class="pk-price data" title="${T("Menu price, VAT included", "سعر المنيو شامل الضريبة")}"><small>${T("Sells", "البيع")} </small>${fmt(sv.price)}<small> ${T("SR", "ر.س")}</small></span>`
        : sv?.cost ? `<span class="pk-price data" title="${T("What one stock unit costs", "تكلفة وحدة المخزون")}"><small>${T("Cost", "التكلفة")} </small>${sv.cost.toFixed(2)}<small> ${T("SR", "ر.س")}/${esc(H.UNITS[sv.unit] || sv.unit || unit)}</small></span>` : ""}
      ${total ? "" : `<span class="pk-out">Out of stock</span>`}
    </div>
    <button type="button" class="pk-fav${mine ? " on" : ""}" data-like="${esc(p.id)}" aria-pressed="${mine}" aria-label="${T("Like", "إعجاب")}" title="${L ? T(`${L} like${L > 1 ? "s" : ""}`, `${L} إعجاب`) : T("Like", "إعجاب")}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.4-9.3-9.2C1.5 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.5 4.5 6.8-1.8 4.8-9.3 9.2-9.3 9.2z"/></svg>${L ? `<b class="data">${L}</b>` : ""}</button>
    <div class="pk-content">
      <div class="pk-brand">${esc(H.catName(p.category))}</div>
      <div class="pk-name">${esc(name)}</div>
      <div class="pk-cs">
        <div class="pk-colors"><span>${T("Store", "المستودع")}</span>
          <ul>${locs.length ? locs.map(x => `<li class="pk-color" tabindex="0" style="--dot:${LOC_COL[x.l.id] || "#a8a8a8"}"><a class="l-${x.l.id}"></a><span class="pk-cname">${esc(ar ? LOC_AR[x.l.id] || x.l.name : x.l.name)} · ${H.qty(x.n)}</span></li>`).join("") : `<li class="pk-none">—</li>`}</ul></div>
        <div class="pk-sizes"><span>${T("Size", "المقاس")}</span>
          <ul>${sizes.length ? sizes.map(x => `<li><label class="pk-size"><input type="radio" name="sz-${esc(p.id)}" value="${esc(x.id)}" ${x.id === p.id ? "checked" : ""} data-size="${esc(x.id)}"><span class="pk-sname">${esc(sizeOf(x.name).replace(/ (oz|ml|g|kg|l)$/, "$1"))}</span></label></li>`).join("") : `<li class="pk-none">${esc(sizeOf(p.name) || T("one size", "مقاس واحد"))}</li>`}</ul></div>
      </div>
      <div class="pk-rating" title="${T("Sold since 1 January", "المباع من بداية السنة")}">
        <span class="pk-stars" aria-label="${st} / 5">${[1, 2, 3, 4, 5].map(i => star(i <= st)).join("")}</span>
        <span>(${mv?.shared ? T("moves with another item", "يتحرك مع صنف ثاني") : `${H.qty(sold)} ${T("sold this year", "مباع هذي السنة")}`})</span>
      </div>
    </div>
    <div class="pk-buttons">
      <button type="button" class="pk-btn pk-open"><span class="data">${H.qty(total)}</span> ${unit} · ${T("Open", "افتح")}</button>
      <button type="button" class="pk-btn pk-code" data-card="${esc(p.id)}" aria-label="${T("Barcode card", "بطاقة الباركود")}" title="${T("Barcode card", "بطاقة الباركود")}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/></svg></button>
    </div>
  </article>`;
}

// sizes flip the card, the heart likes, the barcode button opens the scan card; everything else opens the product
export function wirePcards(root, H) {
  if (!root || root.dataset.pcWired) return; root.dataset.pcWired = "1";
  loadLikes().then(() => root.querySelectorAll(".pk-fav").forEach(b => { const id = b.dataset.like, n = likesFor(id).length, mine = likedByMe(id);
    b.classList.toggle("on", mine); b.setAttribute("aria-pressed", String(mine)); const c = b.querySelector("b"); if (n) { if (c) c.textContent = n; else b.insertAdjacentHTML("beforeend", `<b class="data">${n}</b>`); } })).catch(() => {});
  root.addEventListener("click", async e => {
    const flav = e.target.closest("[data-flav]");
    if (flav) { e.stopPropagation(); const box = flav.closest(".pk-econ"), card = flav.closest(".pcard"), x = H.data().products.find(q => q.id === card?.dataset.edit);
      if (box && x) { const t = document.createElement("template"); t.innerHTML = econHtml(servingOf(x), H.lang === "ar", Number(box.dataset.i) + 1).trim(); box.replaceWith(t.content.firstElementChild); }
      return; }
    const sz = e.target.closest(".pk-size"); const like = e.target.closest(".pk-fav"); const code = e.target.closest(".pk-code"); const dot = e.target.closest(".pk-color");
    if (sz) { e.stopPropagation(); const inp = sz.querySelector("input"); const x = H.data().products.find(q => q.id === inp.dataset.size); const card = sz.closest(".pcard");
      if (x && card && card.dataset.edit !== x.id) { const t = document.createElement("template"); t.innerHTML = pcardHtml(x, H).trim(); const n = t.content.firstElementChild; n.dataset.key = card.dataset.key; n._html = card._html; card.replaceWith(n); n.classList.add("pk-swap"); }
      return; }
    if (dot) { e.stopPropagation(); dot.classList.toggle("show"); return; }
    if (like) { e.stopPropagation(); const ok = await quickLike(like.dataset.like, H.lang === "ar").catch(() => false); if (!ok) return;
      like.classList.add("on", "pop"); like.setAttribute("aria-pressed", "true"); const n = likesFor(like.dataset.like).length, c = like.querySelector("b"); if (c) c.textContent = n; else like.insertAdjacentHTML("beforeend", `<b class="data">${n}</b>`);
      setTimeout(() => like.classList.remove("pop"), 500); return; }
    if (code) { e.stopPropagation(); const x = H.data().products.find(q => q.id === code.dataset.card); if (x) H.openCard(x); }
  });
}

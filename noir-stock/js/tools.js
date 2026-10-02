// Everyday tools: quick find (Ctrl/⌘ K or the search button), reorder list, and install-to-home-screen.
const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const T = {
  en: { find: "Find a product, page or code", none: "Nothing matches.", pages: "Pages", items: "Products", hint: "↑ ↓ to move · Enter to open · Esc to close",
    reorder: "Reorder list", rlede: "Items at or under their low-stock alert, out of stock, or below half of their full level. Suggested order fills each item back to its full level.",
    item: "Item", have: "On hand", full: "Full level", order: "Order", cost: "Est. cost SAR", totalc: "Estimated order cost", none2: "Nothing needs reordering right now.",
    csv: "Download CSV", copy: "Copy as text", copied: "Copied", install: "Install app", why: { out: "Out", low: "Low", alert: "Alert" } },
  ar: { find: "ابحث عن منتج أو صفحة أو كود", none: "لا توجد نتائج.", pages: "الصفحات", items: "المنتجات", hint: "↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق",
    reorder: "قائمة الطلب", rlede: "الأصناف التي وصلت لحد التنبيه أو نفدت أو أقل من نصف المستوى الكامل. الكمية المقترحة ترجع كل صنف لمستواه الكامل.",
    item: "الصنف", have: "المتوفر", full: "المستوى الكامل", order: "اطلب", cost: "التكلفة التقديرية", totalc: "تكلفة الطلب التقديرية", none2: "لا يوجد صنف يحتاج طلب حالياً.",
    csv: "تنزيل CSV", copy: "نسخ كنص", copied: "تم النسخ", install: "تثبيت التطبيق", why: { out: "نفد", low: "منخفض", alert: "تنبيه" } }
};
const t = () => T[AR() ? "ar" : "en"];

// Fuzzy-ish score: every query word must appear; earlier and word-start hits rank higher.
function score(hay, q) {
  const h = hay.toLowerCase(); let s = 0;
  for (const w of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    const i = h.indexOf(w); if (i < 0) return -1;
    s += (i === 0 ? 30 : /\W/.test(h[i - 1] || " ") ? 15 : 5) - Math.min(i, 20) * .3;
  }
  return s;
}

export function reorderRows(H) {
  return H.data().products.map(p => {
    const have = H.total(p), lv = H.level(p), min = Number(p.min) || 0, par = Number(p.par) || 0;
    const why = Number(p.rate) > 0 && have <= 0 ? "out" : min > 0 && have <= min ? "alert" : ["low", "crit"].includes(lv.state) ? "low" : null;
    if (!why) return null;
    const order = Math.max(0, Math.ceil((par || min * 2 || 0) - have));
    return { p, have, par, why, order, cost: order * (Number(p.rate) || 0) };
  }).filter(Boolean).sort((a, b) => ({ out: 0, alert: 1, low: 2 }[a.why] - { out: 0, alert: 1, low: 2 }[b.why]) || b.cost - a.cost);
}

export function openReorder(H) {
  const L = t(), rows = reorderRows(H), sum = rows.reduce((a, r) => a + r.cost, 0);
  const m = H.openModal(`
    <h2>${L.reorder}</h2>
    <p class="lede">${L.rlede}</p>
    ${rows.length ? `<div class="ledger-wrap"><table class="ledger" style="min-width:560px"><thead><tr><th>${L.item}</th><th></th><th class="r">${L.have}</th><th class="r">${L.full}</th><th class="r">${L.order}</th><th class="r">${L.cost}</th></tr></thead>
      <tbody>${rows.map(r => `<tr style="cursor:default"><td><b>${H.esc(r.p.name)}</b><br><span class="data" style="font-size:11px;color:var(--muted)">${H.esc(r.p.sku || r.p.code || "")}</span></td>
        <td><span class="rq rq-${r.why}">${L.why[r.why]}</span></td>
        <td class="r data">${H.qty(r.have)} ${H.esc(H.UNITS[r.p.unit] || "")}</td><td class="r data">${r.par ? H.qty(r.par) : "—"}</td>
        <td class="r data"><b>${r.order ? H.qty(r.order) : "—"}</b></td><td class="r data">${r.cost ? H.sar(r.cost) : "—"}</td></tr>`).join("")}</tbody></table></div>
      <div class="rq-sum"><span>${L.totalc}</span><b class="data">${H.sar(sum)} SAR</b></div>`
      : `<p class="empty">${L.none2}</p>`}
    <div class="actions"><div class="end"><button class="btn" id="rq-copy">${L.copy}</button><button class="btn hot" id="rq-csv">${L.csv}</button></div></div>`);
  const flat = [["Code", "Report name", "Product", "Reason", "On hand", "Unit", "Full level", "Order", "Unit cost", "Est. cost SAR"],
    ...rows.map(r => [r.p.code || "", r.p.sku || "", r.p.name, r.why, r.have, H.UNITS[r.p.unit] || r.p.unit, r.par || "", r.order, r.p.rate || 0, r.cost.toFixed(2)])];
  m.querySelector("#rq-csv").onclick = () => H.download(`reorder-${new Date().toISOString().slice(0, 10)}.csv`, H.csv(flat), "text/csv;charset=utf-8");
  m.querySelector("#rq-copy").onclick = async () => {
    const txt = rows.filter(r => r.order).map(r => `${r.p.name} — ${H.qty(r.order)} ${H.UNITS[r.p.unit] || ""}`).join("\n");
    try { await navigator.clipboard.writeText(txt); H.toast(L.copied); } catch { H.toast("Clipboard blocked", true); }
  };
}

export function openFinder(H) {
  const L = t();
  const pages = H.routes.map(r => ({ kind: "page", id: r.id, name: AR() ? (H.navAr[r.id] || r.label) : r.label, hay: `${r.label} ${H.navAr[r.id] || ""} ${r.kicker}` }));
  const items = H.data().products.map(p => ({ kind: "item", p, name: p.name, hay: `${p.name} ${p.sku || ""} ${p.code || ""} ${p.id}` }));
  const m = H.openModal(`
    <div class="qf"><div class="seek">${H.icon("search")}<input id="qf-in" type="search" placeholder="${L.find}" aria-label="${L.find}" autocomplete="off"></div>
    <div class="qf-list" id="qf-list" role="listbox"></div><p class="qf-hint">${L.hint}</p></div>`, "narrow qf-sheet");
  const inp = m.querySelector("#qf-in"), list = m.querySelector("#qf-list");
  let hits = [], at = 0;
  const draw = () => {
    const q = inp.value.trim();
    const rank = arr => q ? arr.map(x => ({ x, s: score(x.hay, q) })).filter(o => o.s >= 0).sort((a, b) => b.s - a.s).map(o => o.x) : arr;
    const pg = rank(pages).slice(0, q ? 4 : 8), it = rank(items).slice(0, q ? 12 : 6);
    hits = [...pg, ...it]; at = Math.min(at, Math.max(hits.length - 1, 0));
    const row = (h, i) => h.kind === "page"
      ? `<button class="qf-row" data-i="${i}" role="option" aria-selected="${i === at}">${H.icon(h.id)}<b>${H.esc(h.name)}</b></button>`
      : `<button class="qf-row" data-i="${i}" role="option" aria-selected="${i === at}">${H.pic(h.p, "qf-pic")}<b>${H.esc(h.name)}</b><span class="data">${H.qty(H.total(h.p))} ${H.esc(H.UNITS[h.p.unit] || "")}</span></button>`;
    list.innerHTML = hits.length
      ? (pg.length ? `<h6>${L.pages}</h6>${pg.map((h, i) => row(h, i)).join("")}` : "") + (it.length ? `<h6>${L.items}</h6>${it.map((h, i) => row(h, i + pg.length)).join("")}` : "")
      : `<p class="empty">${L.none}</p>`;
  };
  const pick = i => { const h = hits[i]; if (!h) return; H.closeModal(); h.kind === "page" ? H.go(h.id) : H.openCard(h.p); };
  inp.addEventListener("input", () => { at = 0; draw(); });
  inp.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); at = (at + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % Math.max(hits.length, 1); draw();
      list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") { e.preventDefault(); pick(at); }
  });
  list.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) pick(+b.dataset.i); });
  draw(); setTimeout(() => inp.focus(), 30);
}

let deferred = null;
export function mountTools(H) {
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openFinder(H); }
  });
  const meta = document.querySelector(".head-meta");
  if (meta && !document.getElementById("qf-btn")) {
    const b = document.createElement("button");
    b.type = "button"; b.id = "qf-btn"; b.className = "btn sm ghost icon"; b.title = AR() ? "بحث سريع (Ctrl K)" : "Quick find (Ctrl K)";
    b.setAttribute("aria-label", b.title); b.innerHTML = H.icon("search");
    b.onclick = () => openFinder(H); meta.prepend(b);
  }
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferred = e;
    if (document.getElementById("inst-btn") || !meta) return;
    const b = document.createElement("button");
    b.type = "button"; b.id = "inst-btn"; b.className = "btn sm ghost"; b.textContent = t().install;
    b.onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; b.remove(); };
    meta.prepend(b);
  });
}

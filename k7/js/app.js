// 67 Stock — the app shell: data loading, routing, header, dock, and the pages that are small enough to live here.
// Larger pages load on demand through lazy(); folders: core/ (shell services), data/ (generated data),
// stock/ (stock, cards, alerts), finance/ (ledger, budget, audit), reports/ (nightly, halls, uploads).
// With window.CARD_DOOR set (the barcode door build) it renders a single product card and nothing else.
import * as store from "./core/store.js?v=94";
import { isOpen, unlock } from "./core/lock.js?v=94";
import { icon } from "./core/icons.js?v=94";
import { tone } from "./core/chart-theme.js?v=94";
import { LOCATIONS, CATEGORIES, UNITS } from "./core/store.js?v=94";
import { SEED_DATE } from "./data/seed-data.js?v=94";
import { openProductCard, openScanner, requirePin, pinUnlocked, applyCountToSheet, downloadSheet, idFromCode, mountLabelSheet, mountProductPage, exportLabelsPdf } from "./stock/stock-card.js?v=94";
import { soldOf, moveOf, SALES_FROM, SALES_TO } from "./data/sales-data.js?v=94";
import { usageOf } from "./stock/consumption.js?v=94";
import { AR as NAMES_AR } from "./core/names-ar.js?v=94";
import { stockAlerts, renderAlerts } from "./stock/stock-alerts.js?v=94";
import { mountClock } from "./core/clock.js?v=94";
// Heavy sections load only when opened, so the first paint (and every scan) stays light.
const lazy = path => { let p; const f = () => (p ??= import(path).then(m => (f.done = m))); return f; };
const exportCount = lazy("./stock/export-count.js?v=94");
const financeView = lazy("./finance/finance-view.js?v=94");
const unaizahView = lazy("./finance/unaizah-view.js?v=94");
const syncAdmin = lazy("./reports/sync-admin.js?v=94");
const toolsMod = lazy("./core/tools.js?v=94");
const intelMod = lazy("./stock/stock-intel.js?v=94");
const menuMod = lazy("./stock/menu-lab.js?v=94"), yieldMod = lazy("./stock/analytics.js?v=94");
const labMod = lazy("./stock/stock-lab.js?v=94");
const showMod = lazy("./stock/showcase.js?v=94");
const p360Mod = lazy("./stock/product-360.js?v=94");
// GitHub libraries: krisk/Fuse (typo-tolerant search) · formkit/auto-animate (list motion) · kamranahmedse/driver.js (tour, in tools.js)
const fuseMod = lazy("../vendor/fuse.min.mjs");
const aaMod = lazy("../vendor/auto-animate.mjs");
let FuseC = null, fuseIdx = null, fuseFor = null;
if (!window.CARD_DOOR) fuseMod().then(m => { FuseC = m.default; if (ui.route === "products" && ui.q) renderResults(); }).catch(() => {});
// product ids matching a search, typos and Arabic names included; null until Fuse has loaded
function fuzzyIds(q) {
  if (!FuseC || !q.trim()) return null;
  if (fuseFor !== data.products) {
    fuseIdx = new FuseC(data.products.map(p => ({ id: p.id, name: p.name, sku: p.sku || "", code: p.code || "", ar: NAMES_AR[p.id] || "" })),
      { keys: [{ name: "name", weight: 3 }, "sku", "code", { name: "ar", weight: 2 }], threshold: .36, ignoreLocation: true });
    fuseFor = data.products;
  }
  return new Set(fuseIdx.search(q.trim()).map(r => r.item.id));
}
// swap a list's children, keeping unchanged nodes so auto-animate can slide them into place
function patchKids(parent, html) {
  const t = document.createElement("template"); t.innerHTML = html;
  const old = new Map([...parent.children].map(n => [n.dataset.key || n.dataset.edit, n]));
  parent.replaceChildren(...[...t.content.children].map(n => {
    const k = n.dataset.key || n.dataset.edit, o = k && old.get(k), html = n.outerHTML;
    if (o && o._html === html) return o;
    n._html = html; return n;
  }));
}

// Device: phone / tablet / desktop from width + touch; kept current on rotate and resize.
(function device() {
  const set = () => {
    const w = innerWidth, touch = matchMedia("(pointer: coarse)").matches, c = document.documentElement.classList;
    const kind = w <= 640 || (touch && w <= 820) ? "phone" : w <= 1100 ? "tablet" : "desktop";
    ["phone", "tablet", "desktop"].forEach(k => c.toggle("is-" + k, k === kind));
    c.toggle("is-touch", touch);
  };
  set(); addEventListener("resize", () => requestAnimationFrame(set), { passive: true });
})();
// The barcode door (the old address printed on product labels) runs this same app in card-only mode:
// it can open a product card and nothing else.
const CARD_DOOR = !!window.CARD_DOOR;
const isScanUrl = () => !!new URLSearchParams(location.search).get("p") || location.hash.startsWith("#p/");

// bump with each release so browsers fetch fresh photos instead of cached ones
const ASSET_V = "46";

// ── Helpers ──────────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfq = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const qty = n => nfq.format(Math.round((Number(n) || 0) * 100) / 100);
const sar = n => nf2.format(Number(n) || 0);
const total = p => LOCATIONS.reduce((a, l) => a + (Number(p.stock?.[l.id]) || 0), 0);
const value = (p, loc) => (loc ? Number(p.stock?.[loc]) || 0 : total(p)) * (Number(p.rate) || 0);
const catName = id => CATEGORIES.find(c => c.id === id)?.name || "Other";
const loc = id => LOCATIONS.find(l => l.id === id) || { name: id, short: id, code: "—" };
const initials = p => (p.name || "?").replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const when = iso => { try { return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };
const ago = iso => {
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return "just now"; if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`; return when(iso);
};
const src = img => String(img).startsWith("assets/") ? `${img}?v=${ASSET_V}` : img;
const ph = (p, cls) => `<div class="${cls} ph" aria-hidden="true">${esc(initials(p))}</div>`;
// a photo that fails to load falls back to the initials tile instead of a broken icon
const pic = (p, cls) => p.image
  ? `<img class="${cls}" src="${esc(src(p.image))}" alt="" loading="lazy" data-ph="${esc(initials(p))}" onerror="this.outerHTML='<div class=&quot;'+this.className+' ph&quot; aria-hidden=&quot;true&quot;>'+this.dataset.ph+'</div>'">`
  : ph(p, cls);

// Stock level against the product's full level (par)
function level(p, amount = total(p)) {
  const par = Number(p.par) || 0;
  if (!par) return { par: 0, pct: 0, left: amount, state: "unset" };
  const pct = amount / par;
  const state = amount <= 0 ? "empty" : pct < .25 ? "crit" : pct < .5 ? "low" : pct > 1.001 ? "over" : "ok";
  return { par, pct, left: amount, state };
}
const tank = (lv, cls = "") => `<span class="tank ${cls} s-${lv.state}" style="--lv:${Math.min(Math.max(lv.pct, 0), 1).toFixed(3)}" aria-hidden="true"><i class="liquid"></i></span>`;
const pctText = lv => lv.state === "unset" ? "—" : `${Math.round(lv.pct * 100)}%`;
const lsGet = (k, d) => { try { const v = localStorage.getItem("noir-ui2:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem("noir-ui2:" + k, JSON.stringify(v)); } catch {} };
const splitMoney = n => { const [a, b] = sar(n).split("."); return `${a}<span class="dec">.${b}</span>`; };

// icons: Lucide (core/icons.js)

const ROUTES = [
  { id: "dashboard", label: "Overview", kicker: "Treasury", title: 'Stock, <span class="voice">at a glance</span>' },
  { id: "products", label: "Stock", kicker: "Stock", title: 'The <span class="voice">stock</span>' },
  { id: "count", label: "Count", kicker: "Stocktake", title: 'Count <span class="voice">the room</span>' },
  { id: "yield", label: "Yield", kicker: "Analytics", title: 'What stock <span class="voice">can sell</span>' },
  { id: "history", label: "Ledger", kicker: "History", title: 'Count <span class="voice">ledger</span>' },
  { id: "finance", label: "Budget", kicker: "Finance", title: 'Branch <span class="voice">network</span>' },
  { id: "profit", label: "Profit", kicker: "Finance", title: 'Product <span class="voice">profit</span>' },
  { id: "unaizah", label: "Unaizah", kicker: "Unaizah", title: 'Unaizah <span class="voice">treasury</span>' },
  { id: "halls", label: "Halls", kicker: "Auditoriums", title: 'The <span class="voice">auditoriums</span>' },
  { id: "nightly", label: "Nightly", kicker: "Reports", title: 'Nightly <span class="voice">reports</span>' },
  { id: "safety", label: "Safety", kicker: "Safety", title: 'Safety <span class="voice">&amp; maintenance</span>' },
  { id: "petty", label: "Petty cash", kicker: "Expenses", title: 'Petty <span class="voice">cash</span>' },
  { id: "links", label: "Links", kicker: "Systems", title: 'Quick <span class="voice">links</span>' },
  { id: "alerts", label: "Alerts", kicker: "Stock", title: 'Stock <span class="voice">alerts</span>' },
  { id: "settings", label: "Settings", kicker: "Node", title: 'Sync <span class="voice">&amp; backup</span>' }
];
const TITLE_AR = {
  dashboard: ["الخزينة", 'المخزون <span class="voice">بنظرة</span>'], products: ["المخزون", 'قائمة <span class="voice">الستوك</span>'],
  count: ["الجرد", 'جرد <span class="voice">الموقع</span>'], yield: ["التحليل", 'ما يمكن <span class="voice">بيعه</span>'],
  history: ["السجل", 'سجل <span class="voice">الجرد</span>'], finance: ["المالية", 'ميزانية <span class="voice">الفروع</span>'], profit: ["المالية", 'ربحية <span class="voice">المنتجات</span>'], safety: ["السلامة", 'السلامة <span class="voice">والصيانة</span>'],
  unaizah: ["عنيزة", 'خزينة <span class="voice">عنيزة</span>'], halls: ["القاعات", 'القاعات <span class="voice">والمقاعد</span>'], nightly: ["التقارير", 'التقارير <span class="voice">الليلية</span>'], alerts: ["المخزون", 'تنبيهات <span class="voice">المخزون</span>'], petty: ["المصروفات", 'بيتي <span class="voice">كاش</span>'], links: ["الأنظمة", 'روابط <span class="voice">سريعة</span>'], settings: ["العقدة", 'المزامنة <span class="voice">والنسخ</span>']
};
const CAT_COLORS = ["#5b7bff", "#4c6bff", "#edf1f8", "#8c95a8", "#7f95ff", "#33427a", "#c9d4e6", "#7c8599", "#ffffff", "#a3adbf", "#26305a"];

// ── State ────────────────────────────────────────────────────
const ui = {
  route: ROUTES.some(r => r.id === location.hash.slice(1)) ? location.hash.slice(1) : lsGet("route", "dashboard"),
  q: "", cat: lsGet("cat", "all"), loc: lsGet("loc", "all"), sort: lsGet("sort", "cat"), view: lsGet("showIntro", false) ? lsGet("view", "show") : (lsSet("showIntro", true), lsSet("labIntro", true), lsSet("view", "show"), "show"),
  session: null, countQ: "", countOnlyStock: lsGet("countOnlyStock", true), countCat: "all", setupLoc: "mini"
};
// Lemon and mint go into mocktails (slush glass), not hot drinks.
const CAT_FIX = { lemon: "slush", mint: "slush" };
const fixCats = snap => ({ ...snap, products: (snap.products || []).map(p => CAT_FIX[p.id] && p.category !== CAT_FIX[p.id] ? { ...p, category: CAT_FIX[p.id] } : p) });
let data = fixCats(store.snapshot());
const tokenNo = id => { const i = data.products.findIndex(p => p.id === id); return "#" + String(i + 1).padStart(3, "0"); };

// ── Toast / Modal ────────────────────────────────────────────
function toast(msg, err = false) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : ""); t.textContent = msg;
  $("#toasts").append(t); setTimeout(() => t.remove(), 3200);
}
function openModal(html, cls = "") {
  const root = $("#modal-root");
  root.innerHTML = `<div class="veil"><div class="sheet ${cls}" role="dialog" aria-modal="true">
    <button class="btn icon ghost x" data-x aria-label="Close">${icon("x")}</button>${html}</div></div>`;
  const veil = root.firstElementChild;
  veil.addEventListener("mousedown", e => { if (e.target === veil) closeModal(); });
  veil.querySelector("[data-x]").onclick = closeModal;
  setTimeout(() => veil.querySelector(".sheet input, .sheet select, .sheet [data-ok]")?.focus(), 40);
  return veil.firstElementChild;
}
function closeModal() { $("#modal-root").innerHTML = ""; }
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("#modal-root").innerHTML) closeModal();
  if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { const s = $("#q, #cq"); if (s) { e.preventDefault(); s.focus(); } }
});
function confirmBox(title, text, okLabel = "Confirm", danger = false) {
  return new Promise(resolve => {
    const m = openModal(`<h2>${title}</h2><p class="lede">${esc(text)}</p>
      <div class="actions"><div class="end"><button class="btn ghost" data-no>Cancel</button>
      <button class="btn ${danger ? "warn" : "hot"}" data-ok>${esc(okLabel)}</button></div></div>`, "narrow");
    m.querySelector("[data-ok]").onclick = () => { closeModal(); resolve(true); };
    m.querySelector("[data-no]").onclick = () => { closeModal(); resolve(false); };
    m.querySelector("[data-x]").addEventListener("click", () => resolve(false));
  });
}
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const csv = rows => "﻿" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

// ── Chrome ───────────────────────────────────────────────────
const LANG_KEY = "noir-lang";
const NAV_AR = { dashboard: "نظرة", products: "الستوك", count: "الجرد", yield: "التحليل", history: "السجل", finance: "الميزانية", profit: "الربحية", safety: "السلامة", unaizah: "عنيزة", halls: "القاعات", nightly: "الليلية", petty: "بيتي كاش", links: "روابط", alerts: "التنبيهات", settings: "الإعدادات" };
function siteLang() { return sessionStorage.getItem(LANG_KEY) || "en"; }
function renderNav() {
  $("#nav").innerHTML = ROUTES.filter(r => r.id !== "settings" && r.id !== "alerts").map(r => `<button data-route="${r.id}" ${ui.route === r.id ? 'aria-current="page"' : ""} aria-label="${siteLang()==="ar" ? (NAV_AR[r.id] || r.label) : r.label}">${icon(r.id)}<span>${siteLang()==="ar" ? (NAV_AR[r.id] || r.label) : r.label}</span></button>`).join("");
}
function renderNet() {
  const live = data.mode === "firebase", el = $("#net");
  el.classList.toggle("live", live);
  el.querySelector("span").textContent = live ? "Firebase · synced" : data.mode === "connecting" ? "Connecting…" : "Local node · this browser";
  el.title = live ? "Data is stored in Firestore and syncs live" : "Data is stored in this browser only. Add your Firebase config to sync.";
}
// stock reports: compare with the stock on file and save the difference (Product 360 shows it as history)
let stockHist = store.localDocs("stockHistory");
const histMod = lazy("./stock/stock-history.js?v=94");
async function stockReport(found, source, fromRequired) {
  const m = await histMod();
  const entry = await m.applyStockReport(found, { data: () => data, saveProduct: store.saveProduct, putDoc: store.putDoc, log: store.log }, source);
  stockHist = [...stockHist.filter(e => e.id !== entry.id), entry];
  localStorage.setItem("noir-sync-at", new Date().toISOString());
  const sold = entry.net.filter(n => n.delta < 0), added = entry.net.filter(n => n.delta > 0), ar = siteLang() === "ar";
  toast(ar ? `تحديث ${entry.products} منتج · ${sold.length} انباع · ${added.length} انضاف` : `${entry.products} products · ${sold.length} sold · ${added.length} added`);
  renderBell();
  if (!fromRequired) markUpload("stock", source).catch(() => {});
  return entry;
}
window.__stockReport = stockReport;
// header bell: how many items need action today (critical + act today)
// White / Night switch in the header (the choice is remembered on this device)
function renderThemeBtn() {
  const meta = document.querySelector(".head-meta"); if (!meta || document.getElementById("theme-btn")) return;
  const b = document.createElement("button"); b.type = "button"; b.id = "theme-btn"; b.className = "btn sm ghost icon theme-btn";
  b.innerHTML = '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>';
  const label = () => { const dark = document.documentElement.dataset.theme === "dark", ar = siteLang() === "ar";
    b.title = dark ? (ar ? "الوضع الأبيض" : "White mode") : (ar ? "الوضع الليلي" : "Night mode"); b.setAttribute("aria-label", b.title); };
  b.onclick = () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t; try { localStorage.setItem("noir-theme", t); } catch {} label(); render(); };
  label(); meta.insertBefore(b, document.getElementById("bell-btn"));
}
function renderBell() {
  const b = $("#bell-btn"); if (!b || !data.products?.length) return;
  const A = stockAlerts(data.products).counts, n = A.critical + A.warn;
  b.querySelector("sup").textContent = n > 99 ? "99+" : n;
  b.classList.toggle("ring", A.critical > 0); b.classList.toggle("quiet", !n);
  b.title = siteLang() === "ar" ? `تنبيهات المخزون · ${A.critical} حرج · ${A.warn} اليوم` : `Stock alerts · ${A.critical} critical · ${A.warn} today`;
}
document.addEventListener("click", e => {
  const r = e.target.closest("[data-route]"); if (r) return go(r.dataset.route);
  const ed = e.target.closest("[data-edit]");
  if (ed) { const p = data.products.find(x => x.id === ed.dataset.edit); if (p) p360Mod().then(m => m.open360(p, p360Helpers())).catch(() => openProductCard(p, cardHelpers())); return; }
  const sc = e.target.closest("[data-startcount]"); if (sc) { ui.setupLoc = sc.dataset.startcount; go("count"); }
});
function go(route) {
  if (CARD_DOOR) return;
  if (route === "settings" && ui.route !== "settings") import("./core/skylr.js?v=94").then(m => m.playSkylr()).catch(() => {});
  ui.route = route; lsSet("route", route);
  try { history.replaceState(null, "", "#" + route); } catch {}
  render(); window.scrollTo(0, 0);
}
function render() {
  if (CARD_DOOR) return renderDoor();
  if (!isScanUrl()) lastCard = null;
  document.body.classList.remove("card-only", "watch-only");
  const qid = new URLSearchParams(location.search).get("p");
  if (qid && data.products?.length) {
    const p = data.products.find(x => x.id === qid);
    if (p) { history.replaceState(null, "", "#p/" + p.id); return viewScanProduct(p); }
  }
  const hash = location.hash.slice(1);
  if (hash === "labels" && data.products?.length) return viewLabels();
  if (hash.startsWith("p/") && data.products?.length) {
    const p = data.products.find(x => x.id === hash.slice(2));
    if (p) return viewScanProduct(p);
  }
  renderNav(); renderNet(); renderBell(); renderThemeBtn();
  const langBtn = document.getElementById("lang-btn");
  if (langBtn && !langBtn.dataset.bound) {
    langBtn.dataset.bound = "1";
    langBtn.textContent = siteLang() === "ar" ? "English" : "عربي";
    document.documentElement.lang = siteLang();
    langBtn.onclick = () => { sessionStorage.setItem(LANG_KEY, siteLang() === "ar" ? "en" : "ar"); location.reload(); };
  }
  const r = ROUTES.find(x => x.id === ui.route) || ROUTES[0];
  const arTitle = siteLang() === "ar" && TITLE_AR[r.id];
  $("#kicker").textContent = arTitle ? arTitle[0] : r.kicker;
  $("#page-title").innerHTML = arTitle ? arTitle[1] : r.title;
  $("#title-actions").innerHTML = "";
  ({ dashboard: viewDashboard, products: viewProducts, count: viewCount, yield: viewYield, history: viewHistory, finance: viewFinance, profit: viewProfit, safety: viewSafety, unaizah: viewUnaizah, halls: viewHalls, nightly: viewNightly, petty: viewPetty, links: viewLinks, alerts: viewAlerts, settings: viewSettings })[r.id]();
  if (ui.lastEnter !== r.id) { ui.lastEnter = r.id; motionMod().then(m => m.enter($("#view"), $("#page-title"))).catch(() => {}); } // only on a page change, not every re-render
}

const motionMod = lazy("./core/motion.js?v=94");

// ── Overview ─────────────────────────────────────────────────
function viewDashboard() {
  const P = data.products;
  const grand = P.reduce((a, p) => a + value(p), 0);
  const units = P.reduce((a, p) => a + total(p), 0);
  const stocked = P.filter(p => total(p) > 0).length;
  const byLoc = LOCATIONS.map(l => ({ ...l, v: P.reduce((a, p) => a + value(p, l.id), 0), n: P.filter(p => Number(p.stock?.[l.id]) > 0).length }));
  const byCat = CATEGORIES.map((c, i) => ({ ...c, color: tone(CAT_COLORS[i % CAT_COLORS.length]), v: P.filter(p => p.category === c.id).reduce((a, p) => a + value(p), 0) }))
    .filter(c => c.v > 0.01).sort((a, b) => b.v - a.v);
  const top = [...P].sort((a, b) => value(b) - value(a)).slice(0, 7);
  const out = P.filter(p => Number(p.rate) > 0 && total(p) === 0);
  const low = P.filter(p => total(p) > 0 && ((Number(p.min) > 0 && total(p) <= Number(p.min)) || ["low", "crit"].includes(level(p).state)))
    .sort((a, b) => level(a).pct - level(b).pct);
  const drafts = data.sessions.filter(s => s.status === "draft");
  // what moved most this year, in riyal: direct sales, or sales × recipe for ingredients
  const movers = P.map(p => { const u = usageOf(p, P), mv = moveOf(p.id), q = u ? u.total : mv && mv.shared ? 0 : soldOf(p.id);
    return { p, q, u: UNITS[p.unit] || "", v: q * (Number(p.rate) || 0), est: !!u && !u.exact }; }).filter(m => m.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);

  $("#title-actions").innerHTML = `<button class="btn" id="dash-reorder">Reorder list</button><button class="btn hot" data-route="count">${icon("count")}Start a count</button>`;
  $("#dash-reorder").onclick = () => toolsMod().then(m => m.openReorder(toolHelpers()));

  // orbit rings: one ring per location, radius shrinks inward
  const cols = ["#5b7bff", "#edf1f8", "#8c95a8"].map(tone);
  const rings = byLoc.map((l, i) => {
    const R = 112 - i * 22, C = 2 * Math.PI * R, share = grand ? l.v / grand : 0;
    return `<circle cx="130" cy="130" r="${R}" fill="none" style="stroke:rgba(var(--tint),.08)" stroke-width="12"/>
      <circle cx="130" cy="130" r="${R}" fill="none" stroke="${cols[i]}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${Math.max(share * C, 2)} ${C}" transform="rotate(-90 130 130)" style="filter:drop-shadow(0 0 6px ${cols[i]})"/>
      <text x="122" y="${130 - R + 3.5}" text-anchor="end" fill="${cols[i]}" font-family="Geist Mono, monospace" font-size="9">${l.code} ${Math.round(share * 100)}%</text>`;
  }).join("");

  const AL = stockAlerts(P), ar = siteLang() === "ar", needs = AL.items.filter(a => a.level === "critical" || a.level === "warn").slice(0, 4);
  // shift brief: the four things a supervisor checks at the start of a shift, each a door to its page
  const expd = AL.items.filter(a => a.expiry.some(e => e.kind === "expired")).length, expSoon = AL.items.filter(a => a.expiry.some(e => e.kind === "soon" || e.kind === "month")).length;
  const T2 = (en, a) => ar ? a : en, today = new Date();
  const alertStrip = `<section class="brief" aria-labelledby="brief-h">
    <header class="brief-h"><h2 id="brief-h">${T2("Shift brief", "موجز الوردية")}</h2><span class="data">${today.toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "long", day: "2-digit", month: "short" })}</span></header>
    <div class="brief-grid">
      <button class="bf ${AL.counts.critical ? "t-bad" : AL.counts.warn ? "t-warn" : "t-ok"}" data-route="alerts">
        <span class="bf-ic">${icon("alerts")}</span><span class="bf-k">${T2("Stock", "المخزون")}</span>
        <b class="data">${AL.counts.critical}</b><span class="bf-l">${T2("critical", "حرج")} · ${AL.counts.warn} ${T2("today", "اليوم")} · ${AL.moves.length} ${T2("moves", "نقلات")}</span>
        <span class="bf-list">${needs.slice(0, 3).map(a => `<em>${esc((ar ? NAMES_AR[a.p.id] : null) || a.p.name)}</em>`).join("") || `<em>${T2("Everything is where it should be", "كل الأصناف بمكانها الصح")}</em>`}</span></button>
      <button class="bf ${expd ? "t-bad" : expSoon ? "t-warn" : "t-ok"}" data-route="alerts">
        <span class="bf-ic">${icon("history")}</span><span class="bf-k">${T2("Expiry", "الصلاحية")}</span>
        <b class="data">${expd}</b><span class="bf-l">${T2("items with an expired group", "أصناف فيها مجموعة منتهية")}</span>
        <span class="bf-list"><em>${expSoon} ${T2("expiring within a month", "تنتهي خلال شهر")}</em></span></button>
      <button class="bf t-wait" data-route="safety" id="bf-safety">
        <span class="bf-ic">${icon("safety")}</span><span class="bf-k">${T2("Safety", "السلامة")}</span><b class="data">…</b><span class="bf-l"></span><span class="bf-list"></span></button>
      <button class="bf t-wait" data-route="settings" id="bf-reports">
        <span class="bf-ic">${icon("settings")}</span><span class="bf-k">${T2("System reports", "تقارير النظام")}</span><b class="data">…</b><span class="bf-l"></span><span class="bf-list"></span></button>
    </div></section>
    <section class="fav" id="fav" hidden></section>`;
  $("#view").innerHTML = `
  <div class="dash">
    ${alertStrip}
    <section class="hero">
      <div class="hero-grid">
        <div>
          <div class="tag">Total inventory value · net of VAT</div>
          <div class="hero-num">${splitMoney(grand)}<span class="cur">SAR</span></div>
          <div class="hero-facts">
            <span><b>${nf0.format(units)}</b>units on hand</span>
            <span><b>${stocked}</b>of ${P.length} SKUs in stock</span>
            <span><b>${data.sessions.filter(s => s.status === "committed").length}</b>counts committed</span>
          </div>
        </div>
        <div class="orbit">
          <svg viewBox="0 0 260 260" role="img" aria-label="Value share by location">${rings}</svg>
          <div class="orbit-center"><div><div class="voice">three vaults</div><div class="data">${byLoc.length} locations</div></div></div>
        </div>
      </div>
    </section>

    <div class="vaults">
      ${byLoc.map((l, i) => `
      <article class="slab vault">
        <span class="code" aria-hidden="true">${l.code}</span>
        <h3>${l.name}</h3>
        <div class="amt">${sar(l.v)}<small>SAR</small></div>
        <div class="meter"><i style="width:${grand ? (l.v / grand * 100).toFixed(1) : 0}%;background:${cols[i]}"></i></div>
        <div class="vault-foot"><span class="data">${l.n} SKUs stocked</span><button class="btn sm ghost" data-startcount="${l.id}">Count ${l.short}</button></div>
      </article>`).join("")}
    </div>

    <section class="slab span-7">
      <div class="slab-h"><h2>Value by category</h2><span class="voice">where the money sits</span></div>
      <div class="spectrum" role="img" aria-label="Category value distribution">
        ${byCat.map(c => `<i style="flex:${c.v};background:${c.color}" title="${esc(c.name)} · ${sar(c.v)} SAR"></i>`).join("")}
      </div>
      <div class="legend">
        ${byCat.map(c => `<div class="lg"><i style="background:${c.color}"></i><span>${esc(c.name)}</span><span class="data">${sar(c.v)}</span></div>`).join("")}
      </div>
    </section>

    <section class="slab span-5">
      <div class="slab-h"><h2>Top holdings</h2><button class="btn sm ghost" data-route="products">View all</button></div>
      <div class="board">
        ${top.map((p, i) => `<button class="rank" data-edit="${esc(p.id)}">
          <span class="n">${i + 1}</span>${pic(p, "pic")}
          <span style="min-width:0"><span class="nm" style="display:block">${esc(p.name)}</span><span class="sub">${qty(total(p))} ${esc(UNITS[p.unit] || "")}</span></span>
          <span class="v">${sar(value(p))}</span></button>`).join("")}
      </div>
    </section>

    <section class="slab span-5">
      <div class="slab-h"><h2>Signals</h2><span class="tag">${out.length + low.length + drafts.length} open</span></div>
      <div class="alerts">
        ${drafts.map(s => `<div class="alert amber"><span>Unfinished count · ${esc(loc(s.location).name)}</span><button class="btn sm" data-route="count">Resume</button></div>`).join("")}
        ${low.map(p => { const lv = level(p); return `<div class="alert amber"><span>${esc(p.name)} is running low</span><span class="data">${lv.state === "unset" ? `${qty(total(p))} / ${qty(p.min)}` : `${pctText(lv)} · ${qty(lv.left)} left`}</span></div>`; }).join("")}
        ${out.slice(0, 8).map(p => `<div class="alert"><span>${esc(p.name)}</span><span class="data">OUT</span></div>`).join("")}
        ${!drafts.length && !low.length && !out.length ? `<p class="empty"><span class="voice">All quiet.</span> Set a minimum level on any product to get low-stock signals here.</p>` : ""}
      </div>
    </section>

    <section class="slab span-7">
      <div class="slab-h"><h2>Activity chain</h2><span class="tag">latest first</span></div>
      <div class="chain">
        ${data.activity.slice(0, 20).map((a, i, arr) => `<div class="block">
          <div class="no"><span>BLOCK ${String(arr.length - i).padStart(4, "0")}</span><i class="kind ${esc(a.type)}"></i></div>
          <div class="txt">${esc(a.text)}</div>
          <div class="hash">${esc(a.id)}</div>
          <div class="no"><span>${ago(a.at)}</span></div></div>`).join("") || '<p class="empty">No activity yet.</p>'}
      </div>
    </section>

    <section class="slab span-12 movers">
      <div class="slab-h"><h2>Top movers</h2><span class="tag">${SALES_FROM} → ${SALES_TO}</span></div>
      <div class="mv-list">${movers.map((m, i) => `<button class="mv" data-edit="${esc(m.p.id)}" style="--w:${(m.v / (movers[0]?.v || 1) * 100).toFixed(1)}%">
        <span class="mv-n">${i + 1}</span>${pic(m.p, "pic")}<span class="mv-nm"><b>${esc(m.p.name)}</b><small>${m.est ? "≈ " : ""}${qty(m.q)} ${esc(m.u)}</small></span><span class="mv-v">${sar(m.v)}</span><i></i></button>`).join("")}</div>
    </section>
  </div>`;
  fillBrief(ar);
}

// ── Collection ───────────────────────────────────────────────
function filtered() {
  const q = ui.q.trim().toLowerCase(), order = CATEGORIES.map(c => c.id), fz = fuzzyIds(q);
  const L = data.products.filter(p =>
    (ui.cat === "all" || p.category === ui.cat) &&
    (ui.loc === "all" || Number(p.stock?.[ui.loc]) > 0) &&
    (!q || (fz ? fz.has(p.id) : [p.name, p.sku, p.code, NAMES_AR[p.id]].some(s => String(s || "").toLowerCase().includes(q)))));
  const S = {
    cat: (a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    value: (a, b) => value(b) - value(a),
    qty: (a, b) => total(b) - total(a),
    recent: (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")
  };
  return L.sort(S[ui.sort] || S.cat);
}

function viewProducts() {
  $("#title-actions").innerHTML = `<button class="btn hot" id="reorder">Reorder list</button><button class="btn" id="scan-code">Scan</button><button class="btn" id="print-codes">Print barcodes</button><button class="btn ghost" id="dl-sheet">Excel</button><button class="btn ghost" id="dl-csv">CSV</button>`;
  $("#scan-code").onclick = () => openScanner(cardHelpers(), id => { const p = data.products.find(x => x.id === idFromCode(id)); if (!p) return toast("No product for that code", true); location.hash = "p/" + p.id; });
  $("#print-codes").onclick = () => { location.hash = "labels"; };
  $("#reorder").onclick = () => toolsMod().then(m => m.openReorder(toolHelpers()));
  $("#dl-sheet").onclick = () => downloadSheet().then(() => toast("Expiry sheet downloaded")).catch(e => toast(e.message, true));
  $("#dl-csv").onclick = () => exportLedger();
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, data.products.filter(p => p.category === c.id).length]));
  $("#view").innerHTML = `
    <div class="controls">
      <div class="seek">${icon("search")}<input id="q" type="search" placeholder="Search name, report name or code" value="${esc(ui.q)}" aria-label="Search products"><kbd>/</kbd></div>
      <select class="select" id="loc" aria-label="Location"><option value="all">All locations</option>
        ${LOCATIONS.map(l => `<option value="${l.id}" ${ui.loc === l.id ? "selected" : ""}>${l.name}</option>`).join("")}</select>
      <select class="select" id="sort" aria-label="Sort">
        ${[["cat", "By category"], ["value", "Highest value"], ["qty", "Highest quantity"], ["name", "A → Z"], ["recent", "Recently edited"]].map(([v, t]) => `<option value="${v}" ${ui.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select>
      <div class="seg" role="group" aria-label="View">
        <button data-view="show" aria-pressed="${ui.view === "show"}">${icon("stage")}Showcase</button>
        <button data-view="lab" aria-pressed="${ui.view === "lab"}">${icon("finance")}Lab</button>
        <button data-view="grid" aria-pressed="${ui.view === "grid"}">${icon("grid")}Cards</button>
        <button data-view="list" aria-pressed="${ui.view === "list"}">${icon("list")}Ledger</button>
        <button data-view="intel" aria-pressed="${ui.view === "intel"}">${icon("yield")}Analysis</button>
      </div>
    </div>
    <div class="cats" role="group" aria-label="Categories">
      <button class="cat" data-cat="all" aria-pressed="${ui.cat === "all"}">Everything<sup>${data.products.length}</sup></button>
      ${CATEGORIES.filter(c => counts[c.id]).map(c => `<button class="cat" data-cat="${c.id}" aria-pressed="${ui.cat === c.id}">${c.name}<sup>${counts[c.id]}</sup></button>`).join("")}
    </div>
    <div id="results"></div>`;
  renderResults();
  $("#q").addEventListener("input", e => { ui.q = e.target.value; renderResults(); });
  $("#loc").addEventListener("change", e => { ui.loc = e.target.value; lsSet("loc", ui.loc); renderResults(); });
  $("#sort").addEventListener("change", e => { ui.sort = e.target.value; lsSet("sort", ui.sort); renderResults(); });
  $$("[data-view]").forEach(b => b.onclick = () => { ui.view = b.dataset.view; lsSet("view", ui.view); $$("[data-view]").forEach(x => x.setAttribute("aria-pressed", x === b)); renderResults(); });
  $$(".cat").forEach(c => c.onclick = () => { ui.cat = c.dataset.cat; lsSet("cat", ui.cat); $$(".cat").forEach(x => x.setAttribute("aria-pressed", x === c)); renderResults(); });
}

function renderResults() {
  if (ui.view === "show") {
    const L = filtered();
    if (!$("#show")) $("#results").innerHTML = `<div id="show"></div>`;
    showMod().then(m => { const h = $("#show"); if (h) m.renderShowcase(h, { ...toolHelpers(), level, catName, openProduct: id => { const p = data.products.find(x => x.id === id); if (p) p360Mod().then(m => m.open360(p, p360Helpers())).catch(() => openProductCard(p, cardHelpers())); } }, L); }).catch(e => toast(e.message, true));
    return;
  }
  if (ui.view === "lab") {
    const L = filtered();
    $("#results").innerHTML = `<div id="lab"></div>`;
    labMod().then(m => { const h = $("#lab"); if (h) m.renderStockLab(h, { ...toolHelpers(), CATEGORIES, topRank }, L); }).catch(e => toast(e.message, true));
    return;
  }
  if (ui.view === "intel") {
    $("#results").innerHTML = `<div id="intel" class="intel-host"><p class="empty">…</p></div>`;
    intelMod().then(m => { const h = $("#intel"); if (h) m.renderIntel(h, toolHelpers()); }).catch(e => toast(e.message, true));
    return;
  }
  const L = filtered();
  // group headers when the list is sorted by category
  const grouped = ui.sort === "cat";
  const catHead = (p, i, arr) => grouped && (i === 0 || arr[i - 1].category !== p.category) ? (() => {
    const g = arr.filter(x => x.category === p.category);
    return { name: catName(p.category), n: g.length, v: g.reduce((a, x) => a + (ui.loc === "all" ? value(x) : value(x, ui.loc)), 0) };
  })() : null;
  const v = L.reduce((a, p) => a + (ui.loc === "all" ? value(p) : value(p, ui.loc)), 0);
  const head = `<p class="count-line">${L.length} items · ${sar(v)} SAR${ui.loc !== "all" ? " · " + esc(loc(ui.loc).name) : ""}</p>`;
  if (ui.view === "list") {
    $("#results").innerHTML = head + `<div class="ledger-wrap"><table class="ledger"><thead><tr>
      <th>Token</th><th>Product</th><th>Category</th>${LOCATIONS.map(l => `<th class="r">${l.short}</th>`).join("")}<th class="r">Total</th><th>Level</th><th class="r">Unit cost</th><th class="r">Value SAR</th></tr></thead>
      <tbody>${L.map((p, i, arr) => { const h = catHead(p, i, arr); return (h ? `<tr class="grp-row"><td colspan="${7 + LOCATIONS.length}"><b>${esc(h.name)}</b><span>${h.n} · ${sar(h.v)} SAR</span></td></tr>` : "") + `<tr data-edit="${esc(p.id)}">
        <td class="data" style="color:var(--muted)">${tokenNo(p.id)}</td>
        <td><div class="nm">${pic(p, "pic")}<div><b>${esc(p.name)}</b><span>${esc(p.sku || p.code || "—")}</span></div></div></td>
        <td>${esc(catName(p.category))}</td>
        ${LOCATIONS.map(l => `<td class="r data">${qty(p.stock?.[l.id] || 0)}</td>`).join("")}
        <td class="r data">${qty(total(p))} <span style="color:var(--muted)">${esc(UNITS[p.unit] || "")}</span></td>
        <td>${(lv => `<span class="lvbar s-${lv.state}"><i style="width:${Math.min(lv.pct, 1) * 100}%"></i></span><span class="data lvpct">${pctText(lv)}</span>`)(level(p))}</td>
        <td class="r data">${Number(p.rate) ? sar(p.rate) : "—"}</td>
        <td class="r data">${sar(value(p))}</td></tr>`; }).join("")}</tbody></table></div>`;
    return;
  }
  const kids = L.map((p, i, arr) => { const h = catHead(p, i, arr); return (h ? `<h3 class="coll-h" data-key="h-${esc(p.category)}"><b>${esc(h.name)}</b><span>${h.n} · ${sar(h.v)} SAR</span></h3>` : "") + token(p); }).join("");
  const coll = $("#results .collection");
  if (coll) { $("#results .count-line").outerHTML = head; patchKids(coll, kids || `<p class="empty" data-key="none">No match.</p>`); }
  else {
    $("#results").innerHTML = head + `<div class="collection">${kids}</div>`;
    [...$("#results .collection").children].forEach(n => { n._html = n.outerHTML; });
    aaMod().then(m => { const c = $("#results .collection"); if (c && !c.dataset.aa) { c.dataset.aa = "1"; m.default(c, { duration: 260 }); } }).catch(() => {});
  }
  bindTilt();
}

// top 6 sellers by units actually rung up (not linked or estimated items)
let topCache = null;
function topRank(id) {
  if (!topCache) topCache = data.products.filter(p => !moveOf(p.id) && soldOf(p.id) > 0).sort((a, b) => soldOf(b.id) - soldOf(a.id)).slice(0, 6).map(p => p.id);
  const i = topCache.indexOf(id); return i < 0 ? 0 : i + 1;
}
function token(p) {
  const t = total(p), lv = level(p);
  const low = (Number(p.min) > 0 && t <= p.min) || lv.state === "low" || lv.state === "crit";
  const state = t === 0 ? `<span class="token-state out">Out</span>` : low ? `<span class="token-state low">Low</span>` : "";
  const unit = esc(UNITS[p.unit] || "");
  const rank = topRank(p.id);
  return `<button class="token ${rank ? "top" : ""}" data-edit="${esc(p.id)}">
    <div class="token-frame">${pic(p, "token-img")}<span class="token-id">${tokenNo(p.id)}</span>${state}${tank(lv)}</div>
    ${rank ? `<span class="top-seller"><b>★</b>${siteLang() === "ar" ? "الأكثر مبيعاً" : "Top seller"} #${rank}</span>` : ""}
    <div class="token-body"><span class="token-cat">${esc(catName(p.category))}</span><h3>${esc(p.name)}</h3><span class="token-sku">${esc(p.sku || p.code || "not on report")}</span></div>
    <div class="level s-${lv.state}">${lv.state === "unset"
      ? `<span>Level</span><em>set a full level</em>`
      : `<span>Level</span><b class="data">${pctText(lv)}</b><em>${qty(lv.left)} of ${qty(lv.par)} ${unit} left</em>`}</div>
    <div class="alloc">
      <div class="alloc-bar" role="img" aria-label="Stock by location">${LOCATIONS.map(l => { const n = Number(p.stock?.[l.id]) || 0; return n > 0 ? `<i class="l-${l.id}" style="flex:${n}" title="${esc(l.name)} ${qty(n)}"></i>` : ""; }).join("") || `<i class="none"></i>`}</div>
      <div class="alloc-legend">${LOCATIONS.map(l => { const n = Number(p.stock?.[l.id]) || 0; return `<span class="l-${l.id} ${ui.loc === l.id ? "on" : ""} ${n ? "" : "zero"}"><i></i><em>${l.code}</em><b>${qty(n)}</b><small>${t ? Math.round(n / t * 100) : 0}%</small></span>`; }).join("")}</div>
    </div>
    <div class="token-foot"><span class="qty">${qty(t)} ${unit}</span><span class="val">${Number(p.rate || 0).toFixed(2)}<small>/${unit}</small></span></div>
    ${usageOf(p, data.products) ? (u => `<p class="token-sold">${siteLang() === "ar" ? "استهلاك" : "Used"} <b>${u.exact ? "" : "≈ "}${qty(u.total)}</b> ${esc(UNITS[p.unit] || "")}${u.exact ? "" : `<i>${siteLang() === "ar" ? "تقدير" : "est."}</i>`}</p>`)(usageOf(p, data.products)) : soldOf(p.id) ? (mv => { const ar = siteLang() === "ar";
      return `<p class="token-sold">${mv && mv.shared ? (ar ? "تحرك مع" : "Moved with") : (ar ? "مباع من بداية السنة" : "Sold this year")} <b>${qty(soldOf(p.id))}</b>${mv && mv.shared ? ` ${mv.unit[ar ? 1 : 0]}` : ""}${mv && !mv.shared ? `<i>${ar ? "مرتبط" : "linked"}</i>` : ""}</p>`; })(moveOf(p.id)) : ""}
  </button>`;
}

function bindTilt() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(hover: none)").matches) return;
  $$(".token:not([data-tilt])").forEach(el => {
    el.dataset.tilt = "1";
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(x - .5) * 12}deg`); el.style.setProperty("--rx", `${(.5 - y) * 12}deg`);
      el.style.setProperty("--mx", `${x * 100}%`); el.style.setProperty("--my", `${y * 100}%`);
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  });
}



// ── Count ────────────────────────────────────────────────────
function newSession(where, counter) {
  const system = {}, rates = {};
  data.products.forEach(p => { system[p.id] = Number(p.stock?.[where]) || 0; rates[p.id] = Number(p.rate) || 0; });
  return { id: store.txHash(), location: where, counter, status: "draft", createdAt: new Date().toISOString(), counts: {}, system, rates };
}

function viewCount() {
  if (ui.session) return viewRun();
  const drafts = data.sessions.filter(s => s.status === "draft");
  $("#view").innerHTML = `
    <div class="setup">
      <section class="slab">
        <div class="slab-h"><h2>New count</h2><span class="voice">pick a vault</span></div>
        <div class="gates" role="group" aria-label="Location">
          ${LOCATIONS.map(l => `<button class="gate" data-pick="${l.id}" aria-pressed="${ui.setupLoc === l.id}">
            <span class="code" aria-hidden="true">${l.code}</span><b>${l.name}</b><span>${data.products.filter(p => Number(p.stock?.[l.id]) > 0).length} SKUs on system</span></button>`).join("")}
        </div>
        <div class="fl" style="margin-bottom:16px"><label for="counter">Counted by</label><input class="input" id="counter" value="${esc(lsGet("counter", ""))}" placeholder="Your name"></div>
        <label class="check"><input type="checkbox" id="only" ${ui.countOnlyStock ? "checked" : ""}> Only list items the system has at this location</label>
        <button class="btn hot" id="start" style="width:100%">${icon("count")}Open count sheet</button>
      </section>
      <section class="slab">
        <div class="slab-h"><h2>Drafts</h2><span class="tag">${drafts.length} saved</span></div>
        <div class="drafts">
          ${drafts.map(s => `<div class="draft"><div><b>${esc(loc(s.location).name)}</b> <span style="color:var(--muted);font-size:13px">· ${esc(s.counter || "unnamed")} · ${Object.keys(s.counts || {}).length} counted</span><span class="data">${esc(s.id)}</span></div>
            <button class="btn sm" data-resume="${esc(s.id)}">Resume</button></div>`).join("") || '<p class="empty"><span class="voice">Nothing half-done.</span> Counts you save without committing wait here.</p>'}
        </div>
      </section>
    </div>`;
  $$("[data-pick]").forEach(b => b.onclick = () => { ui.setupLoc = b.dataset.pick; $$("[data-pick]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  $("#only").onchange = e => { ui.countOnlyStock = e.target.checked; lsSet("countOnlyStock", ui.countOnlyStock); };
  $("#start").onclick = () => { const c = $("#counter").value.trim(); lsSet("counter", c); ui.session = newSession(ui.setupLoc, c); ui.countQ = ""; ui.countCat = "all"; render(); };
  $$("[data-resume]").forEach(b => b.onclick = () => { ui.session = JSON.parse(JSON.stringify(data.sessions.find(s => s.id === b.dataset.resume))); render(); });
}

const inScope = (s, p) => !ui.countOnlyStock || (s.system?.[p.id] || 0) > 0 || s.counts[p.id] != null;
function runRows(s) {
  const q = ui.countQ.trim().toLowerCase(), order = CATEGORIES.map(c => c.id);
  return data.products.filter(p => inScope(s, p) && (ui.countCat === "all" || p.category === ui.countCat) &&
    (!q || [p.name, p.sku, p.code].some(x => String(x || "").toLowerCase().includes(q))))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
}
function stats(s) {
  const ids = Object.keys(s.counts || {}); let diff = 0, off = 0;
  ids.forEach(id => { const d = Number(s.counts[id]) - (s.system?.[id] || 0); diff += d * (s.rates?.[id] || 0); if (Math.abs(d) > 1e-9) off++; });
  return { counted: ids.length, diff, off, scope: data.products.filter(p => inScope(s, p)).length };
}
const delta = d => d == null ? `<span class="delta">—</span>` : Math.abs(d) < 1e-9 ? `<span class="delta eq">match</span>` : `<span class="delta ${d > 0 ? "up" : "dn"}">${d > 0 ? "+" : ""}${qty(d)}</span>`;

function viewRun() {
  const s = ui.session;
  $("#kicker").textContent = `Stocktake · ${loc(s.location).name}${s.counter ? " · " + s.counter : ""}`;
  $("#page-title").innerHTML = `${esc(loc(s.location).name)} <span class="voice">count</span>`;
  $("#title-actions").innerHTML = `<button class="btn ghost" id="leave">${icon("x")}Close sheet</button>`;
  const cats = CATEGORIES.filter(c => data.products.some(p => p.category === c.id && inScope(s, p)));
  $("#view").innerHTML = `
    <div class="run-head"><span class="pill draft">Draft</span><span class="hash-chip">${esc(s.id)}</span></div>
    <div class="controls">
      <div class="seek">${icon("search")}<input id="cq" type="search" placeholder="Find an item" value="${esc(ui.countQ)}" aria-label="Find an item"><kbd>/</kbd></div>
      <select class="select" id="ccat" aria-label="Category"><option value="all">All categories</option>${cats.map(c => `<option value="${c.id}" ${ui.countCat === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select>
      <label class="check" style="margin:0"><input type="checkbox" id="conly" ${ui.countOnlyStock ? "checked" : ""}> Items on system only</label>
    </div>
    <div class="stubs" id="stubs"></div>
    <div class="hud" id="hud"></div>`;
  renderStubs(); renderHud();
  $("#cq").oninput = e => { ui.countQ = e.target.value; renderStubs(); };
  $("#ccat").onchange = e => { ui.countCat = e.target.value; renderStubs(); };
  $("#conly").onchange = e => { ui.countOnlyStock = e.target.checked; lsSet("countOnlyStock", ui.countOnlyStock); renderStubs(); renderHud(); };
  $("#leave").onclick = async () => {
    const saved = data.sessions.find(x => x.id === s.id);
    if (Object.keys(s.counts).length && JSON.stringify(saved?.counts) !== JSON.stringify(s.counts)) {
      if (!await confirmBox('Close <span class="voice">without saving?</span>', "This sheet has counts that aren't saved. Save it as a draft first if you want to come back to it.", "Close anyway", true)) return;
    }
    ui.session = null; render();
  };
}

// While counting, the gauge shows what's on the shelf against what the system expects
function stubLevel(sys, counted) {
  const now = counted == null ? sys : Number(counted);
  return level({ par: Math.max(sys, 0) || (now > 0 ? now : 0) }, now);
}

function renderStubs() {
  const s = ui.session, rows = runRows(s);
  $("#stubs").innerHTML = rows.map(p => {
    const c = s.counts[p.id], sys = s.system[p.id] ?? (Number(p.stock?.[s.location]) || 0), d = c == null ? null : Number(c) - sys;
    return `<div class="stub ${c == null ? "" : Math.abs(d) < 1e-9 ? "ok" : "off"}" data-row="${esc(p.id)}">
      ${pic(p, "pic")}${tank(stubLevel(sys, c), "mini")}
      <div class="nm"><b>${esc(p.name)}</b><span>${esc(p.sku || p.code || catName(p.category))}</span></div>
      <div class="sys"><span>System</span><b>${qty(sys)}</b></div>
      <div class="stepper"><button type="button" data-step="-1" aria-label="Minus one">−</button>
        <input type="number" inputmode="decimal" step="any" min="0" id="c-${esc(p.id)}" value="${c ?? ""}" placeholder="count" aria-label="Counted ${esc(p.name)}">
        <button type="button" data-step="1" aria-label="Plus one">+</button></div>
      <div class="dv"><span>Variance</span>${delta(d)}</div>
    </div>`;
  }).join("") || '<p class="empty slab"><span class="voice">No match.</span> Try another search or category.</p>';

  $$(".stub").forEach(row => {
    const id = row.dataset.row, inp = row.querySelector("input");
    const set = v => {
      if (v === "" || v == null || isNaN(v)) delete s.counts[id]; else s.counts[id] = Math.max(0, Number(v));
      const c = s.counts[id], d = c == null ? null : c - (s.system[id] ?? 0);
      row.className = "stub " + (c == null ? "" : Math.abs(d) < 1e-9 ? "ok" : "off");
      row.querySelector(".dv").innerHTML = `<span>Variance</span>${delta(d)}`;
      const lv = stubLevel(s.system[id] ?? 0, c), t = row.querySelector(".tank");
      t.className = `tank mini s-${lv.state}`; t.style.setProperty("--lv", Math.min(Math.max(lv.pct, 0), 1).toFixed(3));
      renderHud();
    };
    inp.addEventListener("input", () => set(inp.value));
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const nx = row.nextElementSibling?.querySelector("input"); nx ? nx.focus() : inp.blur(); } });
    row.querySelectorAll("[data-step]").forEach(b => b.onclick = () => {
      const cur = s.counts[id] ?? (s.system[id] ?? 0);
      const nv = Math.max(0, Math.round((Number(cur) + Number(b.dataset.step)) * 1000) / 1000);
      inp.value = nv; set(nv);
    });
  });
}

function renderHud() {
  const s = ui.session, st = stats(s);
  $("#hud").innerHTML = `
    <div class="stats">
      <div><span>Counted</span><b>${st.counted}<small style="color:var(--muted);font-size:13px;font-weight:400"> / ${st.scope}</small></b></div>
      <div><span>With variance</span><b style="color:${st.off ? "var(--bad)" : "var(--good)"}">${st.off}</b></div>
      <div><span>Variance SAR</span><b style="color:${st.diff < 0 ? "var(--bad)" : st.diff > 0 ? "var(--good)" : "inherit"}">${st.diff > 0 ? "+" : ""}${sar(st.diff)}</b></div>
    </div>
    <div class="acts"><button class="btn" id="save-draft">Save draft</button><button class="btn hot" id="commit" ${st.counted ? "" : "disabled"}>${icon("check")}Commit count</button></div>
    <div class="track"><i style="width:${st.scope ? Math.min(100, st.counted / st.scope * 100) : 0}%"></i></div>`;
  $("#save-draft").onclick = async () => {
    try { await store.saveSession(s); await store.log("draft", `Saved ${loc(s.location).name} draft · ${st.counted} items`); toast("Draft saved"); } catch (e) { toast(e.message, true); }
  };
  $("#commit").onclick = async () => {
    if (!pinUnlocked() && !await requirePin()) return;
    if (!await confirmBox('Commit <span class="voice">this count?</span>', `${loc(s.location).name} stock will be overwritten with your counts for ${st.counted} items. The September expiry sheet batch 1 quantity is updated too.`, "Commit")) return;
    try { await store.commitSession(s); applyCountToSheet(s.location, s.counts); ui.session = null; toast("Count committed · sheet updated"); go("history"); } catch (e) { toast(e.message, true); }
  };
}

// ── Yield analytics ──────────────────────────────────────────
const helpers = () => ({ data: () => data, total, qty, sar, esc, pic, when, nf0, LOCATIONS, UNITS });
const cardHelpers = () => ({ ...helpers(), UNITS, openModal, toast, src });
const p360Helpers = () => ({ ...toolHelpers(), catName, topRank, stockHist: () => stockHist });
const toolHelpers = () => ({ ...cardHelpers(), fuzzyIds, namesAr: NAMES_AR, level, icon, sar, download, csv, go, closeModal, routes: ROUTES, navAr: NAV_AR, CATEGORIES, LOCATIONS, value, openCard: p => openProductCard(p, cardHelpers()) });
function viewLabels() {
  document.body.classList.remove("card-only", "watch-only");
  renderNav(); renderNet();
  $("#kicker").textContent = "Labels";
  $("#page-title").innerHTML = 'Cut <span class="voice">sheet</span>';
  $("#title-actions").innerHTML = `<button class="btn hot" id="do-print">Print</button><button class="btn" id="do-pdf">PDF</button><button class="btn ghost" data-route="products">Back</button>`;
  $("#view").innerHTML = `<div id="labels"></div>`;
  mountLabelSheet($("#labels"), data.products, cardHelpers());
  $("#do-print").onclick = () => window.print();
  $("#do-pdf").onclick = () => exportLabelsPdf(data.products).then(() => toast("Label PDF downloaded")).catch(e => toast(e.message, true));
}
let lastCard = null, cardQueue = Promise.resolve();
function renderDoor() {
  const id = new URLSearchParams(location.search).get("p") || (location.hash.startsWith("#p/") ? location.hash.slice(3) : "");
  document.body.classList.add("card-only");
  const p = id && data.products?.find(x => x.id === id);
  if (p) { if (location.hash !== "#p/" + p.id) history.replaceState(null, "", location.pathname + location.search + "#p/" + p.id); return viewScanProduct(p); }
  if (data.products?.length || !id) {
    lastCard = null;
    $("#view").innerHTML = `<article class="phone-card door-empty"><h1>${id ? "المنتج غير موجود" : "امسح باركود منتج"}</h1><p>${id ? "Product not found" : "Scan a product label"}</p></article>`;
    window.NoirCurtain?.open();
  }
}
function viewScanProduct(p) {
  const sig = JSON.stringify(p) + "|" + (localStorage.getItem("noir-expiry-edits-v1") || "");
  if (lastCard && lastCard.id === p.id && lastCard.sig === sig) return;
  lastCard = { id: p.id, sig };
  document.body.classList.add("card-only");
  $("#kicker").textContent = "";
  $("#page-title").innerHTML = "";
  $("#title-actions").innerHTML = "";
  // one draw at a time: a data refresh that lands mid-draw waits, then redraws quietly (no replayed intro)
  cardQueue = cardQueue.then(() => {
    if (lastCard?.sig !== sig) return;
    const quiet = !!$("#scan-root .phone-card");
    if (!$("#scan-root")) $("#view").innerHTML = `<div id="scan-root"></div>`;
    return Promise.resolve(mountProductPage($("#scan-root"), p, { ...cardHelpers(), quiet }))
      .then(() => new Promise(r => requestAnimationFrame(r)))
      .then(() => window.NoirCurtain?.open());
  }).catch(err => {
    $("#scan-root").innerHTML = `<article class="phone-card"><h1>${esc(p.name)}</h1><p>${esc(err.message || "تعذر فتح البطاقة")}</p></article>`;
    window.NoirCurtain?.open();
  });
}
// These boards read their own JSON, not the stock store, so a store sync must not rebuild them.
function viewUnaizah() { if (!$("#view").querySelector(".uz:not(.fx)")) unaizahView().then(m => { if (ui.route === "unaizah") m.renderUnaizah($("#view"), { allDocs: store.allDocs }); }); }
function viewFinance() { if (!$("#view").querySelector(".fx")) financeView().then(m => { if (ui.route === "finance") m.renderFinance($("#view")); }); }
const profitMod = lazy("./finance/profit.js?v=94");
function viewProfit() {
  $("#title-actions").innerHTML = "";
  if (!$("#view").querySelector(".pf")) $("#view").innerHTML = `<div id="profit-host"><p class="empty">…</p></div>`;
  profitMod().then(m => { if (ui.route === "profit") m.renderProfit($("#profit-host") || $("#view"), helpers()); }).catch(e => toast(e.message, true));
}
const safetyMod = lazy("./safety/safety.js?v=94");
// shift brief tiles that need their own modules: safety checks and system-report freshness
const likesMod = lazy("./core/likes.js?v=94");
let briefSeen = null; // the dashboard re-renders on every sync; report freshness is re-read at most once a minute
function fillBrief(ar) {
  // the crowd's favourites: most-liked products, from the likes people leave on product cards
  likesMod().then(m => m.loadLikes()).then(L => {
    const el = $("#fav"); if (!el || !L?.length) return;
    const by = {}; L.forEach(d => { (by[d.pid] ??= []).push(d); });
    const top = Object.entries(by).map(([id, l]) => ({ p: data.products.find(x => x.id === id), l })).filter(x => x.p).sort((a, b) => b.l.length - a.l.length).slice(0, 5);
    if (!top.length) return;
    el.hidden = false;
    el.innerHTML = `<header class="brief-h"><h2>${ar ? "الأكثر إعجاباً" : "Most liked"}</h2><span>${L.length} ${ar ? "إعجاب" : "likes"}</span></header>
      <div class="fav-row">${top.map((x, i) => `<button class="fav-it" data-edit="${x.p.id}"><span class="fav-n data">${i + 1}</span>${pic(x.p, "fav-pic")}<span class="fav-t"><b>${esc((ar ? NAMES_AR[x.p.id] : null) || x.p.name)}</b><small>${esc(x.l.slice(0, 2).map(d => d.name).join(ar ? "، " : ", "))}</small></span><span class="fav-h data">♥ ${x.l.length}</span></button>`).join("")}</div>`;
  }).catch(() => {});
  const T2 = (en, a) => ar ? a : en, put = (id, tone, n, l, list) => { const b = $("#" + id); if (!b) return; b.className = `bf ${tone}`; b.querySelector("b").textContent = n; b.querySelector(".bf-l").textContent = l; b.querySelector(".bf-list").innerHTML = list; };
  safetyMod().then(m => {
    const S = m.safetySummary({ localDocs: store.localDocs }), open = S.late + S.issue;
    put("bf-safety", open ? "t-bad" : S.soon ? "t-warn" : S.none ? "t-info" : "t-ok", String(open),
      T2(`overdue or open issues · ${S.soon} due soon`, `متأخرة أو ملاحظات · ${S.soon} قريبة`),
      S.next ? `<em>${esc(ar ? S.next.a.ar : S.next.a.en)}</em>` : S.none ? `<em>${T2(`${S.none} checks not logged yet`, `${S.none} فحص ما انسجل`)}</em>` : `<em>${T2("All checks up to date", "كل الفحوصات بوقتها")}</em>`);
  }).catch(() => {});
  reportsMod().then(async m => {
    if (!briefSeen || Date.now() - briefSeen.at > 60e3) briefSeen = { at: Date.now(), p: m.lastSeen({ allDocs: store.allDocs, localDocs: store.localDocs, salesTo: SALES_TO }) };
    const seen = await briefSeen.p;
    const R = m.REPORTS.map(r => ({ r, d: seen[r.key] ? (Date.now() - Date.parse(seen[r.key].at)) / 864e5 : Infinity }));
    const fresh = R.filter(x => x.d <= 8).length, late = R.filter(x => x.d > 8);
    put("bf-reports", late.length > 2 ? "t-warn" : "t-ok", `${fresh}/${R.length}`, T2("uploaded in the last 8 days", "انرفعت آخر 8 أيام"),
      late.slice(0, 3).map(x => `<em dir="ltr">${esc(x.r.name.replace(/ - <Month> <Year>/, ""))}</em>`).join(""));
  }).catch(() => {});
}
function viewSafety() {
  if ($("#sf-dlg")?.open) return; // a sync must not wipe a check being logged
  $("#title-actions").innerHTML = "";
  if (!$("#view").querySelector(".sf")) $("#view").innerHTML = `<div id="safety-host"><p class="empty">…</p></div>`;
  safetyMod().then(m => { if (ui.route === "safety") m.renderSafety($("#safety-host") || $("#view"), { putDoc: store.putDoc, allDocs: store.allDocs, localDocs: store.localDocs, toast }); }).catch(e => toast(e.message, true));
}
const pettyMod = lazy("../petty/petty.js?v=94");
function viewPetty() {
  if ($("#petty-host .pc, #petty-host .pc-lock")) return; // a store sync must not reset an open review
  $("#title-actions").innerHTML = "";
  $("#view").innerHTML = `<div id="petty-host"></div>`;
  pettyMod().then(m => { if (ui.route === "petty") m.renderPetty($("#petty-host"), { putDoc: store.putDoc, allDocs: store.allDocs, localDocs: store.localDocs, putRemote: store.putRemote, getRemote: store.getRemote, deleteRemote: store.deleteRemote, deleteLocalDoc: store.deleteLocalDoc, uploadFile: store.uploadFile, toast, log: store.log }); })
    .catch(e => toast(e.message, true));
}
function viewAlerts() {
  $("#title-actions").innerHTML = "";
  $("#view").innerHTML = `<div id="alerts-host"></div>`;
  renderAlerts($("#alerts-host"), { ...toolHelpers(), catName, openProduct: id => { const p = data.products.find(x => x.id === id); if (p) p360Mod().then(m => m.open360(p, p360Helpers())).catch(() => openProductCard(p, cardHelpers())); } });
}
const linksMod = lazy("./core/links.js?v=94");
function viewLinks() {
  $("#title-actions").innerHTML = "";
  $("#view").innerHTML = `<div id="links-host"></div>`;
  linksMod().then(m => { if (ui.route === "links") m.renderLinks($("#links-host"), { allDocs: store.allDocs, localDocs: store.localDocs, putDoc: store.putDoc, toast }); })
    .catch(e => toast(e.message, true));
}
const hallsMod = lazy("./reports/halls.js?v=94");
function viewHalls() {
  if ($("#halls-host .hl")) return; // a store sync must not reset the open hall
  $("#title-actions").innerHTML = "";
  $("#view").innerHTML = `<div id="halls-host"></div>`;
  hallsMod().then(m => { if (ui.route === "halls") m.renderHalls($("#halls-host"), { allDocs: store.allDocs, localDocs: store.localDocs }); })
    .catch(e => toast(e.message, true));
}
const nightlyMod = lazy("./reports/nightly.js?v=94");
function viewNightly() {
  $("#title-actions").innerHTML = "";
  $("#view").innerHTML = `<div id="nightly-host"></div>`;
  nightlyMod().then(m => { if (ui.route === "nightly") m.renderNightly($("#nightly-host"), { ...toolHelpers(), putDoc: store.putDoc, allDocs: store.allDocs, localDocs: store.localDocs, log: store.log, markUpload }); })
    .catch(e => toast(e.message, true));
}
function viewYield() {
  const ar = siteLang() === "ar", tab = ui.yieldTab || lsGet("yieldTab", "stock");
  $("#title-actions").innerHTML = `<div class="seg" role="group" aria-label="Yield views">
    <button data-ytab="stock" aria-pressed="${tab === "stock"}">${icon("yield")}${ar ? "المخزون" : "Stock yield"}</button>
    <button data-ytab="menu" aria-pressed="${tab === "menu"}">${icon("finance")}${ar ? "المنيو والربح" : "Menu Lab"}</button></div>`;
  $$("[data-ytab]").forEach(b => b.onclick = () => { ui.yieldTab = b.dataset.ytab; lsSet("yieldTab", ui.yieldTab); viewYield(); });
  if (tab === "menu") { $("#view").innerHTML = `<div id="menu-lab"></div>`; menuMod().then(m => { if (ui.route === "yield") m.renderMenuLab($("#menu-lab"), helpers()); }); return; }
  yieldMod().then(m => { if (ui.route === "yield" && (ui.yieldTab || lsGet("yieldTab", "stock")) !== "menu") m.renderYield($("#view"), helpers()); }).catch(e => toast(e.message, true));
}

// ── Ledger ───────────────────────────────────────────────────
function lines(s) {
  return Object.keys(s.counts || {}).map(id => {
    const p = data.products.find(x => x.id === id) || { id, name: id };
    const sys = s.system?.[id] || 0, c = Number(s.counts[id]), d = c - sys;
    return { p, sys, c, d, v: d * (s.rates?.[id] || 0) };
  }).sort((a, b) => a.v - b.v);
}
function viewHistory() {
  const S = [...data.sessions].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  $("#view").innerHTML = S.length ? `
    <div class="ledger-wrap"><table class="ledger" style="min-width:860px"><thead><tr>
      <th>Tx hash</th><th>Location</th><th>Counted by</th><th>Opened</th><th>Status</th><th class="r">Items</th><th class="r">Off</th><th class="r">Variance SAR</th><th></th></tr></thead>
      <tbody>${S.map(s => {
        const L = lines(s), diff = L.reduce((a, r) => a + r.v, 0), off = L.filter(r => Math.abs(r.d) > 1e-9).length;
        return `<tr data-sess="${esc(s.id)}">
          <td class="data" style="color:var(--violet)">${esc(s.id.slice(0, 10))}…</td>
          <td>${esc(loc(s.location).name)}</td><td>${esc(s.counter || "—")}</td><td class="data" style="font-size:11.5px">${when(s.createdAt)}</td>
          <td><span class="pill ${s.status}">${s.status === "committed" ? "Committed" : "Draft"}</span></td>
          <td class="r data">${L.length}</td><td class="r data">${off}</td>
          <td class="r data" style="color:${diff < 0 ? "var(--bad)" : diff > 0 ? "var(--good)" : "inherit"}">${diff > 0 ? "+" : ""}${sar(diff)}</td>
          <td class="r"><div style="display:inline-flex;gap:6px">
            <button class="btn sm icon" data-csv="${esc(s.id)}" title="Export CSV" aria-label="Export CSV">${icon("download")}</button>
            <button class="btn sm icon warn" data-del="${esc(s.id)}" title="Delete" aria-label="Delete">${icon("trash")}</button></div></td></tr>`;
      }).join("")}</tbody></table></div>`
    : `<section class="slab" style="text-align:center;padding:56px 20px"><p class="empty" style="margin:0 0 18px"><span class="voice" style="font-size:28px">The ledger is empty.</span><br>Committed and draft counts show up here.</p><button class="btn hot" data-route="count">${icon("count")}Run the first count</button></section>`;
  $$("[data-sess]").forEach(tr => tr.addEventListener("click", e => { if (!e.target.closest("button")) detail(data.sessions.find(s => s.id === tr.dataset.sess)); }));
  $$("[data-csv]").forEach(b => b.onclick = () => exportSession(data.sessions.find(s => s.id === b.dataset.csv)));
  $$("[data-del]").forEach(b => b.onclick = async () => {
    if (await confirmBox('Delete <span class="voice">this entry?</span>', "The record of this count will be removed. Stock that was already committed doesn't change.", "Delete", true)) { await store.deleteSession(b.dataset.del); toast("Entry deleted"); }
  });
}
function detail(s) {
  const L = lines(s);
  const m = openModal(`
    <h2>${esc(loc(s.location).name)} <span class="voice">count</span></h2>
    <p class="lede"><span class="data" style="color:var(--violet)">${esc(s.id)}</span> · ${esc(s.counter || "—")} · ${when(s.createdAt)}</p>
    <div class="ledger-wrap"><table class="ledger" style="min-width:540px"><thead><tr><th>Item</th><th class="r">System</th><th class="r">Counted</th><th class="r">Variance</th><th class="r">SAR</th></tr></thead>
    <tbody>${L.map(r => `<tr style="cursor:default"><td>${esc(r.p.name)}</td><td class="r data">${qty(r.sys)}</td><td class="r data">${qty(r.c)}</td><td class="r">${delta(r.d)}</td><td class="r data">${sar(r.v)}</td></tr>`).join("")}</tbody></table></div>
    <div class="actions">${s.status === "draft" ? `<button class="btn" id="sd-resume">Resume counting</button>` : ""}
      <div class="end"><button class="btn" id="sd-csv">${icon("download")}CSV</button><button class="btn hot" id="sd-close">Done</button></div></div>`);
  $("#sd-close", m).onclick = closeModal;
  $("#sd-csv", m).onclick = () => exportSession(s);
  $("#sd-resume", m)?.addEventListener("click", () => { closeModal(); ui.session = JSON.parse(JSON.stringify(s)); go("count"); });
}
function exportSession(s) {
  const rows = [["Code", "Report name", "Product", "System", "Counted", "Variance", "Unit cost", "Variance SAR"]];
  lines(s).forEach(r => rows.push([r.p.code || "", r.p.sku || "", r.p.name, r.sys, r.c, r.d, s.rates?.[r.p.id] || 0, r.v.toFixed(2)]));
  download(`count-${s.location}-${s.createdAt.slice(0, 10)}.csv`, csv(rows), "text/csv;charset=utf-8");
  toast("CSV exported");
}

// ── Settings ─────────────────────────────────────────────────
const reportsMod = lazy("./reports/reports-admin.js?v=94");
// every upload of a system report is logged, so Settings can show when each one last came in
async function markUpload(key, file) { await store.putDoc("uploads", key, { at: new Date().toISOString(), file: String(file || "") }); }
const fmtN = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
// classic scripts (UMD builds) set a global; they cannot be loaded with import()
const scriptOnce = new Map();
const loadScriptTag = url => scriptOnce.get(url) || scriptOnce.set(url, new Promise((res, rej) => {
  const sc = document.createElement("script"); sc.src = url; sc.onload = res; sc.onerror = () => { scriptOnce.delete(url); rej(new Error("Could not load " + url.split("/").pop())); }; document.head.append(sc);
})).get(url);
const loadExcelJS = () => window.ExcelJS ? Promise.resolve() : loadScriptTag("https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js");
function reportHandlers() {
  const ar = siteLang() === "ar", T = (en, a) => ar ? a : en;
  return {
    expiry: async ([f]) => { const { importExpiry } = await import("./reports/sync-admin.js?v=94"); const n = await importExpiry(f, loadExcelJS); toast(T(`Expiry sheet merged · ${n} items`, `ملف الصلاحيات اندمج · ${n} صنف`)); render(); },
    stock: async ([f]) => { const { parseStockPdf } = await import("./reports/sync-admin.js?v=94"); await stockReport(await parseStockPdf(f, data.products), f.name, true); },
    sales: async ([f]) => {
      const pdfjs = await (await import("./reports/sync-admin.js?v=94")).loadPdf();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      let text = "";
      for (let i = 1; i <= doc.numPages; i++) { const page = await doc.getPage(i); const c = await page.getTextContent(); text += c.items.map(it => it.str).join(" ") + "\n"; }
      const sales = {};
      data.products.forEach(p => { const i = text.toLowerCase().indexOf(String(p.sku || "").toLowerCase()); if (i < 0) return; const m = text.slice(i, i + 80).match(/[\d,]+\.\d{2}/); if (m) sales[p.id] = Number(m[0].replace(/,/g, "")); });
      if (!Object.keys(sales).length) throw new Error(T("No products found in this report", "ما لقيت منتجات بهالتقرير"));
      localStorage.setItem("noir-sales-ytd", JSON.stringify(sales));
      toast(T(`Sales saved · ${Object.keys(sales).length} items`, `مبيعات محفوظة · ${Object.keys(sales).length} صنف`));
    },
    halls: async ([f], step) => {
      const m = await hallsMod();
      const d = await m.uploadSeatReport(f, { putDoc: store.putDoc, log: store.log }, step);
      toast(T(`Done · ${fmtN(d.tickets)} tickets · ${d.from} → ${d.to}`, `تم · ${fmtN(d.tickets)} تذكرة · ${d.from} → ${d.to}`) + (d.grand && d.grand !== d.tickets ? ` (${T("report", "التقرير")} ${d.grand})` : ""));
    },
    dcs: async (files, step) => {
      const [{ loadXLSX }, dcs] = await Promise.all([reportsMod(), import("./finance/fin-dcs.js?v=94")]);
      const XLSX = await loadXLSX();
      const ledger = await fetch("unaizah/ledger.json").then(r => r.json()).catch(() => ({ days: [] }));
      const known = [...new Set(ledger.days.flatMap(d => (d.cashiers || []).map(c => c.user)))];
      let n = 0, from = "", to = "";
      for (const [i, f] of files.entries()) {
        step(i, files.length, f.name);
        const r = dcs.parseDcsWorkbook(XLSX, XLSX.read(await f.arrayBuffer()), f.name, known);
        if (!r.days.length) throw new Error(`${f.name}: ${T("no daily sheets", "ما فيه شيتات يومية")}`);
        const id = r.year && r.month ? `${r.year}-${String(r.month).padStart(2, "0")}` : r.days[0].date.slice(0, 7);
        await store.putDoc("dcs", id, { at: new Date().toISOString(), file: f.name, year: r.year, month: r.month, days: r.days });
        n += r.days.length; from = from && from < r.days[0].date ? from : r.days[0].date; to = to > r.days.at(-1).date ? to : r.days.at(-1).date;
      }
      await store.log("report", `DCS · ${n} days · ${from} → ${to}`);
      toast(`DCS · ${n} ${T("days", "يوم")} · ${from} → ${to}`);
    },
    rdr: async ([f]) => {
      const [{ loadXLSX }, { parseRdrFile }] = await Promise.all([reportsMod(), import("./finance/fin-rdr.js?v=94")]);
      const d = await parseRdrFile(f, await loadXLSX());
      await store.putDoc("rdr", "latest", d);
      await store.log("report", `RDR Exception Register · ${d.shifts.length} shifts · ${d.from} → ${d.to}`);
      toast(`RDR · ${d.shifts.length} ${T("shifts", "وردية")} · ${d.from} → ${d.to}`);
    }
  };
}
function viewSettings() {
  const live = data.mode === "firebase", ar = siteLang() === "ar", T = (en, a) => ar ? a : en;
  if (!isOpen()) {
    $("#view").innerHTML = `<form class="slab" id="master-gate"><h2>${T("Master sign-in", "دخول الماستر")}</h2><input class="input" name="pin" type="password" inputmode="numeric" placeholder="••••" autocomplete="off" aria-label="PIN"><button class="btn hot" type="submit">${T("Open", "دخول")}</button></form>`;
    $("#master-gate").onsubmit = e => { e.preventDefault(); if (!unlock(e.target.pin.value)) { e.target.pin.value = ""; toast(T("Wrong PIN", "الرقم غلط"), true); return; } viewSettings(); };
    return;
  }
  $("#view").innerHTML = `
  <div class="settings">
    <div id="rq-host" class="rq-wrap"></div>
    <section class="slab">
      <div class="slab-h"><h2>${T("Top sellers", "الأكثر مبيعاً")}</h2><span class="tag">${SALES_FROM} → ${SALES_TO}</span></div>
      <div id="sales-chart" style="height:340px"></div>
    </section>
    <section class="slab">
      <div class="slab-h"><h2>${T("Backup &amp; export", "نسخ احتياطي وتصدير")}</h2></div>
      <div class="btns">
        <button class="btn" id="exp-json">${icon("download")}Backup JSON</button>
        <button class="btn" id="exp-csv">${icon("download")}Stock CSV</button>
        <button class="btn" id="copy-json">${icon("copy")}Copy JSON</button>
        <label class="btn" for="imp">${icon("upload")}Import JSON</label><input type="file" id="imp" accept="application/json,.json" hidden>
      </div>
      <p class="note">${T("Import adds or updates products by ID. It never deletes anything.", "الاستيراد يضيف أو يحدّث المنتجات حسب الرقم، وما يحذف شي.")}</p>
    </section>
    <div id="sync-admin"></div>
    <section class="slab">
      <div class="slab-h"><h2>${T("Starting data", "البيانات الأصلية")}</h2></div>
      <p style="margin:0;color:var(--ink-2);font-size:14px">${T("Current Stock Position Report", "تقرير الجرد الأصلي")} · Noir Cinema, Othaim Mall, Onaizah · <span class="data" style="font-size:12px">${when(SEED_DATE)}</span>. ${T("Three locations: Concession, Mini Store, Store. Unit cost is net amount ÷ system stock, before VAT.", "ثلاث مواقع: الكونسيشن، الميني ستور، المستودع. تكلفة الوحدة = الصافي ÷ كمية النظام، قبل الضريبة.")}</p>
      ${live ? "" : `<div class="btns" style="margin-top:16px"><button class="btn warn" id="reset">${T("Reload report data", "إعادة تحميل بيانات التقرير")}</button></div>`}
    </section>
  </div>`;
  $("#exp-json").onclick = () => { download(`stock-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll(), null, 1), "application/json"); toast("Backup downloaded"); };
  $("#copy-json").onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(store.exportAll())); toast("Copied to clipboard"); } catch { toast("Your browser blocked copying. Use the download instead.", true); } };
  $("#exp-csv").onclick = () => {
    const rows = [["Code", "Report name", "Product", "Category", "Unit", "Unit cost", ...LOCATIONS.map(l => l.name), "Total", "Value SAR"]];
    data.products.forEach(p => rows.push([p.code, p.sku, p.name, catName(p.category), UNITS[p.unit] || p.unit, p.rate, ...LOCATIONS.map(l => p.stock?.[l.id] || 0), total(p), value(p).toFixed(2)]));
    download(`stock-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows), "text/csv;charset=utf-8"); toast("Stock CSV exported");
  };
  $("#imp").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await store.importAll(JSON.parse(await f.text())); toast("Import complete"); } catch (err) { toast(err.message || "That file isn't a valid backup", true); }
    e.target.value = "";
  };
  syncAdmin().then(m => m.renderAdmin(document.getElementById("sync-admin"), { ...cardHelpers(), when, qty }));
  reportsMod().then(m => m.renderReports($("#rq-host"), { allDocs: store.allDocs, localDocs: store.localDocs, toast, go, markUpload, salesTo: SALES_TO, handlers: reportHandlers() }))
    .catch(e => toast(e.message, true));
  loadChart();
  $("#reset")?.addEventListener("click", async () => {
    if (await confirmBox('Reload <span class="voice">report data?</span>', "Every edit and count saved in this browser will be wiped and replaced with the original report.", "Reload", true)) { await store.resetLocal(); toast("Report data reloaded"); }
  });
}


function exportLedger() {
  const rows = data.products.map(p => ({ sku: p.sku, name: p.name, unit: p.unit, mini: p.stock?.mini || 0, refuel: p.stock?.refuel || 0, stores: p.stock?.stores || 0, total: total(p), value: value(p).toFixed(2) }));
  exportCount().then(m => m.downloadCountCsv(rows, "stock-count.csv")).then(() => toast("CSV exported")).catch(e => toast(e.message, true));
}

// ── Boot ─────────────────────────────────────────────────────
// live updates can arrive in bursts (Firestore sends several snapshots on connect): paint once per frame at most
let renderQueued = 0;
store.onChange(snap => {
  data = fixCats(snap); topCache = null;
  if (ui.route === "count" && ui.session) { renderNet(); renderBell(); return; }
  if (!renderQueued) renderQueued = requestAnimationFrame(() => { renderQueued = 0; render(); });
});
window.addEventListener("hashchange", () => {
  const r = location.hash.slice(1);
  if (CARD_DOOR) { if (r.startsWith("p/")) { render(); window.scrollTo(0, 0); } return; }
  if (r === "labels" || r.startsWith("p/")) { render(); window.scrollTo(0, 0); return; }
  if (ROUTES.some(x => x.id === r) && r !== ui.route) go(r);
});
if (CARD_DOOR) {
  render();
  store.init().catch(e => { console.error(e); toast("Couldn't load data: " + e.message, true); });
} else {
  mountClock($("#clock"), siteLang());
  if (!isScanUrl()) { render(); window.NoirCurtain?.open(); }
  if (siteLang() === "ar") import("./core/i18n-ar.js?v=94").then(m => m.startArabic()).catch(() => {});
  toolsMod().then(m => m.mountTools(toolHelpers())).catch(() => {});
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  store.init().catch(e => { console.error(e); toast("Couldn't load data: " + e.message, true); })
    .then(() => Promise.all([histMod(), store.allDocs("stockHistory")])).then(([, d]) => { stockHist = d; }).catch(() => {});
}

async function loadChart() {
  const el = document.getElementById("sales-chart");
  if (!el) return;
  if (!window.echarts) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "vendor/echarts.min.js"; sc.onload = res; sc.onerror = rej; document.head.append(sc); });
  const top = data.products.filter(p => !moveOf(p.id)).map(p => ({ name: p.name, sold: soldOf(p.id) })).filter(x => x.sold).sort((a, b) => b.sold - a.sold).slice(0, 10).reverse();
  const c = window.echarts.init(el);
  c.setOption({ grid: { left: 130, right: 30, top: 10, bottom: 20 }, tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", axisLabel: { color: "#8c95a8" }, splitLine: { lineStyle: { color: "rgba(255,255,255,.07)" } } },
    yAxis: { type: "category", data: top.map(x => x.name), axisLabel: { color: "#edf1f8", width: 120, overflow: "truncate" } },
    series: [{ type: "bar", data: top.map(x => x.sold), barWidth: 14, itemStyle: { color: "#5b7bff", borderRadius: [0, 6, 6, 0] }, label: { show: true, position: "right", color: "#edf1f8" } }] });
  new ResizeObserver(() => c.resize()).observe(el);
}

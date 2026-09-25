import * as store from "./store.js";
import { LOCATIONS, CATEGORIES, UNITS } from "./store.js";
import { SEED_DATE } from "./seed-data.js";

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
const pic = (p, cls) => p.image
  ? `<img class="${cls}" src="${esc(p.image)}" alt="" loading="lazy">`
  : `<div class="${cls} ph" aria-hidden="true">${esc(initials(p))}</div>`;
const lsGet = (k, d) => { try { const v = localStorage.getItem("noir-ui2:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem("noir-ui2:" + k, JSON.stringify(v)); } catch {} };
const splitMoney = n => { const [a, b] = sar(n).split("."); return `${a}<span class="dec">.${b}</span>`; };

const ICON = {
  dashboard: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M21 12h-3"/>',
  products: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  count: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 12h8"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const ROUTES = [
  { id: "dashboard", label: "Overview", kicker: "Treasury", title: 'Stock, <span class="voice">at a glance</span>' },
  { id: "products", label: "Collection", kicker: "Catalog", title: 'The <span class="voice">collection</span>' },
  { id: "count", label: "Count", kicker: "Stocktake", title: 'Count <span class="voice">the room</span>' },
  { id: "history", label: "Ledger", kicker: "History", title: 'Count <span class="voice">ledger</span>' },
  { id: "settings", label: "Settings", kicker: "Node", title: 'Sync <span class="voice">&amp; backup</span>' }
];
const CAT_COLORS = ["#9b6bff", "#ff4fd8", "#3be7ff", "#ffc857", "#4cf0a8", "#ff8a5c", "#7aa2ff", "#e27bff", "#5ce1c6", "#ff5c7a", "#8a84a3"];

// ── State ────────────────────────────────────────────────────
const ui = {
  route: ROUTES.some(r => r.id === location.hash.slice(1)) ? location.hash.slice(1) : lsGet("route", "dashboard"),
  q: "", cat: lsGet("cat", "all"), loc: lsGet("loc", "all"), sort: lsGet("sort", "cat"), view: lsGet("view", "grid"),
  session: null, countQ: "", countOnlyStock: lsGet("countOnlyStock", true), countCat: "all", setupLoc: "mini"
};
let data = store.snapshot();
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
function renderNav() {
  $("#nav").innerHTML = ROUTES.map(r => `<button data-route="${r.id}" ${ui.route === r.id ? 'aria-current="page"' : ""} aria-label="${r.label}">${icon(r.id)}<span>${r.label}</span></button>`).join("");
}
function renderNet() {
  const live = data.mode === "firebase", el = $("#net");
  el.classList.toggle("live", live);
  el.querySelector("span").textContent = live ? "Firebase · synced" : "Local node · this browser";
  el.title = live ? "Data is stored in Firestore and syncs live" : "Data is stored in this browser only. Add your Firebase config to sync.";
}
function renderTicker() {
  const items = [...data.products].filter(p => total(p) > 0).sort((a, b) => value(b) - value(a)).slice(0, 24);
  if (!items.length) { $("#ticker").innerHTML = ""; return; }
  const one = items.map(p => {
    const t = total(p), low = Number(p.min) > 0 && t <= p.min;
    return `<span class="tk">${esc(p.name.toUpperCase())} <b>${qty(t)}</b> ${esc(UNITS[p.unit] || "")} <span class="${low ? "dn" : "up"}">${low ? "▼" : "▲"} ${sar(value(p))}</span></span>`;
  }).join("");
  $("#ticker").innerHTML = one + one;
}
document.addEventListener("click", e => {
  const r = e.target.closest("[data-route]"); if (r) return go(r.dataset.route);
  const ed = e.target.closest("[data-edit]"); if (ed) return productForm(data.products.find(p => p.id === ed.dataset.edit));
  if (e.target.closest("[data-new]")) return productForm(null);
  const sc = e.target.closest("[data-startcount]"); if (sc) { ui.setupLoc = sc.dataset.startcount; go("count"); }
});
function go(route) {
  ui.route = route; lsSet("route", route);
  try { history.replaceState(null, "", "#" + route); } catch {}
  render(); window.scrollTo(0, 0);
}
function render() {
  renderNav(); renderNet(); renderTicker();
  const r = ROUTES.find(x => x.id === ui.route) || ROUTES[0];
  $("#kicker").textContent = r.kicker;
  $("#page-title").innerHTML = r.title;
  $("#title-actions").innerHTML = "";
  ({ dashboard: viewDashboard, products: viewProducts, count: viewCount, history: viewHistory, settings: viewSettings })[r.id]();
}

// ── Overview ─────────────────────────────────────────────────
function viewDashboard() {
  const P = data.products;
  const grand = P.reduce((a, p) => a + value(p), 0);
  const units = P.reduce((a, p) => a + total(p), 0);
  const stocked = P.filter(p => total(p) > 0).length;
  const byLoc = LOCATIONS.map(l => ({ ...l, v: P.reduce((a, p) => a + value(p, l.id), 0), n: P.filter(p => Number(p.stock?.[l.id]) > 0).length }));
  const byCat = CATEGORIES.map((c, i) => ({ ...c, color: CAT_COLORS[i % CAT_COLORS.length], v: P.filter(p => p.category === c.id).reduce((a, p) => a + value(p), 0) }))
    .filter(c => c.v > 0.01).sort((a, b) => b.v - a.v);
  const top = [...P].sort((a, b) => value(b) - value(a)).slice(0, 7);
  const out = P.filter(p => Number(p.rate) > 0 && total(p) === 0);
  const low = P.filter(p => Number(p.min) > 0 && total(p) > 0 && total(p) <= Number(p.min));
  const drafts = data.sessions.filter(s => s.status === "draft");

  $("#title-actions").innerHTML = `<button class="btn hot" data-route="count">${icon("count")}Start a count</button>`;

  // orbit rings: one ring per location, radius shrinks inward
  const cols = ["#9b6bff", "#ff4fd8", "#3be7ff"];
  const rings = byLoc.map((l, i) => {
    const R = 112 - i * 22, C = 2 * Math.PI * R, share = grand ? l.v / grand : 0;
    return `<circle cx="130" cy="130" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="12"/>
      <circle cx="130" cy="130" r="${R}" fill="none" stroke="${cols[i]}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${Math.max(share * C, 2)} ${C}" transform="rotate(-90 130 130)" style="filter:drop-shadow(0 0 6px ${cols[i]})"/>
      <text x="122" y="${130 - R + 3.5}" text-anchor="end" fill="${cols[i]}" font-family="Martian Mono, monospace" font-size="9">${l.code} ${Math.round(share * 100)}%</text>`;
  }).join("");

  $("#view").innerHTML = `
  <div class="dash">
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
        ${low.map(p => `<div class="alert amber"><span>${esc(p.name)} is running low</span><span class="data">${qty(total(p))} / ${qty(p.min)}</span></div>`).join("")}
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
  </div>`;
}

// ── Collection ───────────────────────────────────────────────
function filtered() {
  const q = ui.q.trim().toLowerCase(), order = CATEGORIES.map(c => c.id);
  const L = data.products.filter(p =>
    (ui.cat === "all" || p.category === ui.cat) &&
    (ui.loc === "all" || Number(p.stock?.[ui.loc]) > 0) &&
    (!q || [p.name, p.sku, p.code].some(s => String(s || "").toLowerCase().includes(q))));
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
  $("#title-actions").innerHTML = `<button class="btn hot" data-new>${icon("plus")}New product</button>`;
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, data.products.filter(p => p.category === c.id).length]));
  $("#view").innerHTML = `
    <div class="controls">
      <div class="seek">${icon("search")}<input id="q" type="search" placeholder="Search name, report name or code" value="${esc(ui.q)}" aria-label="Search products"><kbd>/</kbd></div>
      <select class="select" id="loc" aria-label="Location"><option value="all">All locations</option>
        ${LOCATIONS.map(l => `<option value="${l.id}" ${ui.loc === l.id ? "selected" : ""}>${l.name}</option>`).join("")}</select>
      <select class="select" id="sort" aria-label="Sort">
        ${[["cat", "By category"], ["value", "Highest value"], ["qty", "Highest quantity"], ["name", "A → Z"], ["recent", "Recently edited"]].map(([v, t]) => `<option value="${v}" ${ui.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select>
      <div class="seg" role="group" aria-label="View">
        <button data-view="grid" aria-pressed="${ui.view === "grid"}">${icon("grid")}Cards</button>
        <button data-view="list" aria-pressed="${ui.view === "list"}">${icon("list")}Ledger</button>
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
  const L = filtered();
  const v = L.reduce((a, p) => a + (ui.loc === "all" ? value(p) : value(p, ui.loc)), 0);
  const head = `<p class="count-line">${L.length} items · ${sar(v)} SAR${ui.loc !== "all" ? " · " + esc(loc(ui.loc).name) : ""}</p>`;
  if (ui.view === "list") {
    $("#results").innerHTML = head + `<div class="ledger-wrap"><table class="ledger"><thead><tr>
      <th>Token</th><th>Product</th><th>Category</th>${LOCATIONS.map(l => `<th class="r">${l.short}</th>`).join("")}<th class="r">Total</th><th class="r">Unit cost</th><th class="r">Value SAR</th></tr></thead>
      <tbody>${L.map(p => `<tr data-edit="${esc(p.id)}">
        <td class="data" style="color:var(--muted)">${tokenNo(p.id)}</td>
        <td><div class="nm">${pic(p, "pic")}<div><b>${esc(p.name)}</b><span>${esc(p.sku || p.code || "—")}</span></div></div></td>
        <td>${esc(catName(p.category))}</td>
        ${LOCATIONS.map(l => `<td class="r data">${qty(p.stock?.[l.id] || 0)}</td>`).join("")}
        <td class="r data">${qty(total(p))} <span style="color:var(--muted)">${esc(UNITS[p.unit] || "")}</span></td>
        <td class="r data">${Number(p.rate) ? sar(p.rate) : "—"}</td>
        <td class="r data">${sar(value(p))}</td></tr>`).join("")}</tbody></table></div>`;
    return;
  }
  $("#results").innerHTML = head + `<div class="collection">
    <button class="mint" data-new><span><span class="plus">${icon("plus")}</span></span><span><b>Mint a product</b><span class="voice">drop a photo, give it a name</span></span></button>
    ${L.map(token).join("")}</div>`;
  bindTilt();
}

function token(p) {
  const t = total(p), max = Math.max(...LOCATIONS.map(l => Number(p.stock?.[l.id]) || 0), 1);
  const state = t === 0 ? `<span class="token-state out">Out</span>` : Number(p.min) > 0 && t <= p.min ? `<span class="token-state low">Low</span>` : "";
  return `<button class="token" data-edit="${esc(p.id)}">
    <div class="token-frame">${pic(p, "token-img")}<span class="token-id">${tokenNo(p.id)}</span>${state}</div>
    <div class="token-body"><span class="token-cat">${esc(catName(p.category))}</span><h3>${esc(p.name)}</h3><span class="token-sku">${esc(p.sku || p.code || "not on report")}</span></div>
    <div class="bars">${LOCATIONS.map(l => { const n = Number(p.stock?.[l.id]) || 0; return `<div class="bar-row ${ui.loc === l.id ? "on" : ""}"><span>${l.code}</span><span class="meter"><i style="width:${(n / max * 100).toFixed(0)}%"></i></span><b>${qty(n)}</b></div>`; }).join("")}</div>
    <div class="token-foot"><span class="qty">${qty(t)} ${esc(UNITS[p.unit] || "")}</span><span class="val">${sar(value(p))}<small>SAR</small></span></div>
  </button>`;
}

function bindTilt() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(hover: none)").matches) return;
  $$(".token").forEach(el => {
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(x - .5) * 12}deg`); el.style.setProperty("--rx", `${(.5 - y) * 12}deg`);
      el.style.setProperty("--mx", `${x * 100}%`); el.style.setProperty("--my", `${y * 100}%`);
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  });
}

const slug = s => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item") + "-" + Math.random().toString(36).slice(2, 6);

function productForm(p) {
  const isNew = !p;
  const d = p ? JSON.parse(JSON.stringify(p)) : { id: "", name: "", sku: "", code: "", category: ui.cat !== "all" ? ui.cat : "drinks", unit: "pcs", rate: 0, min: 0, image: "", stock: { mini: 0, refuel: 0, stores: 0 } };
  let file = null;
  const blank = `<div class="drop-cta">${icon("image")}<span class="voice">Drop a photo</span>or click, or paste from clipboard</div>`;
  const m = openModal(`
    <h2>${isNew ? 'Mint a <span class="voice">product</span>' : esc(d.name)}</h2>
    <p class="lede">${isNew ? "Only the name is required. The photo is compressed to WebP automatically." : `${tokenNo(d.id)} · last edited ${d.updatedAt ? when(d.updatedAt) : "—"}`}</p>
    <form id="pf" class="form" novalidate>
      <div>
        <label class="drop ${d.image ? "" : "blank"}" id="drop" for="pf-img">${d.image ? `<img src="${esc(d.image)}" alt="">` : blank}</label>
        <input id="pf-img" type="file" accept="image/*" hidden>
        ${d.image ? `<button type="button" class="btn sm ghost" id="rm-img" style="margin-top:10px;width:100%">Remove photo</button>` : ""}
      </div>
      <div class="fields">
        <div class="fl full"><label for="pf-name">Product name</label><input class="input" id="pf-name" value="${esc(d.name)}" placeholder="e.g. Pepsi Can 330 ml" autocomplete="off"></div>
        <div class="fl"><label for="pf-cat">Category</label><select class="select" id="pf-cat">${CATEGORIES.map(c => `<option value="${c.id}" ${d.category === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select></div>
        <div class="fl"><label for="pf-unit">Unit</label><select class="select" id="pf-unit">${Object.entries(UNITS).map(([k, v]) => `<option value="${k}" ${d.unit === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div class="fl"><label for="pf-sku">Name on stock report</label><input class="input" id="pf-sku" value="${esc(d.sku)}" placeholder="RANI CAN"></div>
        <div class="fl"><label for="pf-code">Item code</label><input class="input" id="pf-code" value="${esc(d.code)}" placeholder="R00000007"></div>
        <div class="fl"><label for="pf-rate">Unit cost · SAR</label><input class="input data" id="pf-rate" type="number" step="0.0001" min="0" value="${Number(d.rate) || 0}"></div>
        <div class="fl"><label for="pf-min">Low-stock level</label><input class="input data" id="pf-min" type="number" step="any" min="0" value="${Number(d.min) || 0}"></div>
        <div class="fl full"><label>On hand</label><div class="trio">
          ${LOCATIONS.map(l => `<div class="fl"><label for="pf-s-${l.id}">${l.name}</label><input class="input data" id="pf-s-${l.id}" type="number" step="any" min="0" value="${Number(d.stock?.[l.id]) || 0}"></div>`).join("")}
        </div></div>
      </div>
    </form>
    <div class="actions">
      ${isNew ? "" : `<button class="btn warn" id="pf-del">${icon("trash")}Delete</button>`}
      <div class="end"><button class="btn ghost" id="pf-cancel">Cancel</button><button class="btn hot" id="pf-save">${icon("check")}${isNew ? "Mint product" : "Save changes"}</button></div>
    </div>`);

  const drop = $("#drop", m), inp = $("#pf-img", m);
  const preview = f => { file = f; drop.classList.remove("blank"); drop.innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`; };
  inp.onchange = () => inp.files[0] && preview(inp.files[0]);
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) preview(f); });
  m.addEventListener("paste", e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/")); if (f) preview(f); });
  $("#rm-img", m)?.addEventListener("click", () => { d.image = ""; d.imagePath = ""; file = null; drop.classList.add("blank"); drop.innerHTML = blank; });
  $("#pf-cancel", m).onclick = closeModal;
  $("#pf", m).addEventListener("submit", e => { e.preventDefault(); $("#pf-save", m).click(); });
  $("#pf-save", m).onclick = async () => {
    const name = $("#pf-name", m).value.trim();
    if (!name) { toast("Give the product a name first", true); $("#pf-name", m).focus(); return; }
    const btn = $("#pf-save", m); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const out = { ...d, name, sku: $("#pf-sku", m).value.trim(), code: $("#pf-code", m).value.trim(),
        category: $("#pf-cat", m).value, unit: $("#pf-unit", m).value,
        rate: Number($("#pf-rate", m).value) || 0, min: Number($("#pf-min", m).value) || 0,
        stock: Object.fromEntries(LOCATIONS.map(l => [l.id, Number($(`#pf-s-${l.id}`, m).value) || 0])) };
      if (!out.id) out.id = slug(name);
      if (file) { const up = await store.uploadImage(out.id, file); out.image = up.url; out.imagePath = up.path; }
      await store.saveProduct(out);
      closeModal(); toast(isNew ? "Product minted" : "Changes saved");
    } catch (err) { console.error(err); toast(err.message || "Could not save", true); btn.disabled = false; btn.textContent = isNew ? "Mint product" : "Save changes"; }
  };
  $("#pf-del", m)?.addEventListener("click", async () => {
    if (await confirmBox('Delete <span class="voice">product?</span>', `"${d.name}" and its stock levels will be removed. This can't be undone.`, "Delete", true)) {
      await store.deleteProduct(d.id); toast("Product deleted");
    }
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
            <span class="code">${l.code}</span><b>${l.name}</b><span>${data.products.filter(p => Number(p.stock?.[l.id]) > 0).length} SKUs on system</span></button>`).join("")}
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

function renderStubs() {
  const s = ui.session, rows = runRows(s);
  $("#stubs").innerHTML = rows.map(p => {
    const c = s.counts[p.id], sys = s.system[p.id] ?? (Number(p.stock?.[s.location]) || 0), d = c == null ? null : Number(c) - sys;
    return `<div class="stub ${c == null ? "" : Math.abs(d) < 1e-9 ? "ok" : "off"}" data-row="${esc(p.id)}">
      ${pic(p, "pic")}
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
    if (!await confirmBox('Commit <span class="voice">this count?</span>', `${loc(s.location).name} stock will be overwritten with your counts for ${st.counted} items. Items you didn't count stay as they are.`, "Commit")) return;
    try { await store.commitSession(s); ui.session = null; toast("Count committed · stock updated"); go("history"); } catch (e) { toast(e.message, true); }
  };
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
function viewSettings() {
  const live = data.mode === "firebase";
  $("#view").innerHTML = `
  <div class="settings">
    <section class="slab">
      <div class="slab-h"><h2>Connection</h2><span class="net ${live ? "live" : ""}"><i></i><span>${live ? "Firebase" : "Local"}</span></span></div>
      ${live ? `<p style="margin:0;color:var(--ink-2)">Products and counts live in Firestore, photos in Storage. Every device sees changes instantly.</p>` : `
      <p style="margin:0 0 16px;color:var(--ink-2)">Right now everything is saved in this browser only. To sync across devices:</p>
      <ol class="steps">
        <li>Create a project at <code>console.firebase.google.com</code> and add a Web app.</li>
        <li>Enable Firestore, Storage, and Anonymous sign-in under Authentication.</li>
        <li>Paste the config into <code>js/firebase-config.js</code>.</li>
        <li>Run <code>firebase deploy</code>. The report data uploads on first launch.</li>
      </ol>`}
    </section>
    <section class="slab">
      <div class="slab-h"><h2>Backup &amp; export</h2></div>
      <div class="btns">
        <button class="btn" id="exp-json">${icon("download")}Backup JSON</button>
        <button class="btn" id="exp-csv">${icon("download")}Stock CSV</button>
        <button class="btn" id="copy-json">${icon("copy")}Copy JSON</button>
        <label class="btn" for="imp">${icon("upload")}Import JSON</label><input type="file" id="imp" accept="application/json,.json" hidden>
      </div>
      <p class="note">Import adds or updates products by ID. It never deletes anything.</p>
    </section>
    <section class="slab">
      <div class="slab-h"><h2>Genesis data</h2><span class="voice">where it started</span></div>
      <p style="margin:0;color:var(--ink-2);font-size:14px">Current Stock Position Report · Noir Cinema, Othaim Mall, Onaizah · <span class="data" style="font-size:12px">${when(SEED_DATE)}</span>. Three locations: Mini Store, Refuel, Main Stores. Unit cost is net amount ÷ system stock, before VAT.</p>
      ${live ? "" : `<div class="btns" style="margin-top:16px"><button class="btn warn" id="reset">Reload report data</button></div>`}
    </section>
  </div>`;
  $("#exp-json").onclick = () => { download(`noir-stock-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll(), null, 1), "application/json"); toast("Backup downloaded"); };
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
  $("#reset")?.addEventListener("click", async () => {
    if (await confirmBox('Reload <span class="voice">report data?</span>', "Every edit and count saved in this browser will be wiped and replaced with the original report.", "Reload", true)) { await store.resetLocal(); toast("Report data reloaded"); }
  });
}

// ── Film grain ───────────────────────────────────────────────
function grain() {
  const el = $("#grain"); if (!el) return;
  const c = document.createElement("canvas"), S = 220; c.width = c.height = S;
  const ctx = c.getContext("2d"), img = ctx.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  el.style.backgroundImage = `url(${c.toDataURL()})`;
}

// ── Boot ─────────────────────────────────────────────────────
store.onChange(snap => {
  data = snap;
  if (ui.route === "count" && ui.session) { renderNet(); renderTicker(); return; }
  render();
});
window.addEventListener("hashchange", () => { const r = location.hash.slice(1); if (ROUTES.some(x => x.id === r) && r !== ui.route) go(r); });
grain();
render();
store.init().catch(e => { console.error(e); toast("Couldn't load data: " + e.message, true); });

// Stock alerts — one place that says, for every item, where it is short across the three locations
// and what to do: move (Store → Mini Store → Concession), leave it, order, or sell a dated group first.
//   Concession = ready to sell · Mini Store = next refill · Store = reserve.
//   Group items sold by weight/volume (kg, L) treat Concession + Mini Store as one front.
import { moveOf, dailyUse, SALES_DAYS } from "../data/sales-data.js?v=90";
import { usageOf } from "./consumption.js?v=90";
import { placement, isBulk } from "./fefo-place.js?v=90";

// days of sales each location should hold
export const RULES = { frontMin: 3, frontFill: 5, miniMin: 7, miniFill: 14, lead: 7, safety: 7, orderDays: 30, overDays: 180 };
const LOC = { stores: ["Store", "المستودع"], mini: ["Mini Store", "الميني ستور"], refuel: ["Concession", "الكونسيشن"], front: ["Mini Store · Concession", "الميني ستور · الكونسيشن"] };
const RANK = { critical: 0, warn: 1, info: 2, ok: 3 };
const up = n => Math.max(0, Math.ceil(n - 1e-9));
const r1 = n => Math.round(n * 10) / 10;
const worst = (a, b) => RANK[a] <= RANK[b] ? a : b;

// ── engine ───────────────────────────────────────────────────
export function alertFor(p, products) {
  const s = k => Math.max(0, Number(p.stock?.[k]) || 0);
  const con = s("refuel"), mini = s("mini"), store = s("stores"), total = con + mini + store, bulk = isBulk(p);
  const use = usageOf(p, products), mv = moveOf(p.id);
  const daily = dailyUse(p.id) || (use ? use.total / SALES_DAYS : 0), est = !!use && !use.exact;
  const days = q => daily > 0 ? q / daily : null;
  const front = bulk ? con + mini : con;
  const A = { p, daily, est, shared: !!mv?.shared, bulk, con, mini, store, total, front,
    cover: { con: days(con), mini: days(mini), store: days(store), front: days(front), total: days(total) },
    moves: [], order: null, hold: null, over: null, expiry: [], short: new Set(), level: "ok" };
  const R = RULES, raise = l => { A.level = worst(A.level, l); };
  let miniLeft = mini, storeLeft = store;

  if (total <= 0) {
    A.order = { qty: daily > 0 ? up(daily * R.orderDays) : Number(p.par) || null, now: true };
    ["refuel", "mini", "stores"].forEach(k => A.short.add(k)); raise("critical");
  } else if (bulk) {
    // one front (Concession + Mini Store), refilled from the Store
    if (daily > 0 && front < daily * R.frontMin && storeLeft > 0) {
      const qty = Math.min(storeLeft, up(daily * R.frontFill - front)); storeLeft -= qty;
      A.moves.push({ from: "stores", to: "front", qty, after: days(front + qty) }); A.short.add("refuel"); A.short.add("mini");
      raise(front <= 0 ? "critical" : "warn");
    } else if (daily <= 0 && front <= 0 && storeLeft > 0) {
      A.moves.push({ from: "stores", to: "front", qty: null }); A.short.add("refuel"); raise("warn");
    }
  } else {
    // Concession first: the sales point must never run dry
    if (daily > 0 && con < daily * R.frontMin && miniLeft + storeLeft > 0) {
      let need = up(daily * R.frontFill - con);
      const fromMini = Math.min(miniLeft, need); miniLeft -= fromMini; need -= fromMini;
      const fromStore = Math.min(storeLeft, need); storeLeft -= fromStore;
      if (fromMini) A.moves.push({ from: "mini", to: "refuel", qty: fromMini, after: days(con + fromMini + fromStore) });
      if (fromStore) A.moves.push({ from: "stores", to: "refuel", qty: fromStore, after: days(con + fromMini + fromStore) });
      A.short.add("refuel"); raise(con <= 0 ? "critical" : "warn");
    } else if (daily <= 0 && con <= 0 && miniLeft + storeLeft > 0) {
      A.moves.push({ from: miniLeft ? "mini" : "stores", to: "refuel", qty: null }); A.short.add("refuel"); raise("warn");
    }
    // then the Mini Store, from the Store
    if (daily > 0 && miniLeft < daily * R.miniMin && storeLeft > 0) {
      const qty = Math.min(storeLeft, up(daily * R.miniFill - miniLeft)); storeLeft -= qty;
      A.moves.push({ from: "stores", to: "mini", qty, after: days(miniLeft + qty) }); A.short.add("mini");
      raise("warn");
    }
  }
  // order from the supplier when the whole stock runs short
  if (!A.order && total > 0) {
    if (daily > 0) {
      const c = total / daily;
      if (c < R.lead + R.safety) { A.order = { qty: up(daily * R.orderDays - total), now: c < R.lead }; A.short.add("stores"); raise(c < R.lead ? "critical" : "warn"); }
      else if (c > R.overDays) { A.over = { months: Math.round(c / 30) }; raise("info"); }
    } else if (Number(p.min) > 0 && total <= Number(p.min)) {
      A.order = { qty: Math.max(1, (Number(p.par) || Number(p.min) * 2) - total), now: false }; A.short.add("stores"); raise("warn");
    }
  }
  // nothing to move: say so, with how long the sales point lasts
  if (!A.moves.length && total > 0 && (bulk ? front : con) > 0) A.hold = { days: A.cover.front };
  // dated groups
  const pl = placement(p);
  pl.groups.forEach(g => {
    if (g.left < 0) { A.expiry.push({ kind: "expired", g }); raise("critical"); }
    else if (g.left <= 14) { A.expiry.push({ kind: "soon", g }); raise("warn"); }
    else if (g.left <= 30) { A.expiry.push({ kind: "month", g }); raise("info"); }
  });
  pl.flagged.forEach(g => { A.expiry.push({ kind: "front", g }); raise("warn"); });
  return A;
}

export function stockAlerts(products) {
  const items = products.filter(p => p && p.id).map(p => alertFor(p, products))
    .sort((a, b) => RANK[a.level] - RANK[b.level] || (a.cover.front ?? 1e9) - (b.cover.front ?? 1e9) || a.p.name.localeCompare(b.p.name));
  const count = l => items.filter(a => a.level === l).length;
  const byLoc = Object.fromEntries(["stores", "mini", "refuel"].map(k => [k, {
    short: items.filter(a => a.short.has(k)).length,
    held: items.filter(a => (a.p.stock?.[k] || 0) > 0).length,
    value: items.reduce((s, a) => s + (Number(a.p.stock?.[k]) || 0) * (Number(a.p.rate) || 0), 0)
  }]));
  const moves = items.flatMap(a => a.moves.map(m => ({ ...m, a })));
  return { items, byLoc, moves, counts: { critical: count("critical"), warn: count("warn"), info: count("info"), ok: count("ok"),
    move: items.filter(a => a.moves.length).length, order: items.filter(a => a.order).length, expiry: items.filter(a => a.expiry.some(e => e.kind !== "month")).length } };
}

// ── view ─────────────────────────────────────────────────────
const state = { filter: "act", done: {} };
const DONE_KEY = () => "noir-transfer-done:" + new Date().toISOString().slice(0, 10);
try { state.done = JSON.parse(localStorage.getItem(DONE_KEY()) || "{}"); } catch {}

export function renderAlerts(host, H) {
  const ar = (sessionStorage.getItem("noir-lang") || "en") === "ar", T = (en, a) => ar ? a : en;
  const loc = k => LOC[k][ar ? 1 : 0], esc = H.esc, q = H.qty, unit = p => esc(H.UNITS[p.unit] || p.unit || "");
  const name = p => esc((ar ? H.namesAr?.[p.id] : null) || p.name);
  const A = stockAlerts(H.data().products), C = A.counts;
  const dd = d => d == null ? "—" : d >= 99 ? "99+" : r1(d) >= 10 ? Math.round(d) : r1(d);
  const tone = d => d == null ? "none" : d < RULES.frontMin ? "bad" : d < RULES.miniMin ? "warn" : "ok";
  const filters = [["act", T("Needs action", "يحتاج إجراء"), C.critical + C.warn], ["move", T("Move", "انقل"), C.move], ["order", T("Order", "اطلب"), C.order],
    ["expiry", T("Expiry", "الصلاحية"), C.expiry], ["hold", T("Don't move", "لا تنقل"), A.items.filter(a => a.hold && !a.moves.length).length], ["all", T("All", "الكل"), A.items.length]];
  const pick = a => ({ act: ["critical", "warn"].includes(a.level), move: a.moves.length > 0, order: !!a.order, expiry: a.expiry.some(e => e.kind !== "month"), hold: !!a.hold && !a.moves.length, all: true })[state.filter];
  const list = A.items.filter(pick);
  const node = (a, k) => {
    const qty = k === "front" ? a.front : a[k === "refuel" ? "con" : k === "stores" ? "store" : "mini"], d = k === "front" ? a.cover.front : a.cover[k === "refuel" ? "con" : k === "stores" ? "store" : "mini"];
    const short = k === "front" ? a.short.has("refuel") : a.short.has(k);
    return `<span class="al-node ${short ? "short" : ""} t-${k === "stores" ? "none" : tone(d)}"><i>${k === "front" ? T("FRONT", "الواجهة") : k === "refuel" ? "CON" : k === "mini" ? "MNI" : "STR"}</i><b class="data">${q(qty)}</b><em class="data">${a.daily > 0 && k !== "stores" ? dd(d) + T("d", "ي") : ""}</em></span>`;
  };
  const arrow = (a, from, to) => { const m = a.moves.find(x => x.from === from && x.to === to); return `<span class="al-arrow ${m ? "go" : ""}">${m ? `<b class="data">${m.qty != null ? "+" + q(m.qty) : "↻"}</b>` : ""}<i></i></span>`; };
  const lane = a => a.bulk
    ? `<div class="al-lane bulk">${node(a, "stores")}${arrow(a, "stores", "front")}${node(a, "front")}</div>`
    : `<div class="al-lane">${node(a, "stores")}${arrow(a, "stores", "mini")}${node(a, "mini")}${arrow(a, "mini", "refuel")}${node(a, "refuel")}</div>`;
  const acts = a => {
    const out = [];
    a.moves.forEach(m => out.push(`<li class="mov"><b>${T("Move", "انقل")} ${m.qty != null ? `<span class="data">${q(m.qty)}</span> ${unit(a.p)}` : T("some stock", "كمية")}</b> ${T("from", "من")} ${loc(m.from)} ${T("to", "إلى")} ${loc(m.to)}${m.after != null ? ` <em>· ${T("then covers", "يكفي بعدها")} ${dd(m.after)} ${T("days", "يوم")}</em>` : ""}</li>`));
    if (a.order) out.push(`<li class="or ${a.order.now ? "now" : ""}"><b>${a.order.now ? T("Order now", "اطلب الحين") : T("Order soon", "اطلب قريب")}${a.order.qty ? ` <span class="data">${q(a.order.qty)}</span> ${unit(a.p)}` : ""}</b>${a.cover.total != null && a.total > 0 ? ` <em>· ${T("all stock lasts", "كل المخزون يكفي")} ${dd(a.cover.total)} ${T("days", "يوم")}</em>` : a.total <= 0 ? ` <em>· ${T("out everywhere", "نافد بكل المواقع")}</em>` : ""}</li>`);
    if (a.hold && !a.moves.length) out.push(`<li class="ok"><b>${T("Don't move", "لا تنقل")}</b> <em>· ${a.hold.days != null ? `${loc(a.bulk ? "front" : "refuel")} ${T("covers", "يكفي")} ${dd(a.hold.days)} ${T("days", "يوم")}` : T("the sales point has stock", "نقطة البيع فيها مخزون")}</em></li>`);
    if (a.over) out.push(`<li class="in"><b>${T("Don't order", "لا تطلب")}</b> <em>· ${T("stock covers", "المخزون يكفي")} ${a.over.months} ${T("months", "شهر")}</em></li>`);
    a.expiry.filter(e => e.kind !== "month" || state.filter === "expiry" || state.filter === "all").slice(0, 3).forEach(e => {
      const g = e.g, where = loc(g.loc);
      out.push(e.kind === "expired" ? `<li class="ex bad"><b>${T("Expired", "منتهي")}</b> <em>· ${T("group", "مجموعة")} ${g.n} · ${where} · ${q(g.qty)} ${unit(a.p)} — ${T("pull it", "اسحبها")}</em></li>`
        : e.kind === "front" ? `<li class="ex"><b>${T("Sell first", "بيعها أول")}</b> <em>· ${T("group", "مجموعة")} ${g.n} (${where}) ${T("expires in", "تنتهي بعد")} ${g.left} ${T("days", "يوم")} ${T("but sits behind a later one", "وهي ورا مجموعة تنتهي بعدها")}</em></li>`
        : `<li class="ex ${e.kind === "soon" ? "warn" : ""}"><b>${T("Expires in", "تنتهي بعد")} <span class="data">${g.left}</span> ${T("days", "يوم")}</b> <em>· ${T("group", "مجموعة")} ${g.n} · ${where} · ${q(g.qty)} ${unit(a.p)}</em></li>`);
    });
    if (!out.length) out.push(`<li class="mute"><em>${a.daily > 0 ? T("Nothing to do", "ما فيه شي مطلوب") : T("No sales on file for this item", "ما فيه مبيعات مسجلة لهالصنف")}</em></li>`);
    return out.join("");
  };
  const LV = { critical: T("Critical", "حرج"), warn: T("Act today", "اليوم"), info: T("Watch", "متابعة"), ok: T("Good", "تمام") };
  // transfer list: every move, grouped by route, to tick off on the floor
  const routes = [["stores", "mini"], ["mini", "refuel"], ["stores", "refuel"], ["stores", "front"]].map(([f, t]) => ({ f, t, rows: A.moves.filter(m => m.from === f && m.to === t) })).filter(r => r.rows.length);
  const tKey = m => `${m.a.p.id}:${m.from}:${m.to}`;
  const doneN = A.moves.filter(m => state.done[tKey(m)]).length;

  host.innerHTML = `<div class="al">
    <section class="al-hero">
      <div class="al-sum">
        <button class="al-k bad" data-f="act"><b class="data">${C.critical}</b><span>${T("Critical", "حرج")}</span></button>
        <button class="al-k warn" data-f="act"><b class="data">${C.warn}</b><span>${T("Act today", "إجراء اليوم")}</span></button>
        <button class="al-k mov" data-f="move"><b class="data">${A.moves.length}</b><span>${T("Moves", "نقلات")}</span></button>
        <button class="al-k or" data-f="order"><b class="data">${C.order}</b><span>${T("To order", "للطلب")}</span></button>
        <button class="al-k ok" data-f="hold"><b class="data">${C.ok}</b><span>${T("All good", "تمام")}</span></button>
      </div>
      <div class="al-flow">${["stores", "mini", "refuel"].map((k, i) => `${i ? `<span class="al-flow-arrow" aria-hidden="true"></span>` : ""}
        <article class="al-loc ${A.byLoc[k].short ? "has-short" : ""}"><header><i>${k === "refuel" ? "CON" : k === "mini" ? "MNI" : "STR"}</i><b>${loc(k)}</b></header>
          <p class="data"><b>${A.byLoc[k].short}</b> ${T("short", "نقص")}</p><span>${A.byLoc[k].held} ${T("items held", "صنف موجود")} · ${H.sar(A.byLoc[k].value)} SAR</span>
          <em>${k === "refuel" ? T("ready to sell", "جاهز للبيع") : k === "mini" ? T("next refill", "التعبئة الجاية") : T("reserve", "احتياط")}</em></article>`).join("")}</div>
    </section>

    ${routes.length ? `<section class="al-card al-pick">
      <header><h3>${T("Transfer list · today", "قائمة النقل · اليوم")}</h3><span class="data">${doneN}/${A.moves.length}</span><button class="btn sm ghost" id="al-print">${T("Print", "طباعة")}</button></header>
      ${routes.map(r => `<div class="al-route"><h4>${loc(r.f)} <i>→</i> ${loc(r.t)} <small class="data">${r.rows.length}</small></h4>
        ${r.rows.map(m => `<label class="al-tick ${state.done[tKey(m)] ? "done" : ""}"><input type="checkbox" data-t="${esc(tKey(m))}" ${state.done[tKey(m)] ? "checked" : ""}><span>${name(m.a.p)}</span><b class="data">${m.qty != null ? q(m.qty) : "—"}</b><em>${unit(m.a.p)}</em></label>`).join("")}</div>`).join("")}
    </section>` : ""}

    <div class="al-bar"><div class="al-filters">${filters.map(([k, l, n]) => `<button data-f="${k}" class="${state.filter === k ? "on" : ""}">${l}<sup class="data">${n}</sup></button>`).join("")}</div>
      <p class="al-rule">${T(`Concession ≥ ${RULES.frontMin} days · Mini Store ≥ ${RULES.miniMin} days · order when all stock < ${RULES.lead + RULES.safety} days`, `الكونسيشن ≥ ${RULES.frontMin} أيام · الميني ستور ≥ ${RULES.miniMin} أيام · اطلب لما كل المخزون أقل من ${RULES.lead + RULES.safety} يوم`)}</p></div>

    <div class="al-grid">${list.map(a => `<article class="al-item lv-${a.level}" data-open="${esc(a.p.id)}" tabindex="0">
      <header>${H.pic(a.p, "pic")}<div><b>${name(a.p)}</b><span>${esc(H.catName ? H.catName(a.p.category) : a.p.category)}${a.daily > 0 ? ` · ${r1(a.daily)} ${unit(a.p)}/${T("day", "يوم")}${a.est ? " ≈" : ""}` : ""}</span></div><em class="al-lv">${LV[a.level]}</em></header>
      ${lane(a)}
      <ul class="al-acts">${acts(a)}</ul>
    </article>`).join("") || `<p class="al-empty">${T("Nothing here. Every item is where it should be.", "ما فيه شي هنا. كل الأصناف بمكانها الصح.")}</p>`}</div>
  </div>`;
  host.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { state.filter = b.dataset.f; renderAlerts(host, H); });
  host.querySelectorAll("[data-open]").forEach(c => { const open = () => H.openProduct?.(c.dataset.open); c.onclick = open; c.onkeydown = e => { if (e.key === "Enter") open(); }; });
  host.querySelectorAll(".al-tick input").forEach(i => i.onchange = () => {
    state.done[i.dataset.t] = i.checked; if (!i.checked) delete state.done[i.dataset.t];
    try { localStorage.setItem(DONE_KEY(), JSON.stringify(state.done)); } catch {}
    i.closest(".al-tick").classList.toggle("done", i.checked);
    host.querySelector(".al-pick header .data").textContent = `${Object.keys(state.done).filter(k => A.moves.some(m => tKey(m) === k)).length}/${A.moves.length}`;
  });
  host.querySelector("#al-print")?.addEventListener("click", () => { document.body.classList.add("print-pick"); window.print(); setTimeout(() => document.body.classList.remove("print-pick"), 500); });
}

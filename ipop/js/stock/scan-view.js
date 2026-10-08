// What a scan opens: the product watch (watch.js) for that one product, and nothing else.
// The photo block (.pc-shot + H.pic) and everything barcode-related are untouched; the barcode shown is the saved label.
// Counting happens on the same watch (watch-count.js): counts wait on this phone as "pending" until
// "Send report to admin" turns them "submitted". Nothing here writes a product's stock.
import { BARCODES } from "../data/barcodes.js?v=106";
import { watchHtml, mountWatch, recipeFor } from "./watch.js?v=106";
import { noDate, startMission, loadCounts, openRecount, locLabel, ORDER, counterName, myPending, sendReport } from "./watch-count.js?v=106";

const localIso = d => d && !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";

export async function renderScanCard(root, p, ctx) {
  const { H, rowsFor, daysLeft, fmtDate, asDate } = ctx;
  const dated = !noDate(p);
  const unit = H.UNITS[p.unit] || p.unit || "";
  const locs = ORDER.map(id => ({ id, label: locLabel(id), n: Number(p.stock?.[id]) || 0 }));
  const total = locs.reduce((a, x) => a + x.n, 0);
  // the dated groups, place by place in the walk order (Main Stores → Mini Store → Concession), soonest first
  const groups = !dated ? [] : rowsFor(p.id)
    .flatMap(r => r.batches.map(b => ({ loc: r.loc, n: b.n, qty: Number(String(b.qty ?? "").replace(/[^\d.]/g, "")) || 0, date: b.date, left: daysLeft(b.date), when: fmtDate(b.date) })))
    .filter(b => b.left != null && b.qty > 0)
    .sort((a, b) => ORDER.indexOf(a.loc) - ORDER.indexOf(b.loc) || a.left - b.left)
    .map(b => ({ ...b, label: `${locLabel(b.loc)} · Group ${b.n}` }));
  const next = [...groups].sort((a, b) => a.left - b.left).find(b => b.left >= 0) || [...groups].sort((a, b) => a.left - b.left)[0] || null;
  const mark = BARCODES[p.id];
  const html = watchHtml({ p, H, name: p.name, unit, total, locs, dated, groups, next, recipe: recipeFor(p),
    code: mark?.code || p.code || p.sku || p.id, barcode: mark?.barcode || "",
    shot: `<div class="pc-shot">${H.pic(p, "pic")}<small class="pc-age"></small></div>` });

  const cardOnly = document.body.classList.contains("card-only");
  if (cardOnly) document.body.classList.add("watch-only");
  root.innerHTML = `<div class="nw-page">${html}</div>`;

  // a recount the admin asked for runs only the places it names
  let recount = null;
  const paintBar = list => {
    const bar = root.querySelector(".nw-bar"); if (!bar) return;
    bar.querySelector(".nw-due")?.remove();
    const b = bar.querySelector(".nw-start b"); if (b) b.textContent = recount ? "Recount" : "Start count";
    bar.classList.toggle("is-due", !!recount);
    if (recount) bar.insertAdjacentHTML("afterbegin", `<p class="nw-due">Admin asked for a recount · ${recount.recount.map(l => H.esc(locLabel(l))).join(", ")}</p>`);
    const send = bar.querySelector("[data-send]"), mine = myPending(list || [], counterName());
    if (send) { send.hidden = !mine.length; send.querySelector("em").textContent = mine.length ? String(mine.length) : ""; }
  };
  const refresh = force => loadCounts(force).then(list => { recount = openRecount(list, p.id); paintBar(list); }).catch(() => paintBar([]));
  const mission = disp => startMission(disp, { p, H, prev: recount, only: recount?.recount,
    groupsAt: loc => groups.filter(b => b.loc === loc).map(b => ({ qty: b.qty, date: /^\d{4}-\d{2}-\d{2}/.test(String(b.date)) ? String(b.date).slice(0, 10) : localIso(asDate(b.date)) })),
    onDone: () => refresh(false) });
  const onSend = async btn => {
    const by = counterName();
    if (!by) { H.toast("Count a product first, so the report carries your name", true); return; }
    btn.disabled = true;
    try { const n = await sendReport(by); H.toast(n ? `Report sent to admin · ${n} ${n === 1 ? "product" : "products"}` : "Nothing waiting to send"); }
    catch (e) { H.toast(e.message, true); }
    btn.disabled = false; refresh(false);
  };
  mountWatch(root, { onCount: mission, onSend });
  refresh(false);

  // opened from a label scan: the page holds still and the watch scales to the screen
  if (cardOnly) {
    document.documentElement.classList.add("nw-lock");
    const sh = root.querySelector(".nw-page .nw-shell"); if (!sh) return;
    const fit = () => { if (!sh.isConnected) return removeEventListener("resize", fit); sh.style.zoom = 1;
      const z = Math.min(1, (innerHeight - 16) / (sh.offsetHeight || 760), (innerWidth - 24) / 340); sh.style.zoom = z.toFixed(3); };
    fit(); addEventListener("resize", fit);
  }
}

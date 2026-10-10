// What a label scan opens: the product watch (watch.js) for that one product, and nothing else.
// The photo block (.pc-shot + H.pic) and everything barcode-related are untouched; the barcode shown is the saved label.
// Anyone can scan without signing in. Counting needs a code: Start count opens the stock card when signed in,
// and the sign-in door (back to this same product) when not.
import { BARCODES } from "../data/barcodes.js?v=106";
import { watchHtml, mountWatch, recipeFor } from "./watch.js?v=106";
import { noDate, locLabel, ORDER } from "./watch-count.js?v=112";
import { expiryRows } from "../data/expiry-edits.js?v=106";
import { fmtDate, daysTo, openStockCard } from "./stock-panel.js?v=115";

const sig = p => JSON.stringify([p.id, p.stock, p.image, p.name]);
export function renderScanCard(root, p, H) {
  if (root.dataset.sig === sig(p)) return; // a sync that did not touch this product leaves the watch where it is
  root.dataset.sig = sig(p);
  const dated = !noDate(p), unit = H.UNITS?.[p.unit] || p.unit || "";
  const locs = ORDER.map(id => ({ id, label: locLabel(id), n: Number(p.stock?.[id]) || 0 }));
  const total = locs.reduce((a, x) => a + x.n, 0);
  // the dated groups, place by place in the walk order (Main Stores → Mini Store → Concession), soonest first
  const groups = !dated ? [] : expiryRows(p.id)
    .flatMap(r => r.batches.map(b => ({ loc: r.loc, n: b.n, qty: Number(String(b.qty ?? "").replace(/[^\d.]/g, "")) || 0, left: daysTo(b.date), when: fmtDate(b.date) })))
    .filter(b => b.left != null && b.qty > 0)
    .sort((a, b) => ORDER.indexOf(a.loc) - ORDER.indexOf(b.loc) || a.left - b.left)
    .map(b => ({ ...b, label: `${locLabel(b.loc)} · Group ${b.n}` }));
  const soon = [...groups].sort((a, b) => a.left - b.left), next = soon.find(b => b.left >= 0) || soon[0] || null;
  const mark = BARCODES[p.id];
  root.innerHTML = `<div class="nw-page">${watchHtml({ p, H, name: p.name, unit, total, locs, dated, groups, next, recipe: recipeFor(p),
    code: mark?.code || p.code || p.sku || p.id, barcode: mark?.barcode || "",
    shot: `<div class="pc-shot">${H.pic(p, "pic")}<small class="pc-age"></small></div>` })}</div>`;
  const guest = !!globalThis.IPOP_SESSION?.guest;
  const start = root.querySelector("[data-count] b"); if (start && guest) start.textContent = "Sign in to count";
  mountWatch(root, { onCount: () => guest ? globalThis.IPOP_DOOR?.signIn() : openStockCard(p, H) });

  // opened from a label: the page holds still and the watch scales to the screen
  document.body.classList.add("watch-only");
  document.documentElement.classList.add("nw-lock");
  const sh = root.querySelector(".nw-page .nw-shell"); if (!sh) return;
  const fit = () => { if (!sh.isConnected) return removeEventListener("resize", fit); sh.style.zoom = 1;
    const z = Math.min(1, (innerHeight - 16) / (sh.offsetHeight || 760), (innerWidth - 24) / 340); sh.style.zoom = z.toFixed(3); };
  fit(); addEventListener("resize", fit);
}

// Product likes: whoever opens a product (a barcode scan, the showcase) can like it under their name.
// One like per name per product, kept in the "likes" collection (Firestore when connected, this browser otherwise).
// The name is asked once and remembered on this device.
import * as store from "./store.js?v=101";

const COL = "likes", NAME_KEY = "noir-like-name";
let all = null, loading = null;
const slug = s => String(s).trim().toLowerCase().replace(/\s+/g, "-").replace(/[/.#$[\]]/g, "").slice(0, 40);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar" || document.documentElement.lang === "ar";

export function loadLikes() {
  return loading ??= store.allDocs(COL).then(d => { all = d; return d; }).catch(() => { all = store.localDocs(COL); return all; });
}
export const likesFor = pid => (all || store.localDocs(COL)).filter(d => d.pid === pid).sort((a, b) => String(b.at).localeCompare(String(a.at)));
export function myName() { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } }
async function addLike(pid, name) {
  const doc = { pid, name: name.trim().slice(0, 30), at: new Date().toISOString() }, id = `${pid}__${slug(name)}`;
  await store.putDoc(COL, id, doc);
  all = [...(all || store.localDocs(COL)).filter(d => d.id !== id), { id, ...doc }];
}

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.4-9.3-9.2C1.5 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.5 4.5 6.8-1.8 4.8-9.3 9.2-9.3 9.2z"/></svg>';
// a like bar: heart + count + who; draws itself into `el` and keeps itself up to date
export function mountLikes(el, pid, { compact = false, lang } = {}) {
  if (!el) return;
  const ar = lang ? lang === "ar" : AR(), T = (en, a) => ar ? a : en;
  const draw = () => {
    const L = likesFor(pid), me = myName(), mine = !!me && L.some(d => slug(d.name) === slug(me));
    const names = L.slice(0, 2).map(d => esc(d.name)), more = L.length - names.length;
    const who = !L.length ? T("Be the first to like it", "كن أول من يعجبه")
      : ar ? `أعجب ${names.join("، ")}${more > 0 ? ` و${more} غيرهم` : ""}` : `Liked by ${names.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
    el.innerHTML = `<div class="lk ${compact ? "lk-compact" : ""}">
      <button type="button" class="lk-heart" aria-pressed="${mine}" aria-label="${T("Like", "إعجاب")}">${HEART}<b class="data">${L.length}</b></button>
      ${compact ? "" : `<p class="lk-who">${who}</p>`}
      <form class="lk-name" hidden><input class="input" name="n" maxlength="30" autocomplete="name" placeholder="${T("Your name", "اكتب اسمك")}" aria-label="${T("Your name", "اسمك")}" required><button class="btn sm hot" type="submit">${T("Like", "أعجبني")}</button></form>
    </div>`;
    const btn = el.querySelector(".lk-heart"), form = el.querySelector(".lk-name");
    btn.onclick = () => {
      if (mine) { burst(btn); return; }
      if (!myName()) { form.hidden = false; form.n.focus(); return; }
      save(myName());
    };
    form.onsubmit = e => { e.preventDefault(); const n = form.n.value.trim(); if (!n) return; try { localStorage.setItem(NAME_KEY, n); } catch {} save(n); };
    const save = async n => { btn.disabled = true; burst(btn); try { await addLike(pid, n); } catch {} draw(); };
  };
  draw();
  loadLikes().then(() => { if (el.isConnected) draw(); });
}
function burst(btn) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = btn.getBoundingClientRect(), box = document.createElement("div");
  box.className = "lk-burst"; box.style.left = `${r.left + r.width / 2}px`; box.style.top = `${r.top + r.height / 2}px`;
  box.innerHTML = Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36}deg;--d:${(i % 3) * .05}s">${HEART}</i>`).join("");
  document.body.append(box); setTimeout(() => box.remove(), 900);
}

// one-tap like from a product card: the saved name, or ask once; true when the product is now liked by this person
export const likedByMe = pid => { const me = myName(); return !!me && likesFor(pid).some(d => slug(d.name) === slug(me)); };
export async function quickLike(pid, ar) {
  let n = myName();
  if (!n) { n = (prompt(ar ? "اكتب اسمك عشان يتسجل الإعجاب" : "Your name, so the like is yours") || "").trim().slice(0, 30); if (!n) return false; try { localStorage.setItem(NAME_KEY, n); } catch {} }
  if (likedByMe(pid)) return true;
  await addLike(pid, n); return true;
}

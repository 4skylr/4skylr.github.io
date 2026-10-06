// Privacy lock. Money (values, costs, prices, revenue), recipes and the finance pages open with the clock PIN (HHMM)
// for this tab; 30 minutes without a tap locks them again. Quantities, dates, locations and barcodes stay open to all.
// NOTE: this hides data in the interface. The data files themselves are public on GitHub Pages; real protection needs
// them moved behind Firebase Auth (see README · Security).
import { timePinOk } from "./time-pin.js?v=89";

const KEY = "noir-admin", AT = "noir-admin-at", IDLE = 30 * 60e3;
export const MASK = "••••";
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} }, del: k => { try { sessionStorage.removeItem(k); } catch {} } };

export function isOpen() {
  if (ss.get(KEY) !== "1") return false;
  const at = Number(ss.get(AT)) || 0;
  if (at && Date.now() - at > IDLE) { lock(); return false; }
  return true;
}
export function touch() { if (ss.get(KEY) === "1") ss.set(AT, String(Date.now())); }
export function unlock(pin) {
  if (!timePinOk(pin)) return false;
  ss.set(KEY, "1"); ss.set(AT, String(Date.now()));
  dispatchEvent(new CustomEvent("noir-lock", { detail: { open: true } }));
  return true;
}
export function lock() {
  ss.del(KEY); ss.del(AT);
  dispatchEvent(new CustomEvent("noir-lock", { detail: { open: false } }));
}
// any tap or key keeps an open session alive
["pointerdown", "keydown"].forEach(e => addEventListener(e, touch, { passive: true, capture: true }));

const AR = () => (sessionStorage.getItem("noir-lang") || document.documentElement.lang || "en") === "ar";
// a small PIN sheet for places that are not a whole page (a recipe on a card, an export). Resolves true when open.
export function askPin({ lang } = {}) {
  if (isOpen()) return Promise.resolve(true);
  const ar = lang ? lang === "ar" : AR(), T = (en, a) => ar ? a : en;
  return new Promise(res => {
    const d = document.createElement("dialog");
    d.className = "pin-sheet"; d.dir = ar ? "rtl" : "ltr";
    d.innerHTML = `<form method="dialog" class="pin-form">
      <svg class="pin-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
      <h3>${T("Locked", "مقفل")}</h3><p>${T("Prices, costs and recipes open with the PIN.", "الأسعار والتكاليف والوصفات تنفتح بالرقم السري.")}</p>
      <input class="input pin-in" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]*" aria-label="${T("PIN", "الرقم السري")}" placeholder="••••">
      <p class="pin-err" hidden>${T("Wrong PIN", "الرقم غلط")}</p>
      <div class="pin-act"><button type="button" class="btn ghost" data-x>${T("Cancel", "إلغاء")}</button><button class="btn hot" type="submit">${T("Open", "فتح")}</button></div></form>`;
    document.body.append(d);
    const f = d.querySelector("form"), inp = f.pin, err = d.querySelector(".pin-err");
    const done = ok => { d.close(); d.remove(); res(ok); };
    d.querySelector("[data-x]").onclick = () => done(false);
    d.addEventListener("cancel", e => { e.preventDefault(); done(false); });
    inp.addEventListener("input", () => { err.hidden = true; if (inp.value.length === 4) f.requestSubmit(); });
    f.onsubmit = e => { e.preventDefault(); if (unlock(inp.value)) done(true); else { err.hidden = false; inp.value = ""; inp.focus(); d.querySelector(".pin-form").animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 260 }); } };
    d.showModal(); inp.focus();
  });
}

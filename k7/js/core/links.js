// Links — quick doors to the systems the reports come from. Opens them in a new tab; no passwords are kept here.
import { isOpen } from "./lock.js?v=100";
const AR = () => (sessionStorage.getItem("noir-lang") || "en") === "ar";
const COL = "links";
export const BUILT_IN = [
  { id: "unaizah-system", name: "Unaizah system", nameAr: "نظام عنيزة", url: "http://20.31.134.112/unaizah/",
    note: "Sign in with your own account, export the report, then upload it under Settings · Required reports.",
    noteAr: "سجّل دخولك بحسابك، طلّع التقرير، وارفعه من الإعدادات ← التقارير المطلوبة.", builtIn: true },
  { id: "developer", name: "Contact the developer", nameAr: "تواصل مع المطور", url: "https://wa.me/966561105517",
    note: "WhatsApp · +966 56 110 5517", noteAr: "واتساب · ‎+966 56 110 5517", builtIn: true }
];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const host = u => { try { return new URL(u).host; } catch { return u; } };
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

export async function renderLinks(el, H) {
  const ar = AR(), admin = isOpen();
  let saved = [];
  try { saved = await H.allDocs(COL); } catch { saved = H.localDocs(COL); }
  const list = [...BUILT_IN, ...saved.filter(l => !l.deleted && safeUrl(l.url)).sort((a, b) => (a.at || "").localeCompare(b.at || ""))];
  const T = ar ? { open: "افتح", add: "إضافة رابط", name: "الاسم", url: "الرابط", note: "ملاحظة (اختياري)", save: "حفظ", del: "حذف", lock: "إضافة وحذف الروابط بالرقم السري حق الإعدادات.", http: "غير مشفّر (http)", bad: "الرابط لازم يبدأ بـ http أو https" }
    : { open: "Open", add: "Add a link", name: "Name", url: "URL", note: "Note (optional)", save: "Save", del: "Delete", lock: "Adding and removing links needs the Settings PIN.", http: "Not encrypted (http)", bad: "The link must start with http or https" };
  el.innerHTML = `<div class="lk">
    <div class="lk-grid">${list.map(l => { const u = safeUrl(l.url);
      return `<article class="lk-card${l.builtIn ? " main" : ""}">
        <div class="lk-ic">${esc((ar ? l.nameAr || l.name : l.name).trim().slice(0, 1))}</div>
        <div class="lk-tx"><b>${esc(ar ? l.nameAr || l.name : l.name)}</b><span class="data" dir="ltr">${esc(host(u))}</span>
          ${(ar ? l.noteAr || l.note : l.note) ? `<p>${esc(ar ? l.noteAr || l.note : l.note)}</p>` : ""}
          ${u.startsWith("http:") ? `<em>⚠ ${T.http}</em>` : ""}</div>
        <div class="lk-act"><a class="btn hot" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${T.open} ↗</a>
          ${admin && !l.builtIn ? `<button class="btn ghost" data-del="${esc(l.id)}">${T.del}</button>` : ""}</div>
      </article>`; }).join("")}</div>
    ${admin ? `<form class="slab lk-form" id="lk-form"><h3>${T.add}</h3>
      <input class="input" name="name" placeholder="${T.name}" required maxlength="60">
      <input class="input" name="url" placeholder="https://…" required dir="ltr" inputmode="url">
      <input class="input" name="note" placeholder="${T.note}" maxlength="160">
      <button class="btn hot" type="submit">${T.save}</button></form>` : `<p class="note lk-lock"><svg class="ic-lock" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> ${T.lock}</p>`}
  </div>`;
  el.querySelector("#lk-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, url = safeUrl(f.url.value.trim());
    if (!url) { H.toast(T.bad, true); return; }
    const id = "l" + Date.now().toString(36);
    await H.putDoc(COL, id, { name: f.name.value.trim(), url, note: f.note.value.trim(), at: new Date().toISOString() });
    renderLinks(el, H);
  });
  el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    const l = saved.find(x => x.id === b.dataset.del); if (!l) return;
    await H.putDoc(COL, l.id, { ...l, deleted: true });
    renderLinks(el, H);
  });
}

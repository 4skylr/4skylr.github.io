// Branch access. Admin adds people. A code opens one branch, never the others.
import { putDoc, allDocs, localDocs, uploadFile } from "./store.js?v=115";

export const BRANCHES = [
  { id: "unaizah", name: "Unaizah" },
  { id: "buraydah", name: "Buraydah" },
  { id: "midhnab", name: "Al Midhnab" },
  { id: "rass", name: "Ar Rass" },
  { id: "hafar", name: "Hafar Al-Batin" }
];
const COL = "people";
const REPORTS = "branchReports";

export function who() {
  try { return JSON.parse(sessionStorage.getItem("noir-who") || "null"); } catch { return null; }
}
export const isAdmin = () => who()?.role === "admin";
export const branchOf = () => who()?.branch || "unaizah";
export const branchName = id => BRANCHES.find(b => b.id === id)?.name || id;

export function signOut() {
  try {
    sessionStorage.removeItem("noir-site");
    sessionStorage.removeItem("noir-admin");
    sessionStorage.removeItem("noir-who");
    sessionStorage.removeItem("noir-at");
  } catch {}
  location.reload();
}
export async function watchKick() {
  const me = who();
  if (!me || me.id === "admin") return;
  const at = Number(sessionStorage.getItem("noir-at") || 0);
  const row = (await allDocs(COL)).find(p => p.id === me.id);
  if (row?.kickedAt && Date.parse(row.kickedAt) > at) signOut();
}
export async function kick(id) {
  const row = (await allDocs(COL)).find(p => p.id === id);
  if (!row) return;
  await putDoc(COL, id, { ...row, kickedAt: new Date().toISOString() });
}

export async function syncPeople() {
  return allDocs(COL);
}
function list() {
  return localDocs(COL).filter(p => p && p.pin && p.active !== false);
}
function photoKey(id) { return "ipop-photo:" + id; }
export function photoOf(id) {
  try { return localStorage.getItem(photoKey(id)) || ""; } catch { return ""; }
}

export async function renderPeople(el, { toast }) {
  const people = (await syncPeople()).filter(p => p.pin);
  const me = who();
  el.innerHTML = `
    <header class="slab" style="background:var(--section);border:0;border-radius:0;margin:0 -24px 24px;padding:28px 24px">
      <img src="assets/brand/ipop-mark.webp" alt="iPop" style="width:100%;height:140px;object-fit:contain">
      <h2 style="margin:8px 0 0;font-weight:600">iPop</h2>
      <p class="lede" style="margin:2px 0 0">Access · admin only</p>
    </header>
    <section>
      ${people.map(p => `<article class="block" style="display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:center;padding:16px 0;border-top:1px solid var(--hairline-soft)">
        <span style="width:48px;height:48px;border-radius:8px;border:1px solid var(--hairline);background:#f5f5f7 center/cover url('${photoOf(p.id)}')"></span>
        <span><b>${esc(p.name)}</b><small style="display:block;font-weight:300;color:var(--muted)">${esc(p.role)} · ${esc(branchName(p.branch))}</small>
        <span class="tag">${esc(p.pin)}</span> <button type="button" class="btn sm" data-kick="${esc(p.id)}">Kick</button></span></article>`).join("") || `<p class="lede">No people yet. Add the first code.</p>`}
    </section>
    <form id="person-form" class="slab" style="display:grid;gap:12px;margin-top:24px">
      <label>Name<input class="input" name="name" required maxlength="40"></label>
      <label>Code<input class="input" name="pin" inputmode="numeric" required maxlength="4" pattern="[0-9]{3,4}"></label>
      <label>Role<select class="input" name="role"><option value="employee">Employee</option><option value="supervisor">Supervisor</option></select></label>
      <label>Branch<select class="input" name="branch">${BRANCHES.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}</select></label>
      <button class="btn hot" type="submit">Add person</button>
    </form>
    <button type="button" class="btn" id="sign-out" style="margin-bottom:12px">Sign out</button><p class="note">A code opens that branch only. ${esc(me?.name || "Admin")} can add people. Branch stock and reports stay hidden from the others.</p>`;
  el.querySelector("#person-form").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const pin = String(f.get("pin") || "").trim();
    if (pin === "899" || people.some(p => p.pin === pin)) return toast("That code is already used", true);
    const id = "p-" + Date.now().toString(36);
    await putDoc(COL, id, { id, name: String(f.get("name")).trim(), pin, role: f.get("role"), branch: f.get("branch"), active: true, at: new Date().toISOString() });
    toast("Person added");
    renderPeople(el, { toast });
  };
  el.querySelector("#sign-out").onclick = signOut;
  el.querySelectorAll("[data-kick]").forEach(b => b.onclick = async () => { await kick(b.dataset.kick); toast("Kicked"); renderPeople(el, { toast }); });
}

export async function renderBranch(el, { toast }) {
  const me = who();
  if (!me) return;
  const mine = (await allDocs(REPORTS)).filter(r => r.branch === me.branch).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const pic = photoOf(me.id);
  el.innerHTML = `
    <header class="slab" style="background:var(--section);border:0;border-radius:0;margin:0 -24px 24px;padding:28px 24px">
      <div style="display:flex;gap:12px;align-items:center">
        <span id="me-ava" style="width:64px;height:64px;border-radius:8px;border:1px solid var(--hairline);background:#fff center/cover ${pic ? `url('${pic}')` : "none"}"></span>
        <span><b style="font-size:22px">${esc(me.name)}</b><small style="display:block;font-weight:300;color:var(--muted)">Signed in · this phone</small></span>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px"><span class="tag">${esc(me.role)}</span><span class="tag">${esc(branchName(me.branch))}</span></div>
      <label class="btn" style="margin-top:16px;color:#0066cc;border:1px solid #0066cc;background:#fff">Add photo<input id="me-photo" type="file" accept="image/*" hidden></label>
    </header>
    <h2 style="font-weight:600">Your reports</h2>
    <p class="lede">Only what this branch uploaded.</p>
    ${mine.map(r => `<article class="block" style="padding:12px 0;border-top:1px solid var(--hairline-soft)"><b>${esc(r.title)}</b><small style="display:block;font-weight:300;color:var(--muted)">${esc(r.at.slice(0, 16).replace("T", " · "))}${r.url ? ` · <a href="${esc(r.url)}">file</a>` : ""}</small></article>`).join("") || `<p class="note">Nothing uploaded yet.</p>`}
    <form id="rep-form" style="display:grid;gap:12px;margin-top:24px">
      <input class="input" name="title" placeholder="Report name" required maxlength="80">
      <input class="input" name="file" type="file">
      <button class="btn hot" type="submit">Upload a report</button>
    </form>
    <button type="button" class="btn" id="sign-out">Sign out</button><p class="note">Other branches stay hidden.</p>`;
  el.querySelector("#me-photo").onchange = e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { localStorage.setItem(photoKey(me.id), reader.result); } catch {} renderBranch(el, { toast }); };
    reader.readAsDataURL(file);
  };
  el.querySelector("#rep-form").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const id = "r-" + Date.now().toString(36);
    const file = f.get("file");
    let saved = "", url = "";
    if (file && file.size) {
      saved = file.name;
      const up = await uploadFile(`branches/${me.branch}/${id}-${file.name}`, file, file.type || "application/octet-stream");
      url = up?.url || "";
    }
    await putDoc(REPORTS, id, { id, branch: me.branch, by: me.id, title: String(f.get("title")).trim(), file: saved, url, at: new Date().toISOString() });
    toast("Saved to " + branchName(me.branch));
    renderBranch(el, { toast });
  };
  el.querySelector("#sign-out").onclick = signOut;
}
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&", "<": "<", ">": ">", '"': """ }[c])); }

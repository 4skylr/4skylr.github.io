// People (admin only): who can open iPop, with which code, in which branch and role.
// Adding a person creates their sign-in account (their code) and their users/<uid> record; removing deletes the record,
// which closes every branch to that code at once (firestore.rules read it on every request).
import { BRANCHES, ROLES, branchName, roleName, session } from "./session.js?v=106";

const ONLINE_MS = 5 * 60 * 1000;
export async function renderPeople(host, H) {
  if (!host) return;
  const door = globalThis.IPOP_DOOR, esc = H.esc;
  let people = [], online = [], picked = null, protectedState = "";
  const load = async () => {
    [people, online, protectedState] = await Promise.all([door.people().catch(() => []), door.online().catch(() => []), door.probe().catch(() => "unknown")]);
    people.sort((a, b) => (a.role === "admin" ? -1 : b.role === "admin" ? 1 : 0) || String(a.branch).localeCompare(String(b.branch)) || String(a.name).localeCompare(String(b.name)));
  };
  const isOnline = uid => online.some(o => o.uid === uid && Date.now() - Date.parse(o.at) < ONLINE_MS);
  const mark = id => `<span class="br-mark" title="${esc(branchName(id))}">${esc(BRANCHES.find(b => b.id === id)?.code || "—")}</span>`;
  const paint = () => {
    const me = session()?.uid;
    host.innerHTML = `<section class="slab people">
      <div class="slab-h"><h2>People</h2><span class="voice">Admin only. A code opens that person's branch.</span></div>
      <p class="people-state ${protectedState === "protected" ? "is-ok" : "is-warn"}">${protectedState === "protected" ? "Access rules are published: each code reaches only its branch."
        : protectedState === "local" ? "Test mode on this computer: nothing leaves this browser."
        : "The access rules are not published in Firebase yet, so the database is still open. Publish firestore.rules (see the steps in the repository) to lock it."}</p>
      <ul class="people-list">${people.map(p => `<li class="${p.uid === picked ? "is-picked" : ""}" data-uid="${esc(p.uid)}" tabindex="0" role="option" aria-selected="${p.uid === picked}">
          ${mark(p.branch)}<span class="pp-id"><b>${esc(p.name)}${p.uid === me ? " · you" : ""}</b><small>${esc(roleName(p.role))} · ${esc(branchName(p.branch))}</small></span>
          ${isOnline(p.uid) ? `<span class="pp-on"><i aria-hidden="true"></i>Online</span>` : ""}<span class="pp-code data">${esc(p.code || "—")}</span></li>`).join("") || `<li class="empty">Nobody yet.</li>`}</ul>
      <form class="people-form" autocomplete="off">
        <label for="pp-name">Name</label><input class="input" id="pp-name" name="name" maxlength="40" placeholder="New person" required>
        <label for="pp-code">Code</label><input class="input data" id="pp-code" name="code" inputmode="numeric" pattern="\\d{4}" maxlength="4" placeholder="4 digits" required>
        <label for="pp-role">Role</label><select class="select" id="pp-role" name="role">${ROLES.filter(r => r.id !== "admin").map(r => `<option value="${r.id}">${r.name} · ${r.note}</option>`).join("")}</select>
        <label for="pp-branch">Branch</label><select class="select" id="pp-branch" name="branch">${BRANCHES.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}</select>
        <p class="people-msg" role="alert"></p>
        <button type="submit" class="btn hot">Add person</button>
        <button type="button" class="btn" data-remove ${picked ? "" : "disabled"}>${picked ? `Remove ${esc(people.find(p => p.uid === picked)?.name || "")}` : "Remove · pick someone above"}</button>
      </form>
      <p class="note people-foot">Their screen shows only their branch: its stock, counts and the reports they upload. Prices, photos and the menu are shared.</p>
    </section>`;
    wire();
  };
  const say = (t, ok) => { const m = host.querySelector(".people-msg"); m.textContent = t; m.classList.toggle("ok", !!ok); };
  const wire = () => {
    host.querySelectorAll(".people-list li[data-uid]").forEach(li => {
      const pick = () => { picked = picked === li.dataset.uid ? null : li.dataset.uid; paint(); };
      li.onclick = pick; li.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
    });
    const f = host.querySelector(".people-form");
    f.onsubmit = async e => {
      e.preventDefault();
      const name = f.name.value.trim(), code = f.code.value.trim(), role = f.role.value, branch = f.branch.value;
      if (!name) return say("Write the person's name.");
      if (!/^\d{4}$/.test(code)) return say("The code is 4 digits.");
      if (people.some(p => p.code === code)) return say("That code is taken. Choose another.");
      const btn = f.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Adding…";
      try { await door.addPerson({ name, code, role, branch }); await load(); paint(); say(`${name} can sign in with ${code} · ${branchName(branch)}.`, true); H.toast(`${name} added · ${branchName(branch)}`); }
      catch (x) { btn.disabled = false; btn.textContent = "Add person"; say(x.kind === "wrong" ? "That code belongs to another account. Choose another." : x.kind === "disabled" ? "Sign-in is switched off in Firebase (Authentication → Sign-in method → Email/Password)." : (x.message || "Could not add.")); }
    };
    host.querySelector("[data-remove]").onclick = async () => {
      const p = people.find(x => x.uid === picked); if (!p) return;
      if (p.uid === session()?.uid) return say("You cannot remove yourself.");
      if (p.role === "admin") return say("The admin cannot be removed here.");
      try { await door.removePerson(p.uid); picked = null; await load(); paint(); H.toast(`${p.name} removed · their code no longer opens iPop`); }
      catch (x) { say(x.message || "Could not remove."); }
    };
  };
  host.innerHTML = `<section class="slab people"><div class="slab-h"><h2>People</h2></div><p class="note">Loading…</p></section>`;
  await load(); paint();
}

// The door: nothing of iPop loads until a code is accepted.
//   · Each person is a Firebase Authentication account. The code is never stored in this site: it is turned into the
//     account's e-mail and password here, and Firebase checks it on its own servers (and slows down repeated guesses).
//   · The person's name, role and branch are in users/<uid>, which only the admin writes (firestore.rules).
//   · The first code entered before anyone is set up becomes the admin code (door/state marks it done).
//   · Unaizah keeps its original collections; Al Mithnab and Al Khafji read and write branches/<id>/… only.
// On localhost (the tests), when Firebase cannot be reached, a stand-in keeps the same rules in this browser.
import { firebaseConfig, FIREBASE_SDK_VERSION } from "./core/firebase-config.js?v=106";
import { BRANCHES, HOME } from "./core/session.js?v=106";

const V = new URL(import.meta.url).searchParams.get("v") || "106"; // the same version index.html asked for
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const enc = new TextEncoder();
const hex = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
// the code becomes an address and a password that only make sense together; neither is kept anywhere
const emailOf = async code => `d${(await hex("ipop-door-v1|" + code)).slice(0, 24)}@door.ipop.app`;
const passOf = code => `ipop|${code}|door-v1`;
class DoorError extends Error { constructor(kind, msg) { super(msg || kind); this.kind = kind; } }
const why = e => {
  const c = e?.code || "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return new DoorError("wrong");
  if (/too-many-requests/.test(c)) return new DoorError("throttled");
  if (/operation-not-allowed|admin-restricted/.test(c)) return new DoorError("disabled");
  if (/network-request-failed|unavailable/.test(c)) return new DoorError("network");
  if (/permission-denied/.test(c)) return new DoorError("denied");
  return new DoorError("other", `${MSG.other} (${c || e?.message || "unknown"})`);
};

// ── Firebase ───────────────────────────────────────────────
async function firebaseDoor() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const [appM, au, fs] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
  const app = appM.initializeApp(firebaseConfig), auth = au.getAuth(app), db = fs.getFirestore(app);
  globalThis.IPOP_FB = { app, auth, db, fs, au, appM };
  let side = null; // a second, in-memory sign-in used only to create someone else's account
  const sideAuth = () => side ??= au.initializeAuth(appM.initializeApp(firebaseConfig, "door-add"), { persistence: au.inMemoryPersistence });
  const ref = (...p) => fs.doc(db, ...p);
  const accountUid = async (a, code, create) => {
    const email = await emailOf(code);
    try { return (create ? await au.createUserWithEmailAndPassword(a, email, passOf(code)) : await au.signInWithEmailAndPassword(a, email, passOf(code))).user.uid; }
    catch (e) {
      if (create && /email-already-in-use/.test(e.code)) return (await au.signInWithEmailAndPassword(a, email, passOf(code)).catch(x => { throw why(x); })).user.uid;
      throw why(e);
    }
  };
  return {
    kind: "firebase",
    async current() { await auth.authStateReady(); const u = auth.currentUser; if (u?.isAnonymous) { await au.signOut(auth); return null; } return u?.uid || null; },
    signIn: code => accountUid(auth, code, false),
    async signOut() { await au.signOut(auth); },
    async ready() { try { return (await fs.getDoc(ref("door", "state"))).exists(); } catch (e) { throw why(e); } },
    async bootstrap(code, name) {
      const uid = await accountUid(auth, code, true), at = new Date().toISOString(), b = fs.writeBatch(db);
      b.set(ref("users", uid), { name, role: "admin", branch: HOME, code, active: true, createdAt: at });
      b.set(ref("door", "state"), { ready: true, at, by: uid });
      try { await b.commit(); } catch (e) { await au.signOut(auth); throw why(e); }
      return uid;
    },
    async profile(uid) { try { const s = await fs.getDoc(ref("users", uid)); return s.exists() ? { uid, ...s.data() } : null; } catch (e) { throw why(e); } },
    async people() { return (await fs.getDocs(fs.collection(db, "users"))).docs.map(d => ({ uid: d.id, ...d.data() })); },
    async addPerson({ name, code, role, branch }) {
      const a = sideAuth(), uid = await accountUid(a, code, true);
      await au.signOut(a).catch(() => {});
      await fs.setDoc(ref("users", uid), { name, role, branch, code, active: true, createdAt: new Date().toISOString(), createdBy: auth.currentUser?.uid || "" });
      return uid;
    },
    async removePerson(uid) { await fs.deleteDoc(ref("users", uid)); },
    async presence(p) { await fs.setDoc(ref("presence", p.uid), { name: p.name, role: p.role, branch: p.branch, at: new Date().toISOString() }).catch(() => {}); },
    async online() { try { return (await fs.getDocs(fs.collection(db, "presence"))).docs.map(d => ({ uid: d.id, ...d.data() })); } catch { return []; } },
    // a document the rules close to everyone: reading it tells whether the rules are published
    async probe() { try { await fs.getDoc(ref("door", "sealed")); return "open"; } catch (e) { return /permission-denied/.test(e.code) ? "protected" : "unknown"; } }
  };
}

// ── the stand-in (localhost only): same flow, kept in this browser ──
function localDoor() {
  const K = "ipop-door-local", read = () => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch { return {}; } };
  const write = d => localStorage.setItem(K, JSON.stringify(d)), db = () => ({ accounts: {}, users: {}, presence: {}, ...read() });
  const uidOf = async code => "u" + (await hex("local|" + code)).slice(0, 12);
  return {
    kind: "local",
    async current() { return sessionStorage.getItem("ipop-door-uid") || null; },
    async signIn(code) { const d = db(), uid = await uidOf(code); if (!d.accounts[uid]) throw new DoorError("wrong"); sessionStorage.setItem("ipop-door-uid", uid); return uid; },
    async signOut() { sessionStorage.removeItem("ipop-door-uid"); },
    async ready() { return !!db().ready; },
    async bootstrap(code, name) { const d = db(), uid = await uidOf(code); d.accounts[uid] = 1; d.users[uid] = { name, role: "admin", branch: HOME, code, active: true, createdAt: new Date().toISOString() }; d.ready = true; write(d); sessionStorage.setItem("ipop-door-uid", uid); return uid; },
    async profile(uid) { const u = db().users[uid]; return u ? { uid, ...u } : null; },
    async people() { return Object.entries(db().users).map(([uid, u]) => ({ uid, ...u })); },
    async addPerson({ name, code, role, branch }) { const d = db(), uid = await uidOf(code); d.accounts[uid] = 1; d.users[uid] = { name, role, branch, code, active: true, createdAt: new Date().toISOString() }; write(d); return uid; },
    async removePerson(uid) { const d = db(); delete d.users[uid]; write(d); },
    async presence(p) { const d = db(); d.presence[p.uid] = { name: p.name, role: p.role, branch: p.branch, at: new Date().toISOString() }; write(d); },
    async online() { return Object.entries(db().presence).map(([uid, x]) => ({ uid, ...x })); },
    async probe() { return "local"; }
  };
}

// ── the lock screen ───────────────────────────────────────
const MSG = {
  wrong: "That code is not right.", throttled: "Too many tries. Wait a minute, then try again.",
  disabled: "Sign-in is switched off in Firebase. In the Firebase console: Authentication → Sign-in method → Email/Password → Enable.",
  network: "No connection to the sign-in service. Check the internet and try again.", denied: "This code is not active. Ask the admin.",
  inactive: "This code is not active. Ask the admin.", other: "Could not sign in. Try again."
};
function doorHtml() {
  return `<div class="door" id="door" role="dialog" aria-modal="true" aria-labelledby="door-title">
    <section class="door-mark" aria-hidden="true"><img src="assets/brand/ipop-mark.webp" alt="" width="724" height="900" decoding="async"></section>
    <section class="door-main">
      <h1 class="door-title" id="door-title">iPop</h1>
      <p class="door-sub">People of Performance</p>
      <div class="door-dots" aria-hidden="true">${"<i></i>".repeat(4)}</div>
      <p class="door-msg" role="alert" aria-live="assertive"></p>
      <div class="door-acts"><button type="button" class="btn hot door-go" disabled>Sign in</button><button type="button" class="btn door-clear">Clear</button></div>
      <p class="door-lock"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>Encrypted sign-in · one code opens one branch</p>
    </section>
    <section class="door-pad" aria-label="Code">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(k => k === "" ? `<span></span>`
      : `<button type="button" class="door-key" data-k="${k}" aria-label="${k === "⌫" ? "Delete" : k}">${k}</button>`).join("")}</section>
  </div>`;
}
function setupHtml(code) {
  return `<div class="door-setup"><h2>Set up iPop</h2>
    <p>No one is set up yet. The code you typed (${"•".repeat(code.length)}) becomes the <b>admin code</b>: it opens every branch and adds people.</p>
    <label for="door-name">Admin name</label><input class="input" id="door-name" value="Skylr" autocomplete="name" maxlength="40">
    <div class="door-acts"><button type="button" class="btn hot" data-setup>Make admin</button><button type="button" class="btn" data-cancel>Cancel</button></div></div>`;
}

async function enter(api, uid) {
  const prof = await api.profile(uid);
  if (!prof || prof.active === false) { await api.signOut(); throw new DoorError("inactive"); }
  const admin = prof.role === "admin";
  let view = admin ? sessionStorage.getItem("ipop-view-branch") : null;
  if (!BRANCHES.some(b => b.id === view)) view = null;
  globalThis.IPOP_SESSION = { uid, name: prof.name || "", role: prof.role || "employee", branch: view || prof.branch || HOME, home: prof.branch || HOME };
  globalThis.IPOP_DOOR = {
    kind: api.kind,
    lock: async () => { await api.signOut(); sessionStorage.removeItem("ipop-view-branch"); location.reload(); },
    viewBranch: id => { if (!admin) return; sessionStorage.setItem("ipop-view-branch", id); location.reload(); },
    people: () => api.people(), addPerson: p => api.addPerson(p), removePerson: uid => api.removePerson(uid),
    online: () => api.online(), probe: () => api.probe()
  };
  api.presence(globalThis.IPOP_SESSION);
  setInterval(() => { if (!document.hidden) api.presence(globalThis.IPOP_SESSION); }, 120000);
  document.getElementById("door")?.remove();
  document.documentElement.classList.remove("door-open");
  await import(`./app.js?v=${V}`);
}

function showDoor(api) {
  document.body.insertAdjacentHTML("beforeend", doorHtml());
  document.documentElement.classList.add("door-open");
  window.NoirCurtain?.open();
  const el = document.getElementById("door"), dots = [...el.querySelectorAll(".door-dots i")], msg = el.querySelector(".door-msg");
  const go = el.querySelector(".door-go"), main = el.querySelector(".door-main");
  let code = "", busy = false;
  const paint = () => { dots.forEach((d, i) => d.classList.toggle("on", i < code.length)); go.disabled = code.length < 3 || busy; };
  const say = (t, bad = true) => { msg.textContent = t; msg.classList.toggle("bad", bad); if (bad) { el.querySelector(".door-dots").classList.remove("shake"); void el.offsetWidth; el.querySelector(".door-dots").classList.add("shake"); } };
  const key = k => { if (busy) return; if (k === "⌫") code = code.slice(0, -1); else if (code.length < 4) code += String(k); say("", false); paint(); };
  el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => key(b.dataset.k));
  el.querySelector(".door-clear").onclick = () => { code = ""; say("", false); paint(); };
  addEventListener("keydown", e => {
    if (!document.getElementById("door") || e.target.closest?.("input")) return;
    if (/^\d$/.test(e.key)) key(e.key); else if (e.key === "Backspace") key("⌫"); else if (e.key === "Enter" && !go.disabled) go.click();
  });
  go.onclick = async () => {
    busy = true; paint(); go.textContent = "Checking…";
    try { await enter(api, await api.signIn(code)); return; }
    catch (e) {
      if (e.kind === "wrong" && !(await api.ready().catch(() => true))) { setup(); return; }
      say(e.kind === "other" ? e.message : MSG[e.kind] || MSG.other); code = "";
    }
    busy = false; go.textContent = "Sign in"; paint();
  };
  // nobody set up yet: this code becomes the admin
  const setup = () => {
    const keep = main.innerHTML; main.innerHTML = setupHtml(code);
    const back = () => { main.innerHTML = keep; location.reload(); };
    main.querySelector("[data-cancel]").onclick = back;
    main.querySelector("[data-setup]").onclick = async e => {
      const name = main.querySelector("#door-name").value.trim() || "Admin"; e.target.disabled = true; e.target.textContent = "Setting up…";
      try { await enter(api, await api.bootstrap(code, name)); }
      catch (x) { e.target.disabled = false; e.target.textContent = "Make admin"; main.querySelector("p").textContent = MSG[x.kind] || x.message || MSG.other; }
    };
  };
  paint();
}

(async () => {
  let api;
  try { api = await firebaseDoor(); }
  catch (e) {
    if (!LOCAL) { document.body.insertAdjacentHTML("beforeend", doorHtml()); window.NoirCurtain?.open(); const m = document.querySelector(".door-msg"); m.textContent = MSG.network; m.classList.add("bad"); document.querySelector(".door-go").disabled = true; return; }
    api = localDoor();
  }
  try { const uid = await api.current(); if (uid) { await enter(api, uid); return; } } catch { /* signed out, or no longer active */ }
  showDoor(api);
})();

// Data layer: Firestore + Storage when configured, otherwise localStorage
import { firebaseConfig, FIREBASE_SDK_VERSION } from "./firebase-config.js";
import { SEED_PRODUCTS } from "./seed-data.js";

const LS_KEY = "noir-inventory:v2";
const COL = { products: "products", sessions: "countSessions", activity: "activity" };

let mode = "local";
let fb = null; // { db, storage, fs, st }
let mem = { products: [], sessions: [], activity: [] };
const listeners = new Set();

export const LOCATIONS = [
  { id: "mini", name: "Mini Store", short: "Mini", code: "MNI" },
  { id: "refuel", name: "Refuel", short: "Refuel", code: "RFL" },
  { id: "stores", name: "Main Stores", short: "Stores", code: "STR" }
];

export const CATEGORIES = [
  { id: "syrups", name: "BIB Syrups" },
  { id: "drinks", name: "Drinks & Water" },
  { id: "snacks", name: "Candy & Snacks" },
  { id: "popcorn", name: "Popcorn & Floss" },
  { id: "food", name: "Food & Sauces" },
  { id: "slush", name: "Slush" },
  { id: "icecream", name: "Ice Cream" },
  { id: "hot", name: "Hot Drinks" },
  { id: "packaging", name: "Packaging" },
  { id: "removals", name: "Removals" },
  { id: "other", name: "Other" }
];

export const UNITS = { pcs: "pcs", kg: "kg", ltr: "L", box: "box" };

export function txHash() {
  const a = new Uint8Array(8);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return "0x" + Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
}

function emit() { listeners.forEach(fn => { try { fn(snapshot()); } catch (e) { console.error(e); } }); }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function snapshot() { return { products: mem.products, sessions: mem.sessions, activity: mem.activity, mode }; }
export function getMode() { return mode; }

// ── Local persistence ────────────────────────────────────────
function lsRead() {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function lsWrite() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(mem)); } catch (e) { console.warn("Could not save to browser storage", e); }
}
const clone = o => JSON.parse(JSON.stringify(o));

function seedProducts() {
  const now = new Date().toISOString();
  return SEED_PRODUCTS.map(p => ({ ...clone(p), createdAt: now, updatedAt: now }));
}

// ── Init ─────────────────────────────────────────────────────
export async function init() {
  if (firebaseConfig.apiKey) {
    try { await initFirebase(); mode = "firebase"; emit(); return mode; }
    catch (e) { console.error("Firebase connection failed, falling back to local mode", e); }
  }
  mode = "local";
  const saved = lsRead();
  mem = saved && saved.products?.length ? saved : { products: seedProducts(), sessions: [], activity: [] };
  if (!saved) { log("seed", `Loaded ${mem.products.length} products from the stock report`); lsWrite(); }
  emit();
  return mode;
}

async function initFirebase() {
  const v = FIREBASE_SDK_VERSION, base = `https://www.gstatic.com/firebasejs/${v}`;
  const [{ initializeApp }, fs, st, au] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-storage.js`),
    import(`${base}/firebase-auth.js`)
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = au.getAuth(app);
  await au.signInAnonymously(auth); // enable Anonymous sign-in under Authentication
  const db = fs.getFirestore(app);
  const storage = st.getStorage(app);
  fb = { db, storage, fs, st };

  // first run: upload the report data
  const first = await fs.getDocs(fs.query(fs.collection(db, COL.products), fs.limit(1)));
  if (first.empty) {
    const items = seedProducts();
    for (let i = 0; i < items.length; i += 400) {
      const batch = fs.writeBatch(db);
      items.slice(i, i + 400).forEach(p => batch.set(fs.doc(db, COL.products, p.id), p));
      await batch.commit();
    }
    await log("seed", `Loaded ${items.length} products from the stock report`);
  }

  const live = (name, key, order) => new Promise(resolve => {
    let firstLoad = true;
    fs.onSnapshot(fs.query(fs.collection(db, name), ...(order ? [fs.orderBy(order, "desc"), fs.limit(200)] : [])), snap => {
      mem[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      emit();
      if (firstLoad) { firstLoad = false; resolve(); }
    });
  });
  await Promise.all([
    live(COL.products, "products"),
    live(COL.sessions, "sessions", "createdAt"),
    live(COL.activity, "activity", "at")
  ]);
}

// ── Activity ledger ───────────────────────────────────
export async function log(type, text) {
  const entry = { id: txHash(), type, text, at: new Date().toISOString() };
  if (mode === "firebase" && fb) {
    await fb.fs.setDoc(fb.fs.doc(fb.db, COL.activity, entry.id), entry);
  } else {
    mem.activity = [entry, ...mem.activity].slice(0, 200);
    lsWrite(); emit();
  }
}

// ── Products ─────────────────────────────────────────────────
export async function saveProduct(p, { silent = false } = {}) {
  const now = new Date().toISOString();
  const isNew = !mem.products.some(x => x.id === p.id);
  const doc = { ...p, updatedAt: now, createdAt: p.createdAt || now };
  if (mode === "firebase") {
    await fb.fs.setDoc(fb.fs.doc(fb.db, COL.products, doc.id), doc);
  } else {
    mem.products = isNew ? [...mem.products, doc] : mem.products.map(x => x.id === doc.id ? doc : x);
    lsWrite(); emit();
  }
  if (!silent) await log(isNew ? "add" : "edit", `${isNew ? "Added" : "Updated"} ${doc.name}`);
  return doc;
}

export async function deleteProduct(id) {
  const p = mem.products.find(x => x.id === id);
  if (mode === "firebase") {
    await fb.fs.deleteDoc(fb.fs.doc(fb.db, COL.products, id));
    if (p?.imagePath) { try { await fb.st.deleteObject(fb.st.ref(fb.storage, p.imagePath)); } catch {} }
  } else {
    mem.products = mem.products.filter(x => x.id !== id);
    lsWrite(); emit();
  }
  await log("delete", `Deleted ${p?.name || id}`);
}

// compress to a 512px square WebP, then upload
export async function uploadImage(productId, file) {
  const blob = await compressImage(file, 512);
  if (mode === "firebase") {
    const path = `products/${productId}-${Date.now()}.webp`;
    const r = fb.st.ref(fb.storage, path);
    await fb.st.uploadBytes(r, blob, { contentType: "image/webp" });
    return { url: await fb.st.getDownloadURL(r), path };
  }
  return { url: await blobToDataURL(blob), path: "" };
}

function compressImage(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = size;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
      const s = Math.min(size / img.width, size / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      c.toBlob(b => b ? resolve(b) : reject(new Error("Could not compress the image")), "image/webp", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("That file is not a readable image"));
    img.src = URL.createObjectURL(file);
  });
}
const blobToDataURL = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });

// ── Count sessions ──────────────────────────────
export async function saveSession(s) {
  const doc = { ...s, updatedAt: new Date().toISOString() };
  if (mode === "firebase") {
    await fb.fs.setDoc(fb.fs.doc(fb.db, COL.sessions, doc.id), doc);
  } else {
    const exists = mem.sessions.some(x => x.id === doc.id);
    mem.sessions = exists ? mem.sessions.map(x => x.id === doc.id ? doc : x) : [doc, ...mem.sessions];
    lsWrite(); emit();
  }
  return doc;
}

export async function deleteSession(id) {
  if (mode === "firebase") await fb.fs.deleteDoc(fb.fs.doc(fb.db, COL.sessions, id));
  else { mem.sessions = mem.sessions.filter(x => x.id !== id); lsWrite(); emit(); }
  await log("delete", `Deleted count session ${id.slice(0, 10)}`);
}

// commit: overwrite system stock with counted quantities
export async function commitSession(session) {
  const loc = session.location;
  const counted = Object.entries(session.counts || {});
  if (mode === "firebase") {
    const batch = fb.fs.writeBatch(fb.db);
    counted.forEach(([pid, qty]) => {
      const p = mem.products.find(x => x.id === pid); if (!p) return;
      batch.update(fb.fs.doc(fb.db, COL.products, pid), { [`stock.${loc}`]: Number(qty), updatedAt: new Date().toISOString() });
    });
    await batch.commit();
  } else {
    mem.products = mem.products.map(p => session.counts?.[p.id] != null
      ? { ...p, stock: { ...p.stock, [loc]: Number(session.counts[p.id]) }, updatedAt: new Date().toISOString() } : p);
    lsWrite(); emit();
  }
  const done = await saveSession({ ...session, status: "committed", committedAt: new Date().toISOString() });
  await log("commit", `Committed ${LOCATIONS.find(l => l.id === loc)?.name} count · ${counted.length} items`);
  return done;
}

// ── Import / Export / Reset ──────────────────────────────────
export function exportAll() { return { exportedAt: new Date().toISOString(), ...clone({ products: mem.products, sessions: mem.sessions }) }; }

export async function importAll(data) {
  if (!Array.isArray(data?.products)) throw new Error("This file has no products list");
  for (const p of data.products) await saveProduct(p, { silent: true });
  for (const s of data.sessions || []) await saveSession(s);
  await log("import", `Imported ${data.products.length} products`);
}

export async function resetLocal() {
  if (mode !== "local") throw new Error("Reset is only available in local mode");
  mem = { products: seedProducts(), sessions: [], activity: [] };
  lsWrite();
  await log("seed", "Reloaded the original report data");
}

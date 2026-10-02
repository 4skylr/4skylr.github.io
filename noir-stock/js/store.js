// Data layer: Firestore + Storage when configured, otherwise localStorage
import { firebaseConfig, FIREBASE_SDK_VERSION } from "./firebase-config.js?v=73";
import { SEED_PRODUCTS, SEED_VERSION } from "./seed-data.js?v=73";

const LS_KEY = "noir-inventory:v2";
const COL = { products: "products", sessions: "countSessions", activity: "activity", meta: "meta" };

let mode = "local";
let fb = null; // { db, storage, fs, st }
let mem = { products: [], sessions: [], activity: [] };
const listeners = new Set();

export const LOCATIONS = [
  { id: "refuel", name: "Concession", short: "Concession", code: "CON" },
  { id: "mini", name: "Mini Store", short: "Mini", code: "MNI" },
  { id: "stores", name: "Main Stores", short: "Stores", code: "STR" }
];

export const CATEGORIES = [
  { id: "syrups", name: "BIB Syrups" },
  { id: "drinks", name: "Drinks & Water" },
  { id: "snacks", name: "Candy & Snacks" },
  { id: "popcorn", name: "Popcorn & Floss" },
  { id: "food", name: "Food & Sauces" },
  { id: "slush", name: "Slush & Mocktails" },
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

// Several Firestore snapshots can land in the same moment; coalesce them into one redraw.
let emitQueued = false;
function emit() {
  if (emitQueued) return;
  emitQueued = true;
  queueMicrotask(() => { emitQueued = false; listeners.forEach(fn => { try { fn(snapshot()); } catch (e) { console.error(e); } }); });
}
export function hasData() { return mem.products.length > 0; }
// writes made while Firebase is still connecting wait for it instead of landing in local storage
let markConnected; const connected = new Promise(r => { markConnected = r; });
async function remote() { if (mode === "connecting") await connected; return mode === "firebase" && !!fb; }

// Last Firestore snapshot, kept so the next open paints instantly while Firebase reconnects.
const FB_CACHE = "noir-fb-cache-v1";
function fbCacheRead() { try { const raw = localStorage.getItem(FB_CACHE); return raw ? JSON.parse(raw) : null; } catch { return null; } }
let fbCacheTimer = null;
function fbCacheWrite() {
  clearTimeout(fbCacheTimer);
  fbCacheTimer = setTimeout(() => { try { localStorage.setItem(FB_CACHE, JSON.stringify({ at: Date.now(), products: mem.products, sessions: mem.sessions.slice(0, 50), activity: mem.activity.slice(0, 30) })); } catch {} }, 400);
}
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

// Products added to / retired from the seed, keyed by seed version
const ADDED_IN = { 3: ["vimto-blueberry", "hotdog-bun"] };
const RETIRED_IN = { 4: ["barbican-malt", "barbican-peach", "barbican-pineapple", "barbican-pom", "barbican-raspberry", "coke-light-can", "coke-zero-can", "fanta-citrus-can", "fanta-orange-can", "rani-cocktail", "rani-guava", "rani-mango", "rani-orange", "rani-peach", "rani-pineapple", "schweppes-gingerale", "schweppes-grapefruit", "schweppes-mojito", "schweppes-mojito-red", "schweppes-pom", "sprite-can", "mm-choco-180", "snickers", "twix", "cooking-oil", "nachos-tray", "samosa-tray", "slush-drinks", "ice-cream-cones", "stick-bars", "uur-cream", "cardamom", "cinnamon", "coffee-beans", "coffee-capsules", "cups-3-5", "cups-5", "ginger", "nespresso-lid", "paper-cup-250", "tea-powder", "cups-12", "icecream-spoon", "lids-12", "ptub-130", "ptub-46", "ptub-64", "ptub-85", "spoon", "nachos-removal", "samosas"] };
const isSeedAsset = img => !img || String(img).startsWith("assets/");
const stockTotal = p => Object.values(p.stock || {}).reduce((a, n) => a + (Number(n) || 0), 0);

// Bring stored products in line with the current seed. Idempotent: safe to run on every load.
// Never touches counts, stock levels, or photos the user uploaded (data: / https: URLs).
function seedUpgrade(products, fromVersion) {
  const seed = new Map(SEED_PRODUCTS.map(p => [p.id, p]));
  const have = new Set(products.map(p => p.id));
  const retired = new Set(Object.entries(RETIRED_IN).filter(([v]) => Number(v) > fromVersion).flatMap(([, ids]) => ids));
  const updates = [], additions = [], removals = [];
  for (const cur of products) {
    const sp = seed.get(cur.id), patch = {};
    if (sp) {
      if (isSeedAsset(cur.image) && (cur.image || "") !== (sp.image || "")) patch.image = sp.image || "";
      if (cur.par == null && sp.par != null) patch.par = sp.par;
      // v5: units and report names corrected from the Raw Material List
      if (fromVersion < 5 && sp.unit && cur.unit !== sp.unit) patch.unit = sp.unit;
      if (!cur.sku && sp.sku) patch.sku = sp.sku;
      if (fromVersion < 6 && sp.stock) { patch.stock = sp.stock; patch.rate = sp.rate; patch.sku = sp.sku; patch.name = sp.name; }
    } else if (retired.has(cur.id) && stockTotal(cur) === 0 && isSeedAsset(cur.image)) {
      removals.push(cur.id); continue;
    } else if (isSeedAsset(cur.image) && cur.image) {
      patch.image = ""; // photo file no longer ships with the app
    }
    if (Object.keys(patch).length) updates.push({ id: cur.id, ...patch });
  }
  for (const [v, ids] of Object.entries(ADDED_IN)) {
    if (Number(v) > fromVersion) ids.forEach(id => { if (!have.has(id) && seed.has(id)) additions.push(seed.get(id)); });
  }
  return { updates, additions, removals };
}

function seedProducts() {
  const now = new Date().toISOString();
  return SEED_PRODUCTS.map(p => ({ ...clone(p), createdAt: now, updatedAt: now }));
}

// ── Init ─────────────────────────────────────────────────────
export async function init() {
  if (firebaseConfig.apiKey) {
    // paint right away from the last snapshot (or the bundled report) while Firebase connects
    const cached = fbCacheRead();
    mem = cached?.products?.length ? { products: cached.products, sessions: cached.sessions || [], activity: cached.activity || [] }
      : { products: seedProducts(), sessions: [], activity: [] };
    mode = "connecting"; emit();
    try { await initFirebase(); mode = "firebase"; markConnected(); emit(); return mode; }
    catch (e) { console.error("Firebase connection failed, falling back to local mode", e); }
  }
  mode = "local";
  markConnected();
  const saved = lsRead();
  mem = saved && saved.products?.length ? saved : { products: seedProducts(), sessions: [], activity: [], seedVersion: SEED_VERSION };
  if (!saved) { log("seed", `Loaded ${mem.products.length} products from the stock report`); lsWrite(); }
  else {
    const from = mem.seedVersion || 2;
    const { updates, additions, removals } = seedUpgrade(mem.products, from);
    if (updates.length || additions.length || removals.length || from < SEED_VERSION) {
      const now = new Date().toISOString(), patch = new Map(updates.map(u => [u.id, u])), gone = new Set(removals);
      mem.products = mem.products.filter(p => !gone.has(p.id)).map(p => patch.has(p.id) ? { ...p, ...patch.get(p.id) } : p)
        .concat(additions.map(p => ({ ...clone(p), createdAt: now, updatedAt: now })));
      mem.seedVersion = SEED_VERSION;
      lsWrite();
      if (from < SEED_VERSION) log("seed", `Catalog updated: ${updates.length} photos refreshed, ${additions.length} added, ${removals.length} retired`);
    }
  }
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

  const live = (name, key, order) => new Promise(resolve => {
    let firstLoad = true;
    fs.onSnapshot(fs.query(fs.collection(db, name), ...(order ? [fs.orderBy(order, "desc"), fs.limit(200)] : [])), snap => {
      mem[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      fbCacheWrite();
      emit();
      if (firstLoad) { firstLoad = false; resolve(); }
    });
  });
  // listeners first so data arrives as early as possible; the one-off seed check runs alongside
  const seedCheck = (async () => {
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
      await fs.setDoc(fs.doc(db, COL.meta, "seed"), { version: SEED_VERSION });
    } else {
      const metaRef = fs.doc(db, COL.meta, "seed");
      const meta = await fs.getDoc(metaRef);
      const from = meta.exists() ? meta.data().version : 2;
      if (from < SEED_VERSION) {
        const all = (await fs.getDocs(fs.collection(db, COL.products))).docs.map(d => ({ id: d.id, ...d.data() }));
        const { updates, additions, removals } = seedUpgrade(all, from);
        const now = new Date().toISOString();
        const batch = fs.writeBatch(db);
        updates.forEach(({ id, ...patch }) => batch.update(fs.doc(db, COL.products, id), patch));
        removals.forEach(id => batch.delete(fs.doc(db, COL.products, id)));
        additions.forEach(p => batch.set(fs.doc(db, COL.products, p.id), { ...p, createdAt: now, updatedAt: now }));
        batch.set(metaRef, { version: SEED_VERSION });
        await batch.commit();
        await log("seed", `Catalog updated: ${updates.length} photos refreshed, ${additions.length} added, ${removals.length} retired`);
      }
    }
  })().catch(e => console.warn("Seed check skipped", e));
  await Promise.all([
    live(COL.products, "products"),
    live(COL.sessions, "sessions", "createdAt"),
    live(COL.activity, "activity", "at")
  ]);
  seedCheck.then(() => {});
}

// ── Activity ledger ───────────────────────────────────
export async function log(type, text) {
  const entry = { id: txHash(), type, text, at: new Date().toISOString() };
  if (fb) {
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
  if (await remote()) {
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
  if (await remote()) {
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
  if (await remote()) {
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
  if (await remote()) {
    await fb.fs.setDoc(fb.fs.doc(fb.db, COL.sessions, doc.id), doc);
  } else {
    const exists = mem.sessions.some(x => x.id === doc.id);
    mem.sessions = exists ? mem.sessions.map(x => x.id === doc.id ? doc : x) : [doc, ...mem.sessions];
    lsWrite(); emit();
  }
  return doc;
}

export async function deleteSession(id) {
  if (await remote()) await fb.fs.deleteDoc(fb.fs.doc(fb.db, COL.sessions, id));
  else { mem.sessions = mem.sessions.filter(x => x.id !== id); lsWrite(); emit(); }
  await log("delete", `Deleted count session ${id.slice(0, 10)}`);
}

// commit: overwrite system stock with counted quantities
export async function commitSession(session) {
  const loc = session.location;
  const counted = Object.entries(session.counts || {});
  if (await remote()) {
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
  mem = { products: seedProducts(), sessions: [], activity: [], seedVersion: SEED_VERSION };
  lsWrite();
  await log("seed", "Reloaded the original report data");
}

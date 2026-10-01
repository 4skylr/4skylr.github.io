// Batch edits live in IndexedDB via idb-keyval (github.com/jakearchibald/idb-keyval).
import { get, set } from "../vendor/idb-keyval.mjs";
const KEY = "noir-expiry-edits-v1";
export async function loadEdits() {
  try {
    const saved = await get(KEY);
    if (saved) return saved;
  } catch {}
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
export async function saveEdits(edits) {
  localStorage.setItem(KEY, JSON.stringify(edits));
  try { await set(KEY, edits); } catch {}
}

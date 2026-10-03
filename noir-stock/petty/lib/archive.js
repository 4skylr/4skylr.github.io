// Invoice and workbook archive.
//   This browser: IndexedDB (no size limits worth worrying about for receipts).
//   Firebase: entries in Firestore "petty", a JPEG of each invoice in "pettyImg" (the Excel export reads it),
//   the original file in Storage under petty/invoices/<month>/, exported workbooks under petty/excel/.
const DB = "noir-petty", STORES = ["img", "file", "xlsx"];
let dbp = null;
function db() {
  return dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => STORES.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store), q = fn(s); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
export const idbPut = (store, key, val) => tx(store, "readwrite", s => s.put(val, key)).catch(() => null);
export const idbGet = (store, key) => tx(store, "readonly", s => s.get(key)).catch(() => null);
export const idbDel = (store, key) => tx(store, "readwrite", s => s.delete(key)).catch(() => null);
export const idbKeys = store => tx(store, "readonly", s => s.getAllKeys()).catch(() => []);

const extOf = (name, type) => (name.match(/\.(\w{2,5})$/)?.[1] || (type === "application/pdf" ? "pdf" : type?.split("/")[1] || "bin")).toLowerCase();

// save one invoice: entry fields, preview image, original file
export async function archiveInvoice(H, entry, { image, file }) {
  if (image) { await idbPut("img", entry.id, image); H.putRemote?.("pettyImg", entry.id, { data: image, at: entry.savedAt }); }
  if (file) {
    await idbPut("file", entry.id, file);
    const path = `petty/invoices/${(entry.date || "undated").slice(0, 7)}/${entry.id}.${extOf(file.name || "", file.type)}`;
    const up = await H.uploadFile?.(path, file, file.type || "application/octet-stream");
    if (up) Object.assign(entry, { filePath: up.path, fileUrl: up.url });
  }
  await H.putDoc("petty", entry.id, entry);
  return entry;
}
export async function imageOf(H, id) {
  const local = await idbGet("img", id); if (local) return local;
  const r = await H.getRemote?.("pettyImg", id);
  if (r?.data) { idbPut("img", id, r.data); return r.data; }
  return null;
}
export async function fileOf(id) { return idbGet("file", id); }
export async function removeInvoice(H, id) {
  await Promise.all([idbDel("img", id), idbDel("file", id), H.deleteRemote?.("pettyImg", id), H.deleteRemote?.("petty", id), H.deleteLocalDoc?.("petty", id)]);
}
// keep each exported workbook
export async function archiveWorkbook(H, name, blob, meta) {
  const id = name.replace(/\.xlsx$/i, "");
  await idbPut("xlsx", id, blob);
  const up = await H.uploadFile?.(`petty/excel/${name}`, blob, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  await H.putDoc("pettyXlsx", id, { name, at: new Date().toISOString(), ...meta, ...(up ? { path: up.path, url: up.url } : {}) });
}
export const workbookBlob = id => idbGet("xlsx", id);

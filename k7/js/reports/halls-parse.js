// Reads "User Transaction Log - Payment Type wise" (pdf.js, mozilla/pdf.js) into seat counts per hall.
import { summarize } from "./halls-data.js?v=101";

// rebuild each printed line from the text positions, top to bottom
export async function pdfLines(pdfjs, data, onProgress = () => {}) {
  const doc = await pdfjs.getDocument({ data }).promise, lines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i), text = await page.getTextContent(), rows = new Map();
    text.items.forEach(it => {
      if (!it.str.trim()) return;
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], s: it.str.trim() });
    });
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => lines.push(r.sort((a, b) => a.x - b.x).map(c => c.s).join("   ")));
    page.cleanup();
    if (i % 5 === 0 || i === doc.numPages) onProgress(i, doc.numPages);
  }
  await doc.destroy();
  return lines;
}

export async function parseTxLog(file, onProgress) {
  const { loadPdf } = await import("./sync-admin.js?v=101");
  const pdfjs = await loadPdf();
  const lines = await pdfLines(pdfjs, new Uint8Array(await file.arrayBuffer()), onProgress);
  if (!lines.some(l => /User Transaction Log/i.test(l))) throw new Error("This is not the User Transaction Log - Payment Type wise report");
  return summarize(lines);
}

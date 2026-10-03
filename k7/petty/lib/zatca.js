// ZATCA e-invoice QR (Saudi Arabia). The code is Base64 of TLV records:
// 1 seller name · 2 VAT number · 3 timestamp · 4 total incl. VAT · 5 VAT amount (phase 2 adds 6-9: hashes and keys).
export function decodeZatca(text) {
  const s = String(text || "").trim();
  if (!/^[A-Za-z0-9+/=\s]{20,}$/.test(s)) return null;
  let bytes;
  try { bytes = Uint8Array.from(atob(s.replace(/\s+/g, "")), c => c.charCodeAt(0)); } catch { return null; }
  const out = {}, dec = new TextDecoder("utf-8", { fatal: false });
  for (let i = 0; i + 1 < bytes.length;) {
    const tag = bytes[i], len = bytes[i + 1];
    if (!tag || i + 2 + len > bytes.length) break;
    if (tag <= 5) out[tag] = dec.decode(bytes.slice(i + 2, i + 2 + len));
    i += 2 + len;
  }
  if (!out[1] || !out[2] || !/^3\d{13}3$/.test(out[2])) return null;
  const ts = out[3] ? new Date(out[3].replace(/Z$/, "")) : null; // the clock printed on the receipt is local time
  return {
    seller: out[1].trim(), vat: out[2], ts: out[3] || null,
    date: ts && !Number.isNaN(+ts) ? `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")}` : null,
    time: ts && !Number.isNaN(+ts) ? `${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}` : null,
    total: out[4] != null ? Number(out[4]) : null, tax: out[5] != null ? Number(out[5]) : null
  };
}

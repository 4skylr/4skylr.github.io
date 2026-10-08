// RDR Exception Register → one record per cashier shift (packet).
// Per payment type the register gives three counts of the same money:
//   POS Transaction Amount (what the system sold) · User RDR Drop (what the cashier declared)
//   TL RDR Drop (what the team leader verified) · Accountant RDR Drop (third check)
const PAY = { "cash": "cash", "credit card": "card", "pre-paid": "prepaid", "voucher": "voucher", "others": "others", "comp.": "comp", "loyalty": "loyalty", "wallet": "wallet" };
const r2 = n => Math.round(n * 100) / 100;
const num = v => typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "")) || 0;
const clean = s => String(s ?? "").replace(/[\s ]+/g, " ").trim();
const isoOf = s => { const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null; };

export function parseRdrRows(rows) {
  const meta = {};
  let hdr = -1;
  rows.forEach((r, i) => {
    const a = clean(r?.find(x => x != null && clean(x)));
    let m;
    if ((m = a.match(/Report Type\s*:\s*(.+)/i))) meta.report = m[1].trim();
    if ((m = a.match(/^From\s*:\s*(\S+)/i))) meta.from = m[1];
    if ((m = a.match(/^To\s*:\s*(\S+)/i))) meta.to = m[1];
    if (hdr < 0 && clean(r?.[0]).toLowerCase() === "outlet") hdr = i;
  });
  if (hdr < 0 || !/rdr/i.test(meta.report || "")) throw new Error("This is not the RDR Exception Register");
  const H = rows[hdr].map(h => clean(h).toLowerCase());
  const col = k => H.findIndex(h => h.startsWith(k));
  const C = { out: col("outlet"), date: col("shift date"), shift: col("shift number"), user: col("user name"), uid: col("user id"), packet: col("packet"),
    pay: col("payment type"), pos: col("pos transaction"), ud: col("user rdr"), tl: col("tl rdr"), acc: col("accountant"), diff: col("diff"), flag: col("tc sc") };
  const shifts = new Map(), outlets = {};
  let accUsed = 0, diffUsed = 0, lines = 0;
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || !clean(r[C.out])) continue;
    const d = isoOf(r[C.date]); if (!d) continue;
    lines++;
    const out = clean(r[C.out]), pay = PAY[clean(r[C.pay]).toLowerCase()];
    const v = [num(r[C.pos]), num(r[C.ud]), num(r[C.tl])];
    if (num(r[C.acc])) accUsed++; if (num(r[C.diff])) diffUsed++;
    (outlets[out] ??= { lines: 0, money: 0 }).lines++;
    outlets[out].money = r2(outlets[out].money + Math.abs(v[0]) + Math.abs(v[2]));
    if (!pay) continue;
    const key = `${d}|${clean(r[C.uid])}|${clean(r[C.packet])}|${out}`;
    const s = shifts.get(key) ?? { d, u: clean(r[C.user]), id: clean(r[C.uid]), o: out, p: Number(clean(r[C.packet]).replace(/\D/g, "")) || 1, sh: Number(r[C.shift]) || 1, f: clean(r[C.flag]) === "Y" ? 1 : 0, t: {} };
    if (v.some(Boolean)) s.t[pay] = (s.t[pay] || [0, 0, 0]).map((x, j) => r2(x + v[j]));
    shifts.set(key, s);
  }
  const list = [...shifts.values()].filter(s => Object.keys(s.t).length).sort((a, b) => a.d.localeCompare(b.d) || a.u.localeCompare(b.u));
  const users = [...new Set([...shifts.values()].map(s => s.u))];
  return { report: "RDR Exception Register", from: meta.from, to: meta.to, lines, outlets, accUsed, diffUsed, users, shifts: list,
    emptyShifts: shifts.size - list.length, savedAt: new Date().toISOString() };
}

export async function parseRdrFile(file, XLSX) {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return parseRdrRows(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null, blankrows: false }));
}

// Auditorium layouts for Noir Cinema Unaizah, read from the booking seat maps.
// Seats are numbered left to right. A row is a list of blocks: [first grid column, seats in the block].
// Types: "co" Comfort, "cp" Comfort+, wheelchair seats are listed per hall.
// No imports here: the same code runs in the browser and in the build script.

const front = (n, blocks) => [..."ABCDEF"].slice(0, n).map(r => ({ r, type: "co", blocks }));
export const HALLS = [
  { id: 1, cols: 7, wc: ["A1", "A2"], rows: [...front(6, [[0, 2], [4, 3]]), { r: "G", type: "cp", blocks: [[0, 7]], gap: true }] },
  { id: 2, cols: 11, wc: ["A1", "A2"], rows: [...front(6, [[0, 4], [6, 5]]), { r: "G", type: "cp", blocks: [[1, 10]], gap: true }] },
  { id: 3, cols: 10, wc: ["A1", "A2"], rows: [...front(6, [[0, 4], [6, 4]]), { r: "G", type: "cp", blocks: [[1, 9]], gap: true }] },
  { id: 4, cols: 17, wc: ["A7", "A8"], rows: [
    { r: "A", type: "co", blocks: [[0, 4], [6, 6], [15, 2]] },
    ..."BCDE".split("").map(r => ({ r, type: "co", blocks: [[0, 4], [6, 7], [15, 2]] })),
    { r: "F", type: "cp", blocks: [[0, 16]], gap: true }] }
];

// every seat with its grid position: { id:"F3", r:"F", n:3, col, row, type }
export function seatsOf(hall) {
  const out = [];
  hall.rows.forEach((row, ri) => {
    let n = 0;
    row.blocks.forEach(([c0, k]) => { for (let i = 0; i < k; i++) { n++; const id = row.r + n;
      out.push({ id, r: row.r, n, col: c0 + i, row: ri, type: hall.wc.includes(id) ? "wc" : row.type }); } });
  });
  return out;
}
export const typeCount = hall => seatsOf(hall).reduce((a, s) => (a[s.type]++, a), { co: 0, cp: 0, wc: 0 });

// ── User Transaction Log - Payment Type wise ──────────────────
// Input: the report's printed lines, top to bottom. The screen is printed only when it changes,
// so it carries forward to the following tickets.
const TICKET = /^(.*?)(\d\d\/\d\d\/\d{4})\s+(\d\d):(\d\d) ([AP]M)\s+(C[OP])\s+([A-Z])\s+(\d+)\s+(-?[\d,]+\.\d\d)/;
const DMY = s => { const [d, m, y] = s.split("/"); return `${y}-${m}-${d}`; };
export function summarize(lines) {
  const valid = Object.fromEntries(HALLS.map(h => [h.id, new Set(seatsOf(h).map(s => s.id))]));
  const halls = Object.fromEntries(HALLS.map(h => [h.id, { tickets: 0, revenue: 0, free: 0, seats: {}, films: {}, hours: Array(24).fill(0), wd: Array(7).fill(0), first: "", last: "" }]));
  let screen = null, tickets = 0, revenue = 0, skipped = 0, from = "", to = "", asOn = "", grand = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!from) { const m = line.match(/From\s*:\s*(\d\d-\w{3}-\d\d)/); if (m) from = m[1]; }
    if (!to) { const m = line.match(/To\s*:\s*(\d\d-\w{3}-\d\d)/); if (m) to = m[1]; }
    if (!asOn) { const m = line.match(/As On\s*:\s*(\d\d-\w{3}-\d\d [\d:]+ [AP]M)/); if (m) asOn = m[1]; }
    const g = line.match(/Grand Total\s*:\s*([\d,]+)/); if (g) grand = Number(g[1].replace(/,/g, ""));
    const sc = line.match(/SCREEN (\d)/); if (sc) screen = Number(sc[1]);
    const t = line.replace(/SCREEN \d\s*/, "").match(TICKET);
    if (!t) continue;
    const [, film, date, hh, , ap, , row, num, rate] = t;
    const id = row + Number(num), H = halls[screen];
    if (!H || !valid[screen].has(id)) { skipped++; continue; }
    const v = Number(rate.replace(/,/g, "")), iso = DMY(date);
    const hour = (Number(hh) % 12) + (ap === "PM" ? 12 : 0);
    const s = (H.seats[id] ??= [0, 0]); s[0]++; s[1] = Math.round((s[1] + v) * 100) / 100;
    H.tickets++; H.revenue += v; if (v === 0) H.free++;
    const f = film.trim().replace(/\s+/g, " "); if (f) H.films[f] = (H.films[f] || 0) + 1;
    H.hours[hour]++; H.wd[new Date(iso + "T12:00:00").getDay()]++;
    if (!H.first || iso < H.first) H.first = iso; if (iso > H.last) H.last = iso;
    tickets++; revenue += v;
  }
  for (const H of Object.values(halls)) {
    H.revenue = Math.round(H.revenue * 100) / 100;
    H.films = Object.entries(H.films).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, n]) => ({ f, n })); // no nested arrays (Firestore)
  }
  return { report: "User Transaction Log - Payment Type wise", from, to, asOn, tickets, revenue: Math.round(revenue * 100) / 100, grand, skipped, halls, savedAt: new Date().toISOString() };
}

// Admin and finance lock: the PIN is the current time as HHMM (09:00 → 0900).
// 24-hour and 12-hour forms both work (21:05 → 2105 or 0905), with one minute either side for slow typing.
const pad = n => String(n).padStart(2, "0");
export function timePinOk(value) {
  const v = String(value ?? "").trim(), now = Date.now();
  if (!/^\d{4}$/.test(v)) return false;
  for (const d of [-1, 0, 1]) {
    const t = new Date(now + d * 60e3), h = t.getHours(), m = pad(t.getMinutes());
    if (v === pad(h) + m || v === pad(h % 12 || 12) + m) return true;
  }
  return false;
}

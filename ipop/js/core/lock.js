// Admin sign-in for Settings, Unaizah audit, cash office and sync.
// One PIN, this tab only. The clock is not accepted.
const KEY = "noir-admin";
const PIN = "899";
const get = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const isOpen = () => get() === "1";
export function unlock(pin) {
  if (String(pin ?? "").trim() !== PIN) return false;
  try { sessionStorage.setItem(KEY, "1"); } catch {}
  return true;
}
export function lock() { try { sessionStorage.removeItem(KEY); } catch {} }

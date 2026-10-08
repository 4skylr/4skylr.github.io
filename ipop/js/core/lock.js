// The admin sign-in shared by Settings, the Unaizah audit, the cash-office audit and sync admin:
// the clock PIN (HHMM) opens them for this tab. Nothing on the site is hidden by it apart from those admin tools.
import { timePinOk } from "./time-pin.js?v=106";

const KEY = "noir-admin";
const get = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const isOpen = () => get() === "1";
export function unlock(pin) {
  if (!timePinOk(pin)) return false;
  try { sessionStorage.setItem(KEY, "1"); } catch {}
  return true;
}
export function lock() { try { sessionStorage.removeItem(KEY); } catch {} }

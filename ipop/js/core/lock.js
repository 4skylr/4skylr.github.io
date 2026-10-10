// Admin screens (Settings admin panel, Unaizah audit, cash office, links): open to the admin and supervisors, as
// decided at the door (js/door.js) by the person's role in the database. There is no PIN in this site any more.
import { canUpload } from "./session.js?v=106";
export const isOpen = () => canUpload();
export async function unlock() { return false; }
export function lock() { globalThis.IPOP_DOOR?.lock(); }

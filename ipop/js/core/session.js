// Who is signed in, and which branch the site shows. Set once by the door (js/door.js) before the app loads.
//   window.IPOP_SESSION = { uid, name, role: "admin" | "supervisor" | "employee", branch, home }
// Unaizah is the home branch: its data lives in the original collections. Every other branch has its own
// (branches/<id>/<collection>) and never sees Unaizah's stock, sales or cash.
export const BRANCHES = [
  { id: "unaizah", name: "Unaizah", code: "UNZ" },
  { id: "almithnab", name: "Al Mithnab", code: "MTH" },
  { id: "alkhafji", name: "Al Khafji", code: "KHF" }
];
export const ROLES = [
  { id: "employee", name: "Employee", note: "counts stock" },
  { id: "supervisor", name: "Supervisor", note: "counts and uploads reports" },
  { id: "admin", name: "Admin", note: "every branch, people" }
];
export const HOME = "unaizah";
const S = () => globalThis.IPOP_SESSION || null;
export const session = () => S();
export const branchId = () => S()?.branch || HOME;
export const branchName = (id = branchId()) => BRANCHES.find(b => b.id === id)?.name || id;
export const isHome = () => branchId() === HOME;
export const role = () => S()?.role || "";
export const isAdmin = () => role() === "admin";
export const canUpload = () => isAdmin() || role() === "supervisor";
export const roleName = (id = role()) => ROLES.find(r => r.id === id)?.name || id;

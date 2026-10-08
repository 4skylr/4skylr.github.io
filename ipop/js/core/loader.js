// The site's loading mark (after Cobp's loader on Uiverse.io): three rings turning in 3D, and the word under them.
export const loaderHtml = (ar = (sessionStorage.getItem("noir-lang") || "en") === "ar", text) =>
  `<div class="loader" role="status" aria-live="polite"><div class="load-inner load-one"></div><div class="load-inner load-two"></div><div class="load-inner load-three"></div><span class="text">${text || (ar ? "جاري التحميل..." : "Loading...")}</span></div>`;

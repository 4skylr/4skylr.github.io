// ESLint (eslint/eslint) for the site code. CI fails on errors; unused code is reported as a warning.
const browser = Object.fromEntries(["AbortController", "BarcodeDetector", "Blob", "BroadcastChannel", "CSS", "ClipboardItem", "CompressionStream", "CustomEvent", "DOMParser", "DataTransfer", "DecompressionStream", "Event", "File", "FileReader", "FormData", "HTMLCanvasElement", "HTMLElement", "Headers", "Image", "ImageData", "IntersectionObserver", "Intl", "KeyboardEvent", "MessageChannel", "MutationObserver", "Node", "NodeFilter", "Notification", "OffscreenCanvas", "PointerEvent", "ReadableStream", "Request", "ResizeObserver", "Response", "TextDecoder", "TextEncoder", "URL", "URLSearchParams", "WebAssembly", "Worker", "XMLSerializer", "addEventListener", "alert", "atob", "btoa", "caches", "cancelAnimationFrame", "clearInterval", "clearTimeout", "confirm", "console", "createImageBitmap", "crypto", "define", "devicePixelRatio", "dispatchEvent", "document", "exports", "fetch", "frames", "getComputedStyle", "globalThis", "history", "indexedDB", "innerHeight", "innerText", "innerWidth", "isSecureContext", "localStorage", "location", "matchMedia", "module", "name", "navigator", "open", "opener", "origin", "parent", "performance", "print", "process", "prompt", "queueMicrotask", "removeEventListener", "reportError", "requestAnimationFrame", "require", "screen", "scrollTo", "scrollX", "scrollY", "self", "sessionStorage", "setImmediate", "setInterval", "setTimeout", "structuredClone", "top", "visualViewport", "window"].map(n => [n, "readonly"]));
export default [
  { ignores: ["**/vendor/**", "noir-stock/**", "**/*.min.js"] },
  { files: ["k7/**/*.js", "k7/**/*.mjs", ".github/scripts/*.mjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: browser },
    rules: {
      "no-undef": "error", "no-dupe-keys": "error", "no-unreachable": "error", "no-redeclare": "error", "no-const-assign": "error",
      "no-dupe-else-if": "error", "no-self-assign": "error", "no-import-assign": "error",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }]
    } }
];

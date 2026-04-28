/**
 * Single shared toast DOM + short-window dedupe to avoid interceptor + catch double-firing.
 */

let lastToastMsg = "";
let lastToastAt = 0;

const DEDUPE_MS = 800;

/**
 * @param {string} [rawMessage]
 * @param {{ force?: boolean, fallback?: string }} [opts]
 */
export function showToast(rawMessage, opts = {}) {
  if (typeof window === "undefined") return;

  let message =
    typeof rawMessage === "string"
      ? rawMessage.trim()
      : String(rawMessage ?? "").trim();

  if (!message) {
    message =
      opts.fallback && String(opts.fallback).trim()
        ? String(opts.fallback).trim()
        : "Something went wrong";
  }

  const now = Date.now();
  if (!opts.force && message === lastToastMsg && now - lastToastAt < DEDUPE_MS) {
    return;
  }
  lastToastMsg = message;
  lastToastAt = now;

  const div = document.createElement("div");
  div.innerText = message;
  div.className =
    "fixed top-5 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50 animate-fade-in";
  document.body.appendChild(div);

  setTimeout(() => div.remove(), 2500);
}

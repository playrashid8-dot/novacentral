/**
 * Central VIP toast bus — one visible toast at a time; replaces previous immediately.
 * Use only from explicit user-action handlers (not axios interceptors).
 */

export type VipToastType = "success" | "error";

export type VipToastPayload = { type: VipToastType; message: string };

type Listener = (state: VipToastPayload | null) => void;

let listener: Listener | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

const DISMISS_MS = 3600;

export function registerVipToastListener(fn: Listener) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/**
 * @param type — success | error
 * @param message — user-facing copy (already finalized by the caller)
 */
export function showToast(type: VipToastType, message: string) {
  if (typeof window === "undefined") return;

  const trimmed = String(message ?? "").trim();
  if (!trimmed) return;

  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  listener?.({ type, message: trimmed });

  dismissTimer = window.setTimeout(() => {
    listener?.(null);
    dismissTimer = null;
  }, DISMISS_MS);
}

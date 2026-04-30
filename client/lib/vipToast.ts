/**
 * Central VIP toast bus — one visible toast at a time; replaces previous immediately.
 * Use only from explicit user-action handlers (not axios interceptors).
 */

export type VipToastType = "success" | "error";

export type VipToastPayload = { type: VipToastType; message: string };

type Listener = (state: VipToastPayload | null) => void;

let listener: Listener | null = null;
let dismissTimer: number | null = null;

const DISMISS_MS = 3600;

export function registerVipToastListener(fn: Listener) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

function looksAxiosLike(x: unknown): x is object {
  return (
    !!x &&
    typeof x === "object" &&
    ("response" in x || ("isAxiosError" in x && (x as { isAxiosError?: unknown }).isAxiosError === true))
  );
}

/** Single-line snippet from primitives only — avoids "[object Object]" in UI */
function snippet(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return "";
  return "";
}

/** Normalize errors / stray API payload fields into user-facing toast copy. */
export function getMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error == null) return fallback;

  const direct = snippet(error);
  if (direct) return direct;

  if (error instanceof Error) {
    const em = snippet(error.message);
    if (em) return em;
  }

  if (!looksAxiosLike(error)) return fallback;

  const rec = error as {
    response?: { data?: { msg?: unknown; message?: unknown } };
    code?: string;
  };

  if (!rec.response) {
    if (rec.code === "ECONNABORTED" || rec.code === "TIMEOUT") {
      return "Request timed out. Try again.";
    }
    return "Network error, try again";
  }

  const fromBody =
    snippet(rec.response.data?.msg) ||
    snippet(rec.response.data?.message);

  return fromBody || fallback;
}

/**
 * @param type — success | error
 * @param message — user-facing copy (string preferred); non-strings are safely coerced, never serialized objects.
 */
export function showToast(type: VipToastType, message: unknown) {
  if (typeof window === "undefined") return;

  let trimmed = "";
  if (typeof message === "string") trimmed = message.trim();
  else if (typeof message === "number" && Number.isFinite(message)) trimmed = String(message);
  else if (typeof message === "boolean") trimmed = "";
  else if (message instanceof Error) trimmed = message.message?.trim() ?? "";
  else if (looksAxiosLike(message)) trimmed = getMessage(message, "");
  // Deliberately ignore arbitrary objects → no accidental object dumps.

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

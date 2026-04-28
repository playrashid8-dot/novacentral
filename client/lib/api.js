import axios from "axios";

/**
 * Axios base URL must end with `/api` so `/auth/*` and `/csrf-token` resolve correctly.
 */
function normalizeApiBase(envUrl) {
  const fallback = "http://localhost:5000/api";
  const raw = (envUrl || "").trim();
  if (!raw) return fallback;
  const noSlash = raw.replace(/\/$/, "");
  if (/\/api$/i.test(noSlash)) return noSlash;
  return `${noSlash}/api`;
}

// 🔗 BASE URL (always includes `/api`)
const BASE_URL = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

const CSRF_RELATIVE_PATH = "/csrf-token";

/** @returns {string|null} */
function readXsrfCookie() {
  if (typeof document === "undefined") return null;
  const row = document.cookie
    .split("; ")
    .find((r) => r.startsWith("XSRF-TOKEN="));
  if (!row) return null;
  return decodeURIComponent(row.split("=").slice(1).join("="));
}

// 🚀 INSTANCE — must send cookies for CSRF + httpOnly auth
const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let csrfFetched = false;
let csrfTokenCache = null;

// 🚫 prevent multiple redirects
let isRedirecting = false;

export const resetRedirectState = () => {
  isRedirecting = false;
};

/**
 * Prime csurf secret cookie + mirrored XSRF-TOKEN before unsafe requests.
 * @param {boolean} [force=false] Fetch again (e.g. after 403 / rotation)
 */
export const initCSRF = async (force = false) => {
  if (!force && csrfFetched) return csrfTokenCache;

  const url = `${BASE_URL.replace(/\/$/, "")}${CSRF_RELATIVE_PATH}`;
  const { data } = await axios.get(url, { withCredentials: true });
  csrfFetched = true;
  csrfTokenCache = readXsrfCookie() || data?.data?.csrfToken || null;
  return csrfTokenCache;
};

function attachCsrfHeaders(config, token) {
  if (!token) return;
  config.headers = config.headers || {};
  config.headers["X-CSRF-Token"] = token;
  config.headers["csrf-token"] = token;
  config.headers["CSRF-Token"] = token;
}

/* ==============================
   🔐 REQUEST INTERCEPTOR
============================== */
API.interceptors.request.use(async (config) => {
  config.withCredentials = true;

  if (config.headers?.delete) {
    config.headers.delete("Authorization");
    config.headers.delete("authorization");
  } else if (config.headers) {
    delete config.headers.Authorization;
    delete config.headers.authorization;
  }

  const method = String(config.method || "get").toLowerCase();
  const url = String(config.url || "");
  const isUnsafe = ["post", "put", "patch", "delete"].includes(method);
  const skipCsrf = url.includes("csrf-token");

  if (isUnsafe && !skipCsrf) {
    let token = readXsrfCookie()?.trim() || csrfTokenCache;

    if (!token) {
      try {
        await initCSRF(false);
        token = readXsrfCookie() || csrfTokenCache;
      } catch {
        /* CSRF will fail later with a clear response */
      }
    }

    if (!token) {
      token = readXsrfCookie();
    }

    attachCsrfHeaders(config, token);
  }

  return config;
});

/* ==============================
   🚨 RESPONSE INTERCEPTOR
============================== */
API.interceptors.response.use(
  (res) => res,

  async (error) => {
    // ❌ NETWORK ERROR
    if (!error.response) {
      console.error("❌ Network Error:", error.message);

      if (typeof window !== "undefined") {
        showToast("Server not reachable ❌");
      }

      return Promise.reject(error);
    }

    const { status, data } = error.response;
    const cfg = error.config || {};
    const msg = String(data?.msg || "").toLowerCase();

    if (
      status === 403 &&
      msg.includes("csrf") &&
      !cfg._csrfRetry &&
      ["post", "put", "patch", "delete"].includes(String(cfg.method || "").toLowerCase())
    ) {
      csrfTokenCache = null;
      csrfFetched = false;
      try {
        await initCSRF(true);
        const token = readXsrfCookie() || csrfTokenCache;
        cfg._csrfRetry = true;
        attachCsrfHeaders(cfg, token);
        return API(cfg);
      } catch {
        /* fall through */
      }
    }

    // 🔐 UNAUTHORIZED (TOKEN EXPIRED / INVALID)
    if (status === 401) {
      if (typeof window !== "undefined" && !isRedirecting) {
        isRedirecting = true;

        import("./auth").then(({ logout }) => {
          logout("Session expired 🔒");
        });
      }
    }

    if (status === 403 && data?.msg?.toLowerCase?.().includes("csrf")) {
      csrfTokenCache = null;
      csrfFetched = false;
    }

    // ⚠️ BAD REQUEST
    if (status === 400) {
      console.warn("⚠️ Bad Request:", data?.msg || data?.message);

      if (typeof window !== "undefined") {
        showToast(data?.msg || data?.message || "Invalid request ⚠️");
      }
    }

    // 🔥 SERVER ERROR
    if (status >= 500) {
      console.error("🔥 Server Error:", data);

      if (typeof window !== "undefined") {
        showToast("Server error, try again later ❌");
      }
    }

    return Promise.reject(error);
  },
);

export const getApiErrorMessage = (error, fallback = "Something went wrong ❌") => {
  if (!error) return fallback;

  if (!error.response) {
    return "Server not reachable ❌";
  }

  return (
    error.response?.data?.message ||
    error.response?.data?.msg ||
    error.message ||
    fallback
  );
};

export default API;

/* ==============================
   🔥 SIMPLE TOAST SYSTEM
============================== */
function showToast(message) {
  const div = document.createElement("div");

  div.innerText = message;

  div.className =
    "fixed top-5 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50 animate-fade-in";

  document.body.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 2500);
}

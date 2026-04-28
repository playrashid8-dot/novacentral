import axios from "axios";

import { showSafeToast } from "./toast";

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
  timeout: 30000,
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
 * Normalize API envelope so UI always reads { success, msg, data } consistently.
 * @param {object} [res] Axios response body (payload), not the full Axios response
 */
export const normalize = (res) => {
  const payload = res && typeof res === "object" ? res : {};
  return {
    success: payload.success,
    msg: payload.msg,
    data: payload.data || {},
  };
};

/**
 * Prime csurf secret cookie + mirrored XSRF-TOKEN before unsafe requests.
 * @param {boolean} [force=false] Fetch again (e.g. after 403 / rotation)
 */
export const initCSRF = async (force = false) => {
  if (!force && csrfFetched) return csrfTokenCache;

  const url = `${BASE_URL.replace(/\/$/, "")}${CSRF_RELATIVE_PATH}`;
  const { data } = await axios.get(url, {
    withCredentials: true,
    timeout: 30000,
  });
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
   🚨 RESPONSE INTERCEPTOR (global toast + CSRF retry, no dupes with ./toast dedupe)
============================== */
API.interceptors.response.use(
  (res) => res,

  async (error) => {
    if (!error.response) {
      console.error("❌ Network Error:", error.message);
      if (typeof window !== "undefined") {
        showSafeToast(error.message || "Network error", { fallback: "Network error" });
      }
      return Promise.reject(error);
    }

    const { status, data } = error.response;
    const cfg = error.config || {};
    const msgLc = String(data?.msg || "").toLowerCase();

    /** CSRF — retry unsafe request once; no toast until final failure below */
    if (
      status === 403 &&
      msgLc.includes("csrf") &&
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
        /* fall through — show toast via unified handler */
      }
    }

    if (status === 403 && data?.msg?.toLowerCase?.().includes?.("csrf")) {
      csrfTokenCache = null;
      csrfFetched = false;
    }

    /** UNAUTHORIZED — redirect; logout toast from auth, not here */
    if (status === 401) {
      if (typeof window !== "undefined" && !isRedirecting) {
        isRedirecting = true;

        import("./auth").then(({ logout }) => {
          logout("Session expired 🔒");
        });
      }
      return Promise.reject(error);
    }

    if (status === 400) {
      console.warn("⚠️ Bad Request:", data?.msg || data?.message);
    }
    if (status >= 500) {
      console.error("🔥 Server Error:", data);
    }

    const apiMsg =
      data?.msg ||
      data?.message ||
      error.message ||
      "Something went wrong";

    if (typeof window !== "undefined") {
      showSafeToast(apiMsg);
    }

    return Promise.reject(error);
  },
);

export const getApiErrorMessage = (error, fallback = "Something went wrong ❌") => {
  if (!error) return fallback;

  if (!error.response) {
    return "Network error";
  }

  return (
    error.response?.data?.message ||
    error.response?.data?.msg ||
    error.message ||
    fallback
  );
};

export default API;

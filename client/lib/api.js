import axios from "axios";

import { devWarn } from "./devWarn";

axios.defaults.withCredentials = true;

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

export const BASE_URL = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let csrfToken = null;

function readCookie(name) {
  if (typeof document === "undefined") return null;

  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(encodedName));

  return cookie ? decodeURIComponent(cookie.slice(encodedName.length)) : null;
}

async function getCSRF(force = false) {
  if (force) csrfToken = null;
  if (csrfToken) return csrfToken;

  const res = await API.get("/csrf-token");
  csrfToken =
    res.data?.data?.csrfToken ??
    res.data?.csrfToken ??
    readCookie("XSRF-TOKEN");

  return csrfToken;
}

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
 * Prime CSRF before unsafe requests (login/signup call this explicitly).
 * @param {boolean} [force=false]
 */
export const initCSRF = async (force = false) => getCSRF(force);

function attachCsrfToConfig(config, token) {
  if (!token) return;
  config.headers = config.headers || {};

  if (config.headers?.set) {
    config.headers.set("X-CSRF-Token", token);
    config.headers.set("x-csrf-token", token);
    config.headers.set("CSRF-Token", token);
  } else {
    config.headers["X-CSRF-Token"] = token;
    config.headers["x-csrf-token"] = token;
    config.headers["CSRF-Token"] = token;
  }
}

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
    const token = await getCSRF();
    attachCsrfToConfig(config, token);
  }

  if (typeof window !== "undefined") {
    config._requestStartedAt = Date.now();
  }

  return config;
});

API.interceptors.response.use(
  (res) => res,

  async (error) => {
    if (!error.response) {
      return Promise.reject(error);
    }

    const { status, data } = error.response;
    const cfg = error.config || {};
    const method = String(cfg.method || "").toLowerCase();
    const msgLc = String(data?.msg || "").toLowerCase();

    if (
      status === 403 &&
      msgLc.includes("csrf") &&
      !cfg._csrfRetry &&
      ["post", "put", "patch", "delete"].includes(method)
    ) {
      devWarn("CSRF retry");
      csrfToken = null;
      cfg._csrfRetry = true;
      const token = await getCSRF(true);
      attachCsrfToConfig(cfg, token);
      return API.request(cfg);
    }

    if (status === 403 && msgLc.includes("csrf")) {
      csrfToken = null;
    }

    if (status === 401) {
      if (typeof window !== "undefined" && !isRedirecting) {
        isRedirecting = true;

        import("./auth").then(({ logout }) => {
          logout("Session expired. Please sign in again.");
        });
      }
      return Promise.reject(error);
    }

    if (status === 400) {
      devWarn("Bad Request:", data?.msg || data?.message);
    }
    if (status >= 500) {
      devWarn("Server error:", data?.msg || data?.message);
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error, fallback = "Something went wrong") {
  if (error == null) return fallback;
  if (!error?.response) {
    if (error?.code === "ECONNABORTED" || error?.code === "TIMEOUT") {
      return "Request timed out. Try again.";
    }
    return "Network error, try again";
  }

  return (
    error.response?.data?.msg ||
    error.response?.data?.message ||
    fallback
  );
}

export default API;

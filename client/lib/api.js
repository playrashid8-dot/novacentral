import axios from "axios";

// 🔗 BASE URL
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// 🚀 INSTANCE
const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const bareClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
});

let csrfTokenCache = null;

const fetchCsrfToken = async () => {
  const { data } = await bareClient.get("/csrf-token");
  csrfTokenCache = data?.data?.csrfToken || null;
  return csrfTokenCache;
};

// 🚫 prevent multiple redirects
let isRedirecting = false;

export const resetRedirectState = () => {
  isRedirecting = false;
};

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
  if (["post", "put", "patch", "delete"].includes(method) && !url.includes("csrf-token")) {
    if (!csrfTokenCache) {
      try {
        await fetchCsrfToken();
      } catch {
        // CSRF will fail later with a clear response
      }
    }
    if (csrfTokenCache) {
      config.headers = config.headers || {};
      config.headers["CSRF-Token"] = csrfTokenCache;
      config.headers["csrf-token"] = csrfTokenCache;
    }
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
      try {
        await fetchCsrfToken();
        cfg._csrfRetry = true;
        cfg.headers = cfg.headers || {};
        cfg.headers["CSRF-Token"] = csrfTokenCache;
        cfg.headers["csrf-token"] = csrfTokenCache;
        return API(cfg);
      } catch {
        // fall through
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
  }
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

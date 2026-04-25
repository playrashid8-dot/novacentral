import axios from "axios";

// 🔗 BASE URL
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// 🚀 INSTANCE
const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🚫 prevent multiple redirects
let isRedirecting = false;

/* ==============================
   🔐 REQUEST INTERCEPTOR
============================== */
API.interceptors.request.use(
  (req) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");

      if (token) {
        req.headers.Authorization = `Bearer ${token}`;
      }
    }

    return req;
  },
  (error) => Promise.reject(error)
);

/* ==============================
   🚨 RESPONSE INTERCEPTOR
============================== */
API.interceptors.response.use(
  (res) => res,

  (error) => {
    // ❌ NETWORK ERROR
    if (!error.response) {
      console.error("❌ Network Error:", error.message);

      if (typeof window !== "undefined") {
        showToast("Server not reachable ❌");
      }

      return Promise.reject(error);
    }

    const { status, data } = error.response;

    // 🔐 UNAUTHORIZED (TOKEN EXPIRED / INVALID)
    if (status === 401) {
      if (typeof window !== "undefined" && !isRedirecting) {
        isRedirecting = true;

        localStorage.clear();

        showToast("Session expired 🔒");

        setTimeout(() => {
          window.location.href = "/login";
        }, 800);
      }
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
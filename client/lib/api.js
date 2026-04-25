import axios from "axios";

// 🔗 BASE URL
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// 🚀 AXIOS INSTANCE
const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔐 REQUEST INTERCEPTOR
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

// 🚨 RESPONSE INTERCEPTOR
API.interceptors.response.use(
  (res) => res,

  (error) => {
    // ❌ NETWORK ERROR
    if (!error.response) {
      console.error("❌ Network Error:", error.message);

      if (typeof window !== "undefined") {
        alert("Server not reachable ❌");
      }

      return Promise.reject(error);
    }

    const { status, data } = error.response;

    // 🔐 UNAUTHORIZED
    if (status === 401) {
      if (typeof window !== "undefined") {
        localStorage.clear();
        window.location.href = "/login";
      }
    }

    // ⚠️ VALIDATION ERROR
    if (status === 400) {
      console.warn("⚠️ Bad Request:", data?.message);
    }

    // 🔥 SERVER ERROR
    if (status >= 500) {
      console.error("🔥 Server Error:", data);
    }

    return Promise.reject(error);
  }
);

export default API;
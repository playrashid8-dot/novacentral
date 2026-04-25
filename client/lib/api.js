import axios from "axios";

// 🔗 BASE URL (AUTO ADD /api)
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// 🚀 CREATE INSTANCE
const API = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// 🔐 REQUEST INTERCEPTOR (ADD TOKEN)
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
      console.error("Network Error:", error.message);
      alert("Server not reachable ❌");
      return Promise.reject(error);
    }

    const status = error.response.status;

    // 🔐 TOKEN EXPIRED / UNAUTHORIZED
    if (status === 401) {
      if (typeof window !== "undefined") {
        localStorage.clear();
        window.location.replace("/login");
      }
    }

    // 🔥 SERVER ERROR
    if (status >= 500) {
      console.error("Server Error:", error.response.data);
      alert("Server error ❌");
    }

    return Promise.reject(error);
  }
);

export default API;
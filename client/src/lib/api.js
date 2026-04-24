import axios from "axios";

// 🔗 API INSTANCE
const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // Railway backend
  timeout: 10000,
});

// 🔐 REQUEST INTERCEPTOR (TOKEN)
API.interceptors.request.use(
  (req) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");

      if (token) {
        req.headers.Authorization = `Bearer ${token}`; // ✅ FIXED
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
    if (!error.response) {
      alert("Network error ❌ Backend not reachable");
      return Promise.reject(error);
    }

    if (error.response.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
    }

    if (error.response.status >= 500) {
      alert("Server error ❌");
    }

    return Promise.reject(error);
  }
);

export default API;
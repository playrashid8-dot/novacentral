// 🔐 SAVE USER + TOKEN
export const saveUser = (data) => {
  if (typeof window === "undefined") return;

  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
};

// 👤 GET USER
export const getUser = () => {
  if (typeof window === "undefined") return null;

  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

// 🔑 GET TOKEN
export const getToken = () => {
  if (typeof window === "undefined") return null;

  return localStorage.getItem("token");
};

// 🚪 LOGOUT
export const logout = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem("token");
  localStorage.removeItem("user");

  window.location.href = "/login";
};

// 🔒 CHECK AUTH (use in pages)
export const isAuth = () => {
  if (typeof window === "undefined") return false;

  return !!localStorage.getItem("token");
};

// 🛡️ PROTECT ROUTE HELPER
export const protectRoute = (router) => {
  const token = getToken();

  if (!token) {
    router.push("/login");
  }
};
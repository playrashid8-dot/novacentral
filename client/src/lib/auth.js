// 🔐 SAVE USER + TOKEN
export const saveUser = (data) => {
  if (typeof window === "undefined") return;

  if (!data?.token) return;

  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user || {}));
};

// 👤 GET USER (SAFE)
export const getUser = () => {
  if (typeof window === "undefined") return null;

  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch (err) {
    console.error("User parse error", err);
    return null;
  }
};

// 🔑 GET TOKEN
export const getToken = () => {
  if (typeof window === "undefined") return null;

  return localStorage.getItem("token");
};

// 🚪 LOGOUT (SAFE)
export const logout = () => {
  if (typeof window === "undefined") return;

  localStorage.clear();

  window.location.replace("/login"); // ✅ better than href
};

// 🔒 CHECK AUTH
export const isAuth = () => {
  if (typeof window === "undefined") return false;

  const token = localStorage.getItem("token");

  if (!token) return false;

  // OPTIONAL: basic expiry check (JWT decode lite)
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp * 1000 < Date.now()) {
      logout();
      return false;
    }
  } catch (err) {
    return false;
  }

  return true;
};

// 🛡️ PROTECT ROUTE (IMPROVED)
export const protectRoute = (router) => {
  if (typeof window === "undefined") return;

  const token = getToken();

  if (!token) {
    router.replace("/login"); // ✅ better UX
  }
};
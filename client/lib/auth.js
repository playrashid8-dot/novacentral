// 🔐 SAVE USER + TOKEN
export const saveUser = (data) => {
  if (typeof window === "undefined") return;
  if (!data?.token) return;

  localStorage.setItem("token", data.token);

  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }
};

// 👤 GET USER
export const getUser = () => {
  if (typeof window === "undefined") return null;

  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

// 🔑 GET TOKEN
export const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

// 🔐 PARSE JWT (SAFE)
const parseJwt = (token) => {
  try {
    const base64 = token.split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// 🔒 CHECK AUTH
export const isAuth = () => {
  if (typeof window === "undefined") return false;

  const token = getToken();
  if (!token) return false;

  const payload = parseJwt(token);
  if (!payload) return false;

  // ⏳ TOKEN EXPIRED
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    logout();
    return false;
  }

  return true;
};

// 🚪 LOGOUT
export const logout = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem("token");
  localStorage.removeItem("user");

  window.location.href = "/login";
};

// 🛡️ PROTECT ROUTE (HOOK STYLE USE)
export const protectRoute = (router) => {
  if (typeof window === "undefined") return;

  if (!isAuth()) {
    router.replace("/login");
  }
};

// 🔄 UPDATE USER (IMPORTANT FOR BALANCE REFRESH)
export const updateUser = (newData) => {
  if (typeof window === "undefined") return;

  const user = getUser();

  if (!user) return;

  const updated = { ...user, ...newData };

  localStorage.setItem("user", JSON.stringify(updated));
};
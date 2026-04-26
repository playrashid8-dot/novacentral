const TOKEN_KEY = "token";
const USER_KEY = "user";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const extractToken = (data) =>
  data?.token || data?.accessToken || data?.jwt || data?.data?.token || null;

const extractUser = (data) => data?.user || data?.data?.user || null;

// 🔐 SAVE USER + TOKEN
export const saveUser = (data) => {
  const storage = getStorage();
  if (!storage) return false;

  const token = extractToken(data);
  if (!token || typeof token !== "string") return false;

  storage.setItem(TOKEN_KEY, token);

  const user = extractUser(data);
  if (user) {
    storage.setItem(USER_KEY, JSON.stringify(user));
  }

  return true;
};

// 👤 GET USER
export const getUser = () => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const user = storage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

// 🔑 GET TOKEN
export const getToken = () => {
  const storage = getStorage();
  if (!storage) return null;

  const token = storage.getItem(TOKEN_KEY);
  return token && typeof token === "string" ? token : null;
};

// 🔐 PARSE JWT
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

// 🚫 prevent multiple logout redirects
let isLoggingOut = false;

// 🔒 CHECK AUTH
export const isAuth = () => {
  if (typeof window === "undefined") return false;

  const token = getToken();
  if (!token) return false;

  const payload = parseJwt(token);
  if (!payload) return false;

  // ⏳ EXPIRED TOKEN
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    logout("Session expired 🔒");
    return false;
  }

  return true;
};

// 🛡️ ADMIN CHECK
export const isAdmin = () => {
  const user = getUser();
  return user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
};

// 🚪 LOGOUT
export const logout = (message) => {
  const storage = getStorage();
  if (!storage) return;

  if (isLoggingOut) return;
  isLoggingOut = true;

  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);

  if (message) {
    showToast(message);
  }

  setTimeout(() => {
    window.location.href = "/login";
  }, 500);
};

// 🛡️ PROTECT ROUTE
export const protectRoute = (router) => {
  if (typeof window === "undefined") return;

  if (!isAuth()) {
    router.replace("/login");
  }
};

// 🔄 UPDATE USER
export const updateUser = (newData) => {
  const storage = getStorage();
  if (!storage) return;

  const user = getUser();
  if (!user) return;

  const updated = { ...user, ...newData };

  storage.setItem(USER_KEY, JSON.stringify(updated));
};

// 🔥 SIMPLE TOAST
function showToast(message) {
  const div = document.createElement("div");

  div.innerText = message;

  div.className =
    "fixed top-5 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50";

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 2500);
}
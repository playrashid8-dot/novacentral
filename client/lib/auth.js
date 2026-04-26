import API, { resetRedirectState } from "./api";

const USER_KEY = "user";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const extractUser = (data) => data?.user || data?.data?.user || null;

// 🔐 SAVE USER PROFILE (JWT stays in httpOnly cookie)
export const saveUser = (data) => {
  const storage = getStorage();
  if (!storage) return false;

  const user = extractUser(data);
  if (!user) return false;

  storage.setItem(USER_KEY, JSON.stringify(user));

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

// 🚫 prevent multiple logout redirects
let isLoggingOut = false;

// 🔒 CHECK AUTH (server verifies httpOnly cookie)
export const isAuth = async () => {
  if (typeof window === "undefined") return false;

  try {
    const res = await API.get("/user/me");
    if (res?.data?.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    }
    return true;
  } catch {
    return false;
  }
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

  storage.removeItem(USER_KEY);

  API.post("/auth/logout").catch(() => {
    // No-op: local cleanup + redirect should still complete.
  });

  if (message) {
    showToast(message);
  }

  setTimeout(() => {
    window.location.href = "/login";
  }, 500);
};

export const resetLogoutState = () => {
  isLoggingOut = false;
  resetRedirectState();
};

// 🛡️ PROTECT ROUTE
export const protectRoute = (router) => {
  if (typeof window === "undefined") return Promise.resolve();

  return isAuth().then((ok) => {
    if (!ok) {
      router.replace("/login");
    }
  });
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
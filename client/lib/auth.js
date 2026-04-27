import API, { resetRedirectState } from "./api";

// 🚫 prevent multiple logout redirects
let isLoggingOut = false;

/** Sync check on a user object from /user/me (see `data` or legacy `user` on response). */
export const isAdmin = (user) => user?.isAdmin === true;

// 🔒 CHECK AUTH (server verifies httpOnly cookie)
export const isAuth = async () => {
  if (typeof window === "undefined") return false;

  try {
    await API.get("/user/me");
    return true;
  } catch {
    return false;
  }
};

// 🛡️ ADMIN CHECK (session)
export const checkAdminSession = async () => {
  try {
    const res = await API.get("/user/me");
    const user = res.data?.data ?? res.data?.user;
    return isAdmin(user);
  } catch {
    return false;
  }
};

// 🚪 LOGOUT
export const logout = (message) => {
  if (typeof window === "undefined") return;

  if (isLoggingOut) return;
  isLoggingOut = true;

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

// 🔥 SIMPLE TOAST
function showToast(message) {
  const div = document.createElement("div");

  div.innerText = message;

  div.className =
    "fixed top-5 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50";

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 2500);
}

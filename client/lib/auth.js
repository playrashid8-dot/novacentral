import API, { resetRedirectState } from "./api";
import { showToast } from "./vipToast";
import { fetchCurrentUser } from "./session";

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
    const user = await fetchCurrentUser();
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
    showToast("error", message);
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

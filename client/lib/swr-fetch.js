import API, { normalize } from "./api";
import { fetchCurrentUser } from "./session";
import { fetchHybridSummary } from "./hybrid";

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Prefer over long axios timeouts for HybridEarn dashboards — fails fast UX.
 */
export function withRaceTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("Request timed out"), { code: "TIMEOUT" })), ms),
    ),
  ]);
}

export const USER_ME_SWR_KEY = "/user/me";
export const HYBRID_SUMMARY_SWR_KEY = "/hybrid/deposit/summary";
export const DASHBOARD_SUMMARY_SWR_KEY = "/user/dashboard-summary";

export function fetchUserMeSWR() {
  return withRaceTimeout(fetchCurrentUser(), DEFAULT_TIMEOUT_MS);
}

export function fetchHybridSummarySWR() {
  return withRaceTimeout(fetchHybridSummary(), DEFAULT_TIMEOUT_MS);
}

export function fetchDashboardSummarySWR() {
  return withRaceTimeout(API.get(DASHBOARD_SUMMARY_SWR_KEY)).then((res) => {
    const r = normalize(res.data);
    if (!r.success) throw new Error(r.msg || "Failed to load dashboard summary");
    return r.data;
  });
}

/** Shared HybridEarn SWR options: no refresh when tab hidden, 15s interval. */
export const hybridDashboardSWRConfig = Object.freeze({
  revalidateOnFocus: true,
  refreshWhenHidden: false,
  refreshInterval: 15000,
  dedupingInterval: 2500,
});

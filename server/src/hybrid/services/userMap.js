import User from "../../models/User.js";

export const userMap = new Map();

/** Updated on each successful DB sync (initial + periodic). */
let lastSync = Date.now();

export function getUserMapLastSync() {
  return lastSync;
}

async function refillUserMapFromDb() {
  const users = await User.find({}, "walletAddress");

  userMap.clear();

  for (const user of users) {
    if (user.walletAddress == null || String(user.walletAddress).trim() === "") {
      continue;
    }
    userMap.set(String(user.walletAddress).toLowerCase(), user);
  }
}

export async function loadUsersIntoRealtimeMap() {
  await refillUserMapFromDb();
  lastSync = Date.now();
  console.log("👤 Users loaded:", userMap.size);
}

/**
 * Reload from DB until at least one wallet exists or retries exhausted (startup race / empty DB).
 */
export async function waitForDepositWalletsInMap() {
  const maxEmptyRetries = 60;
  let emptyRetries = 0;

  while (userMap.size === 0 && emptyRetries < maxEmptyRetries) {
    await loadUsersIntoRealtimeMap();
    if (userMap.size > 0) {
      return userMap.size;
    }
    emptyRetries += 1;
    console.warn("⚠️ User map empty — reloading from DB; blocking listener start…");
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (userMap.size === 0) {
    console.warn(
      "⚠️ No deposit wallets in DB after retries — listener will start; deposits match once users exist"
    );
  }

  return userMap.size;
}

let periodicRefreshStarted = false;

const USER_MAP_REFRESH_MS = 5 * 60 * 1000;

/** Full refresh every 5 minutes — single code path with initial load; tracks lastSync for observability. */
export function startUserMapPeriodicRefresh() {
  if (periodicRefreshStarted) {
    return;
  }
  periodicRefreshStarted = true;

  setInterval(async () => {
    try {
      if (userMap.size === 0) {
        console.log("⚠️ User map empty — reloading...");
      }
      await refillUserMapFromDb();
      lastSync = Date.now();
      console.log("🔄 User map refreshed", userMap.size);
    } catch (err) {
      console.error("❌ User sync error:", err?.message || String(err));
    }
  }, USER_MAP_REFRESH_MS);
}

/**
 * Keep the in-memory wallet map in sync when a new user is created (signup).
 */
export function addUserToHybridDepositRealtimeMap(userDoc) {
  const addr = userDoc?.walletAddress;
  if (addr == null || String(addr).trim() === "") {
    return;
  }
  const lower = String(addr).toLowerCase();
  userMap.set(lower, {
    _id: userDoc._id,
    walletAddress: lower,
  });
}

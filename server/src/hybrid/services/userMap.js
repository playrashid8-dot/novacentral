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

let periodicRefreshStarted = false;

/** Full refresh every 60s — single code path with initial load; tracks lastSync for observability. */
export function startUserMapPeriodicRefresh() {
  if (periodicRefreshStarted) {
    return;
  }
  periodicRefreshStarted = true;

  setInterval(async () => {
    try {
      await refillUserMapFromDb();
      lastSync = Date.now();
      console.log("🔄 User map refreshed", userMap.size);
    } catch (err) {
      console.log("❌ User sync error:", err.message);
    }
  }, 60000);
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

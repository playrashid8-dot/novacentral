import { id, Interface } from "ethers";
import {
  whenWsProviderReady,
  getWsProvider,
  initializeHybridRpc,
  getProvider,
  verifyWsConnectivityAndLog,
  destroyHybridWsProvider,
} from "../utils/provider.js";
import { BSC_USDT_ABI } from "../utils/constants.js";
import { CONFIRMATIONS, processDepositLog } from "../services/depositListener.js";
import {
  userMap,
  loadUsersIntoRealtimeMap,
  waitForDepositWalletsInMap,
  startUserMapPeriodicRefresh,
} from "../services/userMap.js";

import {
  describeHybridEarnDisabledReason,
  isHybridEarnEnabled,
  warnIfHybridEarnEnvInvalid,
} from "../utils/hybridEarnEnv.js";

const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const transferIface = new Interface(BSC_USDT_ABI);

/** First WS instance is from initial connect; subsequent instances are reconnects. */
let wsProviderReadyCount = 0;
whenWsProviderReady(async () => {
  wsProviderReadyCount += 1;
  if (wsProviderReadyCount < 2) {
    return;
  }
  try {
    await loadUsersIntoRealtimeMap();
    if (process.env.NODE_ENV !== "production") {
      console.log("🔄 User map reloaded after WS reconnect");
    }
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
  }
});

/** Dedupe duplicate WebSocket deliveries of the same tx within the TTL window. */
const processedTx = new Set();
/** Suppress repeated “waiting confirmations” handling for the same tx (WS replay / head lag). */
const pendingTx = new Map();
const PENDING_TX_MAX = 5000;

let realtimeStarted = false;
let listenerHookRegistered = false;
let rpcListenerRegistered = false;
/** True when HYBRID_BSC_WS_URL (or BSC_WS_URL) was used for the realtime subscription. */
let hybridWebSocketRealtimeActive = false;

/** Per-provider guard: reconnect creates a new provider; each gets at most one Transfer listener. */
const wsProvidersWithTransferListener = new WeakSet();

/** For health / bootstrap logs (WebSocket path active). */
export const isHybridRealtimeListenerStarted = () => realtimeStarted;

/** True when realtime listener runs on WebSocket (not JSON-RPC polling subscription). */
export const isHybridWebSocketRealtimeActive = () =>
  hybridWebSocketRealtimeActive && realtimeStarted;

/** Re-export for call sites that imported from this module. */
export { addUserToHybridDepositRealtimeMap } from "../services/userMap.js";

async function dispatchRealtimeDeposit(log, provider) {
  if (!userMap || userMap.size === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.log("⚠️ User map empty — reloading...");
    }
    await loadUsersIntoRealtimeMap();
    if (userMap.size === 0) {
      return;
    }
  }

  if (!log?.transactionHash) {
    return;
  }

  const txHash = log.transactionHash;
  const txKey = String(txHash).toLowerCase();

  const head = await provider.getBlockNumber();
  const bn = log.blockNumber != null ? Number(log.blockNumber) : NaN;
  /** Must run before processedTx so WS replays while unconfirmed collapse on pendingTx */
  if (Number.isFinite(bn) && bn > head - CONFIRMATIONS) {
    if (pendingTx.has(txKey)) {
      return;
    }
    pendingTx.set(txKey, true);
    if (pendingTx.size > PENDING_TX_MAX) {
      pendingTx.clear();
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("⏳ Waiting confirmations:", txHash);
    }
    setTimeout(() => {
      pendingTx.delete(txKey);
      void dispatchRealtimeDeposit(log, provider);
    }, 12000);
    return;
  }

  pendingTx.delete(txKey);

  if (processedTx.has(log.transactionHash)) {
    return;
  }
  if (processedTx.size > 10000) {
    processedTx.clear();
  }
  processedTx.add(log.transactionHash);

  const to = `0x${String(log.topics[2]).slice(26).toLowerCase()}`;
  const user = userMap.get(to);
  if (!user) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("No user found:", to);
    }
    processedTx.delete(log.transactionHash);
    return;
  }

  const usersByWallet = new Map([
    [
      String(user.walletAddress || "")
        .trim()
        .toLowerCase(),
      user,
    ],
  ]);

  let result;
  try {
    result = await processDepositLog(log, transferIface, usersByWallet, {
      skipQueue: false,
    });
  } catch (err) {
    console.error("❌ Realtime deposit pipeline error:", err?.message || String(err));
    processedTx.delete(log.transactionHash);
    throw err;
  }

  if (result.creditFailure) {
    processedTx.delete(log.transactionHash);
    return;
  }

  /** Defer = queue/worker not ready — allow WS replay / tail rescan to retry. */
  if (
    result.holdCheckpoint &&
    result.processedDelta === 0 &&
    result.queued !== true
  ) {
    processedTx.delete(log.transactionHash);
    return;
  }

  setTimeout(() => processedTx.delete(log.transactionHash), 300000);
}

async function onTransferLog(log, provider) {
  try {
    await dispatchRealtimeDeposit(log, provider);
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
    try {
      await new Promise((r) => setTimeout(r, 2000));
      await dispatchRealtimeDeposit(log, provider);
    } catch (err2) {
      console.error("❌ ERROR:", err2?.message || String(err2));
    }
  }
}

async function initRealtimeSubscription() {
  const filter = {
    address: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
    topics: [TRANSFER_TOPIC],
  };

  if (!listenerHookRegistered) {
    listenerHookRegistered = true;
    whenWsProviderReady((provider) => {
      if (wsProvidersWithTransferListener.has(provider)) {
        return;
      }
      wsProvidersWithTransferListener.add(provider);
      provider.on(filter, (incomingLog) => {
        setImmediate(() => void onTransferLog(incomingLog, provider));
      });
    });
  }

  let provider;
  try {
    provider = getWsProvider();
    await verifyWsConnectivityAndLog(provider);
  } catch (err) {
    console.error("❌ WebSocket provider error:", err?.message || String(err));
    destroyHybridWsProvider();
    throw err;
  }

  hybridWebSocketRealtimeActive = true;
  realtimeStarted = true;
  if (process.env.NODE_ENV !== "production") {
    console.log("🚀 Real-time listener started");
  }
}

function initRpcRealtimeSubscription() {
  const filter = {
    address: String(process.env.HYBRID_USDT_CONTRACT || "").trim(),
    topics: [TRANSFER_TOPIC],
  };

  if (rpcListenerRegistered) {
    return;
  }
  rpcListenerRegistered = true;
  hybridWebSocketRealtimeActive = false;

  const provider = getProvider();
  provider.on(filter, (incomingLog) => {
    setImmediate(() => void onTransferLog(incomingLog, provider));
  });

  realtimeStarted = true;
  if (process.env.NODE_ENV !== "production") {
    console.log("🚀 Real-time listener started (RPC Transfer subscription)");
  }
}

export async function startRealtimeListener() {
  if (realtimeStarted) {
    return;
  }

  warnIfHybridEarnEnvInvalid();

  if (!isHybridEarnEnabled()) {
    console.warn(
      "⚠️ Realtime listener skipped:",
      describeHybridEarnDisabledReason()
    );
    return;
  }

  if (!String(process.env.HYBRID_USDT_CONTRACT || "").trim()) {
    if (process.env.NODE_ENV !== "production") {
      console.log("⚠️ Realtime listener skipped: HYBRID_USDT_CONTRACT missing");
    }
    return;
  }

  await initializeHybridRpc();
  await waitForDepositWalletsInMap();
  await new Promise((r) => setTimeout(r, 500));

  const wsUrl = String(process.env.HYBRID_BSC_WS_URL || process.env.BSC_WS_URL || "").trim();

  try {
    if (wsUrl) {
      try {
        await initRealtimeSubscription();
      } catch (wsErr) {
        console.warn(
          "⚠️ WebSocket unavailable — using RPC fallback:",
          wsErr?.message || String(wsErr),
        );
        hybridWebSocketRealtimeActive = false;
        if (!realtimeStarted) {
          initRpcRealtimeSubscription();
        }
      }
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.log("⚠️ Using RPC fallback (WebSocket not configured)");
      }
      initRpcRealtimeSubscription();
    }
  } catch (err) {
    console.error(
      "❌ Realtime listener failed — backup scan will cover deposits:",
      err?.message || String(err),
    );
  }

  startUserMapPeriodicRefresh();
}

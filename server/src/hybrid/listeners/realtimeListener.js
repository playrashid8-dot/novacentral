import { id } from "ethers";
import { whenWsProviderReady, getWsProvider } from "../utils/provider.js";
import { CONFIRMATIONS } from "../services/depositListener.js";
import { enqueueDepositJob } from "../../queue/depositQueue.js";
import {
  userMap,
  loadUsersIntoRealtimeMap,
  startUserMapPeriodicRefresh,
} from "../services/userMap.js";

const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");

/** First WS instance is from initial connect; subsequent instances are reconnects. */
let wsProviderReadyCount = 0;
whenWsProviderReady(async () => {
  wsProviderReadyCount += 1;
  if (wsProviderReadyCount < 2) {
    return;
  }
  try {
    await loadUsersIntoRealtimeMap();
    console.log("🔄 User map reloaded after WS reconnect");
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
  }
});

/** Dedupe duplicate WebSocket deliveries of the same tx within the TTL window. */
const processedTx = new Set();

let realtimeStarted = false;
let listenerHookRegistered = false;

/** For health / bootstrap logs (WebSocket path active). */
export const isHybridRealtimeListenerStarted = () => realtimeStarted;

/** Re-export for call sites that imported from this module. */
export { addUserToHybridDepositRealtimeMap } from "../services/userMap.js";

async function dispatchRealtimeDeposit(log, provider) {
  if (!userMap || userMap.size === 0) {
    console.log("🚫 CRITICAL: User map empty — skipping all processing");
    return;
  }

  if (!log?.transactionHash) {
    return;
  }

  if (processedTx.has(log.transactionHash)) {
    return;
  }
  if (processedTx.size > 10000) {
    console.log("⚠️ processedTx cleared (safety)");
    processedTx.clear();
  }
  processedTx.add(log.transactionHash);

  const head = await provider.getBlockNumber();
  const bn = log.blockNumber != null ? Number(log.blockNumber) : NaN;
  if (Number.isFinite(bn) && bn > head - CONFIRMATIONS) {
    processedTx.delete(log.transactionHash);
    return;
  }

  const to = `0x${String(log.topics[2]).slice(26).toLowerCase()}`;
  const user = userMap.get(to);
  if (!user) {
    processedTx.delete(log.transactionHash);
    return;
  }

  try {
    await enqueueDepositJob({
      txHash: log.transactionHash,
      from: log.topics[1],
      to: log.topics[2],
      amount: log.data,
      blockNumber: log.blockNumber,
    });
    setTimeout(() => processedTx.delete(log.transactionHash), 300000);
  } catch (err) {
    processedTx.delete(log.transactionHash);
    throw err;
  }
}

async function onTransferLog(log, provider) {
  try {
    await dispatchRealtimeDeposit(log, provider);
  } catch (err) {
    console.log("❌ ERROR:", err?.message || String(err));
    try {
      await new Promise((r) => setTimeout(r, 2000));
      await dispatchRealtimeDeposit(log, provider);
    } catch (err2) {
      console.log("❌ ERROR:", err2?.message || String(err2));
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
      provider.on(filter, (log) => {
        setImmediate(() => void onTransferLog(log, provider));
      });
    });
  }

  try {
    getWsProvider();
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
    return;
  }

  realtimeStarted = true;
  console.log("🚀 Real-time listener started");
}

export async function startRealtimeListener() {
  if (realtimeStarted) {
    return;
  }

  if (String(process.env.HYBRID_EARN_ENABLED || "").toLowerCase() !== "true") {
    return;
  }

  if (!String(process.env.HYBRID_USDT_CONTRACT || "").trim()) {
    console.log("⚠️ Realtime listener skipped: HYBRID_USDT_CONTRACT missing");
    return;
  }

  if (!String(process.env.HYBRID_BSC_WS_URL || "").trim()) {
    console.log("⚠️ Realtime listener skipped: HYBRID_BSC_WS_URL missing");
    return;
  }

  await loadUsersIntoRealtimeMap();
  await new Promise((r) => setTimeout(r, 500));
  try {
    await initRealtimeSubscription();
  } catch (err) {
    console.log("❌ WS failed — running in backup mode only");
  }

  startUserMapPeriodicRefresh();
}

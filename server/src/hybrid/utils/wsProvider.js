/**
 * Dedicated WebSocket provider (ethers v6) for hybrid real-time USDT Transfer subscriptions.
 * Auto-reconnect: destroy stale provider, recreate after delay, notify subscribers via whenWsProviderReady.
 */

import { WebSocketProvider } from "ethers";

let wsProvider = null;

const wsReadyCallbacks = [];

let reconnectScheduled = false;
/** False after first successful connection for log wording */
let wsHasEverConnected = false;
/**
 * Ignore socket close/error until verifyWsConnectivityAndLog succeeds for this
 * provider instance — avoids tearing down the connection during ethers' handshake
 * when some public WS endpoints emit a spurious close.
 */
let wsHandshakeComplete = false;

/**
 * Subscribe to newly created WS provider instances (initial + after reconnect).
 */
export const whenWsProviderReady = (cb) => {
  wsReadyCallbacks.push(cb);
  if (wsProvider) {
    try {
      cb(wsProvider);
    } catch (err) {
      console.error("❌ ERROR:", err?.message || String(err));
    }
  }
};

const notifyWsReady = (provider) => {
  for (const cb of wsReadyCallbacks) {
    try {
      cb(provider);
    } catch (err) {
      console.error("❌ ERROR:", err?.message || String(err));
    }
  }
};

function safeDestroy(provider) {
  try {
    provider?.destroy?.();
  } catch (_) {
    /* ignore */
  }
}

export function destroyHybridWsProvider() {
  const prev = wsProvider;
  wsProvider = null;
  wsHandshakeComplete = false;
  safeDestroy(prev);
}

/**
 * Subscribe to underlying socket lifecycle; ethers v6 uses `websocket` accessor.
 */
function attachSocketReconnectHandlers(provider) {
  try {
    const sock = provider?.websocket ?? provider?._websocket;
    if (!sock) {
      return;
    }

    const scheduleReconnect = () => {
      if (!wsHandshakeComplete) {
        return;
      }
      if (reconnectScheduled) {
        return;
      }
      reconnectScheduled = true;
      console.log("❌ WS closed — reconnecting...");

      wsProvider = null;
      safeDestroy(provider);

      setTimeout(() => {
        reconnectScheduled = false;
        try {
          const p = getWsProvider();
          void verifyWsConnectivityAndLog(p).catch((verifyErr) => {
            console.error(
              "❌ WS reconnect verify failed:",
              verifyErr?.message || String(verifyErr),
            );
          });
        } catch (err) {
          console.error("❌ ERROR:", err?.message || String(err));
        }
      }, 3000);
    };

    /* close + error (same as Part 2 — single reconnect path; guard prevents double schedule) */
    if (typeof sock.once === "function") {
      sock.once("close", scheduleReconnect);
      sock.once("error", scheduleReconnect);
    } else if (typeof sock.on === "function") {
      sock.on("close", scheduleReconnect);
      sock.on("error", scheduleReconnect);
    } else {
      sock.onclose = scheduleReconnect;
      sock.onerror = scheduleReconnect;
    }
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
  }
}

/**
 * Wait until WS is usable, then log "🔁 WS connected" or "🔁 WS reconnected".
 * @throws If ready/blockNumber fails (used for startup + RPC fallback decision)
 */
export async function verifyWsConnectivityAndLog(provider) {
  try {
    await Promise.race([
      provider.ready,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("websocket ready timeout")), 20000),
      ),
    ]);
    await provider.getBlockNumber();
    wsHandshakeComplete = true;
    if (wsHasEverConnected) {
      console.log("🔁 WS reconnected");
    } else {
      wsHasEverConnected = true;
      console.log("🔁 WS connected");
    }
  } catch (err) {
    wsHandshakeComplete = false;
    console.error("❌ ERROR:", err?.message || String(err));
    throw err;
  }
}

export const getWsProvider = () => {
  const url = String(
    process.env.HYBRID_BSC_WS_URL || process.env.BSC_WS_URL || ""
  ).trim();
  if (!url) {
    throw new Error(
      "HYBRID_BSC_WS_URL or BSC_WS_URL is required for WebSocket provider access"
    );
  }
  if (!wsProvider) {
    wsHandshakeComplete = false;
    wsProvider = new WebSocketProvider(url);
    attachSocketReconnectHandlers(wsProvider);
    notifyWsReady(wsProvider);
  }
  return wsProvider;
};

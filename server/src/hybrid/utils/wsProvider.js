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
          getWsProvider();
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

/** Log connectivity after provider is reachable (does not block long). */
async function emitWsConnectivityLog(provider) {
  try {
    await Promise.race([
      provider.ready,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("websocket ready timeout")), 20000)
      ),
    ]);
    await provider.getBlockNumber();
    if (wsHasEverConnected) {
      console.log("🔁 WS reconnected");
    } else {
      wsHasEverConnected = true;
      console.log("🔁 WS connected");
    }
  } catch (err) {
    console.error("❌ ERROR:", err?.message || String(err));
  }
}

export const getWsProvider = () => {
  const url = String(process.env.HYBRID_BSC_WS_URL || "").trim();
  if (!url) {
    throw new Error("HYBRID_BSC_WS_URL is required for WebSocket provider access");
  }
  if (!wsProvider) {
    wsProvider = new WebSocketProvider(url);
    attachSocketReconnectHandlers(wsProvider);
    notifyWsReady(wsProvider);
    void emitWsConnectivityLog(wsProvider);
  }
  return wsProvider;
};

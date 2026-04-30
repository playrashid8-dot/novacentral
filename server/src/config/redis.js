import Redis from "ioredis";

let client;
const MAX_REDIS_RECONNECT_ATTEMPTS = 5;
let redisErrorLogged = false;

export function getRedis() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!client) {
    try {
      client = new Redis(process.env.REDIS_URL, {
        enableReadyCheck: false,
        enableOfflineQueue: true,
        maxRetriesPerRequest: null,
        keepAlive: 30000,
        connectTimeout: 10000,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > MAX_REDIS_RECONNECT_ATTEMPTS) return null;
          return Math.min(times * 1000, 5000);
        },
      });
    } catch (err) {
      console.error("❌ Redis init failed:", err?.message || String(err));
      client = null;
      return null;
    }

    client.on("connect", () => {
      console.log("✅ Redis connected");
    });

    client.on("error", (err) => {
      if (!redisErrorLogged) {
        redisErrorLogged = true;
        console.error("❌ Redis unavailable:", err?.message || String(err));
      }
    });
    client.on("end", () => {});
    client.on("reconnecting", () => {
      redisErrorLogged = false;
    });
  }

  return client;
}

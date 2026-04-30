import Redis from "ioredis";

let client;
const REDIS_KEEP_ALIVE_INTERVAL_MS = 30000;

export function getRedis() {
  if (!process.env.REDIS_URL) {
    console.warn("❌ REDIS_URL missing");
    return null;
  }

  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      enableReadyCheck: false,
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
      keepAlive: 30000,
      connectTimeout: 10000,
      lazyConnect: true,
      reconnectOnError: () => true,
      retryStrategy: (times) => Math.min(1000 * 2 ** times, 30000),
    });

    client.on("connect", () => {
      console.log("✅ Redis connected");
    });

    client.on("error", () => {});
    client.on("end", () => console.warn("Redis disconnected"));
    client.on("reconnecting", () => console.log("Redis reconnecting"));
  }

  return client;
}

setInterval(() => {
  const redis = getRedis();
  if (redis) redis.ping().catch(() => {});
}, REDIS_KEEP_ALIVE_INTERVAL_MS);

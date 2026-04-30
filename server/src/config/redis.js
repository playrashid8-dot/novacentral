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
      keepAlive: 30000,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      reconnectOnError: () => true,
      retryStrategy: (times) => Math.min(1000 * 2 ** Math.max(times - 1, 0), 30000),
    });

    client.on("connect", () => {
      console.log("✅ Redis connected");
    });

    client.on("error", () => {});
  }

  return client;
}

setInterval(() => {
  const redis = getRedis();
  if (redis) redis.ping().catch(() => {});
}, REDIS_KEEP_ALIVE_INTERVAL_MS);

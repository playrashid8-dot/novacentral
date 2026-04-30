import Redis from "ioredis";

let client;
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
          if (times > 5) return null;
          return Math.min(times * 500, 3000);
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
  }

  return client;
}

export function isRedisReady(redis = client) {
  return Boolean(redis && redis.status === "ready");
}

export function getReadyRedis() {
  const redis = getRedis();
  return isRedisReady(redis) ? redis : null;
}

export async function connectRedisInBackground() {
  const redis = getRedis();
  if (!redis || isRedisReady(redis) || redis.status === "connecting") {
    return redis;
  }

  try {
    await redis.connect();
  } catch (err) {
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      console.error("❌ Redis unavailable:", err?.message || String(err));
    }
  }

  return redis;
}

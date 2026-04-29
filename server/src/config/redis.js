import Redis from "ioredis";

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    /** BullMQ blocking commands require null; a finite value breaks the worker/queue */
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  redis.on("connect", () => {
    if (process.env.NODE_ENV !== "production") {
      console.log("✅ Redis connected");
    }
  });

  redis.on("error", () => {
    /* silent in production — avoids ECONNREFUSED spam */
  });

  redis.on("reconnecting", () => {});
  redis.on("end", () => {});
} else {
  console.warn("⚠️ REDIS_URL not found → Redis disabled");
}

export { redis };

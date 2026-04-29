import Redis from "ioredis";

let client;

export function getRedis() {
  if (!process.env.REDIS_URL) {
    console.warn("❌ REDIS_URL missing");
    return null;
  }

  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    client.on("connect", () => {
      console.log("✅ Redis connected");
    });

    client.on("error", () => {});
  }

  return client;
}

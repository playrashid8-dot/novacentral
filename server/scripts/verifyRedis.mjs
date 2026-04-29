/**
 * Quick Redis connectivity check (reads REDIS_URL from .env). Exits 0 on PONG.
 */
import dotenv from "dotenv";
import { Redis } from "ioredis";

dotenv.config();

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redis = new Redis(url, {
  maxRetriesPerRequest: 1,
  connectTimeout: 5_000,
  retryStrategy: () => null,
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error(err.message || err);
  redis.disconnect();
  process.exit(1);
});

try {
  const pong = await redis.ping();
  console.log(pong);
} finally {
  redis.disconnect();
}

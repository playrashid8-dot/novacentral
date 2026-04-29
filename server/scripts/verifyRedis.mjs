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
  lazyConnect: true,
});

redis.on("error", () => {
  /* handled via connect() / ping rejection; avoids Unhandled error event */
});

try {
  await redis.connect();
  console.log(await redis.ping());
} catch (e) {
  const msg =
    e?.message ||
    e?.lastNodeError?.message ||
    (Array.isArray(e?.errors) && e.errors[0]?.message) ||
    String(e);
  const code = e?.code || e?.cause?.code;
  if (code === "ECONNREFUSED" || /closed|refused|ECONNREFUSED/i.test(msg)) {
    console.error(
      `Redis unreachable (${code || msg}). Start Redis or set REDIS_URL. Tried: ${url}`,
    );
  } else {
    console.error(msg);
  }
  process.exitCode = 1;
} finally {
  redis.disconnect();
}

process.exit(process.exitCode ?? 0);

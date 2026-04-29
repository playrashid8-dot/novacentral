/**
 * Quick Redis connectivity check (reads REDIS_URL from .env). Exits 0 on PONG.
 */
import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

const url = process.env.REDIS_URL?.trim();
if (!url) {
  console.error(
    "REDIS_URL not set. Set REDIS_URL in server/.env (example: redis://:password@host:6379)",
  );
  process.exit(1);
}

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
      `Redis unreachable (${code || msg}). Check REDIS_URL and network. Tried URL is set (host redacted in logs).`,
    );
  } else {
    console.error(msg);
  }
  process.exitCode = 1;
} finally {
  redis.disconnect();
}

process.exit(process.exitCode ?? 0);

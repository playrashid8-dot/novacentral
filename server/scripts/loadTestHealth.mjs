#!/usr/bin/env node
/**
 * Concurrent GET /api/health against nginx or a single Node upstream.
 * Usage: BASE_URL=http://127.0.0.1:80 CONCURRENT=120 node scripts/loadTestHealth.mjs
 */
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const concurrent = Number(process.env.CONCURRENT || "120") || 120;
const repeats = Number(process.env.REPEATS || "3") || 3;

async function fetchOnce() {
  const r = await fetch(`${baseUrl}/api/health`, {
    headers: { Accept: "application/json" },
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

console.log(`Load test GET /api/health → ${baseUrl} (${concurrent} concurrent × ${repeats} rounds)`);

let failures = 0;
const t0 = Date.now();

for (let round = 0; round < repeats; round++) {
  const tr = Date.now();
  const batch = Array.from({ length: concurrent }, () =>
    fetchOnce().catch((err) => ({
      ok: false,
      status: 0,
      text: String(err.message || err),
    })),
  );

  const results = await Promise.all(batch);
  const bad = results.filter((x) => !x.ok);
  failures += bad.length;
  console.log(
    `Round ${round + 1}: ${results.length - bad.length}/${results.length} ok (+${Date.now() - tr}ms)`,
  );
}

const elapsed = Date.now() - t0;
console.log(`Done in ${elapsed}ms. Failures: ${failures}`);
process.exitCode = failures > 0 ? 1 : 0;

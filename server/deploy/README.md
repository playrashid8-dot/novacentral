# NovaCentral production scaling (infra)

This folder documents **load balancing**, **multi-instance HTTP**, **separate hybrid / workers**, **PM2**, and **verification**. No database schema or contract changes.

---

## Part 1 — Stateless API

| Item | Status |
|------|--------|
| Sessions | JWT in httpOnly cookie + MongoDB lookups — **safe for horizontal scaling** |
| Hybrid / WS listener | Separate process (`src/hybridService.js`), **not duplicated** behind nginx |
| `NOVA_SERVICE` | **`api`** = HTTP-only replicas; **`all`** / unset = monolith with hybrid |

---

## Part 2 — Nginx upstream

Deploy `deploy/nginx/nova-central.conf` (adapt `server_name`, TLS, upstream addresses).

Default upstream targets **`127.0.0.1:5000`** when API runs as **PM2 cluster** (`nova-api`: 3 workers, one listen port). Redis queue + workers use BullMQ against **`REDIS_URL`**.

Uses **least_conn** across upstream members (single member with cluster mode), **Upgrade** headers for WebSocket-style traffic to the API, **`proxy_next_upstream`** for failover on errors.

To use **nginx round-robin across three ports** instead, run three forked API processes on `5000–5002` (see commented block in `nova-central.conf`) and point upstream at those servers.

---

## Part 3 — API cluster + hybrid + workers + same `.env`

**PowerShell (Windows):** use `;` to chain commands — `&&` is not valid in older PowerShell. Examples: `cd server; npx pm2 start ecosystem.config.cjs` · `cd "path\to\folder"; node --check .\path\to\file.js`.

**Redis:** set `REDIS_URL` in `server/.env` (see `.env.example`). Run Redis locally (`docker run -d -p 6379:6379 redis`) or use a cloud URL (e.g. Railway). Verify: `cd server` then `npm run verify:redis` (expects `PONG`). The one-liner `require('ioredis')()` fails on ioredis v5 — use `new Redis()` or the `verify:redis` script.

```bash
# Redis must be running locally or reachable via REDIS_URL before workers/hybrid enqueue jobs.
# Same MongoDB URI and JWT_SECRET everywhere.
cd server
pm2 start ecosystem.config.cjs
```

Manual equivalent (cluster uses one PORT):

```bash
NOVA_SERVICE=api PORT=5000 pm2 start src/server.js -i 3 --name nova-api
node --expose-gc --max-old-space-size=2048 src/hybridService.js &
node --expose-gc --max-old-space-size=2048 src/workers/depositWorker.js &
```

---

## Part 4 — PM2

```bash
npm install pm2 -g
cd server
pm2 start ecosystem.config.cjs
pm2 logs
pm2 monit
```

Multicore utilization: **nova-api** uses **cluster mode** (`instances: 3`) on **PORT=5000**. **nova-worker-deposit** runs **2** fork processes consuming **`depositQueue`**. **nova-hybrid** is a **singleton** (WebSocket + engine).

---

## Part 5 — Auto-scaling (CPU / RAM)

PM2 **`pm2 scale`** and **`pm2 monit`** observe CPU/memory; **threshold scaling** (`CPU > 70%` scale out, `< 30%` scale in) is normally implemented via:

- **Cloud**: AWS EC2 Auto Scaling + ALB target groups; Azure VMSS; GCP MIG — align min/max replicas and health checks to **`GET /api/health`**.
- **Kubernetes**: HPA with `cpu` / `memory` metrics on the API Deployment.

Use this ecosystem file as **fixed replica counts** unless you automate `pm2 delete`/`pm2 start` or use the provider’s scaler.

---

## Part 7 — Health

- **`GET /api/health`** returns `{ "status": "ok" }` (already on main server and hybrid worker).
- Nginx **`proxy_next_upstream`** is configured for failures.

---

## Part 10 — Concurrent test

After nginx or one API is listening:

```bash
cd server
BASE_URL=http://127.0.0.1:80 CONCURRENT=150 REPEATS=5 node scripts/loadTestHealth.mjs
```

---

## Final report checklist (fill after deploy)

| Check | ✅ / ❌ |
|-------|--------|
| Load balancer / nginx upstream | |
| API cluster (`nova-api`) | |
| Redis + `depositQueue` + workers | |
| Hybrid singleton stable | |
| Auto scaling active (cloud/K8s/ops) | |

**FINAL STATUS — SYSTEM SCALABLE:** ✅ / ❌

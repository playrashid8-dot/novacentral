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

Uses **least_conn** to upstream backends, **Upgrade** headers for WebSocket long-poll style traffic, **`proxy_next_upstream`** for failover on errors.

---

## Part 3 — Multiple API instances + same `.env`

```bash
# Linux/macOS/Git Bash — same MongoDB URI and JWT_SECRET everywhere
NOVA_SERVICE=api PORT=5000 node --expose-gc --max-old-space-size=2048 src/server.js &
NOVA_SERVICE=api PORT=5001 node --expose-gc --max-old-space-size=2048 src/server.js &
NOVA_SERVICE=api PORT=5002 node --expose-gc --max-old-space-size=2048 src/server.js &
node --expose-gc --max-old-space-size=2048 src/hybridService.js &
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

Multicore utilization: each **API port** runs one fork — nginx spreads load. Optionally add more entries to `ecosystem.config.cjs`.

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
| Load balancer working | |
| Multi-instance running | |
| Auto scaling active (cloud/K8s/ops) | |
| System stable | |

**FINAL STATUS — SYSTEM SCALABLE:** ✅ / ❌

# Wave 5 Resilience: Backpressure, Failover Drills, and Worker Scaling

> INFRA-210 / INFRA-211 / INFRA-212 — Keeping the platform usable when verification,
> support, and appeal volume spikes suddenly during a Wave.

## Traffic Shaping and Backpressure (INFRA-210)

### Support Ticket Throttle

The `POST /support-tickets` endpoint is protected by `SupportTicketThrottleGuard`:

- **Limit**: 5 new tickets per owner key per 60-second window
- **Response on breach**: `429 Too Many Requests` with a `Retry-After` header
- **Scope**: creation only — reads (`GET`) are unrestricted

The constants (`MAX_CREATES_PER_WINDOW`, `WINDOW_MS`) live in
`apps/api/src/modules/support-tickets/support-ticket-throttle.guard.ts` and can
be adjusted without touching business logic.

### RPC Rate Limit

The existing `RpcRateLimitGuard` (`apps/api/src/modules/rpc/rpc-rate-limit.guard.ts`)
caps RPC proxy calls at 100 requests per IP per minute.

### Operator Action During Spikes

If queue depth or 5xx rate rises during a Wave:

1. Monitor `GET /jobs/stats` for pending depth — alert threshold is 500 (RB-005).
2. If the support ticket queue is growing, verify the throttle limit is appropriate
   and increase `MAX_CREATES_PER_WINDOW` if legitimate volume requires it.
3. Scale horizontally by running additional API processes (adjust `WORKER_CONCURRENCY`
   per process accordingly — see below).

---

## Failover Drills (INFRA-211)

Run before each Wave launch to practice degraded-mode recovery:

```bash
bash scripts/failover-drill.sh
```

The drill exercises:
1. **Baseline health** — `/health` endpoint checks DB and RPC status
2. **RPC endpoint degraded** — proxied call through `POST /rpc/<network>`
3. **Notification dependency** — reachability of `/notifications`
4. **Job queue depth** — warns if pending jobs exceed the P2 threshold (500)

Add results as a comment on the INFRA-211 GitHub issue before marking it done.

**Options:**
```
--api-url <url>       API base URL (default: http://localhost:4000)
--network  <network>  RPC network to probe (default: testnet)
```

---

## Worker Scaling and Concurrency Controls (INFRA-212)

### Configuration

Concurrency is controlled by the `WORKER_CONCURRENCY` env var in `apps/api/.env`:

```
WORKER_CONCURRENCY="3"   # default; increase for more throughput
```

The value is read at startup by `BackgroundJobService` and exposed via:

```
GET /jobs/config  → { "concurrency": 3 }
```

### Scaling Guidelines for Wave 5

| Load Pattern | Recommended `WORKER_CONCURRENCY` |
|---|---|
| Normal (< 100 pending jobs) | 3 (default) |
| Elevated (100–500 pending) | 5–8 |
| Spike (> 500 pending) | Scale out processes; keep per-process at ≤ 10 |

- **Horizontal scaling**: run multiple API processes behind a load balancer. Each
  process independently claims jobs via DB-level locks — no coordination required.
- **Vertical limit**: keep `WORKER_CONCURRENCY` ≤ 10 per process to avoid SQLite
  write contention. If higher throughput is needed, migrate to Postgres.
- **Dead-letter monitoring**: `GET /jobs/dead` lists exhausted jobs. Replay with
  `POST /jobs/:id/replay` after fixing the underlying cause.

### Runbook

If the queue is backed up (depth > 500):
1. Check `GET /jobs/stats` to identify the dominant job type.
2. Check `GET /jobs/dead` for error patterns.
3. Increase `WORKER_CONCURRENCY` and restart the API (or add a second process).
4. Monitor until depth falls below 100.
5. If jobs are repeatedly failing, fix the root cause before replaying.

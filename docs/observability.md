# Observability Guide

This document describes the observability features built into the Soroban DevConsole — what is instrumented, how to access it, and how to extend it.

---

## Table of Contents

1. [Request Tracing](#1-request-tracing)
2. [Audit Logging](#2-audit-logging)
3. [Health Endpoints](#3-health-endpoints)
4. [Network Health Monitoring](#4-network-health-monitoring)
5. [Local Telemetry Setup](#5-local-telemetry-setup)
6. [Error Tracking](#6-error-tracking)
7. [Performance Budgets](#7-performance-budgets)
8. [Adding Instrumentation](#8-adding-instrumentation)

---

## 1. Request Tracing

Every API request receives a correlation ID via the `CorrelationInterceptor` (`apps/api/src/lib/correlation.interceptor.ts`).

- **Request header:** `x-request-id` (client-supplied or auto-generated)
- **Response header:** `x-request-id` (echoed back on all responses)
- **Log format:** Every log line emitted during the request lifetime includes the correlation ID

The frontend (`apps/web/lib/api/workspaces.ts`, `rpc-gateway.ts`) automatically generates and attaches `x-request-id` on every `fetch` call.

**To trace a request end-to-end:**

1. Note the `x-request-id` from the browser's network tab or response headers.
2. Search API logs for that correlation ID.

---

## 2. Audit Logging

All workspace and share mutations are recorded in the `AuditLog` Prisma table.

**Schema fields:** `id`, `actor`, `action`, `resourceType`, `resourceId`, `summary`, `metadata`, `createdAt`

**Reading audit logs:**

```
GET /api/audit
GET /api/audit?actor=<actor>&action=<action>&resourceType=workspace&skip=0&take=50
```

Sensitive values in `summary` and `metadata` are automatically redacted by `RedactionService` (`apps/api/src/modules/security/services/redaction.service.ts`) before storage.

**Redacted patterns include:** Stellar secret keys (`S...`), private keys, auth tokens, passwords, and connection strings.

---

## 3. Health Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Basic service liveness check |
| `GET /api/version` | Service version |
| `GET /api/health/networks` | Aggregated health for all configured networks |
| `GET /api/health/networks/:network` | Health for a specific network (testnet / mainnet / futurenet) |

**Example response (`/api/health`):**

```json
{
  "ok": true,
  "service": "api",
  "version": "0.1.0",
  "timestamp": "2026-07-23T10:00:00.000Z"
}
```

---

## 4. Network Health Monitoring

The `NetworkHealthService` (`apps/api/src/modules/health/network-health.service.ts`) polls each configured Soroban RPC endpoint.

The frontend `NetworkHealth` component (`apps/web/components/network-health.tsx`) polls `/api/health/networks` and surfaces degraded/offline networks in the UI.

The `NetworkDegradedBanner` component displays a top-of-page warning when the active network is degraded.

---

## 5. Local Telemetry Setup

See `docs/local-telemetry.md` for detailed setup instructions.

**Quick start:**

The `telemetry-bootstrap.sh` script is no longer maintained after the strip commit. Basic local observability can be achieved by:

1. Pointing the API at a local Soroban RPC node.
2. Watching API logs for correlation-ID-tagged request traces.
3. Using the browser's DevTools network tab to inspect `x-request-id` headers.

---

## 6. Error Tracking

Errors are surfaced in three places:

1. **API logs:** `ApiErrorFilter` (`apps/api/src/lib/api-error.filter.ts`) catches all unhandled exceptions, logs them with correlation ID, and returns a structured `ApiEnvelope<never>` error response.

2. **Frontend error boundary:** `apps/web/app/error.tsx` catches React rendering errors and displays a recovery UI.

3. **Transaction result panel:** `TransactionResult` component (`apps/web/components/transaction-result.tsx`) decodes and displays Soroban simulation errors and on-chain failure codes.

**Error response shape:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": {}
  }
}
```

---

## 7. Performance Budgets

The web app has a performance budget enforced at build time:

- Script: `apps/web/scripts/performance-budget.js`
- npm command: `npm run check-budget --workspace=web`
- CI step: `Check performance budgets` in the `web` job

The budget file checks that Next.js bundle chunks do not exceed configured size thresholds. Update thresholds in `performance-budget.js` when adding significant new dependencies.

---

## 8. Adding Instrumentation

### API side

1. Inject `AuditService` to record mutations.
2. Use `CorrelationInterceptor` (already global) — no additional setup needed.
3. For new health probes, add a method to `NetworkHealthService` and expose it via `HealthController`.

### Frontend side

1. Use `apiFetch` from `apps/web/lib/api/workspaces.ts` (already injects `x-request-id`).
2. Use `sonner` toasts for user-visible error surfaces.
3. For long-running operations, use `BackgroundJobModule` on the API and poll via the background job endpoint.

---

*Last updated: 2026-07-23*

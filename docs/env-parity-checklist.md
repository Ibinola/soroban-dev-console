# Environment Parity Checklist for Wave Launches

> DEVOPS-215 — Automated and manual parity checks across local, staging, and production-like environments.

## Overview

This checklist ensures that local, staging, and production-like environments are aligned before a Wave launch. Run `bash scripts/check-env-parity.sh` to automate the checks below.

## Pre-Launch Checklist

### 1. Environment Variables

Run the parity script to verify all required variables are set:

```bash
bash scripts/check-env-parity.sh
```

#### API (`apps/api/.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | ✅ | Must match `DEFAULT_API_PORT` in `packages/api-contracts/src/runtime-defaults.ts` |
| `WEB_ORIGIN` | ✅ | Must match the deployed web app URL |
| `DATABASE_URL` | ✅ | Must point to the correct DB for this environment |
| `SOROBAN_RPC_TESTNET_URL` | ✅ | Required for testnet operations |
| `SOROBAN_RPC_MAINNET_URL` | ⚠️ Optional | Required for mainnet operations |
| `SOROBAN_RPC_FUTURENET_URL` | ⚠️ Optional | Required for futurenet operations |
| `SOROBAN_RPC_LOCAL_URL` | ⚠️ Optional | Required for local network operations |
| `RUNTIME_MODE` | ✅ | Must be `local`, `demo`, or `ci` |

#### Web (`apps/web/.env.local`)

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_API_URL` | ✅ | Must point to the API for this environment |
| `NEXT_PUBLIC_RPC_TESTNET` | ✅ | Must match API's `SOROBAN_RPC_TESTNET_URL` |
| `NEXT_PUBLIC_PASSPHRASE_TESTNET` | ✅ | Must match the network passphrase |
| `NEXT_PUBLIC_PASSPHRASE_MAINNET` | ✅ | Must match the network passphrase |

### 2. Port and URL Alignment

Verify that documented defaults match the canonical source of truth:

```bash
npm run check-drift
```

This checks that `README.md`, `docs/architecture.md`, and `.env.example` files are aligned with `packages/api-contracts/src/runtime-defaults.ts`.

### 3. Database

- [ ] Database migrations are applied: `cd apps/api && npx prisma migrate deploy`
- [ ] Database is seeded (if required): `cd apps/api && npx prisma db seed`
- [ ] Database file is not a development snapshot (check `DATABASE_URL`)
- [ ] Backup exists before launch (see `docs/backup-restore-drill.md`)

### 4. RPC Endpoints

- [ ] At least one Soroban RPC endpoint is reachable
- [ ] RPC URLs are correct for the target network (testnet vs mainnet)
- [ ] No local RPC URL (`localhost:8000`) is used in staging/production

```bash
bash scripts/check-service-health.sh
```

### 5. Build Artefacts

- [ ] Web app is built: `npm run build -w web`
- [ ] API is built: `npm run build -w api`
- [ ] No stale `.next` cache from a different environment

### 6. Security Configuration

- [ ] `WEB_ORIGIN` is set to the correct domain (not `localhost`) in staging/production
- [ ] No development secrets are present in staging/production env files
- [ ] CORS is restricted to the correct origin
- [ ] `RUNTIME_MODE` is set to `demo` or `ci` (not `local`) in non-local environments

### 7. Dependency Integrity

```bash
npm run check-integrity
```

- [ ] `package-lock.json` is in sync with `package.json`
- [ ] No workspace dependency version mismatches

### 8. Full Wave-Prep Gate

Run the complete pre-launch validation:

```bash
npm run wave-prep
```

This runs: drift check → integrity check → build order verification → branch workflow validation → SSR smoke test.

### 9. Wave-Critical Feature Flags

Staging must exercise the same feature flags that will be active in production. Mismatched flags are a common source of Wave launch regressions.

Flags are controlled via `FEATURE_*` env vars in `apps/api/.env` and served to the frontend through `GET /runtime-config`.

| Flag | Env Var | Default | Production |
|------|---------|---------|------------|
| Sharing | `FEATURE_SHARING` | `true` | `true` |
| Multi-op | `FEATURE_MULTI_OP` | `true` | `false` |
| Token Dashboard | `FEATURE_TOKEN_DASHBOARD` | `true` | `true` |
| Audit Log | `FEATURE_AUDIT_LOG` | `true` | `true` |
| RPC Gateway | `FEATURE_RPC_GATEWAY` | `true` | `true` |

For staging parity:
- [ ] `FEATURE_MULTI_OP` is set to `false` in the staging API env (matches production default)
- [ ] All other `FEATURE_*` flags match the intended production values
- [ ] `GET /runtime-config` response is inspected after deploy to confirm flag state

## Environment Comparison Matrix

| Check | Local | Staging | Production |
|-------|-------|---------|------------|
| `RUNTIME_MODE` | `local` | `demo` | `demo` |
| `DATABASE_URL` | `file:./dev.db` | Hosted DB | Hosted DB |
| `WEB_ORIGIN` | `http://localhost:3000` | `https://staging.example.com` | `https://app.example.com` |
| RPC endpoints | Any | Testnet/Mainnet | Mainnet |
| Build artefacts | Optional | Required | Required |
| Migrations applied | Optional | Required | Required |
| `FEATURE_MULTI_OP` | `true` | `false` | `false` |
| `FEATURE_SHARING` | `true` | `true` | `true` |

## Automated Parity Script

The `scripts/check-env-parity.sh` script automates the checks above. It:

1. Verifies all required env vars are set in `apps/api/.env` and `apps/web/.env.local`.
2. Checks that `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` are consistent with each other.
3. Verifies port alignment against `packages/api-contracts/src/runtime-defaults.ts`.
4. Warns if local-only values (e.g., `localhost`) are used in non-local `RUNTIME_MODE`.
5. Checks that at least one RPC endpoint is configured.

Exit codes:
- `0` — all checks passed
- `1` — one or more checks failed

## Maintenance

- Update this checklist when new required env vars are added.
- Run `bash scripts/check-env-parity.sh` as part of every Wave launch preparation.
- Add the script to `npm run wave-prep` if it is not already included.

# Configuration Promotion Guide

> DEVOPS-209: How configuration changes move between `local`, `demo`, and `ci` profiles.

## Overview

The project uses a `RUNTIME_MODE` environment variable to control which variables are required vs optional at startup. This prevents silent misconfiguration when promoting from one environment to the next.

| Profile | `RUNTIME_MODE` value | Purpose |
|---------|----------------------|---------|
| Local development | `local` (default) | Full-stack dev on a single machine |
| Demo / staging | `demo` | Shared preview environment |
| CI pipeline | `ci` | Automated test runs in GitHub Actions |

## Canonical Source of Truth

All default ports and local URLs live in one place:

```
packages/api-contracts/src/runtime-defaults.ts
```

Run `npm run check-drift` after any change to `.env.example` files or `README.md` to verify alignment.

## Profile Differences

### `local`
- `DATABASE_URL` → SQLite file (`file:./dev.db`)
- `WEB_ORIGIN` → `http://localhost:3000`
- `SOROBAN_RPC_MAINNET_URL` → optional (warn only)
- All other RPC URLs → optional

### `demo`
- `DATABASE_URL` → persistent SQLite or hosted Postgres
- `WEB_ORIGIN` → your Vercel/Netlify preview URL
- `SOROBAN_RPC_TESTNET_URL` → required
- `SOROBAN_RPC_MAINNET_URL` → required

### `ci`
- `DATABASE_URL` → `file:./test.db` (ephemeral, created per run)
- `WEB_ORIGIN` → `http://localhost:3000`
- All RPC URLs → set to testnet or mocked
- No secrets required beyond what GitHub Actions provides

## Promotion Workflow

```
local  ──►  demo  ──►  production-like (ci gate)
```

1. **local → demo**: Run `scripts/promote-env.sh local demo` to diff and copy non-secret values.
2. **demo → ci**: CI reads from GitHub Actions secrets; no manual copy needed.
3. **Validation**: Each profile runs `npm run check-drift` to catch port/URL drift before deployment.

## Using the Promotion Script

```bash
# Preview what would change (dry-run)
./scripts/promote-env.sh local demo --dry-run

# Apply promotion (copies non-secret keys, skips *_KEY, *_SECRET, *_TOKEN)
./scripts/promote-env.sh local demo

# Promote API env only
./scripts/promote-env.sh local ci --app api

# Promote web env only
./scripts/promote-env.sh local demo --app web
```

The script never copies variables whose names contain `KEY`, `SECRET`, or `TOKEN`. Those must be set manually in the target environment or via your secrets manager.

## Adding a New Environment Variable

1. Add it to `apps/api/.env.example` or `apps/web/.env.example` with a comment indicating which profiles require it.
2. If it contains a port or local URL, add a corresponding constant to `packages/api-contracts/src/runtime-defaults.ts` and update `scripts/check-runtime-drift.ts`.
3. Run `npm run check-drift` to confirm no drift.
4. Document the variable in the README environment table.

## CI Environment Setup

GitHub Actions workflows set environment variables via repository secrets and the `env:` block. The `ci.yml` workflow already runs `check-drift` and `check-integrity` in the `devops` job. No additional setup is needed for standard CI runs.

For the `ci` profile specifically, the API startup validates that `RUNTIME_MODE=ci` relaxes mainnet RPC requirements while still enforcing testnet connectivity.

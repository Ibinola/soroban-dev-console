# Environment Profiles

## Overview

Three curated env profiles cover the common contributor, maintainer, and operator use cases. Copy the relevant block into your `apps/api/.env` and `apps/web/.env.local` instead of hand-editing from scratch.

---

## Profile 1 — Local contributor

Standard local development. Connects to Stellar testnet and runs a local SQLite database.

**`apps/api/.env`**
```
PORT=4000
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=file:./dev.db
SOROBAN_RPC_TESTNET_URL=https://soroban-testnet.stellar.org:443
SOROBAN_RPC_MAINNET_URL=
SOROBAN_RPC_FUTURENET_URL=
SOROBAN_RPC_LOCAL_URL=
RUNTIME_MODE=local
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_RPC_TESTNET=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_RPC_MAINNET=
NEXT_PUBLIC_RPC_FUTURENET=
NEXT_PUBLIC_RPC_LOCAL=
NEXT_PUBLIC_PASSPHRASE_TESTNET=Test SDF Network ; September 2015
NEXT_PUBLIC_PASSPHRASE_MAINNET=Public Global Stellar Network ; September 2015
NEXT_PUBLIC_PASSPHRASE_FUTURENET=Test SDF Future Network ; October 2022
NEXT_PUBLIC_PASSPHRASE_LOCAL=Standalone Network ; February 2017
```

---

## Profile 2 — Demo / preview

Used for staging deployments, preview links, and live demos. Points at a persistent demo database and a deployed API.

**`apps/api/.env`**
```
PORT=4000
WEB_ORIGIN=https://your-demo-domain.vercel.app
DATABASE_URL=file:./demo.db
SOROBAN_RPC_TESTNET_URL=https://soroban-testnet.stellar.org:443
SOROBAN_RPC_MAINNET_URL=https://mainnet.stellar.validationcloud.io/v1/<YOUR_KEY>
SOROBAN_RPC_FUTURENET_URL=
SOROBAN_RPC_LOCAL_URL=
RUNTIME_MODE=demo
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_RPC_TESTNET=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_RPC_MAINNET=https://mainnet.stellar.validationcloud.io/v1/<YOUR_KEY>
NEXT_PUBLIC_RPC_FUTURENET=
NEXT_PUBLIC_RPC_LOCAL=
NEXT_PUBLIC_PASSPHRASE_TESTNET=Test SDF Network ; September 2015
NEXT_PUBLIC_PASSPHRASE_MAINNET=Public Global Stellar Network ; September 2015
NEXT_PUBLIC_PASSPHRASE_FUTURENET=Test SDF Future Network ; October 2022
NEXT_PUBLIC_PASSPHRASE_LOCAL=Standalone Network ; February 2017
```

---

## Profile 3 — Operator

Full all-network configuration for maintainers who need to reproduce mainnet, futurenet, and local-node issues.

**`apps/api/.env`**
```
PORT=4000
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=file:./operator.db
SOROBAN_RPC_TESTNET_URL=https://soroban-testnet.stellar.org:443
SOROBAN_RPC_MAINNET_URL=https://mainnet.stellar.validationcloud.io/v1/<YOUR_KEY>
SOROBAN_RPC_FUTURENET_URL=https://rpc-futurenet.stellar.org:443
SOROBAN_RPC_LOCAL_URL=http://localhost:8000/soroban/rpc
RUNTIME_MODE=local
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_RPC_TESTNET=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_RPC_MAINNET=https://mainnet.stellar.validationcloud.io/v1/<YOUR_KEY>
NEXT_PUBLIC_RPC_FUTURENET=https://rpc-futurenet.stellar.org:443
NEXT_PUBLIC_RPC_LOCAL=http://localhost:8000/soroban/rpc
NEXT_PUBLIC_PASSPHRASE_TESTNET=Test SDF Network ; September 2015
NEXT_PUBLIC_PASSPHRASE_MAINNET=Public Global Stellar Network ; September 2015
NEXT_PUBLIC_PASSPHRASE_FUTURENET=Test SDF Future Network ; October 2022
NEXT_PUBLIC_PASSPHRASE_LOCAL=Standalone Network ; February 2017
```

---

## Quick-copy helper

```bash
# Local contributor (default)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Then edit to match the profile you need.
```

## Validation

Run `bash scripts/check-env-parity.sh` after switching profiles to verify all required variables are present and consistent.

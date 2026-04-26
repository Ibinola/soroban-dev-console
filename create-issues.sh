#!/bin/bash

OWNER="Ibinola"
REPO="soroban-dev-console"
FULL_REPO="$OWNER/$REPO"

echo "Creating issues in $FULL_REPO..."

create_issue() {
  gh issue create --repo "$FULL_REPO" "$@"
}

extract_number() {
  echo "$1" | sed 's#.*/##'
}

FE001_URL=$(create_issue \
  --title "[FE-001] Build Contract Spec Ingestion Pipeline" \
  --label "frontend" \
  --label "hard" \
  --label "ready-to-pick-up" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Build the core client-side pipeline that ingests Soroban contract interface definitions from multiple sources: uploaded WASM, uploaded spec JSON, cached workspace metadata, and eventually API-backed shared workspaces. Normalize all inputs into one internal contract-spec model so the rest of the DevConsole can drive forms, previews, saved calls, and docs from a single source of truth.

## Acceptance Criteria
- [ ] A normalized contract-spec model exists in the frontend and is reusable across pages/components.
- [ ] The app can ingest contract spec data from uploaded WASM and JSON without duplicating parsing logic in UI components.
- [ ] Invalid or partial specs are surfaced with actionable error states rather than silent failures.

## Tech Stack / Files
- \`apps/web/store/useAbiStore.ts\`
- \`apps/web/lib/\`
- \`packages/soroban-utils/src/\`
- \`apps/web/components/\`

## Blocked By
None - Ready to Pick Up")
FE001=$(extract_number "$FE001_URL")

FE002_URL=$(create_issue \
  --title "[FE-002] Implement Dynamic ABI-Driven Form Generator" \
  --label "frontend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Build a generic contract call form system that renders function inputs dynamically from normalized Soroban spec data instead of hardcoded transfer/balance-style flows. This is the heart of the MVP because it turns DevConsole into a reusable contract explorer rather than a set of bespoke demos.

## Acceptance Criteria
- [ ] Forms render dynamically for any parsed function definition with typed inputs and defaults.
- [ ] Input rendering supports common Soroban primitives and collection types with validation feedback.
- [ ] The form generator can be reused by contract detail pages, saved calls, and transaction-builder flows.

## Tech Stack / Files
- \`apps/web/components/contract-call-form.tsx\`
- \`apps/web/components/abi-input-field.tsx\`
- \`apps/web/lib/\`
- \`packages/soroban-utils/src/soroban-types.ts\`

## Blocked By
#PENDING_FE001")
FE002=$(extract_number "$FE002_URL")

FE003_URL=$(create_issue \
  --title "[FE-003] Build Transaction Simulation Result Model and UI" \
  --label "frontend" \
  --label "hard" \
  --label "ready-to-pick-up" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Create a structured simulation result layer that captures return values, auth requirements, fees, resource usage, ledger effects, and RPC errors in a consistent format. The current MVP needs a trustworthy preflight story so developers can understand what will happen before signing and submitting transactions.

## Acceptance Criteria
- [ ] Simulation responses are normalized into a reusable frontend model.
- [ ] UI shows return value, auth entries, min resource fee, and state/resource metadata when available.
- [ ] Simulation failures are rendered with structured error sections instead of raw dump strings.

## Tech Stack / Files
- \`apps/web/components/contract-call-form.tsx\`
- \`apps/web/app/tx-builder/page.tsx\`
- \`packages/soroban-utils/src/\`
- \`apps/web/lib/\`

## Blocked By
None - Ready to Pick Up")
FE003=$(extract_number "$FE003_URL")

FE004_URL=$(create_issue \
  --title "[FE-004] Build Persistent Workspace State and Cross-Tool Session Model" \
  --label "frontend" \
  --label "medium" \
  --label "ready-to-pick-up" \
  --body "## Track
Frontend

## Difficulty
Medium

## Description
Define and implement the persistent client-side workspace model that ties together saved contracts, uploaded WASMs, saved calls, selected network, decoded artifacts, and recent transactions. This is necessary so the app feels like a coherent developer console instead of isolated pages.

## Acceptance Criteria
- [ ] A documented Zustand-backed workspace/session schema exists and is persisted safely.
- [ ] Saved contracts, saved calls, WASM registry items, and network selection can be restored after refresh.
- [ ] Store migrations are handled explicitly so future schema changes do not corrupt local state.

## Tech Stack / Files
- \`apps/web/store/\`
- \`apps/web/lib/history-utils.ts\`
- \`apps/web/components/workspace-switcher.tsx\`

## Blocked By
None - Ready to Pick Up")
FE004=$(extract_number "$FE004_URL")

FE005_URL=$(create_issue \
  --title "[FE-005] Implement Contract Storage Explorer Query Model" \
  --label "frontend" \
  --label "hard" \
  --label "ready-to-pick-up" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Rework the storage explorer around a typed query model for ledger key generation, fetch execution, result parsing, and pagination/history. This should support both direct contract storage lookups and future API-backed snapshot/share flows.

## Acceptance Criteria
- [ ] Storage queries are represented as typed objects rather than ad hoc component state.
- [ ] The explorer can fetch and render contract storage results with stable loading, empty, and error states.
- [ ] Query inputs and results can be reused by ledger-key tools and future state diff features.

## Tech Stack / Files
- \`apps/web/components/contract-storage.tsx\`
- \`apps/web/app/tools/ledger-keys/page.tsx\`
- \`packages/soroban-utils/src/xdr-utils.ts\`

## Blocked By
None - Ready to Pick Up")
FE005=$(extract_number "$FE005_URL")

FE006_URL=$(create_issue \
  --title "[FE-006] Build Wallet Capability Abstraction Layer" \
  --label "frontend" \
  --label "medium" \
  --label "ready-to-pick-up" \
  --body "## Track
Frontend

## Difficulty
Medium

## Description
Introduce a wallet capability abstraction that cleanly separates connection state, network support, transaction signing, error handling, and fallback behavior across Freighter and Albedo. This reduces wallet-specific branching across pages and prepares the app for more complex submission flows.

## Acceptance Criteria
- [ ] A single wallet service layer exposes connect, disconnect, getAddress, sign, and capability checks.
- [ ] UI components stop depending directly on wallet-provider-specific response shapes.
- [ ] Unsupported network, rejected signature, and wallet-not-installed states are handled consistently.

## Tech Stack / Files
- \`apps/web/store/useWallet.ts\`
- \`apps/web/components/wallet-connect.tsx\`
- \`apps/web/lib/\`

## Blocked By
None - Ready to Pick Up")
FE006=$(extract_number "$FE006_URL")

BE001_URL=$(create_issue \
  --title "[BE-001] Bootstrap NestJS API Module Architecture" \
  --label "backend" \
  --label "hard" \
  --label "ready-to-pick-up" \
  --body "## Track
Backend

## Difficulty
Hard

## Description
Stand up the real \`apps/api\` NestJS application skeleton with clear module boundaries for workspaces, sharing, RPC proxying, health, and persistence. This establishes the backend contract before UI integration begins and prevents the API from turning into one monolithic service.

## Acceptance Criteria
- [ ] \`apps/api\` is converted or scaffolded into a NestJS structure with domain modules.
- [ ] Shared config, environment loading, validation, and error handling are centralized.
- [ ] Health and version endpoints exist and are suitable for local and CI smoke checks.

## Tech Stack / Files
- \`apps/api/src/\`
- \`apps/api/package.json\`
- \`apps/api/tsconfig.json\`

## Blocked By
None - Ready to Pick Up")
BE001=$(extract_number "$BE001_URL")

BE002_URL=$(create_issue \
  --title "[BE-002] Design Prisma Schema for Cloud Workspaces and Shared Snapshots" \
  --label "backend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Hard

## Description
Model the MVP persistence layer for workspaces, saved artifacts, shareable views, and snapshot metadata in Prisma/SQLite. The schema should support both private local-dev workspaces and read-only shared URLs without needing a redesign right after the hackathon.

## Acceptance Criteria
- [ ] Prisma models cover workspaces, saved contracts, saved calls, WASM artifacts, and share links/snapshots.
- [ ] Relationships and indexes support the expected read paths for loading workspaces and shares.
- [ ] The schema is documented with assumptions about ownership, mutability, and expiration behavior.

## Tech Stack / Files
- \`apps/api/prisma/schema.prisma\`
- \`apps/api/src/modules/workspaces/\`

## Blocked By
#PENDING_BE001")
BE002=$(extract_number "$BE002_URL")

BE003_URL=$(create_issue \
  --title "[BE-003] Implement Database Migration and Seed Strategy" \
  --label "backend" \
  --label "medium" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Medium

## Description
Add a disciplined migration and seed flow for SQLite so local development, CI, and demo environments can reliably bootstrap the MVP dataset. This is especially important for a hackathon demo where reproducible setup matters more than production-scale concerns.

## Acceptance Criteria
- [ ] Prisma migrations can create the schema from scratch in a clean environment.
- [ ] Seed scripts can populate sample workspaces and snapshots for demo/testing use.
- [ ] Reset and bootstrap workflows are documented in package scripts and safe for repeated local runs.

## Tech Stack / Files
- \`apps/api/prisma/\`
- \`apps/api/package.json\`
- \`apps/api/src/seed/\`

## Blocked By
#PENDING_BE002")
BE003=$(extract_number "$BE003_URL")

BE004_URL=$(create_issue \
  --title "[BE-004] Build Network-Aware RPC Proxy Service" \
  --label "backend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Hard

## Description
Implement an API layer that proxies Soroban RPC requests by network, normalizes request/response handling, and provides one controlled surface for the web app. This enables future rate limiting, logging, request shaping, and shareable replay/debug workflows.

## Acceptance Criteria
- [ ] The API exposes network-aware proxy endpoints for the core Soroban RPC methods used by the MVP.
- [ ] Upstream RPC selection is centralized and configurable per environment/network.
- [ ] Proxy responses preserve enough fidelity for debugging while hiding unnecessary backend internals.

## Tech Stack / Files
- \`apps/api/src/modules/rpc/\`
- \`packages/soroban-utils/src/\`

## Blocked By
#PENDING_BE001")
BE004=$(extract_number "$BE004_URL")

BE005_URL=$(create_issue \
  --title "[BE-005] Add Rate Limiting, Request Budgeting, and RPC Guardrails" \
  --label "backend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Hard

## Description
Add safeguards around the RPC proxy so one noisy client or malformed request cannot tank the demo app. The MVP needs predictable behavior under hackathon traffic and repeated simulations, especially for expensive or bursty network operations.

## Acceptance Criteria
- [ ] Rate limiting is enforced per route or client scope with sensible defaults.
- [ ] Request size, timeout, and upstream retry policies are configured and testable.
- [ ] Failed, slow, and throttled proxy calls are observable through structured logs/metrics.

## Tech Stack / Files
- \`apps/api/src/modules/rpc/\`
- \`apps/api/src/common/\`
- \`apps/api/src/main.ts\`

## Blocked By
#PENDING_BE004")
BE005=$(extract_number "$BE005_URL")

SC001_URL=$(create_issue \
  --title "[SC-001] Create Soroban Contracts Workspace and Test Harness" \
  --label "smart-contracts" \
  --label "hard" \
  --label "ready-to-pick-up" \
  --body "## Track
Smart Contracts

## Difficulty
Hard

## Description
Set up the \`contracts/\` workspace with Cargo structure, Soroban SDK dependencies, and a repeatable local test harness. The goal is to create a stable contract fixture layer that the UI can use for realistic interaction, error, and event scenarios.

## Acceptance Criteria
- [ ] A dedicated \`contracts/\` workspace exists with at least one compilable Soroban crate and test setup.
- [ ] Contract tests run locally and in CI without manual environment setup.
- [ ] The workspace structure supports multiple fixture contracts rather than a single demo contract.

## Tech Stack / Files
- \`contracts/\`
- \`Cargo.toml\`
- \`contracts/*/src/lib.rs\`
- CI config

## Blocked By
None - Ready to Pick Up")
SC001=$(extract_number "$SC001_URL")

SC002_URL=$(create_issue \
  --title "[SC-002] Build Reference Token and Counter Fixture Contracts" \
  --label "smart-contracts" \
  --label "medium" \
  --label "blocked" \
  --body "## Track
Smart Contracts

## Difficulty
Medium

## Description
Implement a small set of reference contracts that cover the main interaction patterns the UI must support: basic view calls, state mutation, auth-required calls, and simple token semantics. These become the canonical contracts for end-to-end UI testing and demos.

## Acceptance Criteria
- [ ] At least two fixture contracts exist with distinct interaction patterns and deterministic tests.
- [ ] Contracts expose enough public methods to exercise dynamic form rendering and transaction simulation.
- [ ] Test artifacts are versioned or reproducibly buildable for the web app to consume.

## Tech Stack / Files
- \`contracts/token/\`
- \`contracts/counter/\`
- \`contracts/tests/\`

## Blocked By
#PENDING_SC001")
SC002=$(extract_number "$SC002_URL")

SC003_URL=$(create_issue \
  --title "[SC-003] Build Event-Heavy and Failure-Mode Fixture Contracts" \
  --label "smart-contracts" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Smart Contracts

## Difficulty
Hard

## Description
Add fixture contracts specifically designed to produce events, storage updates, and intentional failures so the UI can validate event feeds, state diffing, and error parsing. This prevents the frontend from being built only against happy-path contracts.

## Acceptance Criteria
- [ ] A fixture contract exists that emits structured events across multiple call types.
- [ ] A fixture contract exists that intentionally triggers common auth/validation/resource failure paths.
- [ ] Tests assert the emitted event and failure metadata needed by the UI.

## Tech Stack / Files
- \`contracts/events-fixture/\`
- \`contracts/failure-fixture/\`
- \`contracts/tests/\`

## Blocked By
#PENDING_SC001")
SC003=$(extract_number "$SC003_URL")

DO001_URL=$(create_issue \
  --title "[DO-001] Build Monorepo CI Pipeline for Web, API, and Contracts" \
  --label "devops" \
  --label "hard" \
  --label "ready-to-pick-up" \
  --body "## Track
DevOps

## Difficulty
Hard

## Description
Create a CI pipeline that validates the monorepo as separate but coordinated tracks: web lint/typecheck/build, API lint/build/test, and Rust contract test/build. This is essential for parallel contributor safety and hackathon delivery confidence.

## Acceptance Criteria
- [ ] CI runs track-appropriate validation for \`apps/web\`, \`apps/api\`, \`packages/*\`, and \`contracts/\`.
- [ ] Failed checks are isolated to the relevant workspace so contributors do not block one another unnecessarily.
- [ ] CI caching is configured for npm, Turbo, and Cargo where it materially improves iteration speed.

## Tech Stack / Files
- \`.github/workflows/\`
- \`turbo.json\`
- root \`package.json\`
- \`contracts/\`

## Blocked By
None - Ready to Pick Up")
DO001=$(extract_number "$DO001_URL")

gh issue edit "$FE002" --repo "$FULL_REPO" --body "## Track
Frontend

## Difficulty
Hard

## Description
Build a generic contract call form system that renders function inputs dynamically from normalized Soroban spec data instead of hardcoded transfer/balance-style flows. This is the heart of the MVP because it turns DevConsole into a reusable contract explorer rather than a set of bespoke demos.

## Acceptance Criteria
- [ ] Forms render dynamically for any parsed function definition with typed inputs and defaults.
- [ ] Input rendering supports common Soroban primitives and collection types with validation feedback.
- [ ] The form generator can be reused by contract detail pages, saved calls, and transaction-builder flows.

## Tech Stack / Files
- \`apps/web/components/contract-call-form.tsx\`
- \`apps/web/components/abi-input-field.tsx\`
- \`apps/web/lib/\`
- \`packages/soroban-utils/src/soroban-types.ts\`

## Blocked By
#$FE001"

gh issue edit "$BE002" --repo "$FULL_REPO" --body "## Track
Backend

## Difficulty
Hard

## Description
Model the MVP persistence layer for workspaces, saved artifacts, shareable views, and snapshot metadata in Prisma/SQLite. The schema should support both private local-dev workspaces and read-only shared URLs without needing a redesign right after the hackathon.

## Acceptance Criteria
- [ ] Prisma models cover workspaces, saved contracts, saved calls, WASM artifacts, and share links/snapshots.
- [ ] Relationships and indexes support the expected read paths for loading workspaces and shares.
- [ ] The schema is documented with assumptions about ownership, mutability, and expiration behavior.

## Tech Stack / Files
- \`apps/api/prisma/schema.prisma\`
- \`apps/api/src/modules/workspaces/\`

## Blocked By
#$BE001"

gh issue edit "$BE003" --repo "$FULL_REPO" --body "## Track
Backend

## Difficulty
Medium

## Description
Add a disciplined migration and seed flow for SQLite so local development, CI, and demo environments can reliably bootstrap the MVP dataset. This is especially important for a hackathon demo where reproducible setup matters more than production-scale concerns.

## Acceptance Criteria
- [ ] Prisma migrations can create the schema from scratch in a clean environment.
- [ ] Seed scripts can populate sample workspaces and snapshots for demo/testing use.
- [ ] Reset and bootstrap workflows are documented in package scripts and safe for repeated local runs.

## Tech Stack / Files
- \`apps/api/prisma/\`
- \`apps/api/package.json\`
- \`apps/api/src/seed/\`

## Blocked By
#$BE002"

gh issue edit "$BE004" --repo "$FULL_REPO" --body "## Track
Backend

## Difficulty
Hard

## Description
Implement an API layer that proxies Soroban RPC requests by network, normalizes request/response handling, and provides one controlled surface for the web app. This enables future rate limiting, logging, request shaping, and shareable replay/debug workflows.

## Acceptance Criteria
- [ ] The API exposes network-aware proxy endpoints for the core Soroban RPC methods used by the MVP.
- [ ] Upstream RPC selection is centralized and configurable per environment/network.
- [ ] Proxy responses preserve enough fidelity for debugging while hiding unnecessary backend internals.

## Tech Stack / Files
- \`apps/api/src/modules/rpc/\`
- \`packages/soroban-utils/src/\`

## Blocked By
#$BE001"

gh issue edit "$BE005" --repo "$FULL_REPO" --body "## Track
Backend

## Difficulty
Hard

## Description
Add safeguards around the RPC proxy so one noisy client or malformed request cannot tank the demo app. The MVP needs predictable behavior under hackathon traffic and repeated simulations, especially for expensive or bursty network operations.

## Acceptance Criteria
- [ ] Rate limiting is enforced per route or client scope with sensible defaults.
- [ ] Request size, timeout, and upstream retry policies are configured and testable.
- [ ] Failed, slow, and throttled proxy calls are observable through structured logs/metrics.

## Tech Stack / Files
- \`apps/api/src/modules/rpc/\`
- \`apps/api/src/common/\`
- \`apps/api/src/main.ts\`

## Blocked By
#$BE004"

gh issue edit "$SC002" --repo "$FULL_REPO" --body "## Track
Smart Contracts

## Difficulty
Medium

## Description
Implement a small set of reference contracts that cover the main interaction patterns the UI must support: basic view calls, state mutation, auth-required calls, and simple token semantics. These become the canonical contracts for end-to-end UI testing and demos.

## Acceptance Criteria
- [ ] At least two fixture contracts exist with distinct interaction patterns and deterministic tests.
- [ ] Contracts expose enough public methods to exercise dynamic form rendering and transaction simulation.
- [ ] Test artifacts are versioned or reproducibly buildable for the web app to consume.

## Tech Stack / Files
- \`contracts/token/\`
- \`contracts/counter/\`
- \`contracts/tests/\`

## Blocked By
#$SC001"

gh issue edit "$SC003" --repo "$FULL_REPO" --body "## Track
Smart Contracts

## Difficulty
Hard

## Description
Add fixture contracts specifically designed to produce events, storage updates, and intentional failures so the UI can validate event feeds, state diffing, and error parsing. This prevents the frontend from being built only against happy-path contracts.

## Acceptance Criteria
- [ ] A fixture contract exists that emits structured events across multiple call types.
- [ ] A fixture contract exists that intentionally triggers common auth/validation/resource failure paths.
- [ ] Tests assert the emitted event and failure metadata needed by the UI.

## Tech Stack / Files
- \`contracts/events-fixture/\`
- \`contracts/failure-fixture/\`
- \`contracts/tests/\`

## Blocked By
#$SC001"

echo "Done."
echo "Created issues:"
echo "FE-001 -> #$FE001"
echo "FE-002 -> #$FE002"
echo "FE-003 -> #$FE003"
echo "FE-004 -> #$FE004"
echo "FE-005 -> #$FE005"
echo "FE-006 -> #$FE006"
echo "BE-001 -> #$BE001"
echo "BE-002 -> #$BE002"
echo "BE-003 -> #$BE003"
echo "BE-004 -> #$BE004"
echo "BE-005 -> #$BE005"
echo "SC-001 -> #$SC001"
echo "SC-002 -> #$SC002"
echo "SC-003 -> #$SC003"
echo "DO-001 -> #$DO001"

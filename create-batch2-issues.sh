#!/bin/bash

REPO="Ibinola/soroban-dev-console"

echo "Creating Batch 2 issues in $REPO..."

create_issue() {
  gh issue create --repo "$REPO" "$@"
}

extract_number() {
  echo "$1" | sed 's#.*/##'
}

FE007_URL=$(create_issue \
  --title "[FE-007] Implement Contract Overview Data Aggregator" \
  --label "frontend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Build a contract overview data layer that aggregates metadata, deployment state, interface presence, ledger details, and network context into one view model for the contract detail page. This prevents the detail screen from making scattered RPC calls and supports future API-backed snapshots and sharing.

## Acceptance Criteria
- [ ] Contract detail pages load through a single orchestrated data model rather than independent ad hoc fetches.
- [ ] The overview shows contract existence, last modified ledger, interface availability, and network context.
- [ ] Partial failures degrade gracefully so missing metadata does not blank the whole screen.

## Tech Stack / Files
- \`apps/web/app/contracts/[contractId]/page.tsx\`
- \`apps/web/lib/\`
- \`packages/soroban-utils/src/\`

## Blocked By
FE-001")
FE007=$(extract_number "$FE007_URL")

FE008_URL=$(create_issue \
  --title "[FE-008] Build State Diff Viewer for Simulations and Before/After Snapshots" \
  --label "frontend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Implement a UI and supporting diff model for comparing contract state before and after simulated or executed operations. This is a high-value developer feature for the MVP because it turns opaque ledger mutations into understandable output.

## Acceptance Criteria
- [ ] The app can render a structured state diff view for supported simulation/storage result inputs.
- [ ] Added, removed, and changed values are visually distinct and typed when possible.
- [ ] The diff component is reusable across simulation results and future shared snapshots.

## Tech Stack / Files
- \`apps/web/components/state-diff-viewer.tsx\`
- \`apps/web/lib/diff-utils.ts\`
- \`packages/soroban-utils/src/xdr-utils.ts\`

## Blocked By
FE-003, FE-005")
FE008=$(extract_number "$FE008_URL")

FE009_URL=$(create_issue \
  --title "[FE-009] Implement Transaction Feed Normalization and Polling Strategy" \
  --label "frontend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Rebuild the transaction feed around a normalized polling model that deduplicates transactions, tracks latest cursor/time, and distinguishes account-not-found, empty, loading, and degraded-network states. The current feed needs to become reliable enough for live demos and real debugging sessions.

## Acceptance Criteria
- [ ] Transaction polling is resilient to refreshes, duplicates, and network changes.
- [ ] Feed items are normalized into one stable UI model with timestamps, status, and operation summary.
- [ ] Empty, stale, and error states are distinguishable in the UI.

## Tech Stack / Files
- \`apps/web/components/transaction-feed.tsx\`
- \`apps/web/lib/history-utils.ts\`
- \`apps/web/store/\`

## Blocked By
FE-004")
FE009=$(extract_number "$FE009_URL")

FE010_URL=$(create_issue \
  --title "[FE-010] Build Multi-Operation Transaction Builder UX" \
  --label "frontend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Expand the multi-operation builder into a production-worthy MVP flow that can compose saved calls, order them deterministically, simulate the batch, surface aggregate fees/auth/state changes, and submit via wallet. This is one of the differentiating DevConsole features for the hackathon.

## Acceptance Criteria
- [ ] Users can add, remove, reorder, and clear batched operations with persistent local state.
- [ ] Simulation output explains aggregate resource usage and failure causes for the batch.
- [ ] Submission flow uses the same normalized wallet and result handling as single-call flows.

## Tech Stack / Files
- \`apps/web/app/tx-builder/page.tsx\`
- \`apps/web/components/multi-op-cart.tsx\`
- \`apps/web/store/useSavedCallsStore.ts\`

## Blocked By
FE-003, FE-004, FE-006")
FE010=$(extract_number "$FE010_URL")

FE011_URL=$(create_issue \
  --title "[FE-011] Implement WASM Registry Metadata Pipeline" \
  --label "frontend" \
  --label "medium" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Medium

## Description
Turn the WASM registry into a real artifact inventory by enriching stored WASMs with parsed function metadata, hashes, upload history, and deployment associations. This gives the app a usable code-artifact workflow instead of just a file upload surface.

## Acceptance Criteria
- [ ] Stored WASM entries capture hash, name, parsed metadata, network, and install/deploy timestamps.
- [ ] Registry items can be associated with deployed contracts and workspace context.
- [ ] The registry gracefully handles parse failures and duplicate artifact uploads.

## Tech Stack / Files
- \`apps/web/app/deploy/wasm/page.tsx\`
- \`apps/web/store/useWasmStore.ts\`
- \`packages/soroban-utils/src/soroban.ts\`

## Blocked By
FE-001, FE-004")
FE011=$(extract_number "$FE011_URL")

FE012_URL=$(create_issue \
  --title "[FE-012] Build Shareable Frontend Workspace Serialization Layer" \
  --label "frontend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Define the client-side serialization format for exporting and importing workspace state to/from backend-backed share links. This creates a clean contract between the web app and upcoming workspace/share APIs.

## Acceptance Criteria
- [ ] Workspace serialization captures contracts, saved calls, selected network, artifacts, and relevant UI context.
- [ ] Import/export logic is versioned so future frontend schema changes are manageable.
- [ ] Sensitive or purely ephemeral client state is excluded from serialized payloads.

## Tech Stack / Files
- \`apps/web/store/\`
- \`apps/web/lib/\`
- \`apps/web/components/data-management.tsx\`

## Blocked By
FE-004, BE-006")
FE012=$(extract_number "$FE012_URL")

FE013_URL=$(create_issue \
  --title "[FE-013] Integrate Frontend with Workspace CRUD API" \
  --label "frontend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Connect the existing local workspace model to the backend workspace API so users can create, load, and update cloud-backed workspaces. The app should preserve its fast local feel while syncing with the API when cloud mode is active.

## Acceptance Criteria
- [ ] The frontend can create and load workspaces through the API.
- [ ] Local store state can sync to backend-backed workspace records without data loss.
- [ ] UI clearly indicates save/load/sync states and handles conflicts/failures gracefully.

## Tech Stack / Files
- \`apps/web/store/\`
- \`apps/web/lib/api/\`
- \`apps/web/components/workspace-switcher.tsx\`

## Blocked By
FE-012, BE-006, BE-008")
FE013=$(extract_number "$FE013_URL")

FE014_URL=$(create_issue \
  --title "[FE-014] Integrate Frontend with Shareable Read-Only Links" \
  --label "frontend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Hard

## Description
Build the frontend flow for creating shareable URLs and loading read-only shared sessions. This should support the MVP storytelling use case where a developer can hand someone a link to inspect a contract session or workspace state.

## Acceptance Criteria
- [ ] Users can create a share link from a relevant workspace/session context.
- [ ] Shared links load in a read-only mode with clear UX differences from editable workspaces.
- [ ] Broken, expired, or revoked links surface useful error states.

## Tech Stack / Files
- \`apps/web/components/data-management.tsx\`
- \`apps/web/lib/api/\`
- \`apps/web/app/\`

## Blocked By
FE-012, BE-007, BE-009")
FE014=$(extract_number "$FE014_URL")

FE015_URL=$(create_issue \
  --title "[FE-015] Seed Frontend Demo Flows with Fixture Contract Manifest" \
  --label "frontend" \
  --label "medium" \
  --label "blocked" \
  --body "## Track
Frontend

## Difficulty
Medium

## Description
Use the generated contract artifact manifest to preload or suggest known fixture contracts in the UI for docs, demos, and testing. This avoids brittle hardcoded IDs scattered across pages and gives the MVP a polished onboarding flow.

## Acceptance Criteria
- [ ] The frontend can load known fixture contract metadata from a manifest or API-fed equivalent.
- [ ] Docs/demo flows reference fixture contracts through one source of truth.
- [ ] Switching fixture versions or networks does not require editing multiple UI files.

## Tech Stack / Files
- \`apps/web/lib/\`
- docs pages
- \`apps/web/app/\`
- generated manifest

## Blocked By
SC-005")
FE015=$(extract_number "$FE015_URL")

BE000_URL=$(create_issue \
  --title "[BE-000] Consolidate API on NestJS and Remove Legacy Express Layer" \
  --label "backend" \
  --label "hard" \
  --label "ready-to-pick-up" \
  --body "## Track
Backend

## Difficulty
Hard

## Description
The API currently has two overlapping server paths: the active NestJS module architecture and a deprecated Express-based route/controller layer. This duplication is already causing type drift, test confusion, and conflicting runtime assumptions. Before expanding Batch 2 backend work, freeze the Express path, migrate any still-needed behavior into NestJS modules/controllers/services, repoint tests to the Nest app only, and then remove the legacy Express files.

## Acceptance Criteria
- [ ] Any still-needed behavior in the legacy Express layer is migrated into NestJS controllers/services/modules.
- [ ] The API no longer imports or depends on the deprecated Express app/router/controller path.
- [ ] Legacy Express files are removed once parity is confirmed.
- [ ] API tests run against the NestJS app only.
- [ ] \`npm run lint -w api\` passes.
- [ ] \`npm run build -w api\` passes.
- [ ] \`npm run test -w api\` passes.

## Tech Stack / Files
- \`apps/api/src/main.ts\`
- \`apps/api/src/app.module.ts\`
- \`apps/api/src/modules/**\`
- \`apps/api/src/app.ts\`
- \`apps/api/src/routes/**\`
- \`apps/api/src/controllers/**\`
- \`apps/api/src/app.test.ts\`
- \`apps/api/package.json\`

## Blocked By
None - Ready to Pick Up")
BE000=$(extract_number "$BE000_URL")

BE006_URL=$(create_issue \
  --title "[BE-006] Implement Workspace CRUD API" \
  --label "backend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Hard

## Description
Build the first real API surface for creating, loading, updating, and listing cloud workspaces. This provides the backend foundation for persistent collaboration and demo continuity across devices.

## Acceptance Criteria
- [ ] API endpoints exist for create, read, update, and list workspace records.
- [ ] Workspace payloads are validated and persisted through Prisma-backed services.
- [ ] Error responses distinguish validation, not-found, and persistence failures cleanly.

## Tech Stack / Files
- \`apps/api/src/modules/workspaces/\`
- \`apps/api/prisma/schema.prisma\`

## Blocked By
BE-000, BE-002, BE-003")
BE006=$(extract_number "$BE006_URL")

BE007_URL=$(create_issue \
  --title "[BE-007] Implement Shareable Snapshot and Read-Only Link Service" \
  --label "backend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Hard

## Description
Build the service that turns a workspace state or contract/session snapshot into a shareable, read-only link. This is a key MVP differentiator for hackathon demos, debugging handoffs, and reproducible examples.

## Acceptance Criteria
- [ ] The backend can create immutable share records tied to a workspace or snapshot payload.
- [ ] Shared links can be resolved without mutating the original workspace.
- [ ] Basic expiration or revocation semantics exist, even if simple for the MVP.

## Tech Stack / Files
- \`apps/api/src/modules/shares/\`
- \`apps/api/prisma/schema.prisma\`

## Blocked By
BE-000, BE-006")
BE007=$(extract_number "$BE007_URL")

BE008_URL=$(create_issue \
  --title "[BE-008] Build Workspace Serialization/Deserialization Boundary" \
  --label "backend" \
  --label "medium" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Medium

## Description
Implement the backend DTO and service layer that validates serialized workspace payloads coming from the frontend and returns them in a stable shape. This avoids coupling API persistence directly to ad hoc client store structures.

## Acceptance Criteria
- [ ] DTO validation exists for workspace import/export payloads.
- [ ] Backend stores and returns versioned workspace data instead of raw unvalidated blobs.
- [ ] Deserialization errors are actionable and do not corrupt existing records.

## Tech Stack / Files
- \`apps/api/src/modules/workspaces/dto/\`
- \`apps/api/src/modules/workspaces/\`
- \`apps/web/store/\`

## Blocked By
BE-000, BE-006")
BE008=$(extract_number "$BE008_URL")

BE009_URL=$(create_issue \
  --title "[BE-009] Implement API Auth Strategy for MVP Workspace Ownership" \
  --label "backend" \
  --label "hard" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Hard

## Description
Define and implement a lightweight MVP authentication/ownership model for private workspaces and public shared links. Even for a hackathon, the app needs a clear rule set for who can mutate a workspace and who can only view a share.

## Acceptance Criteria
- [ ] Private workspace routes enforce an ownership/auth policy.
- [ ] Public share routes are readable without granting edit access to private workspace data.
- [ ] Auth assumptions and limitations are documented explicitly for MVP scope.

## Tech Stack / Files
- \`apps/api/src/auth/\`
- \`apps/api/src/modules/workspaces/\`
- \`apps/api/src/modules/shares/\`

## Blocked By
BE-007, BE-008")
BE009=$(extract_number "$BE009_URL")

BE010_URL=$(create_issue \
  --title "[BE-010] Build RPC Request Logging and Trace Correlation" \
  --label "backend" \
  --label "medium" \
  --label "blocked" \
  --body "## Track
Backend

## Difficulty
Medium

## Description
Add structured logging for proxied RPC requests so developers can correlate frontend actions, backend proxy behavior, and upstream Soroban responses. This is critical when the demo app needs debugging under time pressure.

## Acceptance Criteria
- [ ] Each proxied request receives a correlation ID that propagates through logs.
- [ ] Logs include network, route/method, latency, status, and upstream failure metadata.
- [ ] Sensitive payload details are redacted or summarized appropriately.

## Tech Stack / Files
- \`apps/api/src/modules/rpc/\`
- \`apps/api/src/common/logging/\`

## Blocked By
BE-004, BE-005")
BE010=$(extract_number "$BE010_URL")

DO002_URL=$(create_issue \
  --title "[DO-002] Implement Environment Matrix and Secret Management Strategy" \
  --label "devops" \
  --label "medium" \
  --label "ready-to-pick-up" \
  --body "## Track
DevOps

## Difficulty
Medium

## Description
Define the environment model for local, demo, and CI runs across web, API, and contracts, including RPC endpoints, database location, wallet assumptions, and fixture deployment inputs. This reduces last-minute hackathon setup chaos.

## Acceptance Criteria
- [ ] Environment variable sets are defined for web, API, and contract workflows.
- [ ] Demo-critical secrets and tokens are isolated from local defaults.
- [ ] Broken or missing env configuration fails fast with clear diagnostics.

## Tech Stack / Files
- \`.env.example\`
- \`apps/web/\`
- \`apps/api/\`
- deployment scripts
- CI config

## Blocked By
None - Ready to Pick Up")
DO002=$(extract_number "$DO002_URL")

echo "Done."
echo "FE-007 -> #$FE007"
echo "FE-008 -> #$FE008"
echo "FE-009 -> #$FE009"
echo "FE-010 -> #$FE010"
echo "FE-011 -> #$FE011"
echo "FE-012 -> #$FE012"
echo "FE-013 -> #$FE013"
echo "FE-014 -> #$FE014"
echo "FE-015 -> #$FE015"
echo "BE-000 -> #$BE000"
echo "BE-006 -> #$BE006"
echo "BE-007 -> #$BE007"
echo "BE-008 -> #$BE008"
echo "BE-009 -> #$BE009"
echo "BE-010 -> #$BE010"
echo "DO-002 -> #$DO002"

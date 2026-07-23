# Changelog

All notable changes to **Soroban DevConsole** are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For machine-readable / scriptable rendering of merged PRs after a given
date, run:

```bash
npm run generate-changelog -- --since 2026-07-01
```

The generator also accepts `--until <date>`, `--out <path>`, and
`--base <ref>` for finer-grained ranges. It exits non-zero if no merged
PRs are found in the supplied range so CI can treat a stale generated
changelog as a failure.

## [Unreleased]

### Added

- Contract event log now supports cursor pagination and configurable
  auto-refresh polling (5s / 15s / 30s / 60s / off), event count, last-
  refreshed timestamp, and a transient highlight for events that arrive
  since the last poll. (#679)
- Wallet network-mismatch warning banner: if a connected Freighter wallet
  is configured for a different Stellar network than the app expects, an
  inline banner appears with a quick-switch action. (#675)
- Wallet `/ Albedo` providers expose a best-effort `getNetworkSnapshot()`
  so the wallet store can compare against the active Soroban network. (#675)
- New `scripts/generate-changelog.ts` plus an `npm run generate-changelog`
  command for producing Keep-a-Changelog entries from `git log --merges`. (#659)
- Root `CHANGELOG.md` covering Waves 1 – 7. (#659)

### Fixed

- Albedo session revalidation no longer assumes the session is live:
  `albedoRevalidate()` re-probes `albedo.publicKey()` and clears the
  wallet store (disconnect, plus transient passphrase reset) when the
  user has revoked access. (#651)
- Wallet store no longer persists the wallet's reported network
  passphrase into localStorage; it is re-fetched from the live provider
  on every session restore. (#675)

## [Wave 7] — 2026-07-23

### Changed

- Maintenance cleanup pass to bring CI gates back to a green baseline.

### Security

- No security-relevant changes in this wave.

## [Wave 6] — 2026-07

### Fixed

- Comprehensive Wave 6 audit follow-ups (rebased on `main`). (#646)

## [Wave 5] — 2026-06

### Added

- Wave 5 verification-sensitive flows documentation and fairness runbooks.
- Wave 5 burst-test plan and resilience documentation.

### Changed

- Fairness verification surfaced into the consensus docs, with a separate
  audit checklist for wave cutovers.

## [Wave 4] — 2026-05

### Added

- Cross-browser dashboards to the e2e suite.
- Verification gating tests.
- Share-spec end-to-end coverage.

## [Wave 3] — 2026-04

### Added

- Pre-import review pipeline for contract upload.
- Tooling-grade review of multi-call invocation traces.
- Workspace round-trip fixture tests.

## [Wave 2] — 2026-03

### Added

- RPC gateway (`apps/web/lib/api/rpc-gateway.ts`) with correlation-ID
  request tracing.
- Source registry and source-verification primitives.
- Dependency diagnostics surface in the console.
- Verification checklist for transaction & storage reads.

### Changed

- Contract event display moved to gateway-backed `sorobanRpc.getEvents`
  with a direct fallback when the gateway is offline.

## [Wave 1] — 2026-02

### Added

- Initial monorepo layout (apps/web, apps/api, packages/ui,
  packages/soroban-utils, packages/api-contracts).
- Soroban fixture contracts (`counter-fixture`, `event-fixture`,
  `token-fixture`, `auth-tester`, `failure-fixture`, `error-trigger`,
  `types-tester`).
- RPC proxy NestJS backend with Prisma + SQLite persistence.
- Workspace & share-link workflows with read-only rendering.
- Wallet connect / sign / revalidate abstractions for Freighter + Albedo.
- Sandbox simulation mode.
- Network switcher, custom RPC management, friendbot funding.
- Token SAC (`CDLZFC3…`) default spec used by the call form.

[Unreleased]: https://github.com/Ibinola/soroban-dev-console/compare/main...HEAD

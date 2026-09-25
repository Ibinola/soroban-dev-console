# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Wave 7] - Unreleased

### Added
- Wallet session revalidation for Albedo (`albedoRevalidate` now attempts
  `albedo.publicKey({})` and clears the wallet store on rejection).
- Wallet-vs-app network mismatch detection. After connect we capture the
  wallet's active network passphrase and compare it against the
  configured `NetworkConfig.networkPassphrase`. A dismissible banner
  surfaces the mismatch with a quick-switch action, and re-checks run on
  every network switch.
- Contract event log: cursor-based pagination (load-more), auto-refresh
  toggle (5s, 15s, 30s, off), event-count and last-refreshed timestamp
  display, transient highlight for newly polled events, and URL
  search-param persistence of the refresh choice.
- Root-level `CHANGELOG.md` plus `scripts/generate-changelog.ts` —
  `npm run generate-changelog -- --since <date>` extracts merged PR
  titles via `git log --merges --first-parent` and emits
  Keep-a-Changelog markdown. Exits non-zero when no merged PRs are
  found in the requested range.

### Changed
- `WalletProviderDefinition.revalidate` now returns
  `{ isValid, networkPassphrase? }` instead of a bare `boolean`, so the
  store can use the latest wallet passphrase for mismatch detection.
- `useWallet` state now persists `networkPassphraseAtConnect` (via
  `version: 1`) so legacy localStorage entries hydrate cleanly.

## [Wave 6] - 2026-07-09

### Changed
- Repository audit pass: explained devtooling, removed dead code, and
  stabilised the Next.js + Turborepo build (`chore: Wave 6 audit fixes`).

## [Wave 5] - 2026-06-25

### Added
- Fairness verification primitives.
- Resilience test plan for flaky check quarantine.

### Changed
- Wave 5 telemetry refresh: environment profiles and runtime defaults
  consolidated in `packages/api-contracts/src/runtime-defaults.ts`.

## [Wave 4] - 2026-06-11

### Added
- Branch-protection policy and PR templates.
- Local-telemetry admin scripts.
- Backup/restore drill and migration verification scripts.

## [Wave 3] - 2026-05-24

### Added
- Workspace share links (`/share/[shareId]`).
- Verification checklist for high-stakes actions.

## [Wave 2] - 2026-05-02

### Added
- Fund-account flow via Friendbot/custom HTTP endpoint.
- Token SAC action modal and dashboard.

## [Wave 1] - 2026-04-08

### Added
- Initial Soroban DevConsole: Next.js 16 front-end + NestJS API on a
  Turborepo monorepo with shared Soroban utilities and shadcn/ui.
- Workspace management, contract explorer, transaction feed, and
  read-only / sandbox modes.

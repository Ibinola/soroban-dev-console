# Product PRD — Soroban DevConsole

### One-line Description

A comprehensive web-based developer toolkit for building, testing, and debugging Soroban smart contracts on Stellar.

---

## Problem Statement

Soroban smart contract development currently relies on CLI-heavy workflows with limited visual tooling. Developers need to juggle multiple terminal sessions, RPC endpoint configurations, and manual state inspection. This creates friction, especially during debugging and onboarding. Soroban DevConsole bridges this gap by providing an intuitive web interface for workspace management, contract interaction, RPC proxying, and state snapshots.

---

## Target User

### Primary User

Soroban smart contract developers building on Stellar.

### Traits

- Comfortable with CLI tools but prefers visual debugging
- Works with multiple contracts and RPC endpoints
- Needs to share workspace state with team members
- Values fast iteration and reproducible environments
- May be new to Soroban and needs guided onboarding

---

## Core Features (v1)

### 1. Workspace Management

Isolated development environments with contract collections, saved RPC calls, and artifact references.

#### User Stories

- As a user, I want to create multiple workspaces for different projects.
- As a user, I want to add/remove contracts and saved calls to a workspace.
- As a user, I want to import and export workspace state for sharing.

---

### 2. Contract Explorer

Visual interface for browsing contract state, storage entries, and emitted events.

#### User Stories

- As a user, I want to view contract storage entries for any deployed contract.
- As a user, I want to see transaction history and events for my contracts.
- As a user, I want to inspect contract specifications and ABIs.

---

### 3. RPC Proxy

Backend-mediated access to Soroban RPC endpoints with caching, failover, and rate limiting.

#### User Stories

- As a user, I want to make RPC calls without exposing endpoints to the browser.
- As a user, I want caching of idempotent responses for faster development.
- As a user, I want automatic failover across multiple RPC endpoints.

---

### 4. Share Links

Read-only snapshots of workspace state for collaboration.

#### User Stories

- As a user, I want to share my workspace configuration via a link.
- As a user, I want to control expiration and revocation of share links.
- As a user, I want public resolution without requiring authentication.

---

### 5. Transaction Monitor

Real-time transaction tracking and debugging.

#### User Stories

- As a user, I want to view transaction status and results.
- As a user, I want to debug failed transactions with clear error messages.
- As a user, I want correlation IDs for tracing requests end-to-end.

---

### 6. Multi-Network Support

Support for Mainnet, Testnet, Futurenet, and local standalone networks.

#### User Stories

- As a user, I want to switch between networks without reconfiguration.
- As a user, I want local network support for offline development.
- As a user, I want configurable RPC endpoints for custom networks.

---

## Out of Scope (v1)

- Protocol-level Soroban changes
- Production-grade authentication (JWT/OAuth)
- Multi-user workspaces with real-time sync
- Mobile applications
- CLI tool for pipeline automation
- Analytics and telemetry
- Plugin/extension system
- Full blockchain explorer

---

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, Shadcn/ui
- **State Management**: Zustand 5 with localStorage persistence
- **Backend**: NestJS 11, TypeScript, Prisma 6, SQLite
- **Blockchain**: Stellar SDK, Soroban SDK, Freighter/Albedo wallet adapters
- **Infrastructure**: Turborepo, npm workspaces

---

## Definition of Done

v1 is complete when:

- Users can create, modify, and delete workspaces
- Users can explore contract state, storage, and events
- RPC proxy works with caching and failover across testnet/mainnet/futurenet/local
- Share links can be created, resolved, and revoked
- Transactions display with status, results, and correlation IDs
- All features work across supported networks
- Schema versioning and migrations handle persisted state upgrades
- Core flows work without major usability or data loss issues

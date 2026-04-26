/**
 * Explicit public API surface for @devconsole/soroban-utils.
 *
 * Closes #248 — harden shared packages with explicit public APIs, invariant
 * tests, and release discipline.
 *
 * Only symbols listed here are considered stable public API.
 * App code must import from "@devconsole/soroban-utils" (this file) and never
 * from deep paths such as "@devconsole/soroban-utils/src/soroban".
 *
 * Adding a symbol here is a deliberate, reviewable act.
 * Removing or renaming a symbol is a breaking change and requires a semver
 * major bump.
 */

// ── Core Soroban helpers ──────────────────────────────────────────────────────
export {
  callContract,
  getContractSpec,
  getContractValue,
  simulateTransaction,
} from "./soroban";

// ── XDR / ScVal utilities ─────────────────────────────────────────────────────
export {
  scValToDisplay,
  scValToNative,
  nativeToScVal,
  xdrToBase64,
  base64ToXdr,
} from "./xdr-utils";

// ── Shared type definitions ───────────────────────────────────────────────────
export type {
  ContractCallParams,
  ContractSpec,
  SorobanNetwork,
  ScValDisplay,
} from "./soroban-types";

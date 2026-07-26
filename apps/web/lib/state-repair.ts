/**
 * FE-037: Recovery tooling for corrupted local workspace and artifact state.
 *
 * Provides:
 * - detectCorruption: identify broken persisted state segments
 * - salvageWorkspaces: extract valid workspaces from a corrupted store
 * - repairOrReset: attempt migration, fall back to safe defaults
 * - exportSalvaged: produce a downloadable JSON of salvageable data
 */

import { STORE_SCHEMA_VERSION } from "@/store/schema-version";
import type { WorkspaceSnapshot } from "@/store/workspace-schema";

export interface StoredState {
  version?: number;
  workspaces?: unknown[];
  contracts?: unknown[];
  [key: string]: unknown;
}

export interface CorruptionReport {
  isCorrupted: boolean;
  reasons: string[];
  salvageableWorkspaces: WorkspaceSnapshot[];
}

function isWorkspaceSnapshot(w: unknown): w is WorkspaceSnapshot {
  if (!w || typeof w !== "object") return false;
  const ws = w as Record<string, unknown>;
  return (
    typeof ws.id === "string" &&
    typeof ws.name === "string" &&
    Array.isArray(ws.contractIds) &&
    Array.isArray(ws.savedCallIds) &&
    Array.isArray(ws.artifactRefs)
  );
}

export function detectCorruption(raw: unknown): CorruptionReport {
  const reasons: string[] = [];

  if (!raw || typeof raw !== "object") {
    return {
      isCorrupted: true,
      reasons: ["Persisted state is not an object"],
      salvageableWorkspaces: [],
    };
  }

  const state = raw as StoredState;

  if (state.version !== undefined && typeof state.version !== "number") {
    reasons.push(`Invalid version field: ${JSON.stringify(state.version)}`);
  }

  if (state.workspaces !== undefined && !Array.isArray(state.workspaces)) {
    reasons.push("workspaces field is not an array");
  }

  const salvageableWorkspaces: WorkspaceSnapshot[] = [];
  if (Array.isArray(state.workspaces)) {
    for (const w of state.workspaces) {
      if (isWorkspaceSnapshot(w)) {
        salvageableWorkspaces.push(w as WorkspaceSnapshot);
      } else {
        reasons.push(`Workspace entry is malformed: ${JSON.stringify(w)?.slice(0, 80)}`);
      }
    }
  }

  return {
    isCorrupted: reasons.length > 0,
    reasons,
    salvageableWorkspaces,
  };
}

export function migrateState(raw: StoredState): StoredState {
  const version = typeof raw.version === "number" ? raw.version : 0;

  if (version < STORE_SCHEMA_VERSION) {
    return {
      ...raw,
      version: STORE_SCHEMA_VERSION,
      workspaces: Array.isArray(raw.workspaces)
        ? raw.workspaces.filter(isWorkspaceSnapshot).map((w) => ({
            ...(w as WorkspaceSnapshot),
            version: STORE_SCHEMA_VERSION,
            savedCallIds: (w as any).savedCalls ?? (w as WorkspaceSnapshot).savedCallIds ?? [],
            artifactRefs: (w as WorkspaceSnapshot).artifactRefs ?? [],
          }))
        : [],
    };
  }

  return raw;
}

export function repairOrReset(raw: unknown): StoredState {
  const report = detectCorruption(raw);

  if (!report.isCorrupted) {
    return migrateState(raw as StoredState);
  }

  // Partial repair: keep salvageable workspaces
  if (report.salvageableWorkspaces.length > 0) {
    return {
      version: STORE_SCHEMA_VERSION,
      workspaces: report.salvageableWorkspaces,
      contracts: [],
    };
  }

  // Full reset
  return { version: STORE_SCHEMA_VERSION, workspaces: [], contracts: [] };
}

/** Produce a JSON blob of salvageable data for user download before destructive cleanup. */
export function buildSalvageExport(
  workspaces: WorkspaceSnapshot[],
  rawContracts: unknown,
  rawSavedCalls: unknown,
): string {
  return JSON.stringify(
    {
      salvageVersion: 1,
      exportedAt: new Date().toISOString(),
      workspaces,
      contracts: Array.isArray(rawContracts) ? rawContracts : [],
      savedCalls: Array.isArray(rawSavedCalls) ? rawSavedCalls : [],
    },
    null,
    2,
  );
}

/** Read and parse a localStorage key safely, returning null on failure. */
export function safeReadLocalStorage(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Run a full corruption scan across all known store keys. */
export function scanAllStores(): Record<string, CorruptionReport> {
  const STORE_KEYS: Record<string, string> = {
    workspaces: "soroban-workspaces",
    contracts: "soroban-contracts-storage",
    savedCalls: "soroban-saved-calls",
    artifacts: "soroban-artifact-storage",
  };

  const results: Record<string, CorruptionReport> = {};
  for (const [label, key] of Object.entries(STORE_KEYS)) {
    const raw = safeReadLocalStorage(key);
    // Each Zustand persist key wraps state under { state: {...}, version: N }
    const inner = raw && typeof raw === "object" ? (raw as any).state ?? raw : raw;
    results[label] = detectCorruption(inner);
  }
  return results;
}

/**
 * FE-037b: Pre-flight deploy validation.
 *
 * Runs a set of cheap client-side checks before a deploy transaction is
 * submitted so common misconfigurations surface in a checklist rather than
 * as an on-chain failure. Pure and side-effect free for easy testing.
 */
export interface DeployPreflightInput {
  walletConnected: boolean;
  walletNetwork?: string;
  appNetwork: string;
  accountBalanceXlm: number;
  estimatedFeeXlm: number;
  wasmUploaded: boolean;
  constructorArgsValid: boolean;
  bookmarkedContractIds?: string[];
  targetContractId?: string;
}

export type PreflightStatus = "pass" | "warning" | "fail";

export interface PreflightItem {
  id: string;
  label: string;
  status: PreflightStatus;
  detail?: string;
}

export function validateDeployPreflight(input: DeployPreflightInput): PreflightItem[] {
  const items: PreflightItem[] = [];

  items.push(
    input.walletConnected && input.walletNetwork === input.appNetwork
      ? { id: "network", label: "Wallet on correct network", status: "pass" }
      : {
          id: "network",
          label: "Wallet on correct network",
          status: "fail",
          detail: input.walletConnected
            ? `Wallet is on ${input.walletNetwork ?? "unknown"}, app is on ${input.appNetwork}`
            : "Wallet is not connected",
        },
  );

  items.push(
    input.accountBalanceXlm >= input.estimatedFeeXlm
      ? { id: "balance", label: "Sufficient XLM for fees", status: "pass" }
      : {
          id: "balance",
          label: "Sufficient XLM for fees",
          status: "fail",
          detail: `Balance ${input.accountBalanceXlm} XLM is below estimated fee ${input.estimatedFeeXlm} XLM`,
        },
  );

  items.push({
    id: "wasm",
    label: "WASM uploaded and hashed",
    status: input.wasmUploaded ? "pass" : "fail",
  });

  items.push({
    id: "args",
    label: "Constructor arguments valid",
    status: input.constructorArgsValid ? "pass" : "fail",
  });

  const conflict =
    input.targetContractId &&
    (input.bookmarkedContractIds ?? []).includes(input.targetContractId);
  items.push({
    id: "conflict",
    label: "No conflicting bookmarked contract ID",
    status: conflict ? "warning" : "pass",
    detail: conflict ? "This contract ID is already bookmarked in the workspace" : undefined,
  });

  return items;
}

/** True when no check failed (warnings are allowed to proceed). */
export function canProceedWithDeploy(items: PreflightItem[]): boolean {
  return items.every((item) => item.status !== "fail");
}

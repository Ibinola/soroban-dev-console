/**
 * FE-012: Workspace serialization layer.
 * Defines the versioned export/import format for workspace state.
 * Sensitive or purely ephemeral state (wallet keys, health data) is excluded.
 */

import type { WorkspaceSnapshot } from "@/store/workspace-schema";
import type { Contract } from "@/store/useContractStore";
import type { SavedCall } from "@/store/useSavedCallsStore";

export const SERIALIZER_VERSION = 1 as const;

export interface SerializedWorkspace {
  version: typeof SERIALIZER_VERSION;
  exportedAt: string;
  workspace: WorkspaceSnapshot;
  /** Only contracts referenced by this workspace */
  contracts: Contract[];
  /** Only saved calls referenced by this workspace */
  savedCalls: SavedCall[];
}

export function serializeWorkspace(
  workspace: WorkspaceSnapshot,
  allContracts: Contract[],
  allSavedCalls: SavedCall[],
): SerializedWorkspace {
  const contractSet = new Set(workspace.contractIds);
  const savedCallSet = new Set(workspace.savedCallIds);

  return {
    version: SERIALIZER_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
    contracts: allContracts.filter((c) => contractSet.has(c.id)),
    savedCalls: allSavedCalls.filter((c) => savedCallSet.has(c.id)),
  };
}

export function deserializeWorkspace(raw: unknown): SerializedWorkspace {
  if (
    !raw ||
    typeof raw !== "object" ||
    (raw as SerializedWorkspace).version !== SERIALIZER_VERSION
  ) {
    throw new Error(
      `Unsupported or invalid workspace export (expected version ${SERIALIZER_VERSION})`,
    );
  }

  const payload = raw as SerializedWorkspace;

  if (!payload.workspace?.id || !payload.workspace?.name) {
    throw new Error("Malformed workspace payload: missing id or name");
  }

  return payload;
}

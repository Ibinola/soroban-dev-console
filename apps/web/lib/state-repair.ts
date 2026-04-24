import { Workspace } from "../store/useWorkspaceStore";

const CURRENT_SCHEMA_VERSION = 1;

export interface StoredState {
  version?: number;
  workspaces?: unknown[];
  contracts?: unknown[];
  [key: string]: unknown;
}

export function detectCorruption(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return true;
  const state = raw as StoredState;
  if (state.version !== undefined && typeof state.version !== "number") return true;
  if (state.workspaces !== undefined && !Array.isArray(state.workspaces)) return true;
  return false;
}

export function migrateState(raw: StoredState): StoredState {
  const version = raw.version ?? 0;

  if (version < 1) {
    return {
      ...raw,
      version: CURRENT_SCHEMA_VERSION,
      workspaces: Array.isArray(raw.workspaces)
        ? raw.workspaces.filter(
            (w): w is Workspace =>
              typeof w === "object" &&
              w !== null &&
              typeof (w as Workspace).id === "string" &&
              typeof (w as Workspace).name === "string",
          )
        : [],
    };
  }

  return raw;
}

export function repairOrReset(raw: unknown): StoredState {
  if (detectCorruption(raw)) {
    return { version: CURRENT_SCHEMA_VERSION, workspaces: [], contracts: [] };
  }
  return migrateState(raw as StoredState);
}

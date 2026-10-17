import type { Contract } from "@/store/useContractStore";
import type { SavedCall } from "@/store/useSavedCallsStore";
import {
  assertSupportedVersion,
  SERIALIZER_VERSION,
  STORE_SCHEMA_VERSION,
} from "@/store/schema-version";
import type {
  WorkspaceArtifactRef,
  WorkspaceCheckpoint,
  WorkspaceNote,
  WorkspaceSnapshot,
} from "@/store/workspace-schema";

export { SERIALIZER_VERSION };

export interface SerializedWorkspace {
  version: typeof SERIALIZER_VERSION;
  exportedAt: string;
  workspace: WorkspaceSnapshot;
  contracts: Contract[];
  savedCalls: SavedCall[];
  notes: WorkspaceNote[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function serializeWorkspace(
  workspace: WorkspaceSnapshot,
  contracts: Contract[],
  savedCalls: SavedCall[],
  notes: WorkspaceNote[] = [],
): SerializedWorkspace {
  const contractIds = new Set(workspace.contractIds);
  const savedCallIds = new Set(workspace.savedCallIds);

  return {
    version: SERIALIZER_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: {
      ...workspace,
      version: STORE_SCHEMA_VERSION,
      contractIds: [...workspace.contractIds],
      savedCallIds: [...workspace.savedCallIds],
      artifactRefs: [...workspace.artifactRefs],
    },
    contracts: contracts.filter((contract) => contractIds.has(contract.id)),
    savedCalls: savedCalls.filter(
      (savedCall) =>
        savedCallIds.has(savedCall.id) || savedCall.workspaceId === workspace.id,
    ),
    notes: notes.filter((note) => note.workspaceId === workspace.id),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseWorkspace(
  raw: unknown,
  fallbackVersion: unknown = STORE_SCHEMA_VERSION,
): WorkspaceSnapshot {
  if (!isRecord(raw)) {
    throw new Error("Malformed workspace payload: missing workspace object");
  }

  const version = raw.version ?? fallbackVersion;
  assertSupportedVersion(version, "workspace-serializer");

  const id = typeof raw.id === "string" ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name : "";

  if (!id || !name) {
    throw new Error("Malformed workspace payload: missing id or name");
  }

  return {
    version: STORE_SCHEMA_VERSION,
    id,
    name,
    contractIds: Array.isArray(raw.contractIds)
      ? raw.contractIds.filter((value): value is string => typeof value === "string")
      : [],
    savedCallIds: Array.isArray(raw.savedCallIds)
      ? raw.savedCallIds.filter((value): value is string => typeof value === "string")
      : [],
    artifactRefs: Array.isArray(raw.artifactRefs)
      ? raw.artifactRefs
          .filter(isRecord)
          .map((entry): WorkspaceArtifactRef | null => {
            const kind: WorkspaceArtifactRef["kind"] =
              entry.kind === "wasm" ||
              entry.kind === "decoded-xdr" ||
              entry.kind === "storage-query" ||
              entry.kind === "simulation"
                ? entry.kind
                : "simulation";

            const id = typeof entry.id === "string" ? entry.id : "";
            if (!id) return null;

            return {
              kind,
              id,
              contractId:
                typeof entry.contractId === "string" ? entry.contractId : undefined,
              relationship:
                entry.relationship === "confirmed" ||
                entry.relationship === "inferred"
                  ? entry.relationship
                  : undefined,
            };
          })
          .filter((entry): entry is WorkspaceArtifactRef => entry !== null)
      : [],
    selectedNetwork:
      typeof raw.selectedNetwork === "string" ? raw.selectedNetwork : "testnet",
    createdAt:
      typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt:
      typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function parseContracts(raw: unknown): Contract[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(isRecord)
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "",
      name: typeof entry.name === "string" ? entry.name : "Unnamed Contract",
      network: typeof entry.network === "string" ? entry.network : "testnet",
      addedAt: typeof entry.addedAt === "number" ? entry.addedAt : Date.now(),
    }))
    .filter((entry) => entry.id.length > 0);
}

function parseSavedCalls(raw: unknown): SavedCall[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(isRecord)
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "",
      name: typeof entry.name === "string" ? entry.name : "Saved Call",
      contractId: typeof entry.contractId === "string" ? entry.contractId : "",
      fnName: typeof entry.fnName === "string" ? entry.fnName : "",
      args: Array.isArray(entry.args) ? entry.args : [],
      network: typeof entry.network === "string" ? entry.network : "testnet",
      createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
      workspaceId:
        typeof entry.workspaceId === "string" ? entry.workspaceId : undefined,
    }))
    .filter((entry) => entry.id.length > 0);
}

function parseNotes(raw: unknown): WorkspaceNote[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(isRecord)
    .map((entry): WorkspaceNote => {
      const resourceType: WorkspaceNote["resourceType"] =
        entry.resourceType === "contract" ||
        entry.resourceType === "savedCall" ||
        entry.resourceType === "artifact" ||
        entry.resourceType === "event" ||
        entry.resourceType === "transaction"
          ? entry.resourceType
          : undefined;

      return {
        id: typeof entry.id === "string" ? entry.id : "",
        workspaceId:
          typeof entry.workspaceId === "string" ? entry.workspaceId : "",
        resourceType,
        resourceId:
          typeof entry.resourceId === "string" ? entry.resourceId : undefined,
        body: typeof entry.body === "string" ? entry.body : "",
        createdAt:
          typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
        updatedAt:
          typeof entry.updatedAt === "number" ? entry.updatedAt : Date.now(),
      };
    })
    .filter((entry) => entry.id.length > 0 && entry.body.length > 0);
}

export function deserializeWorkspace(raw: unknown): SerializedWorkspace {
  if (!isRecord(raw)) {
    throw new Error("Malformed workspace export: not an object");
  }

  assertSupportedVersion(raw.version, "workspace-serializer");

  const workspace = parseWorkspace(raw.workspace, raw.version);
  const exportedAt =
    typeof raw.exportedAt === "string" ? raw.exportedAt : new Date().toISOString();

  return {
    version: SERIALIZER_VERSION,
    exportedAt,
    workspace,
    contracts: parseContracts(raw.contracts),
    savedCalls: parseSavedCalls(raw.savedCalls),
    notes: parseNotes(raw.notes),
  };
}

export function importWorkspace(raw: unknown): {
  payload: SerializedWorkspace;
  validation: ValidationResult;
} {
  const payload = deserializeWorkspace(raw);
  const warnings: string[] = [];
  const errors: string[] = [];

  const contractIdSet = new Set(payload.contracts.map((contract) => contract.id));
  const savedCallIdSet = new Set(payload.savedCalls.map((savedCall) => savedCall.id));

  const repairedContractIds = payload.workspace.contractIds.filter((contractId) => {
    const exists = contractIdSet.has(contractId);
    if (!exists) {
      warnings.push(`Missing contract payload for workspace reference "${contractId}"`);
    }
    return exists;
  });

  const repairedSavedCallIds = payload.workspace.savedCallIds.filter((savedCallId) => {
    const exists = savedCallIdSet.has(savedCallId);
    if (!exists) {
      warnings.push(
        `Missing saved-call payload for workspace reference "${savedCallId}"`,
      );
    }
    return exists;
  });

  const repairedNotes = payload.notes.map((note) => {
    if (note.workspaceId !== payload.workspace.id) {
      warnings.push(`Re-linked note "${note.id}" to imported workspace`);
      return { ...note, workspaceId: payload.workspace.id };
    }
    return note;
  });

  if (!payload.workspace.selectedNetwork) {
    errors.push("Workspace is missing a selected network");
  }

  return {
    payload: {
      ...payload,
      workspace: {
        ...payload.workspace,
        contractIds: repairedContractIds,
        savedCallIds: repairedSavedCallIds,
      },
      notes: repairedNotes,
    },
    validation: { errors, warnings },
  };
}

export function serializeCheckpoint(checkpoint: WorkspaceCheckpoint): string {
  return JSON.stringify(checkpoint);
}

export function deserializeCheckpoint(raw: string): WorkspaceCheckpoint {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Malformed checkpoint: invalid JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("Malformed checkpoint: not an object");
  }

  if (
    typeof parsed.id !== "string" ||
    typeof parsed.workspaceId !== "string" ||
    typeof parsed.label !== "string" ||
    !isRecord(parsed.snapshot)
  ) {
    throw new Error("Malformed checkpoint: missing required fields");
  }

  return {
    id: parsed.id,
    workspaceId: parsed.workspaceId,
    label: parsed.label,
    snapshot: parseWorkspace(parsed.snapshot, STORE_SCHEMA_VERSION),
    createdAt:
      typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
  };
}

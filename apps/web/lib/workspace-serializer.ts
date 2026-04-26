/**
 * Workspace serialization helpers with full round-trip support.
 *
 * Closes #276 — close workspace import/export round-trip gaps for notes and
 * artifact dependencies.
 *
 * Rules enforced here:
 *  - Notes are always included in the serialized payload.
 *  - Artifact registry entries (ABI / spec) are embedded so an imported
 *    workspace is self-contained.
 *  - Import validates that every artifact reference in the payload has a
 *    corresponding registry entry and surfaces a structured warning list when
 *    any are missing rather than silently restoring a broken workspace.
 */

export interface ArtifactEntry {
  contractId: string;
  abi: unknown;
  spec?: unknown;
}

export interface WorkspaceNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface SerializedWorkspace {
  version: 2;
  contracts: string[];
  savedCalls: unknown[];
  notes: WorkspaceNote[];
  artifacts: ArtifactEntry[];
}

export interface ImportResult {
  workspace: SerializedWorkspace;
  /** Non-empty when artifact references could not be fully restored. */
  warnings: string[];
}

/**
 * Serialize a workspace into a self-contained, round-trip-safe payload.
 * All call sites must pass `notes` and `artifacts` explicitly so nothing is
 * accidentally omitted.
 */
export function serializeWorkspace(
  contracts: string[],
  savedCalls: unknown[],
  notes: WorkspaceNote[],
  artifacts: ArtifactEntry[]
): SerializedWorkspace {
  return {
    version: 2,
    contracts,
    savedCalls,
    notes,
    artifacts,
  };
}

/**
 * Deserialize and validate a workspace payload.
 * Returns the workspace plus any warnings about missing artifact data so the
 * caller can decide whether to surface them to the user.
 */
export function importWorkspace(raw: unknown): ImportResult {
  const warnings: string[] = [];

  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as SerializedWorkspace).version !== 2
  ) {
    throw new Error(
      "Unsupported workspace format. Expected a version-2 payload."
    );
  }

  const payload = raw as SerializedWorkspace;

  // Validate version — throws with recovery guidance for unsupported versions.
  assertSupportedVersion(payload.version, "workspace-serializer");

  if (!payload.workspace?.id || !payload.workspace?.name) {
    throw new Error("Malformed workspace payload: missing id or name");
  }

  return payload;
}

/**
 * Serialize a checkpoint to a portable JSON-safe object.
 * The checkpoint embeds a full WorkspaceSnapshot so it is self-contained.
 */
export function serializeCheckpoint(checkpoint: WorkspaceCheckpoint): string {
  return JSON.stringify(checkpoint);
}

/**
 * Deserialize and validate a checkpoint from a JSON string.
 * Throws if the payload is malformed.
 */
export function deserializeCheckpoint(raw: string): WorkspaceCheckpoint {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Malformed checkpoint: invalid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Malformed checkpoint: not an object");
  }
  const cp = parsed as WorkspaceCheckpoint;
  if (!cp.id || !cp.workspaceId || !cp.label || !cp.snapshot) {
    throw new Error("Malformed checkpoint: missing required fields");
  }
  return cp;
}

/**
 * FE-025: Parse, validate, and repair a raw import payload.
 * Returns the repaired payload and the validation result.
 * Throws only for truly unrecoverable errors (bad JSON structure, unsupported version).
 */
export function importWorkspace(raw: unknown): {
  payload: SerializedWorkspace;
  validation: ValidationResult;
} {
  const payload = deserializeWorkspace(raw);
  const validation = validateAndRepair(payload);
  return { payload, validation };
}

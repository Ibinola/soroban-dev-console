/**
 * BE-020: Structured revision conflict payloads for workspace update failures.
 * Gives clients enough metadata to drive merge/retry without parsing error text.
 */

export interface RevisionConflictPayload {
  type: "REVISION_CONFLICT";
  workspaceId: string;
  expectedRevision: number;
  actualRevision: number;
  hint: string;
}

export interface RevisionConflictResponse {
  ok: false;
  conflict: RevisionConflictPayload;
}

export function buildConflictPayload(
  workspaceId: string,
  expectedRevision: number,
  actualRevision: number
): RevisionConflictPayload {
  return {
    type: "REVISION_CONFLICT",
    workspaceId,
    expectedRevision,
    actualRevision,
    hint: `Remote is at revision ${actualRevision}; re-fetch and reapply your changes before retrying.`,
  };
}

export function buildConflictResponse(
  workspaceId: string,
  expectedRevision: number,
  actualRevision: number
): RevisionConflictResponse {
  return {
    ok: false,
    conflict: buildConflictPayload(workspaceId, expectedRevision, actualRevision),
  };
}

export function isRevisionConflict(err: unknown): err is RevisionConflictResponse {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as RevisionConflictResponse).ok === false &&
    (err as RevisionConflictResponse).conflict?.type === "REVISION_CONFLICT"
  );
}

export function isStaleRevision(expected: number, actual: number): boolean {
  return actual > expected;
}

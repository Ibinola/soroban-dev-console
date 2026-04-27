/**
 * BE-019: Structured validation warnings for workspace import/export API responses.
 * Exposes repair and partial-trust signals so clients don't rely on string parsing.
 */

import { ApiWarning, repairWarning, fallbackWarning } from "@soroban-dev-console/api-contracts";

export interface WorkspaceValidationResult {
  ok: boolean;
  warnings: ApiWarning[];
  unrecoverable: string[];
}

export function validateImportPayload(raw: unknown): WorkspaceValidationResult {
  const warnings: ApiWarning[] = [];
  const unrecoverable: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    unrecoverable.push("payload must be a non-null object");
    return { ok: false, warnings, unrecoverable };
  }

  const payload = raw as Record<string, unknown>;

  if (!payload.name || typeof payload.name !== "string") {
    unrecoverable.push("missing required field: name");
  }

  if (!payload.selectedNetwork) {
    warnings.push(repairWarning("MISSING_NETWORK", "selectedNetwork absent; defaulted to testnet", { field: "selectedNetwork" }));
  }

  if (!Array.isArray(payload.savedContracts)) {
    warnings.push(repairWarning("MISSING_CONTRACTS", "savedContracts absent; defaulted to empty array", { field: "savedContracts" }));
  }

  if (!Array.isArray(payload.savedInteractions)) {
    warnings.push(repairWarning("MISSING_INTERACTIONS", "savedInteractions absent; defaulted to empty array", { field: "savedInteractions" }));
  }

  if (payload.schemaVersion !== undefined && typeof payload.schemaVersion === "number" && payload.schemaVersion < 2) {
    warnings.push(fallbackWarning("LEGACY_SCHEMA", "payload uses a legacy schema version; some fields may be missing", { schemaVersion: payload.schemaVersion }));
  }

  return { ok: unrecoverable.length === 0, warnings, unrecoverable };
}

export function validateExportPayload(raw: unknown): WorkspaceValidationResult {
  const warnings: ApiWarning[] = [];
  const unrecoverable: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    unrecoverable.push("export source must be a non-null object");
    return { ok: false, warnings, unrecoverable };
  }

  const payload = raw as Record<string, unknown>;

  if (!payload.id || typeof payload.id !== "string") {
    unrecoverable.push("missing required field: id");
  }

  if (!Array.isArray(payload.artifacts) || payload.artifacts.length === 0) {
    warnings.push(fallbackWarning("NO_ARTIFACTS", "export contains no artifacts; downstream consumers may be incomplete", { field: "artifacts" }));
  }

  return { ok: unrecoverable.length === 0, warnings, unrecoverable };
}

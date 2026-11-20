import { createHash } from "node:crypto";

/**
 * Issue #1273: audit log CSV export — shared filter and row-limit resolution.
 *
 * Deliberately free of Nest/Prisma imports so the rules stay pure and directly
 * unit-testable.
 */

/** Issue #1273: hard ceiling for a single CSV export. */
export const DEFAULT_AUDIT_EXPORT_MAX_ROWS = 10_000;

/** Environment variable that overrides the export ceiling. */
export const AUDIT_EXPORT_MAX_ROWS_ENV = "AUDIT_EXPORT_MAX_ROWS";

export interface AuditExportFilterQuery {
  actor?: string;
  action?: string;
  /** Issue #1273: `type` is an alias for `action`. */
  type?: string;
  resourceType?: string;
  resourceId?: string;
  createdAfter?: string;
  /** Issue #1273: `from` is an alias for `createdAfter`. */
  from?: string;
  createdBefore?: string;
  /** Issue #1273: `to` is an alias for `createdBefore`. */
  to?: string;
}

export interface AuditExportFilters {
  actor?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  createdAfter?: string;
  createdBefore?: string;
}

/**
 * Resolve how many rows an export may contain.
 *
 * `requested` may only *lower* the ceiling; it can never raise it above the
 * configured maximum. Malformed or non-positive configuration falls back to
 * {@link DEFAULT_AUDIT_EXPORT_MAX_ROWS}.
 */
export function resolveAuditExportRowLimit(
  requested?: number,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const configured = Number.parseInt(env[AUDIT_EXPORT_MAX_ROWS_ENV] ?? "", 10);
  const maximum =
    Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_AUDIT_EXPORT_MAX_ROWS;

  if (
    requested === undefined ||
    !Number.isFinite(requested) ||
    requested <= 0
  ) {
    return maximum;
  }

  return Math.min(Math.trunc(requested), maximum);
}

/**
 * Canonicalise export query parameters.
 *
 * The `from`/`to`/`type` aliases added by issue #1273 map onto the existing
 * `createdAfter`/`createdBefore`/`action` names; explicit canonical parameters
 * win when both spellings are supplied. Empty values are dropped so they never
 * widen a Prisma `where` clause.
 */
export function resolveAuditExportFilters(
  query: AuditExportFilterQuery,
): AuditExportFilters {
  const action = query.action || query.type;
  const createdAfter = query.createdAfter || query.from;
  const createdBefore = query.createdBefore || query.to;

  return {
    ...(query.actor ? { actor: query.actor } : {}),
    ...(action ? { action } : {}),
    ...(query.resourceType ? { resourceType: query.resourceType } : {}),
    ...(query.resourceId ? { resourceId: query.resourceId } : {}),
    ...(createdAfter ? { createdAfter } : {}),
    ...(createdBefore ? { createdBefore } : {}),
  };
}

// ---------------------------------------------------------------------------
// Export manifest (#1378)
// ---------------------------------------------------------------------------

export interface AuditExportManifest {
  /** Manifest format version. */
  version: 1;
  format: "csv" | "json";
  filename: string;
  /** Normalized filters (sorted keys, empty values dropped). */
  filters: AuditExportFilters;
  generatedAt: string;
  rowCount: number;
  sha256: string;
}

const FILTER_KEYS: ReadonlyArray<keyof AuditExportFilters> = [
  "action",
  "actor",
  "createdAfter",
  "createdBefore",
  "resourceId",
  "resourceType",
];

/** Keep only known filter keys, drop empty values, and fix the key order. */
export function normalizeAuditExportFilters(filters: AuditExportFilters = {}): AuditExportFilters {
  const out: AuditExportFilters = {};
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (typeof value === "string" && value.trim() !== "") out[key] = value.trim();
  }
  return out;
}

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Describe an export. `content` is the exact text the client receives, so the
 * digest can be checked against the downloaded file. Only normalized filters,
 * counts, a timestamp and the digest are recorded: no row data, request
 * headers or credentials ever enter a manifest.
 */
export function buildAuditExportManifest(params: {
  format: "csv" | "json";
  filename: string;
  filters?: AuditExportFilters;
  rowCount: number;
  content: string;
  generatedAt?: Date;
}): AuditExportManifest {
  return {
    version: 1,
    format: params.format,
    filename: params.filename,
    filters: normalizeAuditExportFilters(params.filters),
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
    rowCount: params.rowCount,
    sha256: sha256Hex(params.content),
  };
}

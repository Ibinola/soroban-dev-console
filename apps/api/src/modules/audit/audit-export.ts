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

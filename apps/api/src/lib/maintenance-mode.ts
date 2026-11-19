/**
 * Runtime maintenance (read-only) mode.
 *
 * While enabled, write requests get a consistent 503 and everything that only
 * reads stays available. Reads (GET/HEAD/OPTIONS) are always allowed. Write
 * methods are refused unless the path is explicitly read-only: health and
 * readiness probes, the maintenance toggle itself (so operators can switch the
 * mode off again), and any prefix listed in MAINTENANCE_READ_ONLY_PATHS.
 */

export interface MaintenanceState {
  enabled: boolean;
  reason?: string;
  /** ISO time the mode was last switched on. */
  since?: string;
}

export const MAINTENANCE_ERROR_CODE = "MAINTENANCE_MODE";
export const MAINTENANCE_RETRY_AFTER_SECONDS = 60;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Path prefixes that stay writable-safe while in maintenance (always lower-case, no query). */
export const DEFAULT_READ_ONLY_PREFIXES = [
  "/api/health",
  "/api/ready",
  "/api/readiness",
  "/api/runtime-config/maintenance",
];

/** Parses the comma-separated MAINTENANCE_READ_ONLY_PATHS value into prefixes. */
export function parseReadOnlyPaths(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.startsWith("/"));
}

/** True when a request must be refused because maintenance mode is on. */
export function isBlockedByMaintenance(
  method: string,
  path: string,
  extraReadOnlyPrefixes: string[] = [],
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  const clean = path.split("?")[0].toLowerCase().replace(/\/+$/, "") || "/";
  return ![...DEFAULT_READ_ONLY_PREFIXES, ...extraReadOnlyPrefixes].some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`),
  );
}

/** The 503 body, in the same envelope as ApiErrorFilter. */
export function buildMaintenanceBody(path: string, state: MaintenanceState) {
  return {
    success: false as const,
    error: {
      code: MAINTENANCE_ERROR_CODE,
      message: state.reason
        ? `The API is in read-only maintenance mode: ${state.reason}`
        : "The API is in read-only maintenance mode. Writes are temporarily unavailable.",
      details: { since: state.since ?? null, retryAfterSeconds: MAINTENANCE_RETRY_AFTER_SECONDS },
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

interface ReqLike {
  method: string;
  originalUrl?: string;
  url: string;
}
interface ResLike {
  status(code: number): ResLike;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
}

/**
 * Express middleware. `getState` is read on every request, so toggling the mode
 * takes effect immediately without a restart.
 */
export function createMaintenanceMiddleware(
  getState: () => MaintenanceState,
  extraReadOnlyPrefixes: string[] = parseReadOnlyPaths(process.env.MAINTENANCE_READ_ONLY_PATHS),
) {
  return (req: ReqLike, res: ResLike, next: () => void): void => {
    const state = getState();
    const path = req.originalUrl ?? req.url;
    if (state.enabled && isBlockedByMaintenance(req.method, path, extraReadOnlyPrefixes)) {
      res.setHeader("Retry-After", String(MAINTENANCE_RETRY_AFTER_SECONDS));
      res.status(503).json(buildMaintenanceBody(path, state));
      return;
    }
    next();
  };
}

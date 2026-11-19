/**
 * API deprecation metadata (#1379).
 *
 * Routes listed in configuration get `Deprecation` and `Sunset` response
 * headers (plus a `Link` header pointing at migration guidance) and are marked
 * `deprecated: true`, with the guidance, in the OpenAPI document. Routes that
 * are not configured are never touched.
 *
 * Configure with API_DEPRECATIONS, a JSON array:
 *   [{ "method": "GET", "path": "/api/old", "sunset": "2027-01-01",
 *      "deprecatedSince": "2026-06-01", "migration": "Use /api/new",
 *      "link": "https://docs.example.com/migrate" }]
 * `method` is optional (omit for every method); `path` is matched exactly,
 * ignoring query string and trailing slash.
 */

export interface DeprecationRule {
  method?: string;
  path: string;
  /** ISO date or datetime after which the route may be removed. */
  sunset: string;
  deprecatedSince?: string;
  /** Short migration guidance, shown in OpenAPI and the Link relation. */
  migration?: string;
  /** URL of fuller migration documentation. */
  link?: string;
}

export interface ResolvedDeprecation extends DeprecationRule {
  method?: string;
  /** Sunset as an IMF-fixdate HTTP-date. */
  sunsetHttpDate: string;
  /** Deprecation as the epoch-seconds structured-field form, or null when unknown. */
  deprecationSeconds: number | null;
}

function normalizePath(path: string): string {
  const clean = path.split("?")[0];
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

/** Parse the configuration, dropping (not throwing on) invalid entries. */
export function parseDeprecations(raw: string | undefined): ResolvedDeprecation[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ResolvedDeprecation[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rule = item as Partial<DeprecationRule>;
    if (typeof rule.path !== "string" || !rule.path.startsWith("/") || typeof rule.sunset !== "string") continue;
    const sunsetAt = new Date(rule.sunset);
    if (Number.isNaN(sunsetAt.getTime())) continue;
    const since = rule.deprecatedSince ? new Date(rule.deprecatedSince) : null;
    out.push({
      ...rule,
      path: normalizePath(rule.path),
      method: typeof rule.method === "string" ? rule.method.toUpperCase() : undefined,
      sunset: rule.sunset,
      sunsetHttpDate: sunsetAt.toUTCString(),
      deprecationSeconds: since && !Number.isNaN(since.getTime()) ? Math.floor(since.getTime() / 1000) : null,
    });
  }
  return out;
}

/** The rule for a request, or undefined when the route is not deprecated. */
export function findDeprecation(
  rules: readonly ResolvedDeprecation[],
  method: string,
  path: string,
): ResolvedDeprecation | undefined {
  const target = normalizePath(path);
  return rules.find((r) => r.path === target && (r.method === undefined || r.method === method.toUpperCase()));
}

/** Response headers for a deprecated route. */
export function deprecationHeaders(rule: ResolvedDeprecation): Record<string, string> {
  const headers: Record<string, string> = {
    Deprecation: rule.deprecationSeconds === null ? "true" : `@${rule.deprecationSeconds}`,
    Sunset: rule.sunsetHttpDate,
  };
  if (rule.link) headers.Link = `<${rule.link}>; rel="deprecation"; type="text/html"`;
  return headers;
}

interface ReqLike {
  method: string;
  originalUrl?: string;
  url: string;
}
interface ResLike {
  setHeader(name: string, value: string): unknown;
}

/** Express middleware; does nothing for routes without a rule. */
export function createDeprecationMiddleware(rules: readonly ResolvedDeprecation[]) {
  return (req: ReqLike, res: ResLike, next: () => void): void => {
    if (rules.length > 0) {
      const rule = findDeprecation(rules, req.method, req.originalUrl ?? req.url);
      if (rule) for (const [name, value] of Object.entries(deprecationHeaders(rule))) res.setHeader(name, value);
    }
    next();
  };
}

/**
 * Mark the matching operations in an OpenAPI document as deprecated and add the
 * migration guidance to their description. Returns the same (mutated) document.
 */
export function applyDeprecationsToOpenApi<T extends { paths?: Record<string, Record<string, any>> }>(
  document: T,
  rules: readonly ResolvedDeprecation[],
): T {
  for (const rule of rules) {
    for (const [docPath, item] of Object.entries(document.paths ?? {})) {
      if (normalizePath(docPath) !== rule.path) continue;
      for (const [method, operation] of Object.entries(item)) {
        if (!operation || typeof operation !== "object") continue;
        if (rule.method !== undefined && method.toUpperCase() !== rule.method) continue;
        const note = [`Deprecated; scheduled for removal on ${rule.sunsetHttpDate}.`, rule.migration, rule.link]
          .filter(Boolean)
          .join(" ");
        operation.deprecated = true;
        operation.description = operation.description ? `${operation.description}\n\n${note}` : note;
      }
    }
  }
  return document;
}

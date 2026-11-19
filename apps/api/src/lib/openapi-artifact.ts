/**
 * Deterministic OpenAPI artifact helpers (#1380).
 *
 * `canonicalizeOpenApi` makes a generated document independent of the machine
 * and environment it was generated on: keys are sorted at every level, the
 * `servers` list is removed, and any string that embeds a host-specific URL is
 * replaced. `diffOpenApi` produces a readable line-per-change report for the
 * drift check.
 */

/** Strings containing these are environment-specific and must not be committed. */
const ENV_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w.-]*\.(?:local|internal|localhost))(?::\d+)?[^\s"']*/gi;
const SECRET_ASSIGNMENT = /\b(api[_-]?key|secret|token|password)\s*[=:]\s*\S+/gi;

export const OPENAPI_PLACEHOLDER_URL = "<environment-url>";

function sanitizeString(value: string): string {
  return value.replace(ENV_URL, OPENAPI_PLACEHOLDER_URL).replace(SECRET_ASSIGNMENT, "$1=<redacted>");
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) out[key] = canonicalize(record[key]);
    }
    return out;
  }
  return value;
}

/** Canonical form of an OpenAPI document: sorted, no `servers`, no environment URLs. */
export function canonicalizeOpenApi<T extends Record<string, unknown>>(document: T): Record<string, unknown> {
  const { servers: _servers, ...rest } = document as Record<string, unknown>;
  return canonicalize(rest) as Record<string, unknown>;
}

/** Stable JSON text of the canonical document (what is committed). */
export function serializeOpenApi(document: Record<string, unknown>): string {
  return `${JSON.stringify(canonicalizeOpenApi(document), null, 2)}\n`;
}

function flatten(value: unknown, path: string, out: Map<string, string>): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of Object.keys(value as object)) flatten((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key, out);
    if (Object.keys(value as object).length === 0) out.set(path, "{}");
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, `${path}[${i}]`, out));
    if (value.length === 0) out.set(path, "[]");
  } else {
    out.set(path, JSON.stringify(value));
  }
}

export interface OpenApiDiff {
  identical: boolean;
  /** One human-readable line per added, removed or changed leaf. */
  lines: string[];
}

/** Compare two serialized documents (JSON text) and describe the differences. */
export function diffOpenApi(committedText: string, generatedText: string, maxLines = 200): OpenApiDiff {
  if (committedText === generatedText) return { identical: true, lines: [] };
  const parse = (text: string) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  };
  const committed = parse(committedText);
  const generated = parse(generatedText);
  if (committed === undefined || generated === undefined) {
    return { identical: false, lines: [committed === undefined ? "committed artifact is not valid JSON" : "generated artifact is not valid JSON"] };
  }
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  flatten(canonicalizeOpenApi(committed as Record<string, unknown>), "", a);
  flatten(canonicalizeOpenApi(generated as Record<string, unknown>), "", b);

  const lines: string[] = [];
  for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const before = a.get(key);
    const after = b.get(key);
    if (before === after) continue;
    if (before === undefined) lines.push(`+ ${key} = ${after}`);
    else if (after === undefined) lines.push(`- ${key} (was ${before})`);
    else lines.push(`~ ${key}: ${before} -> ${after}`);
  }
  if (lines.length === 0) {
    // Same content, different formatting/ordering on disk.
    return { identical: false, lines: ["content is equivalent but the committed file is not in canonical form; regenerate it"] };
  }
  if (lines.length > maxLines) {
    const extra = lines.length - maxLines;
    return { identical: false, lines: [...lines.slice(0, maxLines), `... and ${extra} more difference(s)`] };
  }
  return { identical: false, lines };
}

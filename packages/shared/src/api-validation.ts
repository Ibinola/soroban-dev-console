import type { z } from "zod";

/**
 * Reusable runtime validation for API responses. Errors carry the endpoint and
 * normalized field paths; they never carry the received values, so a response
 * containing a secret cannot leak through an error message or a log line.
 */

export interface ApiValidationIssue {
  /** Dotted/indexed path, e.g. `data.items[2].id`; `(root)` for the top level. */
  path: string;
  /** zod issue code, e.g. `invalid_type`. */
  code: string;
  /** Message built from the issue code and expectation only. */
  message: string;
}

export class ApiValidationError extends Error {
  constructor(readonly endpoint: string, readonly issues: ApiValidationIssue[]) {
    super(`Invalid response from ${endpoint}: ${issues.map((i) => `${i.path} (${i.code})`).join(", ")}`);
    this.name = "ApiValidationError";
  }
}

export type ApiParseResult<T> = { ok: true; data: T } | { ok: false; error: ApiValidationError };

export interface ApiValidationLogger {
  warn(message: string, fields?: Record<string, unknown>): void;
}

function formatPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) return "(root)";
  return path.reduce<string>((out, part) => (typeof part === "number" ? `${out}[${part}]` : out ? `${out}.${part}` : part), "");
}

/** Describe an issue without echoing the offending value. */
function describe(issue: z.ZodIssue): string {
  const anyIssue = issue as unknown as { expected?: unknown; minimum?: unknown; maximum?: unknown; options?: unknown[] };
  switch (issue.code) {
    case "invalid_type":
      return `expected ${String(anyIssue.expected)}`;
    case "too_small":
      return `below the minimum${anyIssue.minimum !== undefined ? ` of ${String(anyIssue.minimum)}` : ""}`;
    case "too_big":
      return `above the maximum${anyIssue.maximum !== undefined ? ` of ${String(anyIssue.maximum)}` : ""}`;
    case "invalid_enum_value":
      return "not one of the allowed values";
    case "unrecognized_keys":
      return "unexpected keys present";
    default:
      return issue.code.replace(/_/g, " ");
  }
}

/** Validate without throwing. */
export function safeParseApiResponse<S extends z.ZodTypeAny>(
  schema: S,
  payload: unknown,
  endpoint: string,
): ApiParseResult<z.infer<S>> {
  const result = schema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  const issues = result.error.issues.map((issue) => ({ path: formatPath(issue.path), code: issue.code, message: describe(issue) }));
  return { ok: false, error: new ApiValidationError(endpoint, issues) };
}

/** Validate, throwing `ApiValidationError`. The inferred output type is preserved. */
export function parseApiResponse<S extends z.ZodTypeAny>(schema: S, payload: unknown, endpoint: string): z.infer<S> {
  const result = safeParseApiResponse(schema, payload, endpoint);
  if (!result.ok) throw result.error;
  return result.data;
}

/** Log a validation failure with the endpoint and field paths only (no values, no body). */
export function logApiValidationFailure(error: ApiValidationError, logger: ApiValidationLogger): void {
  logger.warn("api.response.validation_failed", {
    endpoint: error.endpoint,
    issues: error.issues.map(({ path, code }) => ({ path, code })),
  });
}

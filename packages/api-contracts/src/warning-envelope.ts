/**
 * BE-023: Normalized partial-success and warning envelopes for repair and fallback flows.
 */

export type WarningSeverity = "info" | "degraded" | "repaired";

export interface ApiWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
  context?: Record<string, unknown>;
}

export interface PartialSuccessEnvelope<T> {
  ok: true;
  data: T;
  warnings: ApiWarning[];
}

export function wrapWithWarnings<T>(data: T, warnings: ApiWarning[]): PartialSuccessEnvelope<T> {
  return { ok: true, data, warnings };
}

export function repairWarning(code: string, message: string, context?: Record<string, unknown>): ApiWarning {
  return { code, severity: "repaired", message, ...(context ? { context } : {}) };
}

export function fallbackWarning(code: string, message: string, context?: Record<string, unknown>): ApiWarning {
  return { code, severity: "degraded", message, ...(context ? { context } : {}) };
}

export function hasWarnings<T>(envelope: PartialSuccessEnvelope<T>): boolean {
  return envelope.warnings.length > 0;
}

export function isPartialSuccess<T>(
  response: unknown
): response is PartialSuccessEnvelope<T> {
  return (
    typeof response === "object" &&
    response !== null &&
    (response as PartialSuccessEnvelope<T>).ok === true &&
    Array.isArray((response as PartialSuccessEnvelope<T>).warnings)
  );
}

// Convenience: extract warning codes without string parsing
export function warningCodes<T>(envelope: PartialSuccessEnvelope<T>): string[] {
  return envelope.warnings.map((w) => w.code);
}

/**
 * Decode diagnostic events emitted during a failed contract simulation
 * into a chronological, error-highlighted log stream. (#915)
 */
export type DiagnosticSeverity = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface RawDiagnosticEvent {
  topics: string[];
  data: unknown;
  inSuccessfulContractCall: boolean;
}

export interface DecodedDiagnosticLog {
  topics: string[];
  data: unknown;
  isError: boolean;
  severity: DiagnosticSeverity;
}

export const DIAGNOSTIC_SEVERITY_REGEX: Record<DiagnosticSeverity, RegExp> = {
  ERROR: /\b(error|err|fatal|panic|exception|failed|failure)\b/i,
  WARN: /\b(warn|warning|caution)\b/i,
  INFO: /\b(info|notice|log|event)\b/i,
  DEBUG: /\b(debug|trace|verbose)\b/i,
};

function stringifyDiagnosticValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function classifyDiagnosticSeverity(
  event: Pick<RawDiagnosticEvent, "topics" | "data" | "inSuccessfulContractCall">,
): DiagnosticSeverity {
  const haystack = [
    ...event.topics.map(stringifyDiagnosticValue),
    stringifyDiagnosticValue(event.data),
  ].join(" ");

  if (
    !event.inSuccessfulContractCall ||
    DIAGNOSTIC_SEVERITY_REGEX.ERROR.test(haystack)
  ) {
    return "ERROR";
  }
  if (DIAGNOSTIC_SEVERITY_REGEX.WARN.test(haystack)) return "WARN";
  if (DIAGNOSTIC_SEVERITY_REGEX.DEBUG.test(haystack)) return "DEBUG";
  if (DIAGNOSTIC_SEVERITY_REGEX.INFO.test(haystack)) return "INFO";
  return "INFO";
}

export function decodeDiagnosticEvents(events: RawDiagnosticEvent[]): DecodedDiagnosticLog[] {
  return events.map((event) => ({
    topics: event.topics,
    data: event.data,
    isError: !event.inSuccessfulContractCall,
    severity: classifyDiagnosticSeverity(event),
  }));
}

export function countErrorLogs(logs: DecodedDiagnosticLog[]): number {
  return logs.filter((log) => log.isError).length;
}

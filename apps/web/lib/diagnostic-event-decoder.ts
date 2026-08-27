/**
 * Decode diagnostic events emitted during a failed contract simulation
 * into a chronological, error-highlighted log stream. (#915)
 */
export interface RawDiagnosticEvent {
  topics: string[];
  data: unknown;
  inSuccessfulContractCall: boolean;
}

export interface DecodedDiagnosticLog {
  topics: string[];
  data: unknown;
  isError: boolean;
}

export function decodeDiagnosticEvents(events: RawDiagnosticEvent[]): DecodedDiagnosticLog[] {
  return events.map((event) => ({
    topics: event.topics,
    data: event.data,
    isError: !event.inSuccessfulContractCall,
  }));
}

export function countErrorLogs(logs: DecodedDiagnosticLog[]): number {
  return logs.filter((log) => log.isError).length;
}

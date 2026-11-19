import { scValToNative, xdr } from "@stellar/stellar-sdk";

/** Raw diagnostic/contract event as returned by the RPC (topics and data are base64 XDR). */
export interface RawDiagnosticEvent {
  id: string;
  contractId?: string | null;
  ledger: number;
  topics: string[];
  /** Base64 XDR of the event data. */
  data: string;
  /** Where the event came from, when the caller knows. Never used for ordering. */
  invocation?: {
    txHash?: string;
    function?: string;
    callIndex?: number;
  };
}

export interface FormattedXdrValue {
  /** The original base64 XDR, always preserved. */
  raw: string;
  /** JSON-safe decoded value, present when the XDR decoded. */
  decoded?: unknown;
  /** Decode failure reason, present when it did not. */
  decodeError?: string;
}

export interface FormattedDiagnosticEvent {
  id: string;
  contractId: string | null;
  ledger: number;
  topics: FormattedXdrValue[];
  data: FormattedXdrValue;
  invocation?: { txHash?: string; function?: string; callIndex?: number };
}

/** Convert a decoded value to plain JSON: bigint -> string, bytes -> hex, Map -> entries. */
export function toJsonSafe(value: unknown, depth = 0): unknown {
  if (depth > 32) return "[max depth]";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return { bytes: Buffer.from(value).toString("hex") };
  if (value instanceof Map) {
    return { map: [...value.entries()].map(([k, v]) => [toJsonSafe(k, depth + 1), toJsonSafe(v, depth + 1)]) };
  }
  if (Array.isArray(value)) return value.map((v) => toJsonSafe(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = toJsonSafe((value as Record<string, unknown>)[key], depth + 1);
    }
    return out;
  }
  return value;
}

function formatXdr(raw: string): FormattedXdrValue {
  try {
    const decoded = toJsonSafe(scValToNative(xdr.ScVal.fromXDR(raw, "base64")));
    return { raw, decoded };
  } catch (error) {
    return { raw, decodeError: error instanceof Error ? error.message.slice(0, 200) : "decode failed" };
  }
}

/**
 * Canonical form of one diagnostic event. Raw XDR is always kept; decoded
 * fields are added when decoding works. Keys come out in a fixed order and the
 * decoded value is JSON-safe, so equal inputs give byte-identical JSON.
 */
export function formatDiagnosticEvent(event: RawDiagnosticEvent): FormattedDiagnosticEvent {
  const formatted: FormattedDiagnosticEvent = {
    id: event.id,
    contractId: event.contractId ?? null,
    ledger: event.ledger,
    topics: event.topics.map(formatXdr),
    data: formatXdr(event.data),
  };
  if (event.invocation) {
    const { txHash, function: fn, callIndex } = event.invocation;
    const invocation: NonNullable<FormattedDiagnosticEvent["invocation"]> = {};
    if (txHash !== undefined) invocation.txHash = txHash;
    if (fn !== undefined) invocation.function = fn;
    if (callIndex !== undefined) invocation.callIndex = callIndex;
    if (Object.keys(invocation).length > 0) formatted.invocation = invocation;
  }
  return formatted;
}

/**
 * Format a list of events in ledger order. The order depends only on
 * `(ledger, id)`, never on invocation context, so events with and without
 * context sort identically. Ties keep input order.
 */
export function formatDiagnosticEvents(events: readonly RawDiagnosticEvent[]): FormattedDiagnosticEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) =>
      a.event.ledger !== b.event.ledger
        ? a.event.ledger - b.event.ledger
        : a.event.id < b.event.id
          ? -1
          : a.event.id > b.event.id
            ? 1
            : a.index - b.index,
    )
    .map(({ event }) => formatDiagnosticEvent(event));
}

/** Export-safe JSON text for a list of events. */
export function diagnosticEventsToJson(events: readonly RawDiagnosticEvent[]): string {
  return JSON.stringify(formatDiagnosticEvents(events), null, 2);
}

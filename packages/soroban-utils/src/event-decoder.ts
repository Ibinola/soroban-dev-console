import { xdr, scValToNative } from "@stellar/stellar-sdk";
import type { NormalizedContractSpec } from "./contract-spec";

export interface DecodedEventTopic {
  raw: string;
  decoded: unknown;
  error?: string;
}

export interface DecodedContractEvent {
  id: string;
  contractId: string | null;
  ledger: number;
  topics: DecodedEventTopic[];
  data: unknown;
  dataRaw: string;
  isKnown: boolean;
}

/**
 * Decode a single XDR-encoded topic string to a native JS value.
 */
function decodeTopic(raw: string): DecodedEventTopic {
  try {
    const scVal = xdr.ScVal.fromXDR(raw, "base64");
    return { raw, decoded: scValToNative(scVal) };
  } catch (err) {
    return { raw, decoded: null, error: String(err) };
  }
}

/**
 * Decode a raw XDR data value.
 */
function decodeData(raw: string): unknown {
  try {
    const scVal = xdr.ScVal.fromXDR(raw, "base64");
    return scValToNative(scVal);
  } catch {
    return raw;
  }
}

/**
 * Decode a contract event using the available spec for richer topic labels.
 * Falls back to raw XDR decoding when no spec is available.
 */
export function decodeContractEvent(
  event: {
    id: string;
    contractId?: string | null;
    ledger: number;
    topic: string[];
    value?: { xdr: string };
  },
  _spec?: NormalizedContractSpec,
): DecodedContractEvent {
  const topics = (event.topic ?? []).map(decodeTopic);
  const dataRaw = event.value?.xdr ?? "";
  const data = dataRaw ? decodeData(dataRaw) : null;

  // An event is "known" when at least the first topic decodes cleanly to a symbol
  const isKnown =
    topics.length > 0 &&
    !topics[0].error &&
    typeof topics[0].decoded === "string";

  return {
    id: event.id,
    contractId: event.contractId ?? null,
    ledger: event.ledger,
    topics,
    data,
    dataRaw,
    isKnown,
  };
}

/**
 * Decode a batch of raw contract events.
 */
export function decodeContractEvents(
  events: Parameters<typeof decodeContractEvent>[0][],
  spec?: NormalizedContractSpec,
): DecodedContractEvent[] {
  return events.map((evt) => decodeContractEvent(evt, spec));
}

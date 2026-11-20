import { xdr } from "@stellar/stellar-sdk";

/**
 * Decode a raw TransactionEnvelope XDR string and summarize its signatures. (#924)
 */
export interface DecodedEnvelope {
  envelopeType: string;
  signatureCount: number;
  signatureHints: string[];
}

export function decodeTransactionEnvelope(base64: string): DecodedEnvelope {
  const envelope = xdr.TransactionEnvelope.fromXDR(base64, "base64");
  const envelopeType = envelope.switch().name;

  const signatures =
    envelopeType === "envelopeTypeTx"
      ? envelope.v1().signatures()
      : envelopeType === "envelopeTypeTxFeeBump"
        ? envelope.feeBump().signatures()
        : [];

  return {
    envelopeType,
    signatureCount: signatures.length,
    signatureHints: signatures.map((sig) => sig.hint().toString("hex")),
  };
}

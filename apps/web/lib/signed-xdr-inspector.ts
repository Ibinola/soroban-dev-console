import { xdr } from "@stellar/stellar-sdk";

/**
 * Inspect a signed transaction envelope before it is broadcast. (#906)
 */
export interface SignedXdrSummary {
  fee: string;
  operationCount: number;
  signatureCount: number;
}

export function inspectSignedTransactionXdr(base64: string): SignedXdrSummary {
  const envelope = xdr.TransactionEnvelope.fromXDR(base64, "base64");

  if (envelope.switch().name === "envelopeTypeTx") {
    const tx = envelope.v1().tx();
    return {
      fee: tx.fee().toString(),
      operationCount: tx.operations().length,
      signatureCount: envelope.v1().signatures().length,
    };
  }

  const feeBump = envelope.feeBump();
  return {
    fee: feeBump.tx().fee().toString(),
    operationCount: feeBump.tx().innerTx().v1().tx().operations().length,
    signatureCount: feeBump.signatures().length,
  };
}

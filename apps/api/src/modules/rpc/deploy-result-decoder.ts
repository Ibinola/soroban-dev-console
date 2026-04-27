/**
 * BE-021: Backend helpers for deploy result and contract metadata decoding.
 * Normalizes contract creation metadata so browser consumers skip raw XDR handling.
 */

export interface DeployResultMeta {
  contractId: string | null;
  wasmHash: string | null;
  ledger: number | null;
  txHash: string | null;
  error: string | null;
}

export interface RawDeployResult {
  status?: string;
  hash?: string;
  ledger?: number;
  resultMetaXdr?: string;
  contractId?: string;
  wasmHash?: string;
  error?: string;
}

export function decodeDeployResult(raw: RawDeployResult): DeployResultMeta {
  if (!raw || raw.status === "FAILED") {
    return {
      contractId: null,
      wasmHash: null,
      ledger: raw?.ledger ?? null,
      txHash: raw?.hash ?? null,
      error: raw?.error ?? "deploy failed with no additional context",
    };
  }

  return {
    contractId: raw.contractId ?? null,
    wasmHash: raw.wasmHash ?? null,
    ledger: raw.ledger ?? null,
    txHash: raw.hash ?? null,
    error: null,
  };
}

export function isSuccessfulDeploy(meta: DeployResultMeta): boolean {
  return meta.contractId !== null && meta.error === null;
}

export function safeDecodeDeployResult(raw: unknown): DeployResultMeta {
  try {
    return decodeDeployResult(raw as RawDeployResult);
  } catch {
    return { contractId: null, wasmHash: null, ledger: null, txHash: null, error: "decode failed" };
  }
}

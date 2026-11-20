/**
 * Issue #1099: validate an uploaded WASM file's size against the active
 * network's protocol maximum, fetched from its `CONTRACT_MAX_SIZE_BYTES`
 * config-setting ledger entry.
 */

import { rpc as SorobanRpc, xdr } from "@stellar/stellar-sdk";

/**
 * Fallback used when the config-setting ledger entry can't be fetched or
 * parsed (RPC unreachable, unsupported RPC provider, unexpected shape).
 * Matches the constant the deploy wizard already showed as a soft warning
 * before this issue's fix wired up the real network value.
 */
export const DEFAULT_MAX_WASM_SIZE_BYTES = 256 * 1024;

export interface WasmSizeValidation {
  valid: boolean;
  /** Human-readable message detailing file size vs. the limit, set whenever invalid. */
  message?: string;
}

/** Pure size check — file size in bytes against the network maximum in bytes. */
export function validateWasmSize(
  sizeBytes: number,
  maxSizeBytes: number,
): WasmSizeValidation {
  if (sizeBytes <= maxSizeBytes) {
    return { valid: true };
  }
  const sizeKb = (sizeBytes / 1024).toFixed(2);
  const maxKb = (maxSizeBytes / 1024).toFixed(2);
  return {
    valid: false,
    message: `WASM file is ${sizeKb} KB, which exceeds this network's maximum contract size of ${maxKb} KB.`,
  };
}

/**
 * Fetch the network's CONTRACT_MAX_SIZE_BYTES config setting via RPC.
 * Falls back to DEFAULT_MAX_WASM_SIZE_BYTES (and logs a warning) on any
 * failure, so a flaky/unsupported RPC endpoint degrades to the previous
 * soft-limit behavior instead of blocking deployment entirely.
 */
export async function fetchMaxWasmSize(rpcUrl: string): Promise<number> {
  try {
    const server = new SorobanRpc.Server(rpcUrl);
    const key = xdr.LedgerKey.configSetting(
      new xdr.LedgerKeyConfigSetting({
        configSettingId: xdr.ConfigSettingId.configSettingContractMaxSizeBytes(),
      }),
    );

    const response = await server.getLedgerEntries(key);
    const entry = response.entries?.[0];
    if (!entry) {
      return DEFAULT_MAX_WASM_SIZE_BYTES;
    }

    const maxSize = entry.val.configSetting().contractMaxSizeBytes();
    return typeof maxSize === "number" && maxSize > 0
      ? maxSize
      : DEFAULT_MAX_WASM_SIZE_BYTES;
  } catch (err) {
    console.warn(
      "Failed to fetch CONTRACT_MAX_SIZE_BYTES from network RPC; falling back to default",
      err,
    );
    return DEFAULT_MAX_WASM_SIZE_BYTES;
  }
}

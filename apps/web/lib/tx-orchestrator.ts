/**
 * FE-040: Unified transaction orchestration service.
 *
 * Shared orchestration layer for simulation, signing handoff, submission,
 * polling, and result normalization across call, batch, and deploy flows.
 *
 * Can be tested independently of page components.
 *
 * Issue #735: Adds real-time transaction status streaming via SSE with a
 * polling fallback when EventSource is unavailable or fails to connect.
 */

import {
  TransactionBuilder,
  TimeoutInfinite,
  rpc as SorobanRpc,
  xdr,
} from "@stellar/stellar-sdk";
import { Server as SorobanServer } from "@stellar/stellar-sdk/rpc";
import { signTransaction } from "@stellar/freighter-api";
import {
  normalizeSimulationResult,
  type NormalizedSimulationResult,
} from "@devconsole/soroban-utils";
import {
  simulateTransaction,
  sendTransaction,
  pollTransactionStatus,
} from "@/lib/api/transactions";
import {
  type NormalizedTransactionResult,
  type NormalizedSimulationPayload,
} from "@devconsole/api-contracts";
import type { NetworkConfig } from "@/store/useNetworkStore";

export type TxStatus =
  | "idle"
  | "simulating"
  | "awaiting-signature"
  | "submitting"
  | "polling"
  | "success"
  | "error";

export interface TxResult {
  status: "success" | "error";
  hash?: string;
  simulation?: NormalizedSimulationResult;
  errorMessage?: string;
  resultMetaXdr?: string | xdr.TransactionMeta;
  resultXdr?: string | xdr.TransactionResult;
}

export interface OrchestrationOptions {
  /** Pre-built transaction XDR to sign and submit (skips simulation) */
  builtTxXdr?: string;
  /** If true, only simulate — do not submit */
  simulateOnly?: boolean;
  /** Max polling attempts before giving up (default: 20) */
  maxPollAttempts?: number;
  /** Polling interval in ms (default: 2000) */
  pollIntervalMs?: number;
}

export type StatusCallback = (status: TxStatus) => void;

// ── Issue #735: SSE-based status streaming ────────────────────────────────────

/**
 * Options for the SSE / polling status watcher.
 */
export interface TxStatusWatchOptions {
  /** API base URL — defaults to NEXT_PUBLIC_API_URL or http://localhost:4000 */
  apiBase?: string;
  /** How long to wait before giving up when SSE connection fails (ms, default 5 000) */
  sseConnectTimeoutMs?: number;
  /** Polling interval used in the fallback path (ms, default 2 000) */
  pollIntervalMs?: number;
  /** Max polling attempts in the fallback path (default 60) */
  maxPollAttempts?: number;
}

/**
 * Subscribe to real-time transaction status updates via SSE, falling back to
 * HTTP polling if EventSource is unavailable or fails to connect.
 *
 * @param network  Network identifier (e.g. "testnet")
 * @param hash     Transaction hash to watch
 * @param onUpdate Called on every status update
 * @param options  Configuration overrides
 * @returns A cleanup function that stops watching
 */
export function watchTxStatus(
  network: string,
  hash: string,
  onUpdate: (result: NormalizedTransactionResult) => void,
  options: TxStatusWatchOptions = {},
): () => void {
  const {
    apiBase = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
      "http://localhost:4000",
    sseConnectTimeoutMs = 5_000,
    pollIntervalMs = 2_000,
    maxPollAttempts = 60,
  } = options;

  const sseUrl = `${apiBase}/api/rpc/${network}/tx/${encodeURIComponent(hash)}/status`;

  // ── Try SSE first ───────────────────────────────────────────────────────────
  if (typeof EventSource !== "undefined") {
    let resolved = false;
    let es: EventSource | null = null;
    let pollCleanup: (() => void) | null = null;

    // Fallback to polling if SSE doesn't connect within the timeout
    const connectTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        es?.close();
        pollCleanup = startPollingFallback(
          network,
          hash,
          apiBase,
          onUpdate,
          pollIntervalMs,
          maxPollAttempts,
        );
      }
    }, sseConnectTimeoutMs);

    try {
      es = new EventSource(sseUrl);

      es.onopen = () => {
        // SSE connected — cancel the polling fallback timer
        clearTimeout(connectTimeout);
        resolved = true;
      };

      es.onmessage = (event: MessageEvent) => {
        try {
          const envelope = JSON.parse(event.data as string) as
            | { success: true; data: NormalizedTransactionResult }
            | { success: false; error: string };

          if (envelope.success) {
            onUpdate(envelope.data);
            // Close the stream once terminal
            if (
              envelope.data.status === "success" ||
              envelope.data.status === "failed"
            ) {
              es?.close();
            }
          }
        } catch {
          // Malformed event data — ignore
        }
      };

      es.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(connectTimeout);
          es?.close();
          // SSE failed before a message arrived — fall back to polling
          pollCleanup = startPollingFallback(
            network,
            hash,
            apiBase,
            onUpdate,
            pollIntervalMs,
            maxPollAttempts,
          );
        } else {
          // Already started, this is a normal close after the stream ends
          es?.close();
        }
      };
    } catch {
      // EventSource constructor threw — environment doesn't support it
      clearTimeout(connectTimeout);
      pollCleanup = startPollingFallback(
        network,
        hash,
        apiBase,
        onUpdate,
        pollIntervalMs,
        maxPollAttempts,
      );
    }

    return () => {
      clearTimeout(connectTimeout);
      es?.close();
      pollCleanup?.();
    };
  }

  // ── No EventSource available — go straight to polling ──────────────────────
  const cleanup = startPollingFallback(
    network,
    hash,
    apiBase,
    onUpdate,
    pollIntervalMs,
    maxPollAttempts,
  );
  return cleanup;
}

/**
 * Internal helper: poll `GET /api/rpc/:network/status` (POST body) until the
 * transaction reaches a terminal state or the attempt limit is reached.
 */
function startPollingFallback(
  network: string,
  hash: string,
  apiBase: string,
  onUpdate: (result: NormalizedTransactionResult) => void,
  intervalMs: number,
  maxAttempts: number,
): () => void {
  let attempts = 0;
  let stopped = false;

  const poll = async () => {
    if (stopped || attempts >= maxAttempts) return;
    attempts++;

    try {
      const res = await fetch(`${apiBase}/api/rpc/${network}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash }),
      });

      if (!res.ok) return;

      const envelope = await res.json() as
        | { success: true; data: NormalizedTransactionResult }
        | { success: false };

      if (envelope.success) {
        onUpdate(envelope.data);
        if (
          envelope.data.status === "success" ||
          envelope.data.status === "failed"
        ) {
          stopped = true;
          return;
        }
      }
    } catch {
      // Network error — keep retrying
    }

    if (!stopped) {
      setTimeout(poll, intervalMs);
    }
  };

  void poll();

  return () => { stopped = true; };
}

// ── Existing orchestration helpers (unchanged) ────────────────────────────────

/**
 * Simulate a prepared transaction and return normalized results.
 */
export async function simulateTx(
  txXdr: string,
  network: NetworkConfig,
): Promise<NormalizedSimulationResult> {
  try {
    const normalized = await simulateTransaction(network.name, txXdr);
    
    // Convert to the existing NormalizedSimulationResult format for compatibility
    return {
      ok: normalized.ok,
      error: normalized.error,
      minResourceFee: normalized.minResourceFee,
      resultXdr: normalized.resultXdr,
      auth: normalized.auth,
      requiredAuthKeys: normalized.requiredAuthKeys,
      stateChangesCount: normalized.stateChangesCount,
      cpuInsns: normalized.cpuInsns,
      memBytes: normalized.memBytes,
      stateChanges: [], // Not included in normalized payload yet
    };
  } catch (error) {
    // Fallback to direct RPC if normalized API fails
    const server = new SorobanServer(network.rpcUrl);
    const tx = TransactionBuilder.fromXDR(txXdr, network.networkPassphrase);
    const simResult = await server.simulateTransaction(tx);
    return normalizeSimulationResult(simResult);
  }
}

/**
 * Prepare, sign, submit, and poll a transaction to completion.
 * Emits status updates via the optional callback.
 */
export async function orchestrateTx(
  txXdr: string,
  network: NetworkConfig,
  options: OrchestrationOptions = {},
  onStatus?: StatusCallback,
): Promise<TxResult> {
  const {
    simulateOnly = false,
    maxPollAttempts = 20,
    pollIntervalMs = 2000,
  } = options;

  const server = new SorobanServer(network.rpcUrl);

  try {
    // ── Simulate ──────────────────────────────────────────────────────────────
    onStatus?.("simulating");
    const tx = TransactionBuilder.fromXDR(txXdr, network.networkPassphrase);
    const simResult = await server.simulateTransaction(tx);
    const normalized = normalizeSimulationResult(simResult);

    if (simulateOnly) {
      return { status: "success", simulation: normalized };
    }

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      return {
        status: "error",
        simulation: normalized,
        errorMessage: (simResult as SorobanRpc.Api.SimulateTransactionErrorResponse).error,
      };
    }

    // ── Prepare ───────────────────────────────────────────────────────────────
    const preparedTx = await server.prepareTransaction(tx);

    // ── Sign ──────────────────────────────────────────────────────────────────
    onStatus?.("awaiting-signature");
    const { signedTxXdr } = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: network.networkPassphrase,
    });

    // ── Submit ────────────────────────────────────────────────────────────────
    onStatus?.("submitting");
    const submitResult = await server.sendTransaction(
      TransactionBuilder.fromXDR(signedTxXdr, network.networkPassphrase),
    );

    if (submitResult.status !== "PENDING") {
      return {
        status: "error",
        errorMessage: `Submission failed with status: ${submitResult.status}`,
        simulation: normalized,
      };
    }

    // ── Poll ──────────────────────────────────────────────────────────────────
    onStatus?.("polling");
    try {
      const finalStatus = await pollTransactionStatus(
        network.name,
        submitResult.hash,
        {
          maxAttempts: maxPollAttempts,
          intervalMs: pollIntervalMs,
          onStatus: (status) => {
            if (status.status === "success") {
              onStatus?.("success");
            }
          },
        },
      );

      if (finalStatus.status === "success") {
        return {
          status: "success",
          hash: submitResult.hash,
          simulation: normalized,
          resultMetaXdr: finalStatus.resultMetaXdr,
        };
      }

      return {
        status: "error",
        hash: submitResult.hash,
        errorMessage: finalStatus.error || "Transaction failed on-chain",
        simulation: normalized,
        resultXdr: finalStatus.resultXdr,
      };
    } catch (error) {
      // Fallback to direct RPC polling if normalized API fails
      for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        const txStatus = await server.getTransaction(submitResult.hash);

        if (txStatus.status === "SUCCESS") {
          onStatus?.("success");
          return {
            status: "success",
            hash: submitResult.hash,
            simulation: normalized,
            resultMetaXdr: txStatus.resultMetaXdr,
          };
        }

        if (txStatus.status === "FAILED") {
          return {
            status: "error",
            hash: submitResult.hash,
            errorMessage: "Transaction failed on-chain",
            simulation: normalized,
            resultXdr: txStatus.resultXdr,
          };
        }
      }
    }

    return {
      status: "error",
      hash: submitResult.hash,
      errorMessage: "Transaction polling timed out",
      simulation: normalized,
    };
  } catch (err) {
    onStatus?.("error");
    return {
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Issue 277: Shared orchestration adapter for wallet execution flows.
 *
 * Thin wrappers so contract-call-form, instantiate-wizard, and source-registry
 * can delegate to tx-orchestrator without duplicating sign/submit/poll logic.
 */

import type { NormalizedTransactionResult } from "@devconsole/api-contracts";

export type OrchestratorStatus =
  | "idle"
  | "simulating"
  | "awaiting-signature"
  | "submitting"
  | "polling"
  | "done"
  | "error";

export interface OrchestratorCallbacks {
  onStatus?: (status: OrchestratorStatus) => void;
  onResult?: (result: NormalizedTransactionResult) => void;
  onError?: (err: Error) => void;
}

export interface OrchestratedFlowOptions {
  xdr: string;
  networkPassphrase: string;
  rpcUrl: string;
  callbacks?: OrchestratorCallbacks;
}

export function buildOrchestratorAdapter(callbacks?: OrchestratorCallbacks) {
  function notify(status: OrchestratorStatus) {
    callbacks?.onStatus?.(status);
  }

  async function run(
    orchestrate: (opts: OrchestratedFlowOptions) => Promise<NormalizedTransactionResult>,
    opts: OrchestratedFlowOptions
  ): Promise<NormalizedTransactionResult> {
    try {
      notify("simulating");
      const result = await orchestrate(opts);
      notify("done");
      callbacks?.onResult?.(result);
      return result;
    } catch (err) {
      notify("error");
      callbacks?.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  return { run, notify };
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NormalizedContractSpec } from "@devconsole/soroban-utils";

/** An ABI snapshot taken just before a contract upgrade was submitted. */
export interface ContractVersionSnapshot {
  id: string;
  workspaceId: string;
  contractId: string;
  /** 1-based, per contract and workspace; `v1` is the ABI before the first recorded upgrade. */
  version: number;
  recordedAt: number;
  /** WASM hash the contract was upgraded *to* when this snapshot was taken, if known. */
  upgradedToWasmHash?: string;
  spec: NormalizedContractSpec;
}

interface ContractVersionState {
  snapshots: ContractVersionSnapshot[];
  recordSnapshot: (input: {
    workspaceId: string;
    contractId: string;
    spec: NormalizedContractSpec;
    upgradedToWasmHash?: string;
  }) => ContractVersionSnapshot;
  getHistory: (workspaceId: string, contractId: string) => ContractVersionSnapshot[];
  clearHistory: (workspaceId: string, contractId: string) => void;
}

export const useContractVersionStore = create<ContractVersionState>()(
  persist(
    (set, get) => ({
      snapshots: [],
      recordSnapshot: ({ workspaceId, contractId, spec, upgradedToWasmHash }) => {
        const existing = get().snapshots.filter(
          (s) => s.workspaceId === workspaceId && s.contractId === contractId,
        );
        const snapshot: ContractVersionSnapshot = {
          id: crypto.randomUUID(),
          workspaceId,
          contractId,
          version: existing.reduce((max, s) => Math.max(max, s.version), 0) + 1,
          recordedAt: Date.now(),
          upgradedToWasmHash,
          spec,
        };
        set((state) => ({ snapshots: [...state.snapshots, snapshot] }));
        return snapshot;
      },
      getHistory: (workspaceId, contractId) =>
        get()
          .snapshots.filter((s) => s.workspaceId === workspaceId && s.contractId === contractId)
          .sort((a, b) => b.version - a.version),
      clearHistory: (workspaceId, contractId) =>
        set((state) => ({
          snapshots: state.snapshots.filter(
            (s) => !(s.workspaceId === workspaceId && s.contractId === contractId),
          ),
        })),
    }),
    { name: "soroban-contract-versions" },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Issue #1096: a single deployment attempt recorded in the workspace's history log. */
export interface DeploymentLogEntry {
  id: string;
  timestamp: number;
  wasmFileName: string;
  wasmHash: string;
  /** Hex-encoded salt used for `createCustomContract`, when known. */
  salt: string | null;
  contractId: string | null;
  txHash: string | null;
  status: "success" | "failed";
  errorMessage?: string;
  network: string;
}

interface DeploymentLogState {
  entries: DeploymentLogEntry[];
  logDeployment: (entry: Omit<DeploymentLogEntry, "id" | "timestamp">) => void;
  clearLog: () => void;
}

const MAX_LOG_ENTRIES = 100;

export const useDeploymentLogStore = create<DeploymentLogState>()(
  persist(
    (set) => ({
      entries: [],
      logDeployment: (entry) =>
        set((state) => ({
          entries: [
            {
              ...entry,
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              timestamp: Date.now(),
            },
            ...state.entries,
          ].slice(0, MAX_LOG_ENTRIES),
        })),
      clearLog: () => set({ entries: [] }),
    }),
    {
      name: "soroban-deployment-log-storage",
    },
  ),
);

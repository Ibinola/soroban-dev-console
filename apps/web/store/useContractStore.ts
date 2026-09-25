import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Contract {
  id: string;
  name: string;
  network: string;
  addedAt: number;
}

interface ContractState {
  contracts: Contract[];
  /** Issue #1098: `alias` optionally labels the contract instead of the default "Contract <id>" name. */
  addContract: (id: string, network: string, alias?: string) => void;
  removeContract: (id: string) => void;
}

export const useContractStore = create<ContractState>()(
  persist(
    (set) => ({
      contracts: [],
      addContract: (id, network, alias) =>
        set((state) => {
          if (state.contracts.find((c) => c.id === id)) return state;
          return {
            contracts: [
              {
                id,
                name: alias?.trim() || `Contract ${id.slice(0, 4)}`,
                network,
                addedAt: Date.now(),
              },
              ...state.contracts,
            ],
          };
        }),
      removeContract: (id) =>
        set((state) => ({
          contracts: state.contracts.filter((c) => c.id !== id),
        })),
    }),
    {
      name: "soroban-contracts-storage", // unique name for localStorage key
    },
  ),
);

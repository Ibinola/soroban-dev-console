import { create } from "zustand";
import { persist } from "zustand/middleware";

import { safeMerge } from "./safe-merge";

export interface Contract {
  id: string;
  name: string;
  network: string;
  addedAt: number;
}

/**
 * Issue #1269: a single entry on the undo/redo stack.
 *
 * The stack stores whole contract-list snapshots rather than inverse
 * operations: the list is small (workspaces hold a handful of contracts), the
 * snapshots are trivially serialisable, and applying one can never drift out of
 * sync with the live list the way a hand-written inverse can.
 */
export interface ContractHistoryEntry {
  /** Contract list *after* the action, i.e. the state to restore on redo. */
  contracts: Contract[];
  /** History snapshot *before* the action, restored by undo. */
  restore: Contract[];
  /** Human-readable action label, e.g. "removed contract". */
  label: string;
}

/** Issue #1269: the undo stack holds at most this many actions. */
export const CONTRACT_UNDO_LIMIT = 20;

type Snapshot = Pick<ContractState, "contracts">;

interface ContractState {
  contracts: Contract[];
  /** Issue #1269: newest action last; capped at {@link CONTRACT_UNDO_LIMIT}. */
  undoStack: ContractHistoryEntry[];
  /** Issue #1269: actions undone from the top of the undo stack. */
  redoStack: ContractHistoryEntry[];
  /** Issue #1098: `alias` optionally labels the contract instead of the default "Contract <id>" name. */
  addContract: (id: string, network: string, alias?: string) => void;
  removeContract: (id: string) => void;
  /** Issue #1269: reorder a contract within the list. */
  moveContract: (id: string, direction: "up" | "down") => void;
  /** Issue #1269: undo the most recent modification. Returns its label. */
  undo: () => string | null;
  /** Issue #1269: redo the most recently undone modification. */
  redo: () => string | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Issue #1269: label of the action Ctrl+Z would undo. */
  peekUndoLabel: () => string | null;
  /** Issue #1269: label of the action Ctrl+Y would redo. */
  peekRedoLabel: () => string | null;
  /** Issue #1269: drop the history, e.g. after a successful save. */
  clearHistory: () => void;
}

/** Apply an action to the contract list while recording it for undo. */
function withHistory(
  state: Snapshot & Pick<ContractState, "undoStack" | "redoStack">,
  label: string,
  apply: (contracts: Contract[]) => Contract[],
): Partial<ContractState> {
  const contracts = apply(state.contracts);

  // No-op actions (e.g. adding a contract that already exists) must not push
  // history, otherwise Ctrl+Z would appear to do nothing.
  if (contracts === state.contracts) {
    return { contracts };
  }

  const entry: ContractHistoryEntry = {
    contracts,
    restore: state.contracts,
    label,
  };

  return {
    contracts,
    // Issue #1269: keep only the most recent actions.
    undoStack: [...state.undoStack, entry].slice(-CONTRACT_UNDO_LIMIT),
    redoStack: [],
  };
}

export const useContractStore = create<ContractState>()(
  persist(
    (set, get) => ({
      contracts: [],
      undoStack: [],
      redoStack: [],

      addContract: (id, network, alias) =>
        set((state) => {
          if (state.contracts.find((c) => c.id === id))
            return { contracts: state.contracts };

          return withHistory(state, "added contract", (contracts) => [
            {
              id,
              name: alias?.trim() || `Contract ${id.slice(0, 4)}`,
              network,
              addedAt: Date.now(),
            },
            ...contracts,
          ]);
        }),

      removeContract: (id) =>
        set((state) => {
          if (!state.contracts.find((c) => c.id === id)) {
            return { contracts: state.contracts };
          }

          return withHistory(state, "removed contract", (contracts) =>
            contracts.filter((c) => c.id !== id),
          );
        }),

      moveContract: (id, direction) =>
        set((state) => {
          const index = state.contracts.findIndex(
            (contract) => contract.id === id,
          );
          const target = direction === "up" ? index - 1 : index + 1;

          if (index === -1 || target < 0 || target >= state.contracts.length) {
            return { contracts: state.contracts };
          }

          return withHistory(
            state,
            direction === "up" ? "moved contract up" : "moved contract down",
            (contracts) => {
              const next = [...contracts];
              [next[index], next[target]] = [next[target], next[index]];
              return next;
            },
          );
        }),

      undo: () => {
        const { undoStack } = get();
        const entry = undoStack[undoStack.length - 1];
        if (!entry) return null;

        set({
          contracts: entry.restore,
          undoStack: undoStack.slice(0, -1),
          redoStack: [...get().redoStack, entry],
        });

        return entry.label;
      },

      redo: () => {
        const { redoStack } = get();
        const entry = redoStack[redoStack.length - 1];
        if (!entry) return null;

        set({
          contracts: entry.contracts,
          redoStack: redoStack.slice(0, -1),
          undoStack: [...get().undoStack, entry].slice(-CONTRACT_UNDO_LIMIT),
        });

        return entry.label;
      },

      canUndo: () => get().undoStack.length > 0,
      canRedo: () => get().redoStack.length > 0,
      peekUndoLabel: () => get().undoStack.at(-1)?.label ?? null,
      peekRedoLabel: () => get().redoStack.at(-1)?.label ?? null,
      clearHistory: () => set({ undoStack: [], redoStack: [] }),
    }),
    {
      name: "soroban-contracts-storage", // unique name for localStorage key
      merge: safeMerge,
      // Issue #1269: history is per-session only — it is intentionally not
      // persisted, so a reload starts from the saved contract list.
      partialize: (state) => ({ contracts: state.contracts }),
    },
  ),
);

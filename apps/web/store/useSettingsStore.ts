/**
 * Issue #747: User-configurable settings store.
 *
 * Persists UI preferences (theme, default network, simulation auto-run,
 * custom RPC URLs) in localStorage under the key "soroban-settings".
 * SSR-safe: all store reads happen client-side only.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppTheme = "light" | "dark" | "system";

interface SettingsState {
  /** Issue #747: Appearance — theme preference (light / dark / system) */
  theme: AppTheme;
  /** Issue #747: Editor — default network for new workspaces */
  defaultNetwork: string;
  /** Issue #747: Editor — whether simulation runs automatically on method select */
  autoRunSimulation: boolean;

  setTheme: (theme: AppTheme) => void;
  setDefaultNetwork: (network: string) => void;
  setAutoRunSimulation: (value: boolean) => void;
  /**
   * Issue #747: Clear all application data.
   * Clears all known persisted Zustand store keys from localStorage,
   * then redirects to home.
   */
  clearAllData: () => void;
}

const PERSISTED_STORE_KEYS = [
  "soroban-workspaces",
  "soroban-sync-queue",
  "soroban-workspace-activity",
  "soroban-saved-calls",
  "soroban-settings",
  "soroban-abi-store",
  "soroban-wasm-store",
  "soroban-network-store",
] as const;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      defaultNetwork: "testnet",
      autoRunSimulation: false,

      setTheme: (theme) => set({ theme }),
      setDefaultNetwork: (defaultNetwork) => set({ defaultNetwork }),
      setAutoRunSimulation: (autoRunSimulation) => set({ autoRunSimulation }),

      clearAllData: () => {
        if (typeof window !== "undefined") {
          for (const key of PERSISTED_STORE_KEYS) {
            localStorage.removeItem(key);
          }
          window.location.href = "/";
        }
      },
    }),
    {
      name: "soroban-settings",
    },
  ),
);

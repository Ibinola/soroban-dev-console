import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DeployStep, SaltMode } from "@/lib/deploy-wizard";

interface DeployWizardState {
  step: DeployStep;
  saltMode: SaltMode;
  saltHex: string;
  setStep: (step: DeployStep) => void;
  setSaltMode: (mode: SaltMode) => void;
  setSaltHex: (hex: string) => void;
  reset: () => void;
}

const initial = { step: "upload" as DeployStep, saltMode: "default" as SaltMode, saltHex: "" };

/**
 * Wizard progress that survives navigating away and back. Kept in
 * sessionStorage: it is scratch state, not something to carry across sessions.
 * The selected file itself cannot be persisted, so the page falls back to the
 * upload step when it is missing.
 */
export const useDeployWizardStore = create<DeployWizardState>()(
  persist(
    (set) => ({
      ...initial,
      setStep: (step) => set({ step }),
      setSaltMode: (saltMode) => set({ saltMode }),
      setSaltHex: (saltHex) => set({ saltHex }),
      reset: () => set({ ...initial }),
    }),
    {
      name: "soroban-deploy-wizard",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ step, saltMode, saltHex }) => ({ step, saltMode, saltHex }),
    },
  ),
);

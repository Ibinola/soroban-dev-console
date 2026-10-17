import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TourStep {
  id: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Soroban DevConsole",
    body: "Explore, invoke and debug Soroban contracts from one place. This quick tour covers the essentials.",
  },
  {
    id: "workspaces",
    title: "Workspaces",
    body: "Use the workspace switcher at the top of the sidebar to keep contracts, saved calls and notes for each project together.",
  },
  {
    id: "explorer",
    title: "Contract Explorer",
    body: "Open Contract Explorer to add a contract by its ID, load its interface and see its storage and events.",
  },
  {
    id: "invoke",
    title: "Simulate before you send",
    body: "On a contract page, pick a function, fill in the arguments and simulate first. You can sign and submit once the result looks right.",
  },
  {
    id: "shortcuts",
    title: "Shortcuts and favorites",
    body: "Press ? for keyboard shortcuts, and star contracts to pin them in the sidebar for quick access.",
  },
];

interface OnboardingState {
  /** True once the tour has been finished or skipped. */
  completed: boolean;
  /** Whether the tour is currently showing. */
  active: boolean;
  step: number;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completed: false,
      active: false,
      step: 0,
      start: () => set({ active: true, step: 0 }),
      next: () => {
        const { step } = get();
        if (step >= TOUR_STEPS.length - 1) set({ active: false, completed: true, step: 0 });
        else set({ step: step + 1 });
      },
      back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
      skip: () => set({ active: false, completed: true, step: 0 }),
    }),
    {
      name: "soroban-onboarding",
      // Only the completion flag survives reloads; a tour in progress restarts.
      partialize: (state) => ({ completed: state.completed }),
    },
  ),
);

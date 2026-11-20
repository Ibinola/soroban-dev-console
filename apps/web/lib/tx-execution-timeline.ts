/**
 * Break a transaction's lifecycle into a visual timeline with per-step
 * timing durations. (#914)
 */
export const TX_LIFECYCLE_STEPS = [
  "Client Simulation",
  "Wallet Signature",
  "RPC Submission",
  "Ledger Inclusion",
] as const;

export type LifecycleStep = (typeof TX_LIFECYCLE_STEPS)[number];

export function computeStepDurations(timestamps: Partial<Record<LifecycleStep, number>>): number[] {
  const durations: number[] = [];
  for (let i = 1; i < TX_LIFECYCLE_STEPS.length; i++) {
    const prev = timestamps[TX_LIFECYCLE_STEPS[i - 1]];
    const curr = timestamps[TX_LIFECYCLE_STEPS[i]];
    durations.push(prev !== undefined && curr !== undefined ? curr - prev : 0);
  }
  return durations;
}

export function currentActiveStep(timestamps: Partial<Record<LifecycleStep, number>>): LifecycleStep | null {
  for (let i = TX_LIFECYCLE_STEPS.length - 1; i >= 0; i--) {
    if (timestamps[TX_LIFECYCLE_STEPS[i]] !== undefined) {
      return TX_LIFECYCLE_STEPS[i];
    }
  }
  return null;
}

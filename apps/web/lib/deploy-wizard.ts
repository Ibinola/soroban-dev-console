import { validateSaltHex } from "@devconsole/soroban-utils";

export type DeployStep = "upload" | "configure" | "simulate" | "deploy";

export const DEPLOY_STEPS: readonly DeployStep[] = ["upload", "configure", "simulate", "deploy"];

export const DEPLOY_STEP_LABELS: Record<DeployStep, string> = {
  upload: "Upload WASM",
  configure: "Configure",
  simulate: "Review & simulate",
  deploy: "Deploy",
};

export type SaltMode = "default" | "custom";

export interface DeployDraft {
  hasFile: boolean;
  saltMode: SaltMode;
  saltHex: string;
  simulationOk: boolean;
}

export interface StepValidation {
  valid: boolean;
  error?: string;
}

/** Whether the inputs belonging to `step` are complete enough to move past it. */
export function validateStep(step: DeployStep, draft: DeployDraft): StepValidation {
  switch (step) {
    case "upload":
      return draft.hasFile ? { valid: true } : { valid: false, error: "Choose a .wasm file to continue." };
    case "configure": {
      if (draft.saltMode === "default") return { valid: true };
      const salt = validateSaltHex(draft.saltHex);
      return salt.valid ? { valid: true } : { valid: false, error: salt.error };
    }
    case "simulate":
      return draft.simulationOk
        ? { valid: true }
        : { valid: false, error: "Run a successful simulation before deploying." };
    case "deploy":
      return { valid: true };
  }
}

export function stepIndex(step: DeployStep): number {
  return DEPLOY_STEPS.indexOf(step);
}

/** The step after `current`, or `current` itself if it is invalid or last. */
export function nextStep(current: DeployStep, draft: DeployDraft): DeployStep {
  const i = stepIndex(current);
  if (i < 0 || i === DEPLOY_STEPS.length - 1) return current;
  return validateStep(current, draft).valid ? DEPLOY_STEPS[i + 1] : current;
}

export function previousStep(current: DeployStep): DeployStep {
  const i = stepIndex(current);
  return i <= 0 ? current : DEPLOY_STEPS[i - 1];
}

/**
 * The furthest step a draft may be on. Used when restoring a saved wizard:
 * a step past the upload cannot be resumed without the (unpersistable) file,
 * and the deploy step needs a successful simulation.
 */
export function clampRestoredStep(step: DeployStep, draft: DeployDraft): DeployStep {
  let reached: DeployStep = "upload";
  for (const s of DEPLOY_STEPS) {
    if (stepIndex(s) > stepIndex(step)) break;
    reached = s;
    if (!validateStep(s, draft).valid) break;
  }
  return reached;
}

const ZERO_SALT = "0".repeat(64);

/** 32-byte salt hex that the deployment will use. */
export function resolveSaltHex(draft: Pick<DeployDraft, "saltMode" | "saltHex">): string {
  return draft.saltMode === "custom" ? draft.saltHex.trim().toLowerCase() : ZERO_SALT;
}

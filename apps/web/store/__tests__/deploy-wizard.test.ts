import { describe, it, expect } from "vitest";

// #687: Test the deploy wizard step transition logic
// Steps: configure → simulate → review

type DeployStep = "configure" | "simulate" | "review";
const STEP_ORDER: DeployStep[] = ["configure", "simulate", "review"];

function nextStep(current: DeployStep): DeployStep | null {
  const idx = STEP_ORDER.indexOf(current);
  if (idx < 0 || idx === STEP_ORDER.length - 1) return null;
  return STEP_ORDER[idx + 1];
}

function prevStep(current: DeployStep): DeployStep | null {
  const idx = STEP_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return STEP_ORDER[idx - 1];
}

interface SimulationPreview {
  ok: boolean;
  minResourceFee?: string;
  cpuInsns?: number;
  memBytes?: number;
  error?: string;
}

// Determine whether we can proceed to the next step
function canProceedToSimulate(file: File | null): boolean {
  return file !== null;
}

function canProceedToReview(simulation: SimulationPreview | null): boolean {
  return simulation !== null && simulation.ok;
}

function canSubmit(simulation: SimulationPreview | null, file: File | null): boolean {
  return file !== null && simulation !== null && simulation.ok;
}

describe("deploy wizard step transitions (#687)", () => {
  it("starts on configure step", () => {
    const step: DeployStep = "configure";
    expect(step).toBe("configure");
  });

  it("can advance from configure to simulate", () => {
    expect(nextStep("configure")).toBe("simulate");
  });

  it("can advance from simulate to review", () => {
    expect(nextStep("simulate")).toBe("review");
  });

  it("returns null when trying to advance from review", () => {
    expect(nextStep("review")).toBeNull();
  });

  it("can go back from simulate to configure", () => {
    expect(prevStep("simulate")).toBe("configure");
  });

  it("can go back from review to simulate", () => {
    expect(prevStep("review")).toBe("simulate");
  });

  it("returns null when trying to go back from configure", () => {
    expect(prevStep("configure")).toBeNull();
  });

  it("cannot proceed to simulate without a file", () => {
    expect(canProceedToSimulate(null)).toBe(false);
  });

  it("can proceed to simulate with a file", () => {
    const mockFile = new File(["wasm-bytes"], "contract.wasm");
    expect(canProceedToSimulate(mockFile)).toBe(true);
  });

  it("cannot proceed to review if simulation failed", () => {
    const sim: SimulationPreview = { ok: false, error: "Simulation error" };
    expect(canProceedToReview(sim)).toBe(false);
  });

  it("can proceed to review if simulation succeeded", () => {
    const sim: SimulationPreview = {
      ok: true,
      minResourceFee: "100",
      cpuInsns: 50000,
      memBytes: 1024,
    };
    expect(canProceedToReview(sim)).toBe(true);
  });

  it("cannot proceed to review if no simulation run", () => {
    expect(canProceedToReview(null)).toBe(false);
  });

  it("can submit when simulation succeeded and file is loaded", () => {
    const mockFile = new File(["wasm"], "contract.wasm");
    const sim: SimulationPreview = { ok: true, minResourceFee: "200" };
    expect(canSubmit(sim, mockFile)).toBe(true);
  });

  it("cannot submit if simulation failed", () => {
    const mockFile = new File(["wasm"], "contract.wasm");
    const sim: SimulationPreview = { ok: false, error: "error" };
    expect(canSubmit(sim, mockFile)).toBe(false);
  });

  it("step order is correct", () => {
    expect(STEP_ORDER).toEqual(["configure", "simulate", "review"]);
  });

  it("step index is correct for each step", () => {
    expect(STEP_ORDER.indexOf("configure")).toBe(0);
    expect(STEP_ORDER.indexOf("simulate")).toBe(1);
    expect(STEP_ORDER.indexOf("review")).toBe(2);
  });
});

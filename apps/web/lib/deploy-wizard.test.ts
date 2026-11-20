import { describe, expect, it } from "vitest";
import {
  DEPLOY_STEPS,
  clampRestoredStep,
  nextStep,
  previousStep,
  resolveSaltHex,
  validateStep,
  type DeployDraft,
} from "./deploy-wizard";

const draft = (over: Partial<DeployDraft> = {}): DeployDraft => ({
  hasFile: true,
  saltMode: "default",
  saltHex: "",
  simulationOk: false,
  ...over,
});

describe("deploy wizard (#1308)", () => {
  it("has the four steps in order", () => {
    expect(DEPLOY_STEPS).toEqual(["upload", "configure", "simulate", "deploy"]);
  });

  describe("validateStep", () => {
    it("upload needs a file", () => {
      expect(validateStep("upload", draft({ hasFile: false })).valid).toBe(false);
      expect(validateStep("upload", draft()).valid).toBe(true);
    });

    it("configure accepts the default salt and validates a custom one", () => {
      expect(validateStep("configure", draft()).valid).toBe(true);
      expect(validateStep("configure", draft({ saltMode: "custom", saltHex: "zz" })).valid).toBe(false);
      expect(validateStep("configure", draft({ saltMode: "custom", saltHex: "ab".repeat(32) })).valid).toBe(true);
      expect(validateStep("configure", draft({ saltMode: "custom", saltHex: "" })).error).toMatch(/required/i);
    });

    it("simulate needs a successful simulation", () => {
      expect(validateStep("simulate", draft()).valid).toBe(false);
      expect(validateStep("simulate", draft({ simulationOk: true })).valid).toBe(true);
    });
  });

  describe("navigation", () => {
    it("advances only when the current step is valid", () => {
      expect(nextStep("upload", draft({ hasFile: false }))).toBe("upload");
      expect(nextStep("upload", draft())).toBe("configure");
      expect(nextStep("configure", draft({ saltMode: "custom", saltHex: "bad" }))).toBe("configure");
      expect(nextStep("configure", draft())).toBe("simulate");
      expect(nextStep("simulate", draft())).toBe("simulate");
      expect(nextStep("simulate", draft({ simulationOk: true }))).toBe("deploy");
      expect(nextStep("deploy", draft({ simulationOk: true }))).toBe("deploy");
    });

    it("goes back without losing the draft and stops at the first step", () => {
      expect(previousStep("deploy")).toBe("simulate");
      expect(previousStep("upload")).toBe("upload");
    });
  });

  describe("clampRestoredStep", () => {
    it("sends a resumed wizard back to upload when the file is gone", () => {
      expect(clampRestoredStep("simulate", draft({ hasFile: false }))).toBe("upload");
      expect(clampRestoredStep("deploy", draft({ hasFile: false, simulationOk: true }))).toBe("upload");
    });

    it("keeps a step whose prerequisites are intact", () => {
      expect(clampRestoredStep("configure", draft())).toBe("configure");
      expect(clampRestoredStep("simulate", draft())).toBe("simulate");
    });

    it("does not allow deploy without a successful simulation", () => {
      expect(clampRestoredStep("deploy", draft())).toBe("simulate");
      expect(clampRestoredStep("deploy", draft({ simulationOk: true }))).toBe("deploy");
    });

    it("falls back to the configure step when the saved salt is invalid", () => {
      expect(clampRestoredStep("simulate", draft({ saltMode: "custom", saltHex: "nope" }))).toBe("configure");
    });
  });

  describe("resolveSaltHex", () => {
    it("uses the zero salt by default and the custom salt otherwise", () => {
      expect(resolveSaltHex({ saltMode: "default", saltHex: "ignored" })).toBe("0".repeat(64));
      expect(resolveSaltHex({ saltMode: "custom", saltHex: ` ${"AB".repeat(32)} ` })).toBe("ab".repeat(32));
    });
  });
});

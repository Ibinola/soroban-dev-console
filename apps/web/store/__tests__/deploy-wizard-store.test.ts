import { beforeEach, describe, expect, it } from "vitest";
import { useDeployWizardStore } from "../useDeployWizardStore";

describe("useDeployWizardStore (#1308)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useDeployWizardStore.getState().reset();
  });

  it("starts on the upload step with the default salt", () => {
    expect(useDeployWizardStore.getState()).toMatchObject({ step: "upload", saltMode: "default", saltHex: "" });
  });

  it("keeps the user's selections when moving between steps", () => {
    const s = useDeployWizardStore.getState();
    s.setSaltMode("custom");
    s.setSaltHex("ab".repeat(32));
    s.setStep("simulate");
    s.setStep("configure");
    expect(useDeployWizardStore.getState()).toMatchObject({
      step: "configure",
      saltMode: "custom",
      saltHex: "ab".repeat(32),
    });
  });

  it("persists progress to sessionStorage so it survives navigating away", async () => {
    useDeployWizardStore.getState().setStep("configure");
    useDeployWizardStore.getState().setSaltHex("cd".repeat(32));
    const saved = JSON.parse(sessionStorage.getItem("soroban-deploy-wizard")!);
    expect(saved.state).toEqual({ step: "configure", saltMode: "default", saltHex: "cd".repeat(32) });

    useDeployWizardStore.setState({ step: "upload", saltHex: "" });
    sessionStorage.setItem("soroban-deploy-wizard", JSON.stringify(saved));
    await useDeployWizardStore.persist.rehydrate();
    expect(useDeployWizardStore.getState()).toMatchObject({ step: "configure", saltHex: "cd".repeat(32) });
  });

  it("reset returns to the initial state", () => {
    useDeployWizardStore.getState().setStep("deploy");
    useDeployWizardStore.getState().reset();
    expect(useDeployWizardStore.getState().step).toBe("upload");
  });
});

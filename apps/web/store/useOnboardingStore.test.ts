import { beforeEach, describe, expect, it } from "vitest";
import { TOUR_STEPS, useOnboardingStore } from "./useOnboardingStore";

const state = () => useOnboardingStore.getState();

describe("useOnboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.setState({ completed: false, active: false, step: 0 });
  });

  it("starts inactive and not completed", () => {
    expect(state().active).toBe(false);
    expect(state().completed).toBe(false);
  });

  it("walks through every step and completes on the last", () => {
    state().start();
    expect(state().active).toBe(true);
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      state().next();
      expect(state().step).toBe(i);
    }
    state().next();
    expect(state()).toMatchObject({ active: false, completed: true, step: 0 });
  });

  it("back never goes below the first step", () => {
    state().start();
    state().back();
    expect(state().step).toBe(0);
    state().next();
    state().back();
    expect(state().step).toBe(0);
  });

  it("skip marks the tour completed so it is not shown again", () => {
    state().start();
    state().skip();
    expect(state()).toMatchObject({ active: false, completed: true });
  });

  it("restarting resets to the first step", () => {
    state().start();
    state().next();
    state().skip();
    state().start();
    expect(state()).toMatchObject({ active: true, step: 0 });
  });
});

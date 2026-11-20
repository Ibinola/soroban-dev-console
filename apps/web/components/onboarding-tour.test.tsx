import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { OnboardingTour } from "./onboarding-tour";
import { TOUR_STEPS, useOnboardingStore } from "@/store/useOnboardingStore";

describe("OnboardingTour", () => {
  beforeEach(() => {
    useOnboardingStore.setState({ completed: false, active: false, step: 0 });
  });

  it("starts automatically for first-time users", () => {
    render(<OnboardingTour />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(`Step 1 of ${TOUR_STEPS.length}`)).toBeInTheDocument();
  });

  it("does not show for returning users", () => {
    useOnboardingStore.setState({ completed: true });
    render(<OnboardingTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("steps forward and back, finishing on the last step", () => {
    render(<OnboardingTour />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(TOUR_STEPS[1].title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeInTheDocument();
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useOnboardingStore.getState().completed).toBe(true);
  });

  it("can be skipped", () => {
    render(<OnboardingTour />);
    fireEvent.click(screen.getByRole("button", { name: /skip tour/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useOnboardingStore.getState().completed).toBe(true);
  });
});

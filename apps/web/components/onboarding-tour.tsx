"use client";

import { useEffect } from "react";
import { Button } from "@devconsole/ui";
import { TOUR_STEPS, useOnboardingStore } from "@/store/useOnboardingStore";

/** Guided tour shown once to first-time users; can be restarted from the sidebar. */
export function OnboardingTour() {
  const { completed, active, step, start, next, back, skip } = useOnboardingStore();

  // Start automatically on a first visit (after hydration of the persisted flag).
  useEffect(() => {
    if (!completed && !active) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  if (!active) return null;
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-background p-4 shadow-lg"
    >
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Step {step + 1} of {TOUR_STEPS.length}
      </p>
      <h2 id="onboarding-title" className="text-base font-semibold">
        {current.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{current.body}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={skip}>
          Skip tour
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={back} disabled={step === 0}>
            Back
          </Button>
          <Button size="sm" onClick={next}>
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

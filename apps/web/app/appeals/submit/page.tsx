"use client";

import { AppealWorkspace, type AppealSubmission } from "@/components/appeal-workspace";
import {
  VerificationBanner,
  VerificationGate,
  type VerificationGateStatus,
} from "@/components/verification-banner";

// Placeholder — in production fetched from contributor verification API
const VERIFICATION_STATUS: VerificationGateStatus = "unverified";

async function submitAppeal(submission: AppealSubmission): Promise<void> {
  // Placeholder — wire to BE-208 appeal intake API when available
  await new Promise((resolve) => setTimeout(resolve, 800));
  console.log("Appeal submitted:", submission);
}

export default function AppealSubmitPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Submit an appeal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Provide structured evidence so your appeal can be reviewed accurately.
        </p>
      </div>
      <VerificationBanner status={VERIFICATION_STATUS} />
      <VerificationGate status={VERIFICATION_STATUS} action="submit an appeal">
        <AppealWorkspace onSubmit={submitAppeal} />
      </VerificationGate>
    </div>
  );
}

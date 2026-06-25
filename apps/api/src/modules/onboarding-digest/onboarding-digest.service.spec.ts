/**
 * AI-932: Regression coverage for OnboardingDigestService.
 */

import { OnboardingDigestService, ONBOARDING_DIGEST_MODEL_VERSION } from "./onboarding-digest.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    onboardingDigest: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("OnboardingDigestService", () => {
  it("generates a full digest for a new contributor", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new OnboardingDigestService(prisma, audit);
    await svc.generate({ contributorKey: "contributor-1" }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect((createArg.sections as any[]).length).toBeGreaterThan(0);
    expect(createArg.digestText).toContain("# Onboarding Digest");
    expect(createArg.modelVersion).toBe(ONBOARDING_DIGEST_MODEL_VERSION);
  });

  it("filters out already-completed steps", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new OnboardingDigestService(prisma, audit);
    // complete all First Steps items
    await svc.generate({
      contributorKey: "contributor-2",
      completedSteps: [
        "Fork the repository from https://github.com/Ibinola/soroban-dev-console",
        "Clone your fork: `git clone https://github.com/<your-fork>/soroban-dev-console`",
        "Install dependencies: `npm install`",
        "Copy environment files: `cp apps/api/.env.example apps/api/.env`",
        "Initialize the database: `cd apps/api && npx prisma db push`",
      ],
    }, "actor");
    const sections = (calls.upsert[0][0] as any).create.sections as any[];
    expect(sections.every((s: any) => s.heading !== "First Steps")).toBe(true);
  });

  it("digest text includes version header", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new OnboardingDigestService(prisma, audit);
    await svc.generate({ contributorKey: "contributor-3" }, "actor");
    expect((calls.upsert[0][0] as any).create.digestText).toContain("# Onboarding Digest");
  });

  it("getByContributor throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new OnboardingDigestService(prisma, audit);
    let threw = false;
    try { await svc.getByContributor("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

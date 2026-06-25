/**
 * AI-934: Regression coverage for SpecRecommenderService.
 */

import { SpecRecommenderService, SPEC_RECOMMENDER_MODEL_VERSION } from "./spec-recommender.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    specRecommendation: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("SpecRecommenderService", () => {
  it("recommends must-run specs for wave changes", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new SpecRecommenderService(prisma, audit);
    await svc.recommend(
      { changeSetId: "cs-1", changedFiles: ["apps/api/src/modules/wave/abuse-risk.service.ts"] },
      "actor",
    );
    const createArg = (calls.upsert[0][0] as any).create;
    const recs = createArg.recommendations as any[];
    expect(recs.some((r: any) => r.priority === "must-run")).toBe(true);
    expect(createArg.mustRunCount).toBeGreaterThan(0);
    expect(createArg.modelVersion).toBe(SPEC_RECOMMENDER_MODEL_VERSION);
  });

  it("recommends schema-related specs for prisma changes", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new SpecRecommenderService(prisma, audit);
    await svc.recommend(
      { changeSetId: "cs-2", changedFiles: ["apps/api/prisma/schema.prisma"] },
      "actor",
    );
    const recs = (calls.upsert[0][0] as any).create.recommendations as any[];
    expect(recs.some((r: any) => r.specPath.includes("chaos-harness"))).toBe(true);
  });

  it("skips already-present tests", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new SpecRecommenderService(prisma, audit);
    const existing = ["apps/api/src/modules/wave/coordinated-abuse-detection.service.spec.ts"];
    await svc.recommend(
      { changeSetId: "cs-3", changedFiles: ["apps/api/src/modules/wave/wave.service.ts"], existingTests: existing },
      "actor",
    );
    const recs = (calls.upsert[0][0] as any).create.recommendations as any[];
    expect(recs.every((r: any) => !existing.includes(r.specPath))).toBe(true);
  });

  it("returns empty recommendations for untracked files", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new SpecRecommenderService(prisma, audit);
    await svc.recommend(
      { changeSetId: "cs-4", changedFiles: ["scripts/deploy.sh"] },
      "actor",
    );
    expect((calls.upsert[0][0] as any).create.mustRunCount).toBe(0);
  });

  it("getByChangeSet throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new SpecRecommenderService(prisma, audit);
    let threw = false;
    try { await svc.getByChangeSet("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

/**
 * AI-929: Regression coverage for ChangeImpactService.
 */

import { ChangeImpactService, CHANGE_IMPACT_MODEL_VERSION } from "./change-impact.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    changeImpactAnalysis: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1", diffId: "diff-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("ChangeImpactService", () => {
  it("identifies high-risk schema change", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ChangeImpactService(prisma, audit);
    await svc.analyze(
      { diffId: "diff-1", changedFiles: ["apps/api/prisma/schema.prisma"] },
      "actor",
    );
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.highRiskCount).toBe(1);
    const areas = createArg.impactAreas as any[];
    expect(areas[0].riskLevel).toBe("high");
    expect(createArg.modelVersion).toBe(CHANGE_IMPACT_MODEL_VERSION);
  });

  it("identifies high-risk auth change", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ChangeImpactService(prisma, audit);
    await svc.analyze(
      { diffId: "diff-2", changedFiles: ["apps/api/src/auth/owner-key.guard.ts"] },
      "actor",
    );
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.highRiskCount).toBe(1);
  });

  it("sorts high-risk areas first", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ChangeImpactService(prisma, audit);
    await svc.analyze(
      { diffId: "diff-3", changedFiles: ["apps/api/src/modules/wave/wave.service.ts", "apps/api/prisma/schema.prisma"] },
      "actor",
    );
    const areas = (calls.upsert[0][0] as any).create.impactAreas as any[];
    expect(areas[0].riskLevel).toBe("high");
  });

  it("deduplicates files into the same area", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ChangeImpactService(prisma, audit);
    await svc.analyze(
      { diffId: "diff-4", changedFiles: ["apps/api/src/modules/wave/a.ts", "apps/api/src/modules/wave/b.ts"] },
      "actor",
    );
    const areas = (calls.upsert[0][0] as any).create.impactAreas as any[];
    const waveArea = areas.find((a: any) => a.area === "wave");
    expect(waveArea.affectedPaths.length).toBe(2);
  });

  it("getByDiff throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new ChangeImpactService(prisma, audit);
    let threw = false;
    try { await svc.getByDiff("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

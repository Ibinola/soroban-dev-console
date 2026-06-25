/**
 * AI-931: Regression coverage for AiEscalationService.
 */

import { AiEscalationService, AI_ESCALATION_MODEL_VERSION } from "./ai-escalation.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [], update: [] };
  const defaultRecord = { id: "esc-1", outputId: "out-1" };
  const prisma = {
    aiEscalation: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? defaultRecord; },
      update: async (a: unknown) => { calls.update.push([a]); return overrides.updateResult ?? defaultRecord; },
      findUnique: async () => overrides.findUniqueResult ?? defaultRecord,
      findMany: async () => overrides.findManyResult ?? [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("AiEscalationService", () => {
  it("auto-accepts high-confidence output", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new AiEscalationService(prisma, audit);
    await svc.evaluate({ outputId: "out-1", outputType: "summary", confidence: 0.9 }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.decision).toBe("auto_accept");
    expect(createArg.requiresHumanReview).toBe(false);
    expect(createArg.modelVersion).toBe(AI_ESCALATION_MODEL_VERSION);
  });

  it("escalates mid-confidence output", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new AiEscalationService(prisma, audit);
    await svc.evaluate({ outputId: "out-2", outputType: "summary", confidence: 0.5 }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.decision).toBe("escalate");
    expect(createArg.requiresHumanReview).toBe(true);
  });

  it("auto-rejects very low-confidence output", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new AiEscalationService(prisma, audit);
    await svc.evaluate({ outputId: "out-3", outputType: "summary", confidence: 0.1 }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.decision).toBe("auto_reject");
    expect(createArg.requiresHumanReview).toBe(true);
  });

  it("resolve marks escalation as resolved", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new AiEscalationService(prisma, audit);
    await svc.resolve("out-1", "reviewer", { resolution: "approved", note: "looks good" });
    const updateArg = (calls.update[0][0] as any).data;
    expect(updateArg.resolution).toBe("approved");
    expect(updateArg.resolvedBy).toBe("reviewer");
    expect(updateArg.requiresHumanReview).toBe(false);
  });

  it("resolve throws when record not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new AiEscalationService(prisma, audit);
    let threw = false;
    try { await svc.resolve("missing", "actor", { resolution: "approved" }); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

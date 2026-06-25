/**
 * AI-925: Regression coverage for ContractDiffExplainerService.
 */

import { ContractDiffExplainerService, CONTRACT_DIFF_MODEL_VERSION } from "./contract-diff-explainer.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    contractDiffExplanation: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("ContractDiffExplainerService", () => {
  it("detects breaking change when function is removed", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ContractDiffExplainerService(prisma, audit);
    await svc.explain({
      diffId: "diff-1",
      contractName: "counter",
      hunks: [{ section: "increment", before: "pub fn increment()", after: "" }],
    }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.breakingCount).toBeGreaterThan(0);
    expect(createArg.modelVersion).toBe(CONTRACT_DIFF_MODEL_VERSION);
  });

  it("marks struct change as breaking", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ContractDiffExplainerService(prisma, audit);
    await svc.explain({
      diffId: "diff-2",
      contractName: "token",
      hunks: [{ section: "State", before: "struct State { count: u32 }", after: "struct State { count: u64 }" }],
    }, "actor");
    const explanation = (calls.upsert[0][0] as any).create.explanations[0];
    expect(explanation.breakingChange).toBe(true);
  });

  it("classifies minor changes as non-breaking", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ContractDiffExplainerService(prisma, audit);
    await svc.explain({
      diffId: "diff-3",
      contractName: "counter",
      hunks: [{ section: "main", before: "// old comment", after: "// new comment" }],
    }, "actor");
    const explanation = (calls.upsert[0][0] as any).create.explanations[0];
    expect(explanation.breakingChange).toBe(false);
  });

  it("getByDiff throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new ContractDiffExplainerService(prisma, audit);
    let threw = false;
    try { await svc.getByDiff("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

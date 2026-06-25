/**
 * AI-928: Regression coverage for FixtureSynthesisService.
 */

import { FixtureSynthesisService, FIXTURE_SYNTHESIS_MODEL_VERSION } from "./fixture-synthesis.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [], findUnique: [], findMany: [] };
  const prisma = {
    fixtureSynthesisResult: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1", contextId: "ctx-1" }; },
      findUnique: async (a: unknown) => { calls.findUnique.push([a]); return overrides.findUniqueResult; },
      findMany: async () => overrides.findManyResult ?? [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("FixtureSynthesisService", () => {
  it("generates suggestions for uncovered flows", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new FixtureSynthesisService(prisma, audit);
    await svc.synthesize(
      { contextId: "ctx-1", targetFlows: ["workspace create", "rpc call"], existingFixtures: [] },
      "actor",
    );
    const createArg = (calls.upsert[0][0] as any).create;
    expect((createArg.suggestions as any[]).length).toBe(2);
    expect(createArg.modelVersion).toBe(FIXTURE_SYNTHESIS_MODEL_VERSION);
  });

  it("skips flows already covered by existing fixtures", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new FixtureSynthesisService(prisma, audit);
    await svc.synthesize(
      { contextId: "ctx-2", targetFlows: ["workspace create", "ticket open"], existingFixtures: ["workspace create"] },
      "actor",
    );
    const createArg = (calls.upsert[0][0] as any).create;
    expect((createArg.suggestions as any[]).length).toBe(1);
  });

  it("infers workspace type correctly", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new FixtureSynthesisService(prisma, audit);
    await svc.synthesize(
      { contextId: "ctx-3", targetFlows: ["workspace import"] },
      "actor",
    );
    const suggestion = (calls.upsert[0][0] as any).create.suggestions[0];
    expect(suggestion.type).toBe("workspace");
  });

  it("getByContext throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new FixtureSynthesisService(prisma, audit);
    let threw = false;
    try { await svc.getByContext("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

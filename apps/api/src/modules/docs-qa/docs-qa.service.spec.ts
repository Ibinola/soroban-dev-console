/**
 * AI-926: Regression coverage for DocsQaService.
 */

import { DocsQaService, DOCS_QA_MODEL_VERSION } from "./docs-qa.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    docsQaAnswer: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("DocsQaService", () => {
  it("answers questions about getting started", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new DocsQaService(prisma, audit);
    await svc.ask({ questionId: "q-1", question: "How do I get started and install the project?" }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.confidence).toBeGreaterThan(0);
    expect(createArg.answer).toContain("README");
    expect(createArg.modelVersion).toBe(DOCS_QA_MODEL_VERSION);
  });

  it("returns low confidence for unrecognized question", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new DocsQaService(prisma, audit);
    await svc.ask({ questionId: "q-2", question: "zzz unknown xyz" }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.confidence).toBe(0);
    expect((createArg.sources as any[]).length).toBe(0);
  });

  it("finds API module docs for backend questions", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new DocsQaService(prisma, audit);
    await svc.ask({ questionId: "q-3", question: "How do I add a new API module?" }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.confidence).toBeGreaterThan(0);
    expect((createArg.sources as any[]).some((s: any) => s.path.includes("modules"))).toBe(true);
  });

  it("getByQuestion throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new DocsQaService(prisma, audit);
    let threw = false;
    try { await svc.getByQuestion("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

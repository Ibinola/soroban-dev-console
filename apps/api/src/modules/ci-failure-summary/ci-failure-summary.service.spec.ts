/**
 * AI-923: Regression coverage for CiFailureSummaryService.
 */

import { CiFailureSummaryService, CI_SUMMARY_MODEL_VERSION } from "./ci-failure-summary.service.js";

const noop = () => {};

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [], findUnique: [], findMany: [], log: [] };
  const prisma = {
    ciFailureSummary: {
      upsert: async (args: unknown) => { calls.upsert.push([args]); return overrides.upsertResult ?? { id: "id-1", runId: "run-1" }; },
      findUnique: async (args: unknown) => { calls.findUnique.push([args]); return overrides.findUniqueResult; },
      findMany: async (args: unknown) => { calls.findMany.push([args]); return overrides.findManyResult ?? []; },
    },
  } as any;
  const audit = { log: (...a: unknown[]) => { calls.log.push(a); } } as any;
  return { prisma, audit, calls };
}

describe("CiFailureSummaryService", () => {
  it("classifies lint errors and maps next actions", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new CiFailureSummaryService(prisma, audit);
    await svc.summarize(
      { runId: "r1", repository: "org/repo", branch: "main", failedSteps: [{ name: "lint", error: "ESLint found 3 errors" }], affectedFiles: ["src/foo.ts"] },
      "actor",
    );
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.likelyCauses).toContain("Lint failure");
    expect(createArg.nextActions).toContain("Run lint locally and fix reported issues");
    expect(createArg.modelVersion).toBe(CI_SUMMARY_MODEL_VERSION);
  });

  it("classifies type-check errors", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new CiFailureSummaryService(prisma, audit);
    await svc.summarize(
      { runId: "r2", repository: "org/repo", branch: "feat/x", failedSteps: [{ name: "tc", error: "TypeScript error TS2345" }], affectedFiles: [] },
      "actor",
    );
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.likelyCauses).toContain("Type check failure");
  });

  it("deduplicates causes from multiple steps", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new CiFailureSummaryService(prisma, audit);
    await svc.summarize(
      { runId: "r3", repository: "org/repo", branch: "main", failedSteps: [{ name: "l1", error: "ESLint issue" }, { name: "l2", error: "Prettier issue" }], affectedFiles: [] },
      "actor",
    );
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.likelyCauses.length).toBe(1);
    expect(createArg.likelyCauses[0]).toBe("Lint failure");
  });

  it("calls audit.log after summarize", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new CiFailureSummaryService(prisma, audit);
    await svc.summarize(
      { runId: "r4", repository: "r", branch: "b", failedSteps: [], affectedFiles: [] },
      "actor-key",
    );
    expect(calls.log.length).toBe(1);
  });

  it("getByRunId returns record when found", async () => {
    const record = { id: "ci-5", runId: "run-5" };
    const { prisma, audit } = makeDeps({ findUniqueResult: record });
    const svc = new CiFailureSummaryService(prisma, audit);
    const result = await svc.getByRunId("run-5");
    expect(result).toBe(record);
  });

  it("getByRunId throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new CiFailureSummaryService(prisma, audit);
    let threw = false;
    try { await svc.getByRunId("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });

  it("list returns all records", async () => {
    const records = [{ id: "a" }, { id: "b" }];
    const { prisma, audit } = makeDeps({ findManyResult: records });
    const svc = new CiFailureSummaryService(prisma, audit);
    const result = await svc.list();
    expect(result).toBe(records);
  });
});

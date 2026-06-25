/**
 * AI-930: Regression coverage for WorkflowRecommenderService.
 */

import { WorkflowRecommenderService, WORKFLOW_RECOMMENDER_MODEL_VERSION } from "./workflow-recommender.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    workflowRecommendation: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1", taskId: "task-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("WorkflowRecommenderService", () => {
  it("recommends fix-and-pr for a bug fix task", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new WorkflowRecommenderService(prisma, audit);
    await svc.recommend({ taskId: "t1", taskDescription: "fix a bug in the module" }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.topWorkflow).toBe("fix-and-pr");
    expect(createArg.modelVersion).toBe(WORKFLOW_RECOMMENDER_MODEL_VERSION);
  });

  it("recommends database-migration for schema tasks", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new WorkflowRecommenderService(prisma, audit);
    await svc.recommend({ taskId: "t2", taskDescription: "add a new database model to the schema" }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.topWorkflow).toBe("database-migration");
  });

  it("recommends add-api-module for module tasks", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new WorkflowRecommenderService(prisma, audit);
    await svc.recommend({ taskId: "t3", taskDescription: "add a new NestJS module with a service and controller" }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.topWorkflow).toBe("add-api-module");
  });

  it("returns empty recommendations for unrecognized task", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new WorkflowRecommenderService(prisma, audit);
    await svc.recommend({ taskId: "t4", taskDescription: "zzz xyz unrecognized" }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect((createArg.recommendations as any[]).length).toBe(0);
    // defaults to fix-and-pr when no matches
    expect(createArg.topWorkflow).toBe("fix-and-pr");
  });

  it("getByTask throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new WorkflowRecommenderService(prisma, audit);
    let threw = false;
    try { await svc.getByTask("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

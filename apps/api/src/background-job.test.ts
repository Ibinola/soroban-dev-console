/**
 * BE-216: BackgroundJobService unit tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import { BackgroundJobService } from "./lib/background-job.service.js";

const makeJob = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "j1",
  type: "sync",
  status: "pending",
  attempts: 0,
  maxAttempts: 3,
  lastError: null,
  scheduledAt: new Date(),
  completedAt: null,
  createdAt: new Date(),
  lockedUntil: null,
  payload: {},
  updatedAt: new Date(),
  ...overrides,
});

test("BackgroundJobService: enqueues a job", async () => {
  const job = makeJob();
  const prisma = {
    backgroundJob: {
      create: async () => job,
      fields: { maxAttempts: {} },
    },
  } as any;
  const service = new BackgroundJobService(prisma);
  const result = await service.enqueue({ type: "sync", payload: { foo: "bar" } });
  assert.equal(result.type, "sync");
});

test("BackgroundJobService: returns null when no claimable job exists", async () => {
  const prisma = {
    backgroundJob: {
      findFirst: async () => null,
      fields: { maxAttempts: {} },
    },
  } as any;
  const service = new BackgroundJobService(prisma);
  const result = await service.claimNext("sync");
  assert.equal(result, null);
});

test("BackgroundJobService: returns null when another worker claims the job first", async () => {
  const prisma = {
    backgroundJob: {
      findFirst: async () => makeJob(),
      updateMany: async () => ({ count: 0 }),
      fields: { maxAttempts: {} },
    },
  } as any;
  const service = new BackgroundJobService(prisma);
  const result = await service.claimNext("sync");
  assert.equal(result, null);
});

test("BackgroundJobService: marks job as dead after max attempts", async () => {
  let updatedData: Record<string, unknown> = {};
  const prisma = {
    backgroundJob: {
      findUnique: async () => makeJob({ attempts: 3, maxAttempts: 3 }),
      update: async ({ data }: { data: Record<string, unknown> }) => { updatedData = data; return {}; },
      fields: { maxAttempts: {} },
    },
  } as any;
  const service = new BackgroundJobService(prisma);
  await service.fail("j1", "timeout");
  assert.equal(updatedData.status, "dead");
});

test("BackgroundJobService: marks job as failed when attempts < maxAttempts", async () => {
  let updatedData: Record<string, unknown> = {};
  const prisma = {
    backgroundJob: {
      findUnique: async () => makeJob({ attempts: 1, maxAttempts: 3 }),
      update: async ({ data }: { data: Record<string, unknown> }) => { updatedData = data; return {}; },
      fields: { maxAttempts: {} },
    },
  } as any;
  const service = new BackgroundJobService(prisma);
  await service.fail("j1", "network error");
  assert.equal(updatedData.status, "failed");
});

test("BackgroundJobService: returns job stats", async () => {
  const prisma = {
    backgroundJob: {
      groupBy: async () => [
        { status: "pending", _count: { id: 5 } },
        { status: "completed", _count: { id: 10 } },
      ],
      fields: { maxAttempts: {} },
    },
  } as any;
  const service = new BackgroundJobService(prisma);
  const stats = await service.getStats();
  assert.equal(stats.pending, 5);
  assert.equal(stats.completed, 10);
  assert.equal(stats.failed, 0);
});

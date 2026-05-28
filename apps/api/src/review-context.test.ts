/**
 * BE-209: ReviewContextService unit tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { ReviewContextService } from "./modules/review-context/review-context.service.js";

const baseRecord = {
  id: "rc1",
  pullRequestId: "pr-1",
  repositoryId: "repo-1",
  reviewerId: "user-1",
  decision: "approved",
  commentCount: 2,
  requestedChangesCount: 0,
  mergeStatus: "open",
  reviewedAt: new Date("2024-01-01"),
  createdAt: new Date("2024-01-01"),
};

test("ReviewContextService: records a review context", async () => {
  const prisma = {
    reviewContext: { create: async () => baseRecord },
  } as any;
  const emitted: unknown[] = [];
  const events = { emit: (_: string, p: unknown) => { emitted.push(p); return true; } } as any;
  const logged: unknown[] = [];
  const audit = { log: async (e: unknown) => { logged.push(e); } } as any;

  const service = new ReviewContextService(prisma, audit, events);
  const result = await service.record({
    pullRequestId: "pr-1",
    repositoryId: "repo-1",
    reviewerId: "user-1",
    decision: "approved",
    commentCount: 2,
    requestedChangesCount: 0,
    mergeStatus: "open",
    reviewedAt: "2024-01-01T00:00:00Z",
  });

  assert.equal(result.id, "rc1");
  assert.equal(result.decision, "approved");
  assert.equal(emitted.length, 1);
  assert.equal(logged.length, 1);
});

test("ReviewContextService: aggregates appeal context for a PR", async () => {
  const reviews = [
    { ...baseRecord, decision: "changes_requested", requestedChangesCount: 1 },
    { ...baseRecord, id: "rc2", decision: "approved", commentCount: 3 },
  ];
  const prisma = {
    reviewContext: { findMany: async () => reviews },
  } as any;
  const service = new ReviewContextService(prisma, {} as any, {} as any);
  const ctx = await service.getAppealContext("pr-1");

  assert.equal(ctx.approvalCount, 1);
  assert.equal(ctx.totalComments, 5);
  assert.equal(ctx.totalRequestedChanges, 1);
  assert.equal(ctx.reviews.length, 2);
});

test("ReviewContextService: throws NotFoundException when no reviews exist", async () => {
  const prisma = {
    reviewContext: { findMany: async () => [] },
  } as any;
  const service = new ReviewContextService(prisma, {} as any, {} as any);
  await assert.rejects(
    () => service.getAppealContext("pr-missing"),
    (err) => err instanceof NotFoundException,
  );
});

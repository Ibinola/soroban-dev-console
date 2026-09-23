import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuditService } from "./audit.service.js";

describe("audit service", () => {
  it("redacts sensitive summary and metadata before persisting", async () => {
    const calls: unknown[] = [];
    const create = async (args: unknown) => {
      calls.push(args);
    };
    const prisma = { auditLog: { create } } as never;
    const service = new AuditService(prisma);

    await service.log({
      actor: "admin",
      action: "support_view",
      resourceType: "appeal",
      resourceId: "appeal_1",
      summary: "reviewed alice@example.com from 10.0.0.8",
      metadata: {
        token: "eyJabc.def.ghi",
        nested: { secret: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" },
      },
    });

    const data = (calls[0] as { data: { summary: string; metadata: unknown } }).data;
    assert.match(data.summary, /\[REDACTED_EMAIL\]/);
    assert.match(data.summary, /\[REDACTED_IP\]/);
    assert.match(JSON.stringify(data.metadata), /\[REDACTED_TOKEN\]/);
    assert.match(JSON.stringify(data.metadata), /\[REDACTED_SECRET\]/);
  });

  it("aggregates 24-hour summary metrics across the three event categories", async () => {
    const whereCalls: unknown[] = [];
    const count = async (args: { where: unknown }) => {
      whereCalls.push(args.where);
      return whereCalls.length <= 1 ? 50 : whereCalls.length === 2 ? 3 : 12;
    };
    const prisma = { auditLog: { create: async () => {}, count } } as never;
    const service = new AuditService(prisma);

    const result = await service.summary();

    assert.equal(result.windowHours, 24);
    assert.equal(result.totalEvents, 50);
    assert.equal(result.failedAuth, 3);
    assert.equal(result.mutations, 12);

    // Windows start ~24h in the past.
    const totalWhere = whereCalls[0] as { createdAt: { gte: Date } };
    const deltaMs = Date.now() - totalWhere.createdAt.gte.getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    assert.ok(
      deltaMs > twentyFourHoursMs - 60_000 && deltaMs < twentyFourHoursMs + 60_000,
      `expected ~24h window start, got delta ${deltaMs}ms`,
    );

    // Failed-auth query narrows by the documented action set.
    const failedWhere = whereCalls[1] as { AND: Array<{ action?: { in: string[] } }> };
    const failedActions = (failedWhere.AND[1] as { action: { in: string[] } }).action.in;
    assert.ok(failedActions.includes("auth.failed"));
    assert.ok(failedActions.includes("owner_key.failed"));

    // Mutation query excludes read-only action prefixes.
    const mutationWhere = whereCalls[2] as {
      AND: Array<{ NOT?: { OR: Array<{ action: { startsWith: string } }> } }>;
    };
    const notClause = mutationWhere.AND[1] as { NOT: { OR: Array<{ action: { startsWith: string } }> } };
    const prefixes = notClause.NOT.OR.map((entry) => entry.action.startsWith);
    assert.ok(prefixes.includes("get"));
    assert.ok(prefixes.includes("resolve"));
    assert.ok(prefixes.includes("export"));
  });

  it("supports a custom summary window", async () => {
    const count = async () => 0;
    const prisma = { auditLog: { create: async () => {}, count } } as never;
    const service = new AuditService(prisma);

    const result = await service.summary(12);
    assert.equal(result.windowHours, 12);
  });
});

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

  it("prunes rows older than the configured retention days (default 30)", async () => {
    process.env.AUDIT_RETENTION_DAYS = "30";
    let deleteWhere: { createdAt: { lt: Date } } | undefined;
    const deleteMany = async (args: { where: { createdAt: { lt: Date } } }) => {
      deleteWhere = args.where;
      return { count: 11 };
    };
    const prisma = { auditLog: { create: async () => {}, deleteMany } } as never;
    const service = new AuditService(prisma);

    const result = await service.prune();

    assert.equal(result.pruned, 11);
    assert.equal(result.olderThanDays, 30);
    assert.ok(deleteWhere?.createdAt?.lt, "expected a createdAt.lt purge filter");
    const cutoff = deleteWhere!.createdAt.lt.getTime();
    const deltaMs = Date.now() - cutoff;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    assert.ok(
      deltaMs > thirtyDaysMs - 60_000 && deltaMs < thirtyDaysMs + 60_000,
      `expected ~30 day cutoff, got delta ${deltaMs}ms`,
    );
    delete process.env.AUDIT_RETENTION_DAYS;
  });

  it("prunes with an explicit olderThanDays override and correct cutoff", async () => {
    let deleteWhere: { createdAt: { lt: Date } } | undefined;
    const deleteMany = async (args: { where: { createdAt: { lt: Date } } }) => {
      deleteWhere = args.where;
      return { count: 4 };
    };
    const prisma = { auditLog: { create: async () => {}, deleteMany } } as never;
    const service = new AuditService(prisma);

    const result = await service.prune(45);

    assert.equal(result.pruned, 4);
    assert.equal(result.olderThanDays, 45);
    const cutoff = deleteWhere!.createdAt.lt.getTime();
    const deltaMs = Date.now() - cutoff;
    const fortyFiveDaysMs = 45 * 24 * 60 * 60 * 1000;
    assert.ok(
      deltaMs > fortyFiveDaysMs - 60_000 && deltaMs < fortyFiveDaysMs + 60_000,
      `expected ~45 day cutoff, got delta ${deltaMs}ms`,
    );
  });

  it("falls back to a default retention of 30 days when the env var is absent", () => {
    delete process.env.AUDIT_RETENTION_DAYS;
    const prisma = { auditLog: { create: async () => {}, deleteMany: async () => ({ count: 0 }) } } as never;
    const service = new AuditService(prisma);
    assert.equal((service as unknown as { retentionDays: number }).retentionDays, 30);
  });
});

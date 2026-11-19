import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuditService, MAX_RETENTION_DAYS, MIN_RETENTION_DAYS, parseRetentionDays } from "./audit.service.js";

function makeService() {
  const created: any[] = [];
  const deleted: any[] = [];
  const prisma = {
    auditLog: {
      create: async (args: any) => void created.push(args.data),
      findFirst: async () => null,
      deleteMany: async (args: any) => (deleted.push(args.where), { count: 0 }),
    },
  } as never;
  return { service: new AuditService(prisma), created, deleted };
}

describe("audit retention configuration (#1376)", () => {
  it("accepts only whole numbers inside the bounds", () => {
    assert.equal(parseRetentionDays(30), 30);
    assert.equal(parseRetentionDays("45"), 45);
    assert.equal(parseRetentionDays(MIN_RETENTION_DAYS), MIN_RETENTION_DAYS);
    assert.equal(parseRetentionDays(MAX_RETENTION_DAYS), MAX_RETENTION_DAYS);
    for (const bad of [0, -1, MAX_RETENTION_DAYS + 1, 1.5, "abc", "", null, undefined, NaN, Infinity, {}]) {
      assert.equal(parseRetentionDays(bad), null, String(bad));
    }
  });

  it("starts from configuration and reports its source", () => {
    const { service } = makeService();
    const settings = service.getRetentionSettings();
    assert.equal(settings.source, "configuration");
    assert.equal(settings.retentionDays, settings.configuredDays);
  });

  it("updates the effective value and records the old and new values in audit history", async () => {
    const { service, created } = makeService();
    const before = service.getRetentionDays();
    const result = await service.setRetentionDays(90, "ops-admin");
    assert.equal(result?.retentionDays, 90);
    assert.equal(result?.source, "runtime");
    assert.equal(service.getRetentionDays(), 90);
    assert.equal(created.length, 1);
    assert.equal(created[0].action, "audit.retention.changed");
    assert.equal(created[0].actor, "ops-admin");
    assert.deepEqual(created[0].metadata, { oldDays: before, newDays: 90 });
  });

  it("rejects an out-of-bounds value without changing anything or writing history", async () => {
    const { service, created } = makeService();
    const before = service.getRetentionDays();
    assert.equal(await service.setRetentionDays(0), null);
    assert.equal(await service.setRetentionDays(MAX_RETENTION_DAYS + 1), null);
    assert.equal(service.getRetentionDays(), before);
    assert.equal(created.length, 0);
  });

  it("makes scheduled pruning use the effective runtime value", async () => {
    const { service, deleted } = makeService();
    await service.setRetentionDays(10);
    const before = Date.now();
    await service.handleScheduledPrune();
    const cutoff: Date = deleted[0].createdAt.lt;
    const days = (before - cutoff.getTime()) / 86_400_000;
    assert.ok(Math.abs(days - 10) < 0.01, `cutoff was ${days} days ago`);
  });
});

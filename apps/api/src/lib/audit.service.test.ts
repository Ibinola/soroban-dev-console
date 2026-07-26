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
});

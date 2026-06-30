import assert from "node:assert/strict";
import test from "node:test";
import { AuditController } from "./audit.controller.js";
import type { AuditService } from "../../lib/audit.service.js";

test("AuditController routes query parameters to service correctly", async () => {
  let capturedQuery: any;

  const mockService = {
    query: async (q: any) => {
      capturedQuery = q;
      return {
        data: [{ id: "1", action: "test" }],
        pagination: { total: 1, skip: q.skip || 0, take: q.take || 50 },
      };
    },
  } as unknown as AuditService;

  const controller = new AuditController(mockService);
  
  const result = await controller.getAuditLogs({ 
    actor: "user-1",
    action: "create",
    resourceType: "workspace",
    resourceId: "ws-1",
    skip: 10, 
    take: 20 
  });

  assert.deepEqual(capturedQuery, {
    actor: "user-1",
    action: "create",
    resourceType: "workspace",
    resourceId: "ws-1",
    skip: 10,
    take: 20,
  });

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, "1");
  assert.equal(result.pagination.total, 1);
});

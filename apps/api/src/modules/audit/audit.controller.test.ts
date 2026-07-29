import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { AuditController } from "./audit.controller.js";
import { ListAuditDto } from "./audit.dto.js";
import type { AuditService } from "../../lib/audit.service.js";

test("AuditController routes query parameters to service correctly", async () => {
  let capturedQuery: any;

  const mockService = {
    query: async (q: any) => {
      capturedQuery = q;
      return {
        data: [{ id: "1", action: "test" }],
        pagination: { total: 1, skip: q.skip || 0, take: q.take || 50, hasMore: false },
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
    take: 20,
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

test("AuditController response includes the full pagination shape", async () => {
  const mockService = {
    query: async () => ({
      data: [],
      pagination: { total: 0, skip: 0, take: 50, hasMore: false },
    }),
  } as unknown as AuditService;

  const controller = new AuditController(mockService);
  const result = await controller.getAuditLogs({});

  assert.ok("data" in result);
  assert.ok("pagination" in result);
  assert.ok("total" in result.pagination);
  assert.ok("skip" in result.pagination);
  assert.ok("take" in result.pagination);
  assert.ok("hasMore" in result.pagination);
});

test("AuditController forwards createdAfter and createdBefore to the service", async () => {
  let capturedQuery: any;

  const mockService = {
    query: async (q: any) => {
      capturedQuery = q;
      return { data: [], pagination: { total: 0, skip: 0, take: 50, hasMore: false } };
    },
  } as unknown as AuditService;

  const controller = new AuditController(mockService);

  await controller.getAuditLogs({
    createdAfter: "2026-01-01T00:00:00.000Z",
    createdBefore: "2026-01-31T23:59:59.000Z",
  });

  assert.equal(capturedQuery.createdAfter, "2026-01-01T00:00:00.000Z");
  assert.equal(capturedQuery.createdBefore, "2026-01-31T23:59:59.000Z");
});

test("ListAuditDto rejects a take value above the 100 cap", async () => {
  const dto = plainToInstance(ListAuditDto, { take: 101 });
  const errors = await validate(dto);

  const takeError = errors.find((error) => error.property === "take");
  assert.ok(takeError, "expected a validation error on 'take'");
  assert.ok(takeError?.constraints?.max, "expected a 'max' constraint violation");
});

test("ListAuditDto accepts a take value at the 100 cap", async () => {
  const dto = plainToInstance(ListAuditDto, { take: 100 });
  const errors = await validate(dto);

  const takeError = errors.find((error) => error.property === "take");
  assert.equal(takeError, undefined);
});
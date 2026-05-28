/**
 * BE-206: VerificationService unit tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import { VerificationService } from "./modules/verification/verification.service.js";

test("VerificationService: ingests a new verification event", async () => {
  const record = {
    id: "v1",
    eventId: "evt-1",
    contributorId: "c1",
    provider: "github",
    status: "verified",
    processedAt: new Date("2024-01-01"),
  };
  const prisma = {
    verificationEvent: {
      findUnique: async () => null,
      create: async () => record,
    },
  } as any;
  const emitted: unknown[] = [];
  const events = { emit: (_: string, p: unknown) => { emitted.push(p); return true; } } as any;
  const logged: unknown[] = [];
  const audit = { log: async (e: unknown) => { logged.push(e); } } as any;

  const service = new VerificationService(prisma, audit, events);
  const result = await service.ingest({
    eventId: "evt-1",
    contributorId: "c1",
    provider: "github",
    status: "verified",
  });

  assert.equal(result.eventId, "evt-1");
  assert.equal(result.status, "verified");
  assert.equal(emitted.length, 1);
  assert.equal(logged.length, 1);
});

test("VerificationService: is idempotent for duplicate eventId", async () => {
  const existing = {
    id: "v1",
    eventId: "evt-1",
    contributorId: "c1",
    provider: "github",
    status: "verified",
    processedAt: new Date("2024-01-01"),
  };
  let createCalled = false;
  const prisma = {
    verificationEvent: {
      findUnique: async () => existing,
      create: async () => { createCalled = true; return existing; },
    },
  } as any;
  const emitted: unknown[] = [];
  const events = { emit: (_: string, p: unknown) => { emitted.push(p); return true; } } as any;
  const audit = { log: async () => {} } as any;

  const service = new VerificationService(prisma, audit, events);
  const result = await service.ingest({
    eventId: "evt-1",
    contributorId: "c1",
    provider: "github",
    status: "verified",
  });

  assert.equal(result.id, "v1");
  assert.equal(createCalled, false);
  assert.equal(emitted.length, 0);
});

test("VerificationService: returns events for a contributor", async () => {
  const records = [
    { id: "v1", eventId: "e1", contributorId: "c1", provider: "github", status: "verified", processedAt: new Date() },
  ];
  const prisma = {
    verificationEvent: {
      findMany: async () => records,
    },
  } as any;
  const service = new VerificationService(prisma, {} as any, {} as any);
  const results = await service.findByContributor("c1");
  assert.equal(results.length, 1);
  assert.equal(results[0].contributorId, "c1");
});

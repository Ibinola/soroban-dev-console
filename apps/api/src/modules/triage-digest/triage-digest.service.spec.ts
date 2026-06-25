/**
 * AI-933: Regression coverage for TriageDigestService.
 */

import { TriageDigestService, TRIAGE_DIGEST_MODEL_VERSION } from "./triage-digest.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    triageDigest: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("TriageDigestService", () => {
  it("classifies blocked issues into Blocked highlight", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new TriageDigestService(prisma, audit);
    await svc.generate({
      digestId: "d-1",
      issues: [{ number: 1, title: "blocked issue", state: "blocked", ageHours: 10 }],
    }, "actor");
    const highlights = (calls.upsert[0][0] as any).create.highlights as any[];
    expect(highlights.some((h: any) => h.category === "Blocked")).toBe(true);
    expect((calls.upsert[0][0] as any).create.actionableCount).toBeGreaterThan(0);
    expect((calls.upsert[0][0] as any).create.modelVersion).toBe(TRIAGE_DIGEST_MODEL_VERSION);
  });

  it("classifies stale open issues over threshold", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new TriageDigestService(prisma, audit);
    await svc.generate({
      digestId: "d-2",
      issues: [{ number: 2, title: "old issue", state: "open", ageHours: 100 }],
      staleThresholdHours: 72,
    }, "actor");
    const highlights = (calls.upsert[0][0] as any).create.highlights as any[];
    expect(highlights.some((h: any) => h.category.includes("Stale"))).toBe(true);
  });

  it("empty digest text when no actionable items", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new TriageDigestService(prisma, audit);
    await svc.generate({
      digestId: "d-3",
      issues: [{ number: 3, title: "recent open", state: "open", ageHours: 1 }],
      staleThresholdHours: 72,
    }, "actor");
    expect((calls.upsert[0][0] as any).create.actionableCount).toBe(0);
    expect((calls.upsert[0][0] as any).create.digestText).toContain("# Maintainer Triage Digest");
  });

  it("getByDigestId throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new TriageDigestService(prisma, audit);
    let threw = false;
    try { await svc.getByDigestId("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

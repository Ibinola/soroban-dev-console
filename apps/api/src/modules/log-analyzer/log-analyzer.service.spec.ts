/**
 * AI-927: Regression coverage for LogAnalyzerService.
 */

import { LogAnalyzerService, LOG_ANALYZER_MODEL_VERSION } from "./log-analyzer.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    logAnalysisResult: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("LogAnalyzerService", () => {
  it("identifies error theme from error lines", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new LogAnalyzerService(prisma, audit);
    await svc.analyze({
      sessionId: "s-1", source: "api",
      logLines: ["[ERROR] Something failed badly", "[INFO] Server started"],
    }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    const themes = createArg.themes as any[];
    expect(themes.some((t: any) => t.theme === "Error")).toBe(true);
    expect(createArg.errorCount).toBeGreaterThan(0);
    expect(createArg.modelVersion).toBe(LOG_ANALYZER_MODEL_VERSION);
  });

  it("identifies timeout theme", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new LogAnalyzerService(prisma, audit);
    await svc.analyze({
      sessionId: "s-2", source: "api",
      logLines: ["Request timed out after 30s"],
    }, "actor");
    const themes = (calls.upsert[0][0] as any).create.themes as any[];
    expect(themes.some((t: any) => t.theme === "Timeout")).toBe(true);
  });

  it("correlates auth failure with rpc activity", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new LogAnalyzerService(prisma, audit);
    await svc.analyze({
      sessionId: "s-3", source: "api",
      logLines: ["[ERROR] Unauthorized - 401", "[INFO] RPC call to soroban endpoint"],
    }, "actor");
    const events = (calls.upsert[0][0] as any).create.correlatedEvents as any[];
    expect(events.some((e: any) => e.eventA === "AuthFailure")).toBe(true);
  });

  it("counts lines correctly", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new LogAnalyzerService(prisma, audit);
    const lines = ["line1", "line2", "line3"];
    await svc.analyze({ sessionId: "s-4", source: "test", logLines: lines }, "actor");
    expect((calls.upsert[0][0] as any).create.lineCount).toBe(3);
  });

  it("getBySession throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new LogAnalyzerService(prisma, audit);
    let threw = false;
    try { await svc.getBySession("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

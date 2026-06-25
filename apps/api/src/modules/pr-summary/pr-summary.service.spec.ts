import { NotFoundException } from "@nestjs/common";
import { PrSummaryService } from "./pr-summary.service.js";

const mockPrisma = {
  prDraftSummary: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};
const mockAudit = { log: jest.fn() };

function makeService() {
  return new (PrSummaryService as any)(mockPrisma, mockAudit);
}

describe("PrSummaryService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("generate creates a summary with correct text", async () => {
    const record = {
      id: "s1",
      pullRequestId: "pr-42",
      summaryText: "PR pr-42 merged by alice on 2024-01-15. Changed 3 files (+10/-5 lines). No unsupported claims.",
    };
    mockPrisma.prDraftSummary.upsert.mockResolvedValue(record);

    const svc = makeService();
    const result = await svc.generate(
      { pullRequestId: "pr-42", mergedAt: "2024-01-15T00:00:00Z", authorKey: "alice", diffStats: { added: 10, removed: 5, changedFiles: 3 } },
      "actor-key",
    );

    expect(result.summaryText).toContain("PR pr-42");
    expect(result.summaryText).toContain("alice");
    expect(mockPrisma.prDraftSummary.upsert).toHaveBeenCalledTimes(1);
  });

  it("getByPr returns the summary record", async () => {
    const record = { id: "s1", pullRequestId: "pr-42" };
    mockPrisma.prDraftSummary.findUnique.mockResolvedValue(record);

    const svc = makeService();
    const result = await svc.getByPr("pr-42");
    expect(result).toEqual(record);
  });

  it("getByPr throws NotFoundException when not found", async () => {
    mockPrisma.prDraftSummary.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(svc.getByPr("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("list returns array of summaries", async () => {
    const records = [{ id: "s1" }, { id: "s2" }];
    mockPrisma.prDraftSummary.findMany.mockResolvedValue(records);

    const svc = makeService();
    const result = await svc.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });
});

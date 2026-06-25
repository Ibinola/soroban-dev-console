import { NotFoundException } from "@nestjs/common";
import { TestCaseSuggesterService } from "./test-case-suggester.service.js";

const mockPrisma = {
  testCaseSuggestion: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};
const mockAudit = { log: jest.fn() };

function makeService() {
  return new (TestCaseSuggesterService as any)(mockPrisma, mockAudit);
}

describe("TestCaseSuggesterService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("suggest creates test case suggestions for changed files", async () => {
    const record = {
      id: "t1",
      pullRequestId: "pr-10",
      suggestions: [
        { description: "Unit test for foo.service.ts", targetFile: "foo.service.spec.ts", testType: "unit" },
      ],
    };
    mockPrisma.testCaseSuggestion.create.mockResolvedValue(record);

    const svc = makeService();
    const result = await svc.suggest(
      { pullRequestId: "pr-10", changedFiles: ["src/foo.service.ts", "src/bar.controller.ts"] },
      "actor-key",
    );

    expect(result).toEqual(record);
    expect(mockPrisma.testCaseSuggestion.create).toHaveBeenCalledTimes(1);
  });

  it("getByPr returns the most recent suggestion for a PR", async () => {
    const record = { id: "t1", pullRequestId: "pr-10" };
    mockPrisma.testCaseSuggestion.findFirst.mockResolvedValue(record);

    const svc = makeService();
    const result = await svc.getByPr("pr-10");
    expect(result).toEqual(record);
  });

  it("getByPr throws NotFoundException when not found", async () => {
    mockPrisma.testCaseSuggestion.findFirst.mockResolvedValue(null);

    const svc = makeService();
    await expect(svc.getByPr("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("list returns array of suggestions", async () => {
    const records = [{ id: "t1" }, { id: "t2" }];
    mockPrisma.testCaseSuggestion.findMany.mockResolvedValue(records);

    const svc = makeService();
    const result = await svc.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });
});

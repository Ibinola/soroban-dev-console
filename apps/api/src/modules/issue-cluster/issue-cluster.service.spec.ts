import { NotFoundException } from "@nestjs/common";
import { IssueClusterService } from "./issue-cluster.service.js";

const mockPrisma = {
  issueCluster: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};
const mockAudit = { log: jest.fn() };

function makeService() {
  return new (IssueClusterService as any)(mockPrisma, mockAudit);
}

describe("IssueClusterService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("cluster creates an issue cluster record", async () => {
    const record = { id: "c1", clusterKey: "auth:issue-1,issue-2", theme: "auth" };
    mockPrisma.issueCluster.upsert.mockResolvedValue(record);

    const svc = makeService();
    const result = await svc.cluster(
      { issueRefs: ["issue-1", "issue-2"], theme: "auth" },
      "actor-key",
    );

    expect(result).toEqual(record);
    expect(mockPrisma.issueCluster.upsert).toHaveBeenCalledTimes(1);
  });

  it("getCluster returns the cluster", async () => {
    const record = { id: "c1", clusterKey: "auth:issue-1" };
    mockPrisma.issueCluster.findUnique.mockResolvedValue(record);

    const svc = makeService();
    const result = await svc.getCluster("auth:issue-1");
    expect(result).toEqual(record);
  });

  it("getCluster throws NotFoundException when not found", async () => {
    mockPrisma.issueCluster.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(svc.getCluster("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("list returns array of clusters", async () => {
    const records = [{ id: "c1" }, { id: "c2" }];
    mockPrisma.issueCluster.findMany.mockResolvedValue(records);

    const svc = makeService();
    const result = await svc.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });
});

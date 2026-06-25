import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { FeedbackTaggerService, TagFeedbackDto, FEEDBACK_TAGGER_MODEL_VERSION } from "./feedback-tagger.service.js";

class MockPrisma {
  feedbackTagBatch = {
    upsert: async (args: unknown) => ({ id: "batch-1", ...args }),
    findUnique: async () => null,
    findMany: async () => [],
  };
}

class MockAudit {
  public logs: unknown[] = [];
  async log(entry: unknown) {
    this.logs.push(entry);
  }
}

describe("FeedbackTaggerService", () => {
  let service: FeedbackTaggerService;
  let prisma: MockPrisma;
  let audit: MockAudit;

  beforeEach(() => {
    prisma = new MockPrisma();
    audit = new MockAudit();
    service = new FeedbackTaggerService(prisma as never, audit as never);
  });

  it("tags feedback items and returns an upsert record", async () => {
    const dto: TagFeedbackDto = {
      batchId: "batch-1",
      feedbackItems: ["The UI is confusing", "Please add dark mode"],
      context: "release feedback",
    };

    const result = await service.tag(dto, "owner-key-123");

    assert.equal(result.id, "batch-1");
    assert.equal(result.batchId, dto.batchId);
  });

  it("lists batches", async () => {
    const items = await service.list();
    assert.deepEqual(items, []);
  });
});

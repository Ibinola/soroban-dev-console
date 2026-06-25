import {
  CoordinatedAbuseDetectionService,
  AbuseEvent,
} from "./coordinated-abuse-detection.service.js";

const now = new Date().toISOString();

function makeEvent(
  contributorId: string,
  issueRef: string,
  kind: AbuseEvent["kind"] = "appeal_submitted",
  metadata?: Record<string, unknown>,
): AbuseEvent {
  return { contributorId, issueRef, kind, occurredAt: now, metadata };
}

describe("CoordinatedAbuseDetectionService", () => {
  let svc: CoordinatedAbuseDetectionService;

  beforeEach(() => {
    svc = new CoordinatedAbuseDetectionService();
  });

  it("returns low risk and empty patterns for clean events", () => {
    const events = [makeEvent("c1", "issue-1"), makeEvent("c2", "issue-2")];
    const report = svc.analyse(events);
    expect(report.overallRisk).toBe("low");
    expect(report.patterns).toHaveLength(0);
    expect(report.requiresHumanReview).toBe(false);
  });

  describe("VELOCITY_CLUSTER", () => {
    it("fires when a contributor exceeds the event velocity limit", () => {
      const events = Array.from({ length: 11 }, (_, i) =>
        makeEvent("spammer", `issue-${i}`, "issue_claimed"),
      );
      const report = svc.analyse(events, { velocityEventLimit: 10 });
      const p = report.patterns.find((x) => x.kind === "VELOCITY_CLUSTER");
      expect(p).toBeDefined();
      expect(p!.contributorIds).toContain("spammer");
      expect(report.requiresHumanReview).toBe(true);
    });
  });

  describe("APPEAL_FLOODING", () => {
    it("fires when a contributor submits too many appeals", () => {
      const events = Array.from({ length: 6 }, (_, i) =>
        makeEvent("flooder", `issue-${i}`, "appeal_submitted"),
      );
      const report = svc.analyse(events, { appealFloodLimit: 5 });
      const p = report.patterns.find((x) => x.kind === "APPEAL_FLOODING");
      expect(p).toBeDefined();
      expect(report.requiresHumanReview).toBe(true);
    });
  });

  describe("ISSUE_FARMING", () => {
    it("fires when too many contributors claim the same issue", () => {
      const events = ["c1", "c2", "c3", "c4"].map((c) =>
        makeEvent(c, "hot-issue", "issue_claimed"),
      );
      const report = svc.analyse(events, { issueFarmingContributorLimit: 4 });
      const p = report.patterns.find((x) => x.kind === "ISSUE_FARMING");
      expect(p).toBeDefined();
      expect(p!.issueRefs).toContain("hot-issue");
    });
  });

  describe("SHARED_METADATA", () => {
    it("fires when 3+ contributors share the same metadata value", () => {
      const events = ["c1", "c2", "c3"].map((c) =>
        makeEvent(c, `issue-${c}`, "contributor_registered", { ipHash: "abc123" }),
      );
      const report = svc.analyse(events);
      const p = report.patterns.find((x) => x.kind === "SHARED_METADATA");
      expect(p).toBeDefined();
      expect(p!.contributorIds).toHaveLength(3);
    });

    it("does not fire when fewer than 3 contributors share metadata", () => {
      const events = ["c1", "c2"].map((c) =>
        makeEvent(c, `issue-${c}`, "contributor_registered", { ipHash: "abc123" }),
      );
      const report = svc.analyse(events);
      expect(report.patterns.find((x) => x.kind === "SHARED_METADATA")).toBeUndefined();
    });
  });

  it("reports analysedEventCount accurately", () => {
    const events = [makeEvent("c1", "i1"), makeEvent("c2", "i2"), makeEvent("c3", "i3")];
    const report = svc.analyse(events);
    expect(report.analysedEventCount).toBe(3);
  });

  it("never modifies the input events array", () => {
    const events = [makeEvent("c1", "i1")];
    const original = JSON.stringify(events);
    svc.analyse(events);
    expect(JSON.stringify(events)).toBe(original);
  });
});

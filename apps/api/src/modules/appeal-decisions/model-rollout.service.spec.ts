import { ModelRolloutService } from "./model-rollout.service.js";

describe("ModelRolloutService", () => {
  let svc: ModelRolloutService;

  beforeEach(() => {
    svc = new ModelRolloutService();
  });

  describe("pinned mode", () => {
    it("always routes to stableVersion", () => {
      svc.setRollout({ activeVersion: "v2", stableVersion: "v1", mode: "pinned" });
      const r = svc.resolveModel("any-request-id");
      expect(r.modelVersion).toBe("v1");
      expect(r.mode).toBe("pinned");
    });
  });

  describe("full mode", () => {
    it("always routes to activeVersion", () => {
      svc.setRollout({ activeVersion: "v2", stableVersion: "v1", mode: "full" });
      const r = svc.resolveModel("any-request-id");
      expect(r.modelVersion).toBe("v2");
    });
  });

  describe("canary mode", () => {
    it("routes 0% canary to stable every time", () => {
      svc.setRollout({ activeVersion: "v2", stableVersion: "v1", mode: "canary", canaryPercent: 0 });
      for (let i = 0; i < 20; i++) {
        expect(svc.resolveModel(`id-${i}`).modelVersion).toBe("v1");
      }
    });

    it("routes 100% canary to active every time", () => {
      svc.setRollout({ activeVersion: "v2", stableVersion: "v1", mode: "canary", canaryPercent: 100 });
      for (let i = 0; i < 20; i++) {
        expect(svc.resolveModel(`id-${i}`).modelVersion).toBe("v2");
      }
    });

    it("is deterministic — same requestId yields same routing", () => {
      svc.setRollout({ activeVersion: "v2", stableVersion: "v1", mode: "canary", canaryPercent: 50 });
      const first = svc.resolveModel("stable-request-id");
      const second = svc.resolveModel("stable-request-id");
      expect(first.modelVersion).toBe(second.modelVersion);
    });
  });

  describe("rollback", () => {
    it("restores the previous config", () => {
      svc.setRollout({ activeVersion: "v2", stableVersion: "v1", mode: "full" });
      svc.rollback();
      const r = svc.resolveModel("x");
      // should be back to default (pinned to v1)
      expect(r.modelVersion).toBe("v1");
      expect(r.mode).toBe("pinned");
    });

    it("is a no-op when there is no previous config", () => {
      const before = svc.getState();
      svc.rollback();
      const after = svc.getState();
      expect(after.current).toEqual(before.current);
    });

    it("clears previous after rollback (single-level undo)", () => {
      svc.setRollout({ activeVersion: "v2", stableVersion: "v1", mode: "full" });
      svc.rollback();
      expect(svc.getState().previous).toBeNull();
    });
  });

  describe("getState", () => {
    it("exposes current and previous configs", () => {
      svc.setRollout({ activeVersion: "v2", stableVersion: "v1", mode: "full" });
      const state = svc.getState();
      expect(state.current.mode).toBe("full");
      expect(state.previous!.mode).toBe("pinned");
    });
  });
});

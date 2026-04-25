import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "./modules/health/health.controller.js";
import type { NetworkHealthService } from "./modules/health/network-health.service.js";

test("health controller returns ok status", () => {
  const networkHealthStub = {
    getAllHealth: async () => [],
    getHealth: async () => ({
      network: "testnet",
      status: "healthy" as const,
      latestLedger: 0,
      latencyMs: 0,
      checkedAt: Date.now(),
    }),
  } satisfies Pick<NetworkHealthService, "getAllHealth" | "getHealth">;

  const controller = new HealthController(
    networkHealthStub as unknown as NetworkHealthService,
  );
  const result = controller.getHealth();

  assert.equal(result.ok, true);
  assert.equal(result.service, "api");
  assert.ok(result.timestamp);
});

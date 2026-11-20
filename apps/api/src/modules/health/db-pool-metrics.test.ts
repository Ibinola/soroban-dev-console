import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePrometheusPoolMetrics } from "./db-pool-metrics.service.js";

describe("database pool metrics", () => {
  const observedAt = "2026-01-01T00:00:00.000Z";

  it("reads bounded pool counters without labels", () => {
    const metrics = parsePrometheusPoolMetrics(
      [
        "# HELP prisma_pool_connections_busy Busy connections",
        "prisma_pool_connections_busy 3",
        "prisma_pool_connections_idle 7",
        "prisma_pool_connections_waiting 1",
      ].join("\n"),
      observedAt,
    );

    assert.equal(metrics.supported, true);
    assert.equal(metrics.available, true);
    assert.equal(metrics.active, 3);
    assert.equal(metrics.idle, 7);
    assert.equal(metrics.waiting, 1);
    assert.equal(metrics.observedAt, observedAt);
  });

  it("ignores labelled series and negative values", () => {
    const metrics = parsePrometheusPoolMetrics(
      [
        'prisma_pool_connections_busy{workspace_id="ws_1"} 99',
        "prisma_pool_connections_idle -5",
      ].join("\n"),
      observedAt,
    );

    assert.equal(metrics.active, 0);
    assert.equal(metrics.idle, 0);
    assert.equal(metrics.waiting, 0);
  });
});

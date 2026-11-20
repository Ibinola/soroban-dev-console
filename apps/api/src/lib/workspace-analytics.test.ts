import assert from "node:assert/strict";
import test from "node:test";

import { TtlCache, aggregateWorkspaceAnalytics } from "./workspace-analytics.js";

const NOW = new Date("2026-03-15T12:00:00Z");
const d = (s: string) => new Date(s);

const workspaces = [
  { id: "a", createdAt: d("2026-03-01T10:00:00Z"), updatedAt: d("2026-03-14T10:00:00Z") },
  { id: "b", createdAt: d("2026-03-01T18:00:00Z"), updatedAt: d("2026-03-02T10:00:00Z") },
  { id: "c", createdAt: d("2026-03-10T10:00:00Z"), updatedAt: d("2026-03-10T10:00:00Z") },
];
const interactions = [
  { workspaceId: "b", functionName: "transfer", createdAt: d("2026-03-14T08:00:00Z") },
  { workspaceId: "a", functionName: "transfer", createdAt: d("2026-03-05T08:00:00Z") },
  { workspaceId: "a", functionName: "balance", createdAt: d("2026-03-06T08:00:00Z") },
];

test("totals, creation trend and active workspaces (7-day window)", () => {
  const r = aggregateWorkspaceAnalytics(workspaces, interactions, {}, NOW);
  assert.equal(r.totalWorkspaces, 3);
  assert.equal(r.totalInvocations, 3);
  // a (updated 03-14) and b (invoked 03-14) are active; c (03-10) is within 7 days too.
  assert.equal(r.activeWorkspaces, 3);
  assert.deepEqual(r.creationTrend, [
    { date: "2026-03-01", count: 2 },
    { date: "2026-03-10", count: 1 },
  ]);
});

test("popular methods are ranked by invocation count", () => {
  const r = aggregateWorkspaceAnalytics(workspaces, interactions, {}, NOW);
  assert.deepEqual(r.popularMethods, [
    { method: "transfer", invocations: 2 },
    { method: "balance", invocations: 1 },
  ]);
});

test("only the top 10 methods are returned", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({
    workspaceId: "a",
    functionName: `m${String(i).padStart(2, "0")}`,
    createdAt: d("2026-03-14T00:00:00Z"),
  }));
  assert.equal(aggregateWorkspaceAnalytics(workspaces, many, {}, NOW).popularMethods.length, 10);
});

test("results are filterable by date range", () => {
  const r = aggregateWorkspaceAnalytics(
    workspaces,
    interactions,
    { from: d("2026-03-05T00:00:00Z"), to: d("2026-03-11T00:00:00Z") },
    NOW,
  );
  assert.equal(r.totalWorkspaces, 1); // only "c" was created in range
  assert.equal(r.totalInvocations, 2);
  assert.deepEqual(r.creationTrend, [{ date: "2026-03-10", count: 1 }]);
});

test("cache serves repeats for 5 minutes then recomputes", async () => {
  let t = 0;
  const cache = new TtlCache<number>(300_000, () => t);
  let calls = 0;
  const compute = async () => ++calls;
  assert.equal(await cache.getOrCompute("k", compute), 1);
  t = 299_999;
  assert.equal(await cache.getOrCompute("k", compute), 1);
  t = 300_000;
  assert.equal(await cache.getOrCompute("k", compute), 2);
  assert.equal(await cache.getOrCompute("other", compute), 3);
});

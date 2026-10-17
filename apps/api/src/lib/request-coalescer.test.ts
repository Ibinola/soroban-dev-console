import assert from "node:assert/strict";
import test from "node:test";

import { RequestCoalescer, isCoalescible } from "./request-coalescer.js";

test("concurrent identical calls share one upstream request", async () => {
  const c = new RequestCoalescer();
  let upstream = 0;
  const fn = async () => {
    upstream++;
    await new Promise((r) => setTimeout(r, 10));
    return { ok: upstream };
  };
  const key = RequestCoalescer.buildKey("testnet", "getLedgerEntries", { keys: ["a"] });
  const [a, b, d] = await Promise.all([c.run(key, fn), c.run(key, fn), c.run(key, fn)]);
  assert.equal(upstream, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(b, d);
  assert.deepEqual(c.stats(), { hits: 2, misses: 1, hitRate: 2 / 3, inFlight: 0 });
});

test("a settled call is not reused by later callers", async () => {
  const c = new RequestCoalescer();
  let upstream = 0;
  const fn = async () => ++upstream;
  const key = RequestCoalescer.buildKey("testnet", "getHealth", undefined);
  await c.run(key, fn);
  await c.run(key, fn);
  assert.equal(upstream, 2);
});

test("key identity depends on method, network and params, not key order", () => {
  const a = RequestCoalescer.buildKey("testnet", "getEvents", { a: 1, b: { x: 1, y: 2 } });
  const b = RequestCoalescer.buildKey("testnet", "getEvents", { b: { y: 2, x: 1 }, a: 1 });
  assert.equal(a, b);
  assert.notEqual(a, RequestCoalescer.buildKey("testnet", "getEvents", { a: 2 }));
  assert.notEqual(a, RequestCoalescer.buildKey("mainnet", "getEvents", { a: 1, b: { x: 1, y: 2 } }));
  assert.notEqual(a, RequestCoalescer.buildKey("testnet", "getTransaction", { a: 1, b: { x: 1, y: 2 } }));
});

test("failures are shared with concurrent callers and then cleared", async () => {
  const c = new RequestCoalescer();
  const fn = async () => {
    await new Promise((r) => setTimeout(r, 5));
    throw new Error("upstream down");
  };
  const key = "k";
  const results = await Promise.allSettled([c.run(key, fn), c.run(key, fn)]);
  assert.deepEqual(results.map((r) => r.status), ["rejected", "rejected"]);
  assert.equal(c.stats().inFlight, 0);
});

test("only read-only methods are coalescible", () => {
  assert.equal(isCoalescible("getLedgerEntries"), true);
  assert.equal(isCoalescible("simulateTransaction"), true);
  assert.equal(isCoalescible("sendTransaction"), false);
  assert.equal(isCoalescible("unknownMethod"), false);
});

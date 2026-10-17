import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreakerRegistry } from "./circuit-breaker.js";

function setup() {
  let t = 1_000;
  const reg = new CircuitBreakerRegistry({ failureThreshold: 5, cooldownMs: 30_000 }, () => t);
  return { reg, advance: (ms: number) => (t += ms) };
}

test("opens after 5 consecutive failures and then fast-fails", () => {
  const { reg } = setup();
  for (let i = 0; i < 4; i++) {
    assert.equal(reg.canRequest("rpc-a"), true);
    reg.recordFailure("rpc-a");
  }
  assert.equal(reg.getState("rpc-a"), "closed");
  reg.recordFailure("rpc-a");
  assert.equal(reg.getState("rpc-a"), "open");
  assert.equal(reg.canRequest("rpc-a"), false);
});

test("a success resets the consecutive failure count", () => {
  const { reg } = setup();
  for (let i = 0; i < 4; i++) reg.recordFailure("rpc-a");
  reg.recordSuccess("rpc-a");
  for (let i = 0; i < 4; i++) reg.recordFailure("rpc-a");
  assert.equal(reg.getState("rpc-a"), "closed");
});

test("half-opens after the cooldown and allows exactly one test request", () => {
  const { reg, advance } = setup();
  for (let i = 0; i < 5; i++) reg.recordFailure("rpc-a");
  advance(29_999);
  assert.equal(reg.canRequest("rpc-a"), false);
  advance(1);
  assert.equal(reg.getState("rpc-a"), "half-open");
  assert.equal(reg.canRequest("rpc-a"), true);
  assert.equal(reg.canRequest("rpc-a"), false);
});

test("a successful test request closes the circuit", () => {
  const { reg, advance } = setup();
  for (let i = 0; i < 5; i++) reg.recordFailure("rpc-a");
  advance(30_000);
  assert.equal(reg.canRequest("rpc-a"), true);
  reg.recordSuccess("rpc-a");
  assert.equal(reg.getState("rpc-a"), "closed");
  assert.equal(reg.canRequest("rpc-a"), true);
});

test("a failed test request re-opens the circuit for a full cooldown", () => {
  const { reg, advance } = setup();
  for (let i = 0; i < 5; i++) reg.recordFailure("rpc-a");
  advance(30_000);
  assert.equal(reg.canRequest("rpc-a"), true);
  reg.recordFailure("rpc-a");
  assert.equal(reg.getState("rpc-a"), "open");
  advance(29_999);
  assert.equal(reg.canRequest("rpc-a"), false);
});

test("endpoints are independent and visible in the snapshot", () => {
  const { reg } = setup();
  for (let i = 0; i < 5; i++) reg.recordFailure("rpc-a");
  reg.recordSuccess("rpc-b");
  const snap = Object.fromEntries(reg.snapshot().map((s) => [s.endpoint, s]));
  assert.equal(snap["rpc-a"].state, "open");
  assert.equal(snap["rpc-a"].consecutiveFailures, 5);
  assert.equal(snap["rpc-a"].retryInMs, 30_000);
  assert.equal(snap["rpc-b"].state, "closed");
});

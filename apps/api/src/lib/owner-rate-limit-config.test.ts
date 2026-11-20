import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_OWNER_RATE_LIMIT,
  hashOwnerKey,
  parseOwnerRateLimitConfig,
  resolveOwnerRateLimit,
} from "./owner-rate-limit-config.js";

test("defaults apply when nothing is configured", () => {
  const cfg = parseOwnerRateLimitConfig({});
  assert.deepEqual(resolveOwnerRateLimit("any-key", cfg), DEFAULT_OWNER_RATE_LIMIT);
});

test("global defaults can be changed from the environment", () => {
  const cfg = parseOwnerRateLimitConfig({ RPC_RATE_LIMIT_OWNER_MAX: "50", RPC_RATE_LIMIT_OWNER_BURST: "5" });
  assert.deepEqual(resolveOwnerRateLimit("k", cfg), { max: 50, burst: 5 });
});

test("invalid default numbers fall back to the built-in defaults", () => {
  const cfg = parseOwnerRateLimitConfig({ RPC_RATE_LIMIT_OWNER_MAX: "abc", RPC_RATE_LIMIT_OWNER_BURST: "-3" });
  assert.deepEqual(resolveOwnerRateLimit("k", cfg), DEFAULT_OWNER_RATE_LIMIT);
});

test("per-owner overrides apply by raw key or hashed key and leave others alone", () => {
  const cfg = parseOwnerRateLimitConfig({
    RPC_RATE_LIMIT_OWNER_OVERRIDES: JSON.stringify({
      "raw-key": { max: 500, burst: 50 },
      [`sha256:${hashOwnerKey("hashed-key")}`]: { max: 1000 },
    }),
  });
  assert.deepEqual(resolveOwnerRateLimit("raw-key", cfg), { max: 500, burst: 50 });
  assert.deepEqual(resolveOwnerRateLimit("hashed-key", cfg), { max: 1000, burst: DEFAULT_OWNER_RATE_LIMIT.burst });
  assert.deepEqual(resolveOwnerRateLimit("someone-else", cfg), DEFAULT_OWNER_RATE_LIMIT);
});

test("the hashed key takes precedence over the raw key", () => {
  const cfg = parseOwnerRateLimitConfig({
    RPC_RATE_LIMIT_OWNER_OVERRIDES: JSON.stringify({
      k: { max: 10 },
      [`sha256:${hashOwnerKey("k")}`]: { max: 20 },
    }),
  });
  assert.equal(resolveOwnerRateLimit("k", cfg).max, 20);
});

test("burst is clamped to the window limit", () => {
  const cfg = parseOwnerRateLimitConfig({
    RPC_RATE_LIMIT_OWNER_OVERRIDES: JSON.stringify({ k: { max: 5, burst: 100 } }),
  });
  assert.deepEqual(resolveOwnerRateLimit("k", cfg), { max: 5, burst: 5 });
});

test("malformed or invalid override entries are ignored", () => {
  assert.equal(parseOwnerRateLimitConfig({ RPC_RATE_LIMIT_OWNER_OVERRIDES: "{nope" }).overrides.size, 0);
  assert.equal(parseOwnerRateLimitConfig({ RPC_RATE_LIMIT_OWNER_OVERRIDES: "[1]" }).overrides.size, 0);
  const cfg = parseOwnerRateLimitConfig({
    RPC_RATE_LIMIT_OWNER_OVERRIDES: JSON.stringify({ a: { max: -1 }, b: "x", c: { max: 7.5 }, d: { max: 9 } }),
  });
  assert.deepEqual([...cfg.overrides.keys()], ["d"]);
});

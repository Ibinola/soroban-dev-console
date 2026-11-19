import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RETRY_FALLBACK_MS, DEFAULT_RETRY_MAX_MS, parseRetryAfter } from "./retry-after";

const NOW = Date.UTC(2015, 9, 21, 7, 0, 0); // Wed, 21 Oct 2015 07:00:00 GMT

describe("retry-after parsing utility (#1401)", () => {
  it("maps delta seconds to non-negative millisecond delays", () => {
    assert.deepEqual(parseRetryAfter("120", { now: NOW }), { delayMs: 120_000, source: "seconds", valid: true });
    assert.deepEqual(parseRetryAfter("0", { now: NOW }), { delayMs: 0, source: "seconds", valid: true });
    assert.deepEqual(parseRetryAfter("  5 ", { now: NOW }), { delayMs: 5_000, source: "seconds", valid: true });
  });

  it("maps an HTTP-date in the future to the remaining time", () => {
    const r = parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT", { now: NOW });
    assert.deepEqual(r, { delayMs: 28 * 60_000 > DEFAULT_RETRY_MAX_MS ? DEFAULT_RETRY_MAX_MS : 28 * 60_000, source: "http-date", valid: true });
    const near = parseRetryAfter("Wed, 21 Oct 2015 07:00:30 GMT", { now: new Date(NOW) });
    assert.deepEqual(near, { delayMs: 30_000, source: "http-date", valid: true });
  });

  it("returns the bounded fallback for malformed and past values", () => {
    const fallback = { delayMs: DEFAULT_RETRY_FALLBACK_MS, source: "fallback", valid: false };
    for (const bad of ["", "abc", "-5", "1.5", "1e3", "12 seconds", "Wed, 21 Oct 2015 07:28:00", "Tomorrow", "99999999999999999999"]) {
      assert.deepEqual(parseRetryAfter(bad, { now: NOW }), fallback, bad);
    }
    assert.deepEqual(parseRetryAfter(undefined, { now: NOW }), fallback);
    assert.deepEqual(parseRetryAfter(null, { now: NOW }), fallback);
    assert.deepEqual(parseRetryAfter("Wed, 21 Oct 2015 06:59:59 GMT", { now: NOW }), fallback);
    assert.deepEqual(parseRetryAfter("Wed, 21 Oct 2015 07:00:00 GMT", { now: NOW }), fallback);
  });

  it("caps every delay and keeps the fallback within the cap", () => {
    assert.equal(parseRetryAfter("86400", { now: NOW }).delayMs, DEFAULT_RETRY_MAX_MS);
    assert.equal(parseRetryAfter("86400", { now: NOW, maxMs: 10_000 }).delayMs, 10_000);
    assert.equal(parseRetryAfter("nope", { now: NOW, fallbackMs: 60_000, maxMs: 5_000 }).delayMs, 5_000);
    assert.equal(parseRetryAfter("nope", { now: NOW, fallbackMs: 2_000 }).delayMs, 2_000);
  });

  it("does not depend on the local timezone", () => {
    const original = process.env.TZ;
    const results: number[] = [];
    try {
      for (const tz of ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Auckland"]) {
        process.env.TZ = tz;
        results.push(parseRetryAfter("Wed, 21 Oct 2015 07:00:45 GMT", { now: NOW }).delayMs);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    assert.deepEqual(results, [45_000, 45_000, 45_000, 45_000]);
  });

  it("never returns a negative or non-integer delay", () => {
    for (const header of ["0", "7", "Wed, 21 Oct 2015 07:00:00 GMT", "x"]) {
      const { delayMs } = parseRetryAfter(header, { now: NOW });
      assert.ok(Number.isInteger(delayMs) && delayMs >= 0);
    }
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCorrelationId,
  sanitizeCorrelationId,
} from "./request-context.js";

describe("correlation ID sanitization", () => {
  it("keeps safe caller identifiers", () => {
    assert.equal(sanitizeCorrelationId("req_abc-123.xyz:01"), "req_abc-123.xyz:01");
  });

  it("rejects unsafe, oversized, and non-string identifiers", () => {
    assert.equal(sanitizeCorrelationId("bad id"), undefined);
    assert.equal(sanitizeCorrelationId("bad\r\nheader"), undefined);
    assert.equal(sanitizeCorrelationId("a".repeat(129)), undefined);
    assert.equal(sanitizeCorrelationId(123), undefined);
  });

  it("generates a fallback for absent or invalid identifiers", () => {
    const generated = resolveCorrelationId(undefined);
    assert.match(generated, /^[0-9a-f-]{36}$/);
    assert.notEqual(resolveCorrelationId("bad id"), "bad id");
    assert.match(resolveCorrelationId("bad id"), /^[0-9a-f-]{36}$/);
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import { buildStructuredLogEntry } from "./request-context.js";

test("buildStructuredLogEntry fills in correlation context", () => {
  const entry = buildStructuredLogEntry({
    level: "info",
    correlationId: "req-123",
    message: "request.received",
    method: "POST",
    path: "/api/workspaces",
  });

  assert.deepEqual(entry, {
    level: "info",
    correlationId: "req-123",
    message: "request.received",
    method: "POST",
    path: "/api/workspaces",
    statusCode: undefined,
    error: undefined,
  });
});

test("buildStructuredLogEntry defaults unknown correlation ids", () => {
  const entry = buildStructuredLogEntry({
    level: "error",
    message: "request.failed",
  });

  assert.equal(entry.correlationId, "unknown");
  assert.equal(entry.level, "error");
  assert.equal(entry.message, "request.failed");
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeAuditCursor, encodeAuditCursor, filterDigest, toCursorFieldError } from "./audit-cursor.js";

const SECRET = "test-secret";
const position = { createdAt: new Date("2026-03-04T05:06:07.890Z"), id: "cl_abc123" };
const filters = { actor: "alice", action: "workspace.update" };

describe("signed audit cursors (#1381)", () => {
  it("round-trips a keyset position", () => {
    const cursor = encodeAuditCursor(position, filters, SECRET);
    const result = decodeAuditCursor(cursor, filters, SECRET);
    assert.ok(result.ok);
    assert.equal(result.position.createdAt.toISOString(), position.createdAt.toISOString());
    assert.equal(result.position.id, position.id);
    assert.match(cursor, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("is stable: the same position and filters give the same cursor regardless of filter key order", () => {
    assert.equal(
      encodeAuditCursor(position, { actor: "alice", action: "x" }, SECRET),
      encodeAuditCursor(position, { action: "x", actor: "alice" }, SECRET),
    );
    assert.equal(filterDigest({ a: "1", b: undefined, c: "" }), filterDigest({ a: "1" }));
  });

  it("rejects malformed cursors with a field-level error", () => {
    for (const bad of ["", "abc", "a.b.c", "!!!.???", "x".repeat(600), "eyJ4IjoxfQ.sig"]) {
      const result = decodeAuditCursor(bad, filters, SECRET);
      assert.ok(!result.ok, bad);
      assert.ok(result.reason === "MALFORMED" || result.reason === "TAMPERED", bad);
      assert.deepEqual(Object.keys(toCursorFieldError(result)).sort(), ["code", "field", "message"]);
      assert.equal(toCursorFieldError(result).field, "cursor");
    }
  });

  it("rejects a tampered payload or signature", () => {
    const cursor = encodeAuditCursor(position, filters, SECRET);
    const [payload, signature] = cursor.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ t: "2020-01-01T00:00:00.000Z", i: "other", f: filterDigest(filters) })).toString("base64url");
    for (const forged of [`${forgedPayload}.${signature}`, `${payload}.${signature.slice(0, -2)}AA`, `${payload}.${signature}x`]) {
      const result = decodeAuditCursor(forged, filters, SECRET);
      assert.ok(!result.ok);
      assert.equal(result.reason, "TAMPERED");
    }
  });

  it("rejects a cursor signed with a different secret (e.g. a legacy unsigned one)", () => {
    const other = encodeAuditCursor(position, filters, "another-secret");
    const result = decodeAuditCursor(other, filters, SECRET);
    assert.ok(!result.ok && result.reason === "TAMPERED");
    const legacy = Buffer.from(JSON.stringify({ createdAt: position.createdAt.toISOString(), id: position.id })).toString("base64");
    assert.ok(!decodeAuditCursor(legacy, filters, SECRET).ok);
  });

  it("rejects a cursor reused with different filters", () => {
    const cursor = encodeAuditCursor(position, filters, SECRET);
    const result = decodeAuditCursor(cursor, { actor: "bob" }, SECRET);
    assert.ok(!result.ok);
    assert.equal(result.reason, "FILTER_MISMATCH");
    assert.match(result.message, /different filters/);
  });
});

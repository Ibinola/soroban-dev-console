import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CURSOR_VERSION, CursorError, MAX_CURSOR_LENGTH, decodeCursor, encodeCursor } from "./pagination";

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof CursorError);
    return e.code;
  }
  return "none";
};
const raw = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("pagination cursor codec (#1398)", () => {
  it("round-trips compound keys with a version", () => {
    const key = ["2026-01-01T00:00:00.000Z", "id_42", 7, true, null, "héllo ✓"];
    const cursor = encodeCursor(key);
    assert.deepEqual(decodeCursor(cursor), key);
    assert.deepEqual(JSON.parse(Buffer.from(cursor.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()), { v: CURSOR_VERSION, k: key });
  });

  it("produces URL-safe output within the documented maximum", () => {
    for (const key of [["a"], ["??>>"], ["~~~~~~"], ["x".repeat(300)]]) {
      const cursor = encodeCursor(key);
      assert.match(cursor, /^[A-Za-z0-9_-]+$/);
      assert.ok(cursor.length <= MAX_CURSOR_LENGTH);
    }
    assert.equal(codeOf(() => encodeCursor(["x".repeat(2000)])), "TOO_LONG");
  });

  it("returns typed errors for malformed cursors", () => {
    for (const bad of ["", "***", "not-base64-json", "e30", raw([1, 2]), raw("str"), raw({ k: ["a"] })]) {
      assert.equal(codeOf(() => decodeCursor(bad)), "MALFORMED", bad);
    }
    assert.equal(codeOf(() => decodeCursor(undefined as unknown as string)), "MALFORMED");
    assert.equal(codeOf(() => decodeCursor(raw({ v: 1, k: [{}] }))), "MALFORMED");
    assert.equal(codeOf(() => decodeCursor(raw({ v: 1, k: [] }))), "MALFORMED");
  });

  it("rejects unsupported versions and oversized cursors", () => {
    assert.equal(codeOf(() => decodeCursor(raw({ v: 2, k: ["a"] }))), "UNSUPPORTED_VERSION");
    assert.equal(codeOf(() => decodeCursor("A".repeat(MAX_CURSOR_LENGTH + 1))), "TOO_LONG");
  });

  it("rejects invalid keys when encoding", () => {
    assert.equal(codeOf(() => encodeCursor([])), "INVALID_KEY");
    assert.equal(codeOf(() => encodeCursor([NaN])), "INVALID_KEY");
    assert.equal(codeOf(() => encodeCursor([{}] as never)), "INVALID_KEY");
    assert.equal(codeOf(() => encodeCursor(new Array(9).fill("a"))), "INVALID_KEY");
  });
});

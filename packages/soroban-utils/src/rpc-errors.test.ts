import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyRpcError, sanitizeRpcMessage } from "./rpc-errors";

describe("RPC error classification map (#1396)", () => {
  it("maps known HTTP statuses to stable category and retryability", () => {
    const cases: Array<[number, string, boolean]> = [
      [400, "invalid_request", false],
      [401, "unauthorized", false],
      [404, "not_found", false],
      [429, "rate_limited", true],
      [502, "server", true],
      [503, "server", true],
      [504, "server", true],
    ];
    for (const [status, category, retryable] of cases) {
      const c = classifyRpcError({ status, message: "x" });
      assert.equal(c.category, category, String(status));
      assert.equal(c.retryable, retryable, String(status));
      assert.equal(c.code, status);
    }
  });

  it("maps JSON-RPC codes and the nested error.code form", () => {
    assert.deepEqual(
      [classifyRpcError({ code: -32602, message: "bad" }).category, classifyRpcError({ code: -32602, message: "bad" }).retryable],
      ["invalid_request", false],
    );
    assert.equal(classifyRpcError({ error: { code: -32603, message: "oops" } }).category, "server");
    assert.equal(classifyRpcError({ code: -32050, message: "provider" }).retryable, true);
  });

  it("recognizes network and simulation failures", () => {
    assert.deepEqual(
      [classifyRpcError({ code: "ECONNRESET", message: "x" }).category, classifyRpcError(new Error("request timed out")).retryable],
      ["network", true],
    );
    const sim = classifyRpcError(new Error("HostError: Error(Contract, #3)"));
    assert.equal(sim.category, "simulation");
    assert.equal(sim.retryable, false);
  });

  it("classifies unknown errors conservatively and keeps the original code", () => {
    const c = classifyRpcError({ code: "WEIRD_42", message: "something new" });
    assert.deepEqual([c.category, c.retryable, c.code], ["unknown", false, "WEIRD_42"]);
    const bare = classifyRpcError(undefined);
    assert.deepEqual([bare.category, bare.retryable, bare.code, bare.message], ["unknown", false, null, "Unknown error"]);
    assert.equal(classifyRpcError(42).category, "unknown");
  });

  it("removes provider URLs and credentials from messages", () => {
    const msg = sanitizeRpcMessage(
      "POST https://rpc.provider.io/v1/abc123?apikey=SECRET failed; Authorization: Bearer abc.def.ghi token=xyz secret S" + "A".repeat(55),
    );
    for (const leaked of ["rpc.provider.io", "abc123", "SECRET", "abc.def.ghi", "xyz", "S" + "A".repeat(55)]) {
      assert.ok(!msg.includes(leaked), `leaked ${leaked}: ${msg}`);
    }
    assert.match(msg, /\[url\]/);
  });

  it("caps long messages and never throws on odd input", () => {
    assert.ok(sanitizeRpcMessage("x".repeat(1000)).length <= 200);
    for (const odd of [null, 0, [], { message: 5 }, { response: null }, Symbol.iterator]) {
      assert.doesNotThrow(() => classifyRpcError(odd));
    }
  });
});

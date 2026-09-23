import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeSnapshotPayload } from "./share-payload-sanitizer.js";

describe("share payload sanitizer", () => {
  it("strips authorization headers at the top level", () => {
    const result = sanitizeSnapshotPayload({
      workspace: { name: "Deploy" },
      customHeaders: {
        Authorization: "Bearer abc123",
        "X-API-Key": "secret-key-42",
      },
    });

    assert.equal(result.sanitized, true);
    assert.deepEqual(result.detectedSensitiveKeys, [
      "customHeaders.Authorization",
      "customHeaders.X-API-Key",
    ]);
    assert.equal(
      (result.snapshot as any).customHeaders.Authorization,
      "[REDACTED]",
    );
  });

  it("strips secret tokens nested inside saved-call argument maps", () => {
    const result = sanitizeSnapshotPayload({
      savedCalls: [{ fnName: "submit", args: { apiSecret: "s3cr3t" } }],
    });

    assert.equal(result.sanitized, true);
    assert.match(result.detectedSensitiveKeys[0], /args\.apiSecret$/);
    assert.equal(
      (result.snapshot as any).savedCalls[0].args.apiSecret,
      "[REDACTED]",
    );
  });

  it("strips explicit RPC and owner-key credential keys", () => {
    const result = sanitizeSnapshotPayload({
      rpcConfig: { "x-rpc-key": "k", "client-secret": "c" },
      owner: { "owner-key": "k" },
    });

    assert.equal(result.sanitized, true);
    assert.deepEqual(result.detectedSensitiveKeys.sort(), [
      "owner.owner-key",
      "rpcConfig.client-secret",
      "rpcConfig.x-rpc-key",
    ]);
  });

  it("leaves non-sensitive workspace and contract data untouched", () => {
    const payload = {
      workspace: { name: "My Workspace", selectedNetwork: "testnet" },
      contracts: [{ id: "C1", name: "Counter", wasmHash: "0xabc" }],
      savedCalls: [{ fnName: "increment", args: { token: "1000", key: "my-key" } }],
      notes: [{ title: "todo", body: "remember to redeploy" }],
    };
    const result = sanitizeSnapshotPayload(payload);

    assert.equal(result.sanitized, false);
    assert.deepEqual(result.snapshot, payload);
  });

  it("produces deterministic output across runs", () => {
    const payload1 = { a: { Authorization: "x", safe: 1 } };
    const payload2 = { a: { Authorization: "different-secret-value", safe: 1 } };

    const result1 = sanitizeSnapshotPayload(payload1);
    const result2 = sanitizeSnapshotPayload(payload2);

    assert.deepEqual(result1.detectedSensitiveKeys, result2.detectedSensitiveKeys);
    assert.deepEqual(result1.snapshot, result2.snapshot);
  });

  it("handles arrays of objects without crashing", () => {
    const result = sanitizeSnapshotPayload([
      { header: { "X-Auth-Token": "tok" } },
      { header: { "X-Auth-Token": "tok2" } },
    ]);
    const snapshot = result.snapshot as unknown as Array<{ header: Record<string, string> }>;

    assert.equal(result.sanitized, true);
    assert.equal(snapshot[0].header["X-Auth-Token"], "[REDACTED]");
    assert.equal(snapshot[1].header["X-Auth-Token"], "[REDACTED]");
  });

  it("does not redact malformed or primitive payloads", () => {
    for (const value of [null, undefined, "plain text", 42]) {
      const result = sanitizeSnapshotPayload(value);
      assert.equal(result.sanitized, false);
      assert.deepEqual(result.detectedSensitiveKeys, []);
    }
  });
});
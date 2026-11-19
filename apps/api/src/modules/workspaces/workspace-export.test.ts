import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { API_SNAPSHOT_VERSION } from "../../lib/schema-version.js";
import { buildWorkspaceExportSnapshot } from "./workspaces.service.js";

describe("workspace export snapshot", () => {
  it("marks the schema version and omits the raw owner key", () => {
    const snapshot = buildWorkspaceExportSnapshot({
      id: "ws_1",
      name: "Example",
      selectedNetwork: "testnet",
      ownerKey: "owner-secret-value",
      createdAt: new Date(1_000),
      updatedAt: new Date(2_000),
      savedContracts: [{ contractId: "contract_1" }],
      savedInteractions: [{ id: "call_1" }],
      artifacts: [{ kind: "wasm", hash: "abc123", name: "counter.wasm" }],
    });

    assert.equal(snapshot.version, API_SNAPSHOT_VERSION);
    assert.equal(snapshot.schemaVersion, API_SNAPSHOT_VERSION);
    assert.notEqual(snapshot.owner.keyFingerprint, "owner-secret-value");
    assert.equal(JSON.stringify(snapshot).includes("owner-secret-value"), false);
    assert.deepEqual(snapshot.contractIds, ["contract_1"]);
    assert.deepEqual(snapshot.savedCallIds, ["call_1"]);
    assert.deepEqual(snapshot.artifactRefs, [{ kind: "wasm", id: "abc123" }]);
  });

  it("supports an empty workspace", () => {
    const snapshot = buildWorkspaceExportSnapshot({
      id: "ws_empty",
      name: "Empty",
      selectedNetwork: "testnet",
      ownerKey: "owner-secret-value",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      savedContracts: [],
      savedInteractions: [],
      artifacts: [],
    });

    assert.deepEqual(snapshot.contractIds, []);
    assert.deepEqual(snapshot.savedCallIds, []);
    assert.deepEqual(snapshot.artifactRefs, []);
    assert.equal(snapshot.owner.keyFingerprint.length, 16);
  });
});

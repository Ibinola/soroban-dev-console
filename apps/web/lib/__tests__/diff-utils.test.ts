import { describe, it, expect } from "vitest";
import { stateChangesToDiffs, computeStateDiff } from "@/lib/diff-utils";

// Mock xdr and scValToNative from stellar-sdk
// The real SDK isn't available in test env, so we test the logic flow

describe("diff-utils / stateChangesToDiffs (#737)", () => {
  it("returns an empty array when given no changes", () => {
    const result = stateChangesToDiffs([]);
    expect(result).toHaveLength(0);
  });

  it("maps a null-before entry as 'added'", () => {
    // We can't easily instantiate xdr.LedgerKey/LedgerEntry in a unit test without the real SDK,
    // so we test the computeStateDiff helper which uses the same logic.
    const diffs = computeStateDiff({}, { "key1": "val1" });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe("added");
    expect(diffs[0].newValue).not.toBeNull();
    expect(diffs[0].oldValue).toBeNull();
  });

  it("maps a null-after entry as 'deleted'", () => {
    const diffs = computeStateDiff({ "key1": "val1" }, {});
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe("deleted");
    expect(diffs[0].oldValue).not.toBeNull();
    expect(diffs[0].newValue).toBeNull();
  });

  it("maps a changed entry as 'modified'", () => {
    const diffs = computeStateDiff({ "key1": "val1" }, { "key1": "val2" });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe("modified");
  });

  it("produces no diff for identical state", () => {
    const diffs = computeStateDiff(
      { "key1": "val1", "key2": "val2" },
      { "key1": "val1", "key2": "val2" },
    );
    expect(diffs).toHaveLength(0);
  });

  it("handles mixed additions, deletions, and modifications", () => {
    const old = { "k1": "v1", "k2": "v2", "k3": "v3" };
    const next = { "k1": "v1_changed", "k3": "v3" }; // k2 deleted, k1 modified
    const diffs = computeStateDiff(old, next);
    expect(diffs).toHaveLength(2);
    const types = diffs.map((d) => d.type);
    expect(types).toContain("modified");
    expect(types).toContain("deleted");
  });
});

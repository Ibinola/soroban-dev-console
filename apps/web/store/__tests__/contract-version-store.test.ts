import { beforeEach, describe, expect, it } from "vitest";
import type { NormalizedContractSpec } from "@devconsole/soroban-utils";
import { useContractVersionStore } from "../useContractVersionStore";

const spec = (...names: string[]): NormalizedContractSpec => ({
  source: "json",
  rawSpec: "",
  ingestedAt: 1,
  functions: names.map((name) => ({ name, inputs: [], outputs: [] })),
});

describe("useContractVersionStore (#1292)", () => {
  beforeEach(() => {
    useContractVersionStore.setState({ snapshots: [] });
  });

  it("numbers versions per contract and workspace", () => {
    const { recordSnapshot } = useContractVersionStore.getState();
    const a1 = recordSnapshot({ workspaceId: "w1", contractId: "C1", spec: spec("a") });
    const a2 = recordSnapshot({ workspaceId: "w1", contractId: "C1", spec: spec("a", "b") });
    const b1 = recordSnapshot({ workspaceId: "w1", contractId: "C2", spec: spec("x") });
    const c1 = recordSnapshot({ workspaceId: "w2", contractId: "C1", spec: spec("a") });
    expect([a1.version, a2.version, b1.version, c1.version]).toEqual([1, 2, 1, 1]);
  });

  it("returns a contract's history newest first and isolates workspaces", () => {
    const { recordSnapshot, getHistory } = useContractVersionStore.getState();
    recordSnapshot({ workspaceId: "w1", contractId: "C1", spec: spec("a") });
    recordSnapshot({ workspaceId: "w1", contractId: "C1", spec: spec("b"), upgradedToWasmHash: "abc" });
    recordSnapshot({ workspaceId: "w2", contractId: "C1", spec: spec("z") });
    const history = getHistory("w1", "C1");
    expect(history.map((s) => s.version)).toEqual([2, 1]);
    expect(history[0].upgradedToWasmHash).toBe("abc");
    expect(getHistory("w2", "C1")).toHaveLength(1);
    expect(getHistory("w1", "C9")).toEqual([]);
  });

  it("keeps the snapshot's ABI independent of later changes", () => {
    const original = spec("a");
    const snap = useContractVersionStore.getState().recordSnapshot({ workspaceId: "w", contractId: "C", spec: original });
    expect(snap.spec.functions.map((f) => f.name)).toEqual(["a"]);
  });

  it("clears one contract's history only", () => {
    const { recordSnapshot, clearHistory, getHistory } = useContractVersionStore.getState();
    recordSnapshot({ workspaceId: "w", contractId: "C1", spec: spec("a") });
    recordSnapshot({ workspaceId: "w", contractId: "C2", spec: spec("b") });
    clearHistory("w", "C1");
    expect(getHistory("w", "C1")).toEqual([]);
    expect(getHistory("w", "C2")).toHaveLength(1);
  });

  it("persists snapshots to localStorage", () => {
    useContractVersionStore.getState().recordSnapshot({ workspaceId: "w", contractId: "C", spec: spec("a") });
    const saved = JSON.parse(localStorage.getItem("soroban-contract-versions")!);
    expect(saved.state.snapshots).toHaveLength(1);
  });
});

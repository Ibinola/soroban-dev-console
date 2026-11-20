import { describe, expect, it } from "vitest";
import type { DeploymentLogEntry } from "@/store/useDeploymentLogStore";
import { findRollbackTarget, summarizeRollback } from "./deployment-rollback";

const entry = (over: Partial<DeploymentLogEntry>): DeploymentLogEntry => ({
  id: "x",
  timestamp: 1_700_000_000_000,
  wasmFileName: "token.wasm",
  wasmHash: "a".repeat(64),
  salt: null,
  contractId: "CABC",
  txHash: null,
  status: "success",
  network: "testnet",
  ...over,
});

describe("findRollbackTarget", () => {
  it("returns null without a prior distinct version", () => {
    expect(findRollbackTarget([], "CABC")).toBeNull();
    expect(findRollbackTarget([entry({})], "CABC")).toBeNull();
    expect(findRollbackTarget([entry({ id: "1" }), entry({ id: "2" })], "CABC")).toBeNull();
  });

  it("picks the most recent earlier successful version with a different hash", () => {
    const entries = [
      entry({ id: "cur", wasmHash: "c".repeat(64), timestamp: 3 }),
      entry({ id: "same", wasmHash: "c".repeat(64), timestamp: 2 }),
      entry({ id: "prev", wasmHash: "b".repeat(64), timestamp: 1 }),
    ];
    const target = findRollbackTarget(entries, "CABC")!;
    expect(target.current.id).toBe("cur");
    expect(target.previous.id).toBe("prev");
  });

  it("ignores failed deployments and other contracts", () => {
    const entries = [
      entry({ id: "cur", wasmHash: "c".repeat(64) }),
      entry({ id: "failed", wasmHash: "b".repeat(64), status: "failed" }),
      entry({ id: "other", wasmHash: "d".repeat(64), contractId: "COTHER" }),
    ];
    expect(findRollbackTarget(entries, "CABC")).toBeNull();
  });
});

describe("summarizeRollback", () => {
  it("flags the rows that change", () => {
    const rows = summarizeRollback({
      current: entry({ wasmHash: "c".repeat(64), timestamp: 2 }),
      previous: entry({ wasmHash: "b".repeat(64), timestamp: 1 }),
    });
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel["WASM hash"].changed).toBe(true);
    expect(byLabel["WASM hash"].previous).toBe("b".repeat(64));
    expect(byLabel["Network"].changed).toBe(false);
  });
});

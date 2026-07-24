import { describe, it, expect } from "vitest";
import { explainSimulation } from "@devconsole/soroban-utils";

describe("explainSimulation", () => {
  it("should handle simulation error", () => {
    const raw = { error: "Insufficient resources" };
    const result = explainSimulation(raw);

    expect(result.success).toBe(false);
    expect(result.fees.totalFee).toBe("n/a");
    expect(result.authEntries).toHaveLength(0);
    expect(result.stateChanges).toHaveLength(0);
    expect(result.outputSummary).toContain("Error: Insufficient resources");
    expect(result.warnings).toContain("Simulation failed: Insufficient resources");
  });

  it("should parse successful simulation with auth entries", () => {
    const raw = {
      result: { retval: "0x01" },
      cost: { cpuInsns: "1000000", memBytes: "2048" },
      minResourceFee: "500",
      auth: [
        {
          rootInvocation: {
            functionName: "transfer",
            contractAddress: "CONTRACT_A",
          },
        },
        {
          rootInvocation: {
            functionName: "approve",
            contractAddress: "CONTRACT_B",
          },
        },
      ],
      transactionData: {
        resources: {
          footprint: {
            readOnly: [{ key: " ledger" }],
            readWrite: [{ key: "data" }],
          },
        },
      },
    };

    const result = explainSimulation(raw);

    expect(result.success).toBe(true);
    expect(result.fees.inclusionFee).toBe("100");
    expect(result.fees.resourceFee).toBe("500");
    expect(result.fees.totalFee).toBe("600");
    expect(result.authEntries).toHaveLength(2);
    expect(result.authEntries[0].contractId).toBe("CONTRACT_A");
    expect(result.authEntries[0].fnName).toBe("transfer");
    expect(result.authEntries[1].contractId).toBe("CONTRACT_B");
    expect(result.authEntries[1].fnName).toBe("approve");
    expect(result.stateChanges).toHaveLength(2);
    expect(result.outputSummary).toContain("Return value:");
  });

  it("should warn when no auth entries", () => {
    const raw = {
      result: { retval: null },
      minResourceFee: "100",
      auth: [],
    };

    const result = explainSimulation(raw);

    expect(result.warnings).toContain("No auth entries — ensure callers are set.");
  });

  it("should warn when resource fee is high", () => {
    const raw = {
      result: { retval: null },
      minResourceFee: "200000",
      auth: [],
    };

    const result = explainSimulation(raw);

    expect(result.warnings).toContain(
      "Resource fee is unusually high — consider optimising storage footprint."
    );
  });

  it("should handle void function (no return value)", () => {
    const raw = {
      result: {},
      minResourceFee: "100",
      auth: [],
    };

    const result = explainSimulation(raw);

    expect(result.outputSummary).toBe("No return value (void function).");
  });

  it("should handle missing auth entries gracefully", () => {
    const raw = {
      result: { retval: "ok" },
      minResourceFee: "100",
      auth: [
        {
          rootInvocation: {
            functionName: "call",
            contractAddress: undefined,
          },
        },
      ],
    };

    const result = explainSimulation(raw);

    expect(result.authEntries[0].contractId).toBe("unknown");
    expect(result.authEntries[0].fnName).toBe("call");
  });

  it("should handle missing transaction data gracefully", () => {
    const raw = {
      result: { retval: "ok" },
      minResourceFee: "100",
      auth: [],
    };

    const result = explainSimulation(raw);

    expect(result.stateChanges).toHaveLength(0);
  });
});

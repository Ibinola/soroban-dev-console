import { describe, it, expect } from "vitest";
import { computeSpecDiff } from "@/lib/spec-diff";
import type { NormalizedContractSpec } from "@devconsole/soroban-utils";

describe("computeSpecDiff", () => {
  const baseSpec: NormalizedContractSpec = {
    source: "json",
    rawSpec: "",
    functions: [
      {
        name: "initialize",
        inputs: [{ name: "admin", type: "address", required: true }],
        outputs: [],
      },
      {
        name: "transfer",
        inputs: [
          { name: "from", type: "address", required: true },
          { name: "to", type: "address", required: true },
          { name: "amount", type: "u128", required: true },
        ],
        outputs: [],
      },
      {
        name: "balance",
        inputs: [{ name: "account", type: "address", required: true }],
        outputs: [{ name: "amount", type: "u128", required: true }],
      },
    ],
    ingestedAt: Date.now(),
  };

  it("detects added functions", () => {
    const proposed: NormalizedContractSpec = {
      ...baseSpec,
      functions: [
        ...baseSpec.functions,
        {
          name: "mint",
          inputs: [
            { name: "to", type: "address", required: true },
            { name: "amount", type: "u128", required: true },
          ],
          outputs: [],
        },
      ],
    };

    const diff = computeSpecDiff(baseSpec, proposed);
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.removed).toBe(0);
    expect(diff.summary.hasBreakingChanges).toBe(false);
    expect(diff.functions.find((f) => f.name === "mint")?.status).toBe("added");
  });

  it("detects removed functions (breaking)", () => {
    const proposed: NormalizedContractSpec = {
      ...baseSpec,
      functions: baseSpec.functions.filter((f) => f.name !== "balance"),
    };

    const diff = computeSpecDiff(baseSpec, proposed);
    expect(diff.summary.removed).toBe(1);
    expect(diff.summary.hasBreakingChanges).toBe(true);
    expect(diff.functions.find((f) => f.name === "balance")?.status).toBe(
      "removed",
    );
  });

  it("detects changed signatures", () => {
    const proposed: NormalizedContractSpec = {
      ...baseSpec,
      functions: baseSpec.functions.map((f) =>
        f.name === "transfer"
          ? {
              ...f,
              inputs: [
                ...f.inputs,
                { name: "memo", type: "string", required: false },
              ],
            }
          : f,
      ),
    };

    const diff = computeSpecDiff(baseSpec, proposed);
    expect(diff.summary.changed).toBe(1);
    expect(diff.summary.hasBreakingChanges).toBe(false);
    const transferDiff = diff.functions.find((f) => f.name === "transfer");
    expect(transferDiff?.status).toBe("changed");
    expect(transferDiff?.changes).toContain("inputs: 3 -> 4");
  });

  it("detects unchanged functions", () => {
    const diff = computeSpecDiff(baseSpec, baseSpec);
    expect(diff.summary.unchanged).toBe(3);
    expect(diff.summary.added).toBe(0);
    expect(diff.summary.removed).toBe(0);
    expect(diff.summary.changed).toBe(0);
    expect(diff.summary.hasBreakingChanges).toBe(false);
  });

  it("handles mixed changes", () => {
    const proposed: NormalizedContractSpec = {
      ...baseSpec,
      functions: [
        baseSpec.functions[0],
        baseSpec.functions[2],
        {
          name: "approve",
          inputs: [
            { name: "spender", type: "address", required: true },
            { name: "amount", type: "u128", required: true },
          ],
          outputs: [],
        },
      ],
    };

    const diff = computeSpecDiff(baseSpec, proposed);
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.removed).toBe(1);
    expect(diff.summary.unchanged).toBe(2);
    expect(diff.summary.hasBreakingChanges).toBe(true);
  });

  it("sorts functions alphabetically", () => {
    const proposed: NormalizedContractSpec = {
      ...baseSpec,
      functions: [
        {
          name: "zap",
          inputs: [],
          outputs: [],
        },
        ...baseSpec.functions,
      ],
    };

    const diff = computeSpecDiff(baseSpec, proposed);
    const names = diff.functions.map((f) => f.name);
    expect(names).toEqual([...names].sort());
  });
});

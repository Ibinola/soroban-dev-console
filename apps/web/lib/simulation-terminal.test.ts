import { describe, expect, it } from "vitest";
import type { SimulationExplanation } from "@devconsole/soroban-utils";
import { buildTerminalSections, formatTerminalText } from "./simulation-terminal";

const base: SimulationExplanation = {
  success: true,
  fees: { inclusionFee: "100", resourceFee: "2500", totalFee: "2600" },
  authEntries: [{ contractId: "CABC", fnName: "transfer" }],
  stateChanges: ["2 ledger key(s) read"],
  outputSummary: "Returned: 42",
  warnings: [],
};

describe("buildTerminalSections", () => {
  it("produces auth, footprint and result sections in order", () => {
    expect(buildTerminalSections(base).map((s) => s.id)).toEqual(["auth", "footprint", "result"]);
  });

  it("marks a missing auth entry as a warning", () => {
    const [auth] = buildTerminalSections({ ...base, authEntries: [] });
    expect(auth.lines).toEqual([{ level: "warn", text: "no auth entries" }]);
  });

  it("flags multi-signer transactions", () => {
    const [auth] = buildTerminalSections({
      ...base,
      authEntries: [
        { contractId: "CA", fnName: "a" },
        { contractId: "CB", fnName: "b" },
      ],
    });
    expect(auth.lines.at(-1)?.level).toBe("warn");
  });

  it("colours failed simulations as errors", () => {
    const sections = buildTerminalSections({
      ...base,
      success: false,
      outputSummary: "Error: boom",
      warnings: ["Simulation failed: boom"],
    });
    const result = sections.find((s) => s.id === "result")!;
    expect(result.lines.map((l) => l.level)).toEqual(["error", "error"]);
  });

  it("lists fees and state changes in the footprint section", () => {
    const footprint = buildTerminalSections(base).find((s) => s.id === "footprint")!;
    expect(footprint.lines.map((l) => l.text)).toContain("2 ledger key(s) read");
    expect(footprint.lines[2].text).toContain("2600");
  });
});

describe("formatTerminalText", () => {
  it("renders every section with upper-cased levels", () => {
    const text = formatTerminalText(buildTerminalSections(base));
    expect(text).toContain("[auth]");
    expect(text).toContain("[result]");
    expect(text).toContain("INFO  Returned: 42");
  });
});

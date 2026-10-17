import { describe, expect, it } from "vitest";
import { ONE_TOKEN_STROOPS, applyTemplate, templatesForInputs } from "./param-templates";

const transfer = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "amount", type: "i128" },
];

describe("templatesForInputs", () => {
  it("returns nothing for functions without inputs", () => {
    expect(templatesForInputs([])).toEqual([]);
  });

  it("offers amount templates for token-style functions", () => {
    const ids = templatesForInputs(transfer).map((t) => t.id);
    expect(ids).toEqual(["defaults", "one-token", "min-amount"]);
  });

  it("leaves addresses untouched", () => {
    const oneToken = templatesForInputs(transfer).find((t) => t.id === "one-token")!;
    expect(oneToken.values).toEqual([undefined, undefined, ONE_TOKEN_STROOPS]);
  });

  it("only offers type defaults when there is no amount-like input", () => {
    const ids = templatesForInputs([{ name: "flag", type: "bool" }]).map((t) => t.id);
    expect(ids).toEqual(["defaults"]);
  });

  it("offers nothing when no field can be templated", () => {
    expect(templatesForInputs([{ name: "owner", type: "address" }])).toEqual([]);
  });

  it("does not treat small ints named amount as token amounts", () => {
    const ids = templatesForInputs([{ name: "amount", type: "u32" }]).map((t) => t.id);
    expect(ids).not.toContain("one-token");
  });
});

describe("applyTemplate", () => {
  it("overwrites templated fields and keeps the rest", () => {
    const args = [{ value: "GABC" }, { value: "GDEF" }, { value: "5" }];
    const t = templatesForInputs(transfer).find((x) => x.id === "one-token")!;
    expect(applyTemplate(args, t)).toEqual([
      { value: "GABC" },
      { value: "GDEF" },
      { value: ONE_TOKEN_STROOPS },
    ]);
  });
});

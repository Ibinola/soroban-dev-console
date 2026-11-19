import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NormalizedContractFunction, NormalizedContractSpec } from "./contract-spec";
import { compareContractSpecs } from "./spec-diff";

const field = (name: string, type: any = "u32", required = true) => ({ name, type, required });
const fn = (name: string, inputs = [field("a")], outputs = [field("ret")]): NormalizedContractFunction => ({
  name,
  inputs,
  outputs,
});
const spec = (...functions: NormalizedContractFunction[]): NormalizedContractSpec => ({
  source: "json",
  rawSpec: "",
  functions,
  ingestedAt: 0,
});

describe("contract spec compatibility report (#1387)", () => {
  it("separates added, removed and signature-changed functions", () => {
    const before = spec(fn("keep"), fn("gone"), fn("change", [field("x", "u32")]));
    const after = spec(fn("keep"), fn("new_fn"), fn("change", [field("x", "i128")]));
    const report = compareContractSpecs(before, after);
    assert.deepEqual(report.functions.added, ["new_fn"]);
    assert.deepEqual(report.functions.removed, ["gone"]);
    assert.deepEqual(report.functions.signatureChanged, [
      { name: "change", changes: [{ kind: "input-type-changed", name: "x", from: "u32", to: "i128" }] },
    ]);
    assert.deepEqual(report.summary, { added: 1, removed: 1, changed: 1 });
    assert.equal(report.backwardCompatible, false);
  });

  it("ignores ordering-only changes between function lists", () => {
    const a = spec(fn("one"), fn("two"), fn("three"));
    const b = spec(fn("three"), fn("one"), fn("two"));
    const report = compareContractSpecs(a, b);
    assert.deepEqual(report.summary, { added: 0, removed: 0, changed: 0 });
    assert.equal(report.backwardCompatible, true);
  });

  it("is deterministic for equivalent specs", () => {
    const a = spec(fn("b"), fn("a", [field("p"), field("q", "bool")]));
    const b = spec(fn("a", [field("p"), field("q", "bool")]), fn("b"));
    const c = spec(fn("c"), fn("d"));
    assert.equal(JSON.stringify(compareContractSpecs(a, c)), JSON.stringify(compareContractSpecs(b, c)));
  });

  it("treats a positional input reorder as a real change", () => {
    const report = compareContractSpecs(
      spec(fn("f", [field("a"), field("b", "bool")])),
      spec(fn("f", [field("b", "bool"), field("a")])),
    );
    assert.equal(report.functions.signatureChanged[0].changes[0].kind, "input-order-changed");
    assert.equal(report.backwardCompatible, false);
  });

  it("treats an added optional input as compatible and an added required one as breaking", () => {
    const base = spec(fn("f", [field("a")]));
    const optional = compareContractSpecs(base, spec(fn("f", [field("a"), field("o", "u32", false)])));
    assert.equal(optional.backwardCompatible, true);
    const required = compareContractSpecs(base, spec(fn("f", [field("a"), field("r")])));
    assert.equal(required.backwardCompatible, false);
  });

  it("reports changed outputs and added/removed argument types", () => {
    const report = compareContractSpecs(
      spec(fn("f", [field("a", "u32")], [field("ret", "u32")])),
      spec(fn("f", [field("a", "u32")], [field("ret", "address")])),
    );
    assert.deepEqual(report.functions.signatureChanged[0].changes, [
      { kind: "output-changed", from: ["u32"], to: ["address"] },
    ]);
    assert.deepEqual(report.types, { added: ["address"], removed: [] });
  });
});

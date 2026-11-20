import { describe, it, expect } from "vitest";
import { formatDecodedJson } from "./page";

describe("formatDecodedJson (issue #1111)", () => {
  const sample = { type: "Payment", amount: "100", nested: { a: 1, b: [1, 2] } };

  it("produces a single-line string for 'compact'", () => {
    const out = formatDecodedJson(sample, "compact");
    expect(out).not.toContain("\n");
    expect(JSON.parse(out)).toEqual(sample);
  });

  it("indents with 2 spaces for '2'", () => {
    const out = formatDecodedJson(sample, "2");
    expect(out).toContain('\n  "type"');
    expect(JSON.parse(out)).toEqual(sample);
  });

  it("indents with 4 spaces for '4'", () => {
    const out = formatDecodedJson(sample, "4");
    expect(out).toContain('\n    "type"');
    expect(JSON.parse(out)).toEqual(sample);
  });

  it("serializes bigint values as strings, consistent with the decode path", () => {
    const withBigInt = { seq: 12345678901234567890n };
    const out = formatDecodedJson(withBigInt, "2");
    expect(JSON.parse(out)).toEqual({ seq: "12345678901234567890" });
  });
});

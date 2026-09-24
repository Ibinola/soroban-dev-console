import { describe, it, expect } from "vitest";
import { analyzeXdrInput, stripXdrWhitespace } from "./xdr-base64-metrics";

describe("stripXdrWhitespace", () => {
  it("removes spaces, tabs and newlines that XDR pastes carry", () => {
    expect(stripXdrWhitespace("AAAA\n  AgAA\tAA==\n")).toBe("AAAAAgAAAA==");
  });

  it("tolerates null-ish input", () => {
    expect(stripXdrWhitespace(undefined as unknown as string)).toBe("");
  });
});

describe("analyzeXdrInput", () => {
  it("reports an empty input without a warning", () => {
    const m = analyzeXdrInput("   \n ");
    expect(m.kind).toBe("empty");
    expect(m.charCount).toBe(0);
    expect(m.byteLength).toBe(0);
    expect(m.warning).toBeNull();
  });

  it("counts characters and decoded bytes for a valid ScVal", () => {
    // ScVal bool true: 12 base64 chars -> 8 XDR bytes (12 * 3/4 = 9, minus 1 padding)
    const m = analyzeXdrInput("AAAAAAAAAAE=");
    expect(m.kind).toBe("base64");
    expect(m.charCount).toBe(12);
    expect(m.byteLength).toBe(8);
    expect(m.lengthAligned).toBe(true);
    expect(m.warning).toBeNull();
  });

  it("flags a Base64 string whose length is not a multiple of 4", () => {
    const m = analyzeXdrInput("AAAAAAAAAAE");
    expect(m.kind).toBe("base64");
    expect(m.lengthAligned).toBe(false);
    expect(m.warning).toMatch(/not a multiple of 4/);
    expect(m.warning).toMatch(/truncated/);
  });

  it("ignores whitespace when measuring a pasted string", () => {
    const m = analyzeXdrInput("AAAA\nAgAA\nAA==");
    expect(m.charCount).toBe(12);
    // 12 Base64 chars -> 3 groups -> 9 raw bytes, minus the 2 padding bytes
    expect(m.byteLength).toBe(7);
    expect(m.lengthAligned).toBe(true);
  });

  it("detects hex input and halves the length for the byte count", () => {
    const m = analyzeXdrInput("0000000000000001");
    expect(m.kind).toBe("hex");
    expect(m.charCount).toBe(16);
    expect(m.byteLength).toBe(8);
    expect(m.warning).toBeNull();
  });

  it("flags odd-length hex input", () => {
    const m = analyzeXdrInput("00000000000000011");
    expect(m.kind).toBe("base64");
    // 17 chars of [0-9a-f] is not even-length hex, so it falls through to Base64 shape detection
    expect(m.lengthAligned).toBe(false);
    expect(m.warning).not.toBeNull();
  });

  it("warns about characters outside both encodings", () => {
    const m = analyzeXdrInput("AAAA??AgAA==!!");
    expect(m.kind).toBe("unknown");
    expect(m.byteLength).toBe(0);
    expect(m.warning).toMatch(/Not valid Base64 or hex/);
  });

  it("treats an empty value as having no byte length even when padding is present", () => {
    expect(analyzeXdrInput("==").kind).toBe("unknown");
  });

  it("accepts every sample from the preset library as aligned Base64", () => {
    const samples = ["AAAABgAAAAEAAAAAAAAAAA==", "AAAAAA==", "AAAAEAAAAAEAAAAPAAAABGxpc3Q="];
    for (const sample of samples) {
      const m = analyzeXdrInput(sample);
      expect(m.lengthAligned).toBe(true);
      expect(m.warning).toBeNull();
    }
  });
});

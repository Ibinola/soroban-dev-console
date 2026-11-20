import { describe, it, expect } from "vitest";
import { findBase64ErrorPosition } from "./xdr-error-locator";

describe("findBase64ErrorPosition (issue #1105)", () => {
  it("returns null for valid Base64 with no padding", () => {
    expect(findBase64ErrorPosition("AAAAAgAAAAB7v2dX")).toBeNull();
  });

  it("returns null for valid Base64 with trailing padding", () => {
    expect(findBase64ErrorPosition("AAAAAgAAAAB7v2dX/////wAAAAAAAAAAAAAAAAAA+/8=")).toBeNull();
    expect(findBase64ErrorPosition("AAAAAgAAAAB7v2dX==")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(findBase64ErrorPosition("")).toBeNull();
  });

  it("locates an invalid character and reports its position", () => {
    const input = "AAAA!BBBB";
    const result = findBase64ErrorPosition(input);
    expect(result).not.toBeNull();
    expect(result?.position).toBe(4);
    expect(result?.message).toContain("'!'");
    expect(result?.message).toContain("position 4");
  });

  it("locates padding that appears before the end of the payload", () => {
    const input = "AAAA=BBBB";
    const result = findBase64ErrorPosition(input);
    expect(result).not.toBeNull();
    expect(result?.position).toBe(4);
    expect(result?.message).toContain("padding");
  });

  it("computes line and column for multi-line pasted input", () => {
    const input = "AAAA\nBB!B";
    const result = findBase64ErrorPosition(input);
    expect(result).not.toBeNull();
    expect(result?.line).toBe(2);
    expect(result?.column).toBe(3);
  });

  it("ignores whitespace when scanning for invalid characters", () => {
    const input = "AAAA BBBB";
    expect(findBase64ErrorPosition(input)).toBeNull();
  });
});

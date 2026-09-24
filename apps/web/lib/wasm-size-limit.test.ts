import { describe, it, expect } from "vitest";
import { validateWasmSize, DEFAULT_MAX_WASM_SIZE_BYTES } from "@devconsole/soroban-utils";

describe("validateWasmSize (issue #1099)", () => {
  it("is valid when the file is under the limit", () => {
    const result = validateWasmSize(100 * 1024, 256 * 1024);
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("is valid when the file is exactly at the limit", () => {
    const result = validateWasmSize(256 * 1024, 256 * 1024);
    expect(result.valid).toBe(true);
  });

  it("is invalid when the file exceeds the limit, with a size-vs-limit message", () => {
    const result = validateWasmSize(300 * 1024, 256 * 1024);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("300.00 KB");
    expect(result.message).toContain("256.00 KB");
  });

  it("exposes a sane default fallback", () => {
    expect(DEFAULT_MAX_WASM_SIZE_BYTES).toBeGreaterThan(0);
  });
});

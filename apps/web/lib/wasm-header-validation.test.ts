import { describe, it, expect } from "vitest";
import {
  isValidWasmHeader,
  validateWasmBinary,
  WASM_MAGIC_BYTES,
  WASM_VERSION_1_BYTES,
} from "@devconsole/soroban-utils";

describe("WASM header byte validation (Issue #1090)", () => {
  it("returns true for a valid WebAssembly magic header (\\0asm)", () => {
    const validWasmHeader = new Uint8Array([
      ...WASM_MAGIC_BYTES,
      ...WASM_VERSION_1_BYTES,
    ]);
    expect(isValidWasmHeader(validWasmHeader)).toBe(true);
  });

  it("returns false for invalid magic header bytes", () => {
    // E.g. ASCII text file "hello world"
    const textBytes = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(isValidWasmHeader(textBytes)).toBe(false);

    // E.g. ELF header (0x7f, 'E', 'L', 'F')
    const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x01, 0x01, 0x01, 0x00]);
    expect(isValidWasmHeader(elfBytes)).toBe(false);

    // E.g. bytes starting with 0x00 but not 'asm'
    const almostWasm = new Uint8Array([0x00, 0x61, 0x73, 0x00, 0x01, 0x00, 0x00, 0x00]);
    expect(isValidWasmHeader(almostWasm)).toBe(false);
  });

  it("returns false for buffers with less than 4 bytes", () => {
    expect(isValidWasmHeader(new Uint8Array([0x00, 0x61]))).toBe(false);
    expect(isValidWasmHeader(new Uint8Array([]))).toBe(false);
  });

  it("validateWasmBinary approves a valid 8-byte WASM binary", () => {
    const validBinary = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const result = validateWasmBinary(validBinary);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("validateWasmBinary rejects empty byte arrays with helpful error message", () => {
    const emptyBinary = new Uint8Array([]);
    const result = validateWasmBinary(emptyBinary);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("validateWasmBinary rejects files smaller than 8 bytes", () => {
    const truncated = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    const result = validateWasmBinary(truncated);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 8 bytes");
  });

  it("validateWasmBinary rejects non-WASM files and mentions magic header bytes", () => {
    const jsonBytes = new TextEncoder().encode('{"name": "token"}');
    const result = validateWasmBinary(jsonBytes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("\\0asm");
  });
});

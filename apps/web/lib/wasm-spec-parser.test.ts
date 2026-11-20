import { describe, it, expect } from "vitest";
import {
  parseWasmClientSpec,
  formatWasmFileSize,
  isWasmOverWarningLimit,
  isConstructorFunction,
  formatFunctionSignature,
  SOROBAN_WASM_WARN_LIMIT_BYTES,
  extractWasmCustomSection,
} from "@devconsole/soroban-utils";

describe("Client-side WASM spec parser & preview (Issue #1091)", () => {
  it("formats file sizes correctly in bytes, KB, and MB", () => {
    expect(formatWasmFileSize(512)).toBe("512 B");
    expect(formatWasmFileSize(1024)).toBe("1.00 KB");
    expect(formatWasmFileSize(43520)).toBe("42.50 KB");
    expect(formatWasmFileSize(64 * 1024)).toBe("64.00 KB");
    expect(formatWasmFileSize(1024 * 1024 * 2.5)).toBe("2.50 MB");
  });

  it("warns when WASM file size exceeds 64 KB limit threshold", () => {
    expect(isWasmOverWarningLimit(64 * 1024)).toBe(false);
    expect(isWasmOverWarningLimit(64 * 1024 + 1)).toBe(true);
    expect(isWasmOverWarningLimit(100 * 1024)).toBe(true);
    expect(SOROBAN_WASM_WARN_LIMIT_BYTES).toBe(65536);
  });

  it("identifies constructor/init functions correctly", () => {
    expect(isConstructorFunction("__constructor")).toBe(true);
    expect(isConstructorFunction("init")).toBe(true);
    expect(isConstructorFunction("initialize")).toBe(true);
    expect(isConstructorFunction("constructor")).toBe(true);
    expect(isConstructorFunction("transfer")).toBe(false);
    expect(isConstructorFunction("balance")).toBe(false);
  });

  it("formats function signatures with parameter types", () => {
    const fn = {
      name: "init",
      inputs: [
        { name: "admin", type: "address" as const, required: true },
        { name: "decimal", type: "u32" as const, required: true },
      ],
      outputs: [],
    };
    expect(formatFunctionSignature(fn)).toBe("init(admin: address, decimal: u32)");

    const fnWithOutput = {
      name: "balance",
      inputs: [{ name: "id", type: "address" as const, required: true }],
      outputs: [{ name: "amount", type: "i128" as const, required: true }],
    };
    expect(formatFunctionSignature(fnWithOutput)).toBe("balance(id: address) -> i128");
  });

  it("extracts custom section from a constructed WASM binary", () => {
    // Construct a minimal WASM module with a custom section "contractspecv0"
    const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
    const sectionName = "contractspecv0";
    const sectionData = "init transfer balance";
    const sectionNameBytes = Array.from(new TextEncoder().encode(sectionName));
    const sectionContentBytes = Array.from(new TextEncoder().encode(sectionData));

    // Custom section id is 0
    const customSectionPayload = [
      sectionNameBytes.length,
      ...sectionNameBytes,
      ...sectionContentBytes,
    ];
    const customSection = [0x00, customSectionPayload.length, ...customSectionPayload];

    const wasmBytes = new Uint8Array([...header, ...customSection]);

    const extracted = extractWasmCustomSection(wasmBytes, "contractspecv0");
    expect(extracted).not.toBeNull();
    const decoded = new TextDecoder().decode(extracted!);
    expect(decoded).toContain("init");
  });

  it("parseWasmClientSpec parses valid WASM binary and detects functions & size", async () => {
    // Build a mock WASM with contractspecv0
    const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
    const sectionName = "contractspecv0";
    const sectionData = "init transfer balance approve";
    const sectionNameBytes = Array.from(new TextEncoder().encode(sectionName));
    const sectionContentBytes = Array.from(new TextEncoder().encode(sectionData));

    const customSectionPayload = [
      sectionNameBytes.length,
      ...sectionNameBytes,
      ...sectionContentBytes,
    ];
    const customSection = [0x00, customSectionPayload.length, ...customSectionPayload];

    const wasmBytes = new Uint8Array([...header, ...customSection]);

    const result = await parseWasmClientSpec(wasmBytes);
    expect(result.valid).toBe(true);
    expect(result.sizeBytes).toBe(wasmBytes.length);
    expect(result.formattedSize).toBe(formatWasmFileSize(wasmBytes.length));
    expect(result.functions).toContain("init");
    expect(result.functions).toContain("transfer");
    expect(result.hasConstructor).toBe(true);
    expect(result.constructorFunction?.name).toBe("init");
  });

  it("parseWasmClientSpec fails gracefully on invalid WASM bytes", async () => {
    const invalidBytes = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const result = await parseWasmClientSpec(invalidBytes);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.functions.length).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  estimateWasmResources,
  findResourceHeavyFunctions,
  DEFAULT_WASM_RESOURCE_THRESHOLD,
  WASM_PAGE_SIZE_BYTES,
} from "@devconsole/soroban-utils";

/**
 * Hand-assembled two-function module (#1281):
 *
 *   (module
 *     (memory 1)
 *     (func (export "small") (result i32) i32.const 42)
 *     (func (export "large") (result i32) i32.const 128))
 *
 * Layout: header (8) | type (7) | function (5) | memory (5) | export (19) | code (14)
 */
const twoFunctionModule = new Uint8Array([
  // magic + version
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  // type section: one type () -> i32
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
  // function section: two functions, both of type 0
  0x03, 0x03, 0x02, 0x00, 0x00,
  // memory section: one memory, minimum one page
  0x05, 0x03, 0x01, 0x00, 0x01,
  // export section: "small" -> func 0, "large" -> func 1
  0x07, 0x11, 0x02, 0x05, 0x73, 0x6d, 0x61, 0x6c, 0x6c, 0x00, 0x00, 0x05, 0x6c,
  0x61, 0x72, 0x67, 0x65, 0x00, 0x01,
  // code section: bodies of 4 and 5 bytes
  0x0a, 0x0c, 0x02, 0x04, 0x00, 0x41, 0x2a, 0x0b, 0x05, 0x00, 0x41, 0x80, 0x01,
  0x0b,
]);

/** Offset of the export section (0x07) and its full byte length. */
const EXPORT_SECTION_START = 25;
const EXPORT_SECTION_LENGTH = 19;

function withoutExports(): Uint8Array {
  return new Uint8Array([
    ...twoFunctionModule.slice(0, EXPORT_SECTION_START),
    0x07,
    0x01,
    0x00, // empty export section
    ...twoFunctionModule.slice(EXPORT_SECTION_START + EXPORT_SECTION_LENGTH),
  ]);
}

describe("estimateWasmResources (#1281)", () => {
  it("analyses a real, compilable WASM module", async () => {
    // Guards the fixture itself: the estimator only runs on real modules.
    await expect(WebAssembly.compile(twoFunctionModule)).resolves.toBeDefined();

    const estimate = estimateWasmResources(twoFunctionModule);

    expect(estimate.valid).toBe(true);
    expect(estimate.error).toBeUndefined();
    expect(estimate.functionCount).toBe(2);
    expect(estimate.memoryPages).toBe(1);
  });

  it("reports an instruction and memory estimate per function", () => {
    const estimate = estimateWasmResources(twoFunctionModule);

    expect(estimate.functions).toEqual([
      {
        index: 1,
        name: "large",
        bodyBytes: 5,
        estimatedInstructions: 5,
        estimatedMemoryBytes: WASM_PAGE_SIZE_BYTES / 2,
        exceedsThreshold: false,
      },
      {
        index: 0,
        name: "small",
        bodyBytes: 4,
        estimatedInstructions: 4,
        estimatedMemoryBytes: WASM_PAGE_SIZE_BYTES / 2,
        exceedsThreshold: false,
      },
    ]);
    expect(estimate.totalBodyBytes).toBe(9);
    expect(estimate.totalMemoryBytes).toBe(WASM_PAGE_SIZE_BYTES);
  });

  it("ranks the heaviest functions first", () => {
    const estimate = estimateWasmResources(twoFunctionModule);

    expect(estimate.functions.map((fn) => fn.name)).toEqual(["large", "small"]);
  });

  it("flags functions that exceed a configurable threshold", () => {
    const estimate = estimateWasmResources(twoFunctionModule, { threshold: 4 });

    expect(estimate.threshold).toBe(4);
    expect(
      estimate.functions.find((fn) => fn.name === "small")?.exceedsThreshold,
    ).toBe(false);
    expect(
      findResourceHeavyFunctions(twoFunctionModule, { threshold: 4 }),
    ).toEqual([
      expect.objectContaining({ name: "large", exceedsThreshold: true }),
    ]);
  });

  it("defaults to a 1000-instruction threshold", () => {
    expect(estimateWasmResources(twoFunctionModule).threshold).toBe(
      DEFAULT_WASM_RESOURCE_THRESHOLD,
    );
  });

  it("falls back to a generated name for non-exported functions", () => {
    const estimate = estimateWasmResources(withoutExports());

    expect(estimate.valid).toBe(true);
    expect(estimate.functionCount).toBe(2);
    expect(estimate.functions.map((fn) => fn.name)).toEqual([
      "func_1",
      "func_0",
    ]);
  });

  it("accepts an ArrayBuffer", () => {
    const buffer = twoFunctionModule.buffer.slice(0) as ArrayBuffer;

    expect(estimateWasmResources(buffer).functionCount).toBe(2);
  });

  it("rejects input that is not a WASM module", () => {
    const estimate = estimateWasmResources(new Uint8Array([1, 2, 3, 4]));

    expect(estimate.valid).toBe(false);
    expect(estimate.error).toBe("Not a valid WASM module");
    expect(estimate.functions).toEqual([]);
  });
});

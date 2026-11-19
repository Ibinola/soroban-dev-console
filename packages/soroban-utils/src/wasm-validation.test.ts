import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateWasmSectionOrder } from "./wasm-validation";
import { customSection, module_, section } from "./wasm-test-utils";

const sec = (id: number) => section(id, [0]);

describe("WASM section ordering validator (#1392)", () => {
  it("accepts the standard order, including datacount before code", () => {
    const bytes = module_(sec(1), sec(2), sec(3), sec(5), sec(6), sec(7), sec(8), sec(9), sec(12), sec(10), sec(11));
    assert.deepEqual(validateWasmSectionOrder(bytes), { valid: true, issues: [] });
  });

  it("accepts a tag section between memory and global", () => {
    assert.equal(validateWasmSectionOrder(module_(sec(5), sec(13), sec(6))).valid, true);
  });

  it("reports an out-of-order section with its id, name and byte offset", () => {
    const bytes = module_(sec(1), sec(7), sec(2)); // import after export
    const report = validateWasmSectionOrder(bytes);
    assert.equal(report.valid, false);
    assert.deepEqual(report.issues, [
      {
        code: "OUT_OF_ORDER_SECTION",
        message: "import section must come before the export section",
        sectionId: 2,
        sectionName: "import",
        offset: 8 + 3 + 3,
      },
    ]);
  });

  it("reports duplicate standard sections", () => {
    const report = validateWasmSectionOrder(module_(sec(1), sec(3), sec(3)));
    assert.equal(report.issues.length, 1);
    assert.equal(report.issues[0].code, "DUPLICATE_SECTION");
    assert.equal(report.issues[0].sectionId, 3);
    assert.equal(report.issues[0].offset, 8 + 3 + 3);
  });

  it("allows custom sections anywhere, repeated, and ignores their placement", () => {
    const bytes = module_(customSection("a", [1]), sec(1), customSection("b", []), customSection("b", []), sec(10), customSection("c", [9]));
    assert.equal(validateWasmSectionOrder(bytes).valid, true);
  });

  it("treats code before datacount as out of order", () => {
    const report = validateWasmSectionOrder(module_(sec(10), sec(12)));
    assert.equal(report.issues[0].code, "OUT_OF_ORDER_SECTION");
    assert.equal(report.issues[0].sectionName, "datacount");
  });

  it("reports unknown ids, malformed lengths and a bad header", () => {
    assert.equal(validateWasmSectionOrder(module_(sec(99))).issues[0].code, "UNKNOWN_SECTION");
    const truncated = new Uint8Array([...module_(sec(1)), 3, 50, 1]);
    const report = validateWasmSectionOrder(truncated);
    assert.equal(report.issues[0].code, "MALFORMED_SECTION");
    assert.equal(report.issues[0].sectionId, 3);
    assert.equal(validateWasmSectionOrder(new Uint8Array([1, 2, 3])).issues[0].code, "INVALID_HEADER");
  });
});

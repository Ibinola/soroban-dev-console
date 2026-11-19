import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractWasmMetadata } from "./wasm-metadata";
import { customSection, leb, module_, section, str } from "./wasm-test-utils";

const nameSection = (moduleName: string) => customSection("name", [0, ...leb(str(moduleName).length), ...str(moduleName)]);
const producers = customSection("producers", [
  ...leb(2),
  ...str("language"), ...leb(1), ...str("Rust"), ...str(""),
  ...str("processed-by"), ...leb(1), ...str("rustc"), ...str("1.80.0"),
]);

describe("WASM custom section metadata (#1390)", () => {
  it("returns the name and producers sections with offsets and decoded text", () => {
    const bytes = module_(nameSection("my_contract"), producers);
    const meta = extractWasmMetadata(bytes);
    assert.equal(meta.moduleName, "my_contract");
    assert.deepEqual(meta.producers, [
      { field: "language", values: [{ name: "Rust", version: "" }] },
      { field: "processed-by", values: [{ name: "rustc", version: "1.80.0" }] },
    ]);
    assert.deepEqual(meta.sections.map((s) => [s.name, s.offset]), [["name", 8], ["producers", 8 + nameSection("my_contract").length]]);
    assert.deepEqual(meta.diagnostics, []);
  });

  it("keeps reading other sections when one is malformed", () => {
    const badProducers = customSection("producers", [...leb(5), ...str("language")]); // promises 5 fields
    const bytes = module_(badProducers, nameSection("still_ok"));
    const meta = extractWasmMetadata(bytes);
    assert.equal(meta.moduleName, "still_ok");
    assert.equal(meta.producers, undefined);
    assert.equal(meta.diagnostics.length, 1);
    assert.equal(meta.diagnostics[0].code, "MALFORMED_CUSTOM_SECTION");
  });

  it("flags invalid UTF-8 in a name without failing", () => {
    const bad = customSection("name", [0, 3, 1, 0xff, 0xfe]);
    const meta = extractWasmMetadata(module_(bad));
    assert.equal(meta.moduleName, undefined);
    assert.match(meta.diagnostics[0].message, /UTF-8/);
  });

  it("ignores unrecognized custom sections and non-custom sections", () => {
    const big = customSection("huge.debug", new Array(5000).fill(1));
    const meta = extractWasmMetadata(module_(big, section(1, [0]), nameSection("m")));
    assert.deepEqual(meta.sections.map((s) => s.name), ["name"]);
    assert.equal(meta.moduleName, "m");
  });

  it("reports a bad header and a truncated trailing section", () => {
    assert.equal(extractWasmMetadata(new Uint8Array([1, 2, 3])).diagnostics[0].code, "INVALID_HEADER");
    const ok = nameSection("m");
    const bytes = module_(ok, [0, 50, 1, 2]); // declares 50 bytes, has 2
    const meta = extractWasmMetadata(bytes);
    assert.equal(meta.moduleName, "m");
    assert.equal(meta.diagnostics[0].code, "TRUNCATED_SECTION");
  });

  it("returns empty metadata for a module without custom sections", () => {
    const meta = extractWasmMetadata(module_(section(1, [0])));
    assert.deepEqual(meta, { sections: [], diagnostics: [] });
  });
});

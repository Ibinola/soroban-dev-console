import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportWasmImports } from "./wasm-imports";
import { leb, module_, section, str } from "./wasm-test-utils";

const fnImport = (m: string, f: string, typeIdx = 0) => [...str(m), ...str(f), 0, ...leb(typeIdx)];
const memImport = (m: string, f: string) => [...str(m), ...str(f), 2, 0x01, ...leb(1), ...leb(16)];
const importSection = (...entries: number[][]) => section(2, [...leb(entries.length), ...entries.flat()]);

describe("WASM import capability report (#1391)", () => {
  it("lists imports in deterministic order and separates unsupported modules", () => {
    const bytes = module_(
      importSection(fnImport("x", "9"), fnImport("env", "abort"), fnImport("a", "0"), fnImport("x", "1"), memImport("env", "memory")),
    );
    const report = reportWasmImports(bytes);
    assert.deepEqual(report.recognized.map((i) => `${i.module}.${i.field}`), ["a.0", "x.1", "x.9"]);
    assert.deepEqual(report.unsupported.map((i) => `${i.module}.${i.field}:${i.kind}`), ["env.abort:function", "env.memory:memory"]);
    assert.equal(report.total, 5);
    assert.deepEqual(report.diagnostics, []);
  });

  it("gives the same report regardless of the import order in the module", () => {
    const a = reportWasmImports(module_(importSection(fnImport("l", "1"), fnImport("m", "2"))));
    const b = reportWasmImports(module_(importSection(fnImport("m", "2"), fnImport("l", "1"))));
    assert.deepEqual(a, b);
  });

  it("returns an empty report for a module with no import section", () => {
    const report = reportWasmImports(module_(section(1, [0])));
    assert.deepEqual(report, { recognized: [], unsupported: [], total: 0, diagnostics: [] });
  });

  it("returns structured diagnostics for a malformed import section and keeps earlier imports", () => {
    const entries = [...leb(2), ...fnImport("a", "0"), ...str("b"), ...str("1"), 9]; // unknown kind 9
    const report = reportWasmImports(module_(section(2, entries)));
    assert.equal(report.recognized.length, 1);
    assert.equal(report.diagnostics[0].code, "MALFORMED_IMPORT_SECTION");
    assert.equal(report.diagnostics[0].sectionId, 2);
    assert.ok(report.diagnostics[0].offset > 0);
  });

  it("reports a truncated section and a bad header", () => {
    assert.equal(reportWasmImports(new Uint8Array([0, 1])).diagnostics[0].code, "INVALID_HEADER");
    const truncated = new Uint8Array([...module_(), 2, 40, 1, 0]);
    assert.equal(reportWasmImports(truncated).diagnostics[0].code, "TRUNCATED_SECTION");
  });

  it("skips table, global and 64-bit memory descriptors correctly", () => {
    const table = [...str("env"), ...str("t"), 1, 0x70, 0x00, ...leb(1)];
    const global = [...str("env"), ...str("g"), 3, 0x7f, 0x00];
    const mem64 = [...str("env"), ...str("m"), 2, 0x05, ...leb(1), ...leb(2)];
    const report = reportWasmImports(module_(importSection(table, global, mem64, fnImport("l", "0"))));
    assert.deepEqual(report.diagnostics, []);
    assert.equal(report.total, 4);
    assert.deepEqual(report.unsupported.map((i) => i.kind), ["global", "memory", "table"]);
  });
});

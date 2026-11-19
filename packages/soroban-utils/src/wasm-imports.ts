import { scanWasmSections, WasmReader, WasmReadError, type WasmDiagnostic } from "./wasm";

export type WasmImportKind = "function" | "table" | "memory" | "global" | "tag";

export interface WasmImportEntry {
  module: string;
  field: string;
  kind: WasmImportKind;
}

export interface WasmImportReport {
  /** Imports from modules the Soroban host provides. */
  recognized: WasmImportEntry[];
  /** Imports from any other module; a deployed contract cannot satisfy these. */
  unsupported: WasmImportEntry[];
  total: number;
  diagnostics: WasmDiagnostic[];
}

/**
 * Soroban host function modules (protocol 20+): each is a single lower-case
 * letter. Anything else (`env`, `wasi_snapshot_preview1`, ...) is unexpected.
 */
export const SOROBAN_HOST_MODULES: readonly string[] = [
  "a", "b", "c", "d", "e", "f", "g", "i", "l", "m", "p", "t", "v", "x",
];

const IMPORT_SECTION_ID = 2;
const KINDS: WasmImportKind[] = ["function", "table", "memory", "global", "tag"];

function skipLimits(reader: WasmReader): void {
  const flag = reader.byte();
  if (flag > 7) throw new WasmReadError(`invalid limits flag ${flag}`, reader.pos - 1);
  const is64 = (flag & 0x04) !== 0;
  const hasMax = (flag & 0x01) !== 0;
  const leb = () => (is64 ? reader.skipLeb(10) : reader.u32());
  leb();
  if (hasMax) leb();
}

const compare = (a: WasmImportEntry, b: WasmImportEntry) =>
  a.module < b.module ? -1 : a.module > b.module ? 1 : a.field < b.field ? -1 : a.field > b.field ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;

/** Summarize a module's imports, in deterministic (module, field, kind) order. */
export function reportWasmImports(bytes: Uint8Array): WasmImportReport {
  const scan = scanWasmSections(bytes);
  const report: WasmImportReport = { recognized: [], unsupported: [], total: 0, diagnostics: [...scan.diagnostics] };
  const all: WasmImportEntry[] = [];

  for (const section of scan.sections) {
    if (section.id !== IMPORT_SECTION_ID) continue;
    const reader = new WasmReader(bytes, section.payloadOffset, section.payloadOffset + section.size);
    try {
      const count = reader.u32();
      for (let i = 0; i < count; i += 1) {
        const module = reader.name();
        const field = reader.name();
        const kindByte = reader.byte();
        const kind = KINDS[kindByte];
        if (!kind) throw new WasmReadError(`unknown import kind ${kindByte}`, reader.pos - 1);
        switch (kind) {
          case "function":
            reader.u32();
            break;
          case "table":
            reader.byte();
            skipLimits(reader);
            break;
          case "memory":
            skipLimits(reader);
            break;
          case "global":
            reader.byte();
            reader.byte();
            break;
          case "tag":
            reader.byte();
            reader.u32();
            break;
        }
        all.push({ module, field, kind });
      }
    } catch (error) {
      // Keep the imports read before the problem; report where it happened.
      report.diagnostics.push({
        code: "MALFORMED_IMPORT_SECTION",
        message: error instanceof Error ? error.message : "malformed import section",
        offset: error instanceof WasmReadError ? error.offset : section.offset,
        sectionId: section.id,
      });
    }
  }

  all.sort(compare);
  for (const entry of all) {
    (SOROBAN_HOST_MODULES.includes(entry.module) ? report.recognized : report.unsupported).push(entry);
  }
  report.total = all.length;
  return report;
}

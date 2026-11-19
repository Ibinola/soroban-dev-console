import { scanWasmSections, WasmReader, WasmReadError, type WasmDiagnostic, type WasmSection } from "./wasm";

export interface WasmProducerField {
  field: string;
  values: Array<{ name: string; version: string }>;
}

export interface WasmCustomSectionInfo {
  /** The custom section's own name. */
  name: string;
  /** Offset of the section id byte. */
  offset: number;
  /** Payload size in bytes. */
  size: number;
}

export interface WasmMetadata {
  /** Module name from the `name` section, when present and valid. */
  moduleName?: string;
  /** Entries from the `producers` section, when present and valid. */
  producers?: WasmProducerField[];
  /** The recognized custom sections that were found, with byte offsets. */
  sections: WasmCustomSectionInfo[];
  /** Problems found; a malformed section never stops the others being read. */
  diagnostics: WasmDiagnostic[];
}

const RECOGNIZED = new Set(["name", "producers"]);
const CUSTOM_SECTION_ID = 0;

function readModuleName(bytes: Uint8Array, section: WasmSection, nameEnd: number): string | undefined {
  const reader = new WasmReader(bytes, nameEnd, section.payloadOffset + section.size);
  while (reader.remaining > 0) {
    const subId = reader.byte();
    const subSize = reader.u32();
    if (subSize > reader.remaining) throw new WasmReadError("name subsection runs past its section", reader.pos);
    if (subId === 0) {
      return new WasmReader(bytes, reader.pos, reader.pos + subSize).name();
    }
    reader.pos += subSize;
  }
  return undefined;
}

function readProducers(bytes: Uint8Array, section: WasmSection, start: number): WasmProducerField[] {
  const reader = new WasmReader(bytes, start, section.payloadOffset + section.size);
  const fields: WasmProducerField[] = [];
  const count = reader.u32();
  for (let i = 0; i < count; i += 1) {
    const field = reader.name();
    const valueCount = reader.u32();
    const values: WasmProducerField["values"] = [];
    for (let j = 0; j < valueCount; j += 1) {
      values.push({ name: reader.name(), version: reader.name() });
    }
    fields.push({ field, values });
  }
  return fields;
}

/**
 * Extract the `name` and `producers` custom sections of a WASM module. Other
 * custom sections are skipped without reading their payloads. A malformed
 * section produces a diagnostic and does not prevent the others from being read.
 */
export function extractWasmMetadata(bytes: Uint8Array): WasmMetadata {
  const scan = scanWasmSections(bytes);
  const result: WasmMetadata = { sections: [], diagnostics: [...scan.diagnostics] };

  for (const section of scan.sections) {
    if (section.id !== CUSTOM_SECTION_ID) continue;
    const end = section.payloadOffset + section.size;
    let name: string;
    let afterName: number;
    try {
      const reader = new WasmReader(bytes, section.payloadOffset, end);
      name = reader.name(256);
      afterName = reader.pos;
    } catch (error) {
      result.diagnostics.push({
        code: "MALFORMED_CUSTOM_SECTION",
        message: error instanceof Error ? error.message : "malformed custom section name",
        offset: error instanceof WasmReadError ? error.offset : section.offset,
        sectionId: section.id,
      });
      continue;
    }
    if (!RECOGNIZED.has(name)) continue; // ignored: payload is never read or copied

    result.sections.push({ name, offset: section.offset, size: section.size });
    try {
      if (name === "name") {
        const moduleName = readModuleName(bytes, section, afterName);
        if (moduleName !== undefined) result.moduleName = moduleName;
      } else {
        result.producers = readProducers(bytes, section, afterName);
      }
    } catch (error) {
      result.diagnostics.push({
        code: "MALFORMED_CUSTOM_SECTION",
        message: `${name}: ${error instanceof Error ? error.message : "malformed section"}`,
        offset: error instanceof WasmReadError ? error.offset : section.offset,
        sectionId: section.id,
      });
    }
  }
  return result;
}

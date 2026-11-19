/**
 * Minimal, bounds-checked reader for the WebAssembly binary container format.
 * It only understands the section framing and LEB128 integers; the metadata and
 * import modules build on it. Nothing here copies section payloads.
 */

export interface WasmDiagnostic {
  /** Stable code, e.g. `TRUNCATED_SECTION`. */
  code: string;
  message: string;
  /** Byte offset in the module the problem was found at. */
  offset: number;
  sectionId?: number;
}

export interface WasmSection {
  id: number;
  /** Offset of the section id byte. */
  offset: number;
  /** Offset of the first payload byte. */
  payloadOffset: number;
  /** Payload size in bytes. */
  size: number;
}

export interface WasmSectionScan {
  sections: WasmSection[];
  diagnostics: WasmDiagnostic[];
}

export const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];
export const WASM_HEADER_BYTES = 8;

/** Cursor over a byte range that throws `WasmReadError` instead of reading past `end`. */
export class WasmReader {
  constructor(
    readonly bytes: Uint8Array,
    public pos: number,
    readonly end: number,
  ) {}

  get remaining(): number {
    return this.end - this.pos;
  }

  byte(): number {
    if (this.pos >= this.end) throw new WasmReadError("unexpected end of data", this.pos);
    return this.bytes[this.pos++];
  }

  /** Unsigned LEB128, at most 5 bytes (u32). */
  u32(): number {
    let result = 0;
    for (let i = 0; i < 5; i += 1) {
      const b = this.byte();
      result += (b & 0x7f) * 2 ** (7 * i);
      if ((b & 0x80) === 0) {
        if (result > 0xffffffff) throw new WasmReadError("u32 out of range", this.pos - 1);
        return result;
      }
    }
    throw new WasmReadError("u32 LEB128 is too long", this.pos - 1);
  }

  /** Skip an unsigned LEB128 of up to `maxBytes` (for u64 limits). */
  skipLeb(maxBytes = 10): void {
    for (let i = 0; i < maxBytes; i += 1) {
      if ((this.byte() & 0x80) === 0) return;
    }
    throw new WasmReadError("LEB128 is too long", this.pos - 1);
  }

  /** A length-prefixed UTF-8 name. Throws on invalid UTF-8. */
  name(maxLength = 4096): string {
    const len = this.u32();
    if (len > maxLength) throw new WasmReadError(`name longer than ${maxLength} bytes`, this.pos);
    if (len > this.remaining) throw new WasmReadError("name runs past the end of its section", this.pos);
    const slice = this.bytes.subarray(this.pos, this.pos + len);
    this.pos += len;
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(slice);
    } catch {
      throw new WasmReadError("name is not valid UTF-8", this.pos - len);
    }
  }
}

export class WasmReadError extends Error {
  constructor(message: string, readonly offset: number) {
    super(message);
    this.name = "WasmReadError";
  }
}

/**
 * List the sections of a module. A bad section header stops the scan (the rest
 * cannot be located) but everything found before it is still returned, with a
 * diagnostic describing why scanning stopped.
 */
export function scanWasmSections(bytes: Uint8Array): WasmSectionScan {
  const sections: WasmSection[] = [];
  const diagnostics: WasmDiagnostic[] = [];

  if (bytes.length < WASM_HEADER_BYTES || WASM_MAGIC.some((b, i) => bytes[i] !== b)) {
    diagnostics.push({ code: "INVALID_HEADER", message: "missing WebAssembly magic number or version", offset: 0 });
    return { sections, diagnostics };
  }

  const reader = new WasmReader(bytes, WASM_HEADER_BYTES, bytes.length);
  while (reader.remaining > 0) {
    const offset = reader.pos;
    try {
      const id = reader.byte();
      const size = reader.u32();
      if (size > reader.remaining) {
        diagnostics.push({
          code: "TRUNCATED_SECTION",
          message: `section ${id} declares ${size} bytes but only ${reader.remaining} remain`,
          offset,
          sectionId: id,
        });
        return { sections, diagnostics };
      }
      sections.push({ id, offset, payloadOffset: reader.pos, size });
      reader.pos += size;
    } catch (error) {
      diagnostics.push({
        code: "MALFORMED_SECTION_HEADER",
        message: error instanceof Error ? error.message : "malformed section header",
        offset,
      });
      return { sections, diagnostics };
    }
  }
  return { sections, diagnostics };
}

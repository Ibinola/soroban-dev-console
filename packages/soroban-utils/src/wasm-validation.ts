/**
 * Issue #1090: WASM Deployer magic header byte validation & drag-and-drop helpers.
 * Issue #1091: WASM file size formatting & warning limit constants.
 */

/**
 * Standard WebAssembly binary magic bytes: \0asm (0x00, 0x61, 0x73, 0x6d).
 */
export const WASM_MAGIC_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);

/**
 * Standard WebAssembly binary version 1: (0x01, 0x00, 0x00, 0x00).
 */
export const WASM_VERSION_1_BYTES = new Uint8Array([0x01, 0x00, 0x00, 0x00]);

/**
 * Soroban network recommended WASM contract size threshold (64 KB).
 * Contracts larger than 64 KB will trigger a warning.
 */
export const SOROBAN_WASM_WARN_LIMIT_BYTES = 64 * 1024;

export interface WasmBinaryValidation {
  valid: boolean;
  error?: string;
}

/**
 * Verifies if the provided bytes start with the WebAssembly magic header (\0asm).
 */
export function isValidWasmHeader(bytes: Uint8Array | ArrayBuffer | Buffer): boolean {
  if (!bytes) return false;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 4) return false;
  return (
    u8[0] === WASM_MAGIC_BYTES[0] &&
    u8[1] === WASM_MAGIC_BYTES[1] &&
    u8[2] === WASM_MAGIC_BYTES[2] &&
    u8[3] === WASM_MAGIC_BYTES[3]
  );
}

/**
 * Validates a WebAssembly binary for minimal byte length and correct magic header bytes.
 */
export function validateWasmBinary(bytes: Uint8Array | ArrayBuffer | Buffer): WasmBinaryValidation {
  if (!bytes) {
    return { valid: false, error: "No file content provided." };
  }
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length === 0) {
    return { valid: false, error: "Selected file is empty (0 bytes)." };
  }
  if (u8.length < 8) {
    return {
      valid: false,
      error: "File is too small to be a valid WebAssembly binary (must be at least 8 bytes).",
    };
  }
  if (!isValidWasmHeader(u8)) {
    return {
      valid: false,
      error: "Invalid WASM file: Missing WebAssembly magic header bytes (\\0asm).",
    };
  }
  return { valid: true };
}

/**
 * Formats a file size in bytes to human-readable string (e.g., 42.50 KB).
 */
export function formatWasmFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Checks if a WASM file exceeds the 64 KB warning threshold.
 */
export function isWasmOverWarningLimit(sizeBytes: number): boolean {
  return sizeBytes > SOROBAN_WASM_WARN_LIMIT_BYTES;
}

// ---------------------------------------------------------------------------
// Section ordering (#1392)
// ---------------------------------------------------------------------------

export interface WasmSectionIssue {
  code: "DUPLICATE_SECTION" | "OUT_OF_ORDER_SECTION" | "UNKNOWN_SECTION" | "MALFORMED_SECTION" | "INVALID_HEADER";
  message: string;
  /** Numeric section id, when one applies. */
  sectionId?: number;
  sectionName?: string;
  /** Byte offset of the section's id byte. */
  offset: number;
}

export interface WasmSectionOrderReport {
  valid: boolean;
  issues: WasmSectionIssue[];
}

const WASM_SECTION_NAMES: Record<number, string> = {
  0: "custom",
  1: "type",
  2: "import",
  3: "function",
  4: "table",
  5: "memory",
  6: "global",
  7: "export",
  8: "start",
  9: "element",
  10: "code",
  11: "data",
  12: "datacount",
  13: "tag",
};

/**
 * Required relative order of the standard sections. DataCount (12) sits before
 * Code (10) and Tag (13) between Memory and Global, so numeric id order is not
 * the real order. Custom sections (0) may appear anywhere and are not ranked.
 */
const WASM_SECTION_RANK: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  13: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  12: 11,
  10: 12,
  11: 13,
};

/**
 * Check the standard sections of a WASM module for duplicates and ordering
 * mistakes. Custom sections are exempt. Every issue names the section and the
 * byte offset of its id byte.
 */
export function validateWasmSectionOrder(bytes: Uint8Array | ArrayBuffer | Buffer): WasmSectionOrderReport {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const issues: WasmSectionIssue[] = [];

  if (u8.length < 8 || !isValidWasmHeader(u8)) {
    return {
      valid: false,
      issues: [{ code: "INVALID_HEADER", message: "missing WebAssembly header", offset: 0 }],
    };
  }

  const readU32 = (pos: number): { value: number; next: number } | null => {
    let value = 0;
    for (let i = 0; i < 5; i += 1) {
      if (pos + i >= u8.length) return null;
      const b = u8[pos + i];
      value += (b & 0x7f) * 2 ** (7 * i);
      if ((b & 0x80) === 0) return { value, next: pos + i + 1 };
    }
    return null;
  };

  const seen = new Set<number>();
  let highestRank = 0;
  let highestId = 0;
  let pos = 8;
  while (pos < u8.length) {
    const offset = pos;
    const id = u8[pos];
    const size = readU32(pos + 1);
    if (!size || size.next + size.value > u8.length) {
      issues.push({
        code: "MALFORMED_SECTION",
        message: `section ${WASM_SECTION_NAMES[id] ?? id} has a missing or oversized length`,
        sectionId: id,
        sectionName: WASM_SECTION_NAMES[id],
        offset,
      });
      break; // later sections cannot be located
    }
    pos = size.next + size.value;

    if (id === 0) continue;
    const name = WASM_SECTION_NAMES[id];
    const rank = WASM_SECTION_RANK[id];
    if (rank === undefined) {
      issues.push({ code: "UNKNOWN_SECTION", message: `unknown section id ${id}`, sectionId: id, offset });
      continue;
    }
    if (seen.has(id)) {
      issues.push({ code: "DUPLICATE_SECTION", message: `${name} section appears more than once`, sectionId: id, sectionName: name, offset });
      continue;
    }
    seen.add(id);
    if (rank < highestRank) {
      issues.push({
        code: "OUT_OF_ORDER_SECTION",
        message: `${name} section must come before the ${WASM_SECTION_NAMES[highestId]} section`,
        sectionId: id,
        sectionName: name,
        offset,
      });
    } else {
      highestRank = rank;
      highestId = id;
    }
  }

  return { valid: issues.length === 0, issues };
}

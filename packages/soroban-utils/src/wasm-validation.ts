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

/**
 * Issue #1091: Display WASM file size and exported functions preview before upload
 * Issue #1092: Detect constructor/init functions in uploaded WASM spec
 */

import {
  type NormalizedContractFunction,
  type NormalizedContractSpec,
  createNormalizedContractSpecFromFunctionNames,
} from "./contract-spec";
import {
  isValidWasmHeader,
  validateWasmBinary,
  formatWasmFileSize,
  isWasmOverWarningLimit,
  SOROBAN_WASM_WARN_LIMIT_BYTES,
} from "./wasm-validation";

export interface WasmParsedFunction {
  name: string;
  signature: string;
  isConstructor: boolean;
  inputs: Array<{ name: string; type: string; doc?: string }>;
  outputs: Array<{ name: string; type: string; doc?: string }>;
  doc?: string;
}

export interface WasmParsedSpec {
  valid: boolean;
  sizeBytes: number;
  formattedSize: string;
  isOverWarnLimit: boolean;
  warnLimitBytes: number;
  functions: string[];
  parsedFunctions: WasmParsedFunction[];
  specFunctions: NormalizedContractFunction[];
  hasConstructor: boolean;
  constructorFunction?: WasmParsedFunction;
  error?: string;
}

/**
 * Checks if a function name indicates a contract constructor or initialization function.
 */
export function isConstructorFunction(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower === "__constructor" ||
    lower === "init" ||
    lower === "initialize" ||
    lower === "constructor" ||
    lower === "new"
  );
}

/**
 * Formats a normalized function into a readable signature string, e.g. "init(admin: address, decimals: u32)"
 */
export function formatFunctionSignature(fn: NormalizedContractFunction): string {
  const inputs = (fn.inputs || [])
    .map((input) => `${input.name}: ${input.type}`)
    .join(", ");
  const outputs = (fn.outputs || [])
    .map((output) => output.type)
    .join(", ");

  const base = `${fn.name}(${inputs})`;
  if (outputs.length > 0) {
    return `${base} -> ${outputs}`;
  }
  return base;
}

/**
 * Reads variable-length unsigned integer (LEB128) from WebAssembly bytes.
 */
function readVarUint(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  for (;;) {
    if (pos >= bytes.length) break;
    const byte = bytes[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, next: pos };
}

/**
 * Extracts a custom section by name from a compiled WebAssembly binary.
 */
export function extractWasmCustomSection(
  wasmBytes: Uint8Array,
  targetSectionName: string,
): Uint8Array | null {
  if (wasmBytes.length < 8 || !isValidWasmHeader(wasmBytes)) {
    return null;
  }

  let offset = 8;
  while (offset < wasmBytes.length) {
    const sectionId = wasmBytes[offset++];
    const { value: sectionLength, next } = readVarUint(wasmBytes, offset);
    offset = next;
    const sectionEnd = offset + sectionLength;

    if (sectionId === 0) {
      // Custom section
      const { value: nameLength, next: nameStart } = readVarUint(wasmBytes, offset);
      if (nameStart + nameLength <= sectionEnd) {
        let name = "";
        for (let i = 0; i < nameLength; i++) {
          name += String.fromCharCode(wasmBytes[nameStart + i]);
        }
        if (name === targetSectionName) {
          return wasmBytes.slice(nameStart + nameLength, sectionEnd);
        }
      }
    }

    offset = sectionEnd;
  }

  return null;
}

/**
 * Client-side parser for WASM binary files.
 * Extracts function signatures, environment spec, file size, warnings, and constructor information.
 */
export async function parseWasmClientSpec(
  buffer: Uint8Array | ArrayBuffer | Buffer,
): Promise<WasmParsedSpec> {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const sizeBytes = u8.length;
  const formattedSize = formatWasmFileSize(sizeBytes);
  const isOverWarnLimit = isWasmOverWarningLimit(sizeBytes);

  const validation = validateWasmBinary(u8);
  if (!validation.valid) {
    return {
      valid: false,
      sizeBytes,
      formattedSize,
      isOverWarnLimit,
      warnLimitBytes: SOROBAN_WASM_WARN_LIMIT_BYTES,
      functions: [],
      parsedFunctions: [],
      specFunctions: [],
      hasConstructor: false,
      error: validation.error,
    };
  }

  const fnNames: string[] = [];
  const specFunctions: NormalizedContractFunction[] = [];
  const parsedFunctions: WasmParsedFunction[] = [];

  try {
    // 1. Check custom section 'contractspecv0'
    const specSection = extractWasmCustomSection(u8, "contractspecv0");
    if (specSection && specSection.length > 0) {
      const decoder = new TextDecoder("utf-8");
      const asText = decoder.decode(specSection);
      const candidates = asText.match(/[A-Za-z_][A-Za-z0-9_]{1,40}/g) ?? [];

      const reserved = new Set([
        "contract",
        "spec",
        "entry",
        "function",
        "struct",
        "enum",
        "type",
        "symbol",
        "address",
        "string",
        "i32",
        "i64",
        "i128",
        "u32",
        "u64",
        "u128",
        "bool",
        "vec",
        "map",
        "bytes",
        "void",
        "contractspecv0",
      ]);

      for (const rawName of candidates) {
        if (!reserved.has(rawName.toLowerCase()) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(rawName)) {
          if (!fnNames.includes(rawName)) {
            fnNames.push(rawName);
          }
        }
      }
    }

    // 2. Try compiling WebAssembly module to inspect exported functions
    if (typeof WebAssembly !== "undefined") {
      try {
        const module = await WebAssembly.compile(u8 as unknown as BufferSource);
        const exports = WebAssembly.Module.exports(module);
        for (const exp of exports) {
          if (exp.kind === "function" && !exp.name.startsWith("__") && !fnNames.includes(exp.name)) {
            fnNames.push(exp.name);
          } else if (exp.name === "__constructor" && !fnNames.includes(exp.name)) {
            fnNames.unshift(exp.name);
          }
        }
      } catch {
        // Fall back to custom section / heuristic
      }
    }

    // Ensure constructor is prioritized if found
    fnNames.sort((a, b) => {
      if (isConstructorFunction(a)) return -1;
      if (isConstructorFunction(b)) return 1;
      return a.localeCompare(b);
    });

    for (const name of fnNames) {
      const isConstructor = isConstructorFunction(name);
      const fnObj: NormalizedContractFunction = {
        name,
        inputs: [],
        outputs: [],
      };
      specFunctions.push(fnObj);

      parsedFunctions.push({
        name,
        signature: formatFunctionSignature(fnObj),
        isConstructor,
        inputs: [],
        outputs: [],
      });
    }

    const constructorFunction = parsedFunctions.find((f) => f.isConstructor);

    return {
      valid: true,
      sizeBytes,
      formattedSize,
      isOverWarnLimit,
      warnLimitBytes: SOROBAN_WASM_WARN_LIMIT_BYTES,
      functions: fnNames,
      parsedFunctions,
      specFunctions,
      hasConstructor: !!constructorFunction,
      constructorFunction,
    };
  } catch (err: any) {
    return {
      valid: true,
      sizeBytes,
      formattedSize,
      isOverWarnLimit,
      warnLimitBytes: SOROBAN_WASM_WARN_LIMIT_BYTES,
      functions: fnNames.length > 0 ? fnNames : ["(No functions found)"],
      parsedFunctions,
      specFunctions,
      hasConstructor: false,
      error: `Metadata parsing warning: ${err?.message || "Unknown"}`,
    };
  }
}

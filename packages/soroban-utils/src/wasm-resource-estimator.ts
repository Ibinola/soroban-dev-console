/**
 * Issue #1281: WASM function resource estimator for deployment recommendations.
 *
 * Dependency-free, linear scan of a compiled WebAssembly module. Each function's
 * code-section body size is used as an instruction-count proxy (a WASM
 * instruction is 1-5 bytes, so the body size is a documented over-estimate), and
 * the module's declared linear memory is attributed evenly across functions.
 *
 * The estimate is intentionally cheap and deterministic: it exists to rank
 * functions and flag the ones likely to exceed the network's resource limits
 * before a deploy is attempted.
 */

export interface WasmFunctionResourceEstimate {
  /** Function index in the module's index space (imported functions first). */
  index: number;
  /** Export name, or `func_<index>` when the function is not exported. */
  name: string;
  /** Size of the function's code-section body, in bytes. */
  bodyBytes: number;
  /** Body bytes used as an instruction-count proxy. */
  estimatedInstructions: number;
  /** Evenly attributed share of the module's declared linear memory. */
  estimatedMemoryBytes: number;
  /** True when the estimate exceeds the configured threshold. */
  exceedsThreshold: boolean;
}

export interface WasmResourceEstimate {
  valid: boolean;
  functionCount: number;
  totalBodyBytes: number;
  totalMemoryBytes: number;
  memoryPages: number;
  threshold: number;
  /** Functions sorted by estimated instruction count, largest first. */
  functions: WasmFunctionResourceEstimate[];
  error?: string;
}

export const DEFAULT_WASM_RESOURCE_THRESHOLD = 1_000;
export const WASM_PAGE_SIZE_BYTES = 65_536;

interface Reader {
  bytes: Uint8Array;
  offset: number;
}

interface SectionInfo {
  id: number;
  start: number;
  end: number;
}

function readVarUint(reader: Reader): number {
  let result = 0;
  let shift = 0;
  for (;;) {
    if (reader.offset >= reader.bytes.length) {
      throw new Error("Unexpected end of WASM binary");
    }
    const byte = reader.bytes[reader.offset++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error("Malformed LEB128 integer");
  }
  return result >>> 0;
}

/** Reads a WASM limits descriptor: flags, minimum, and optional maximum. */
function readLimits(reader: Reader): void {
  const flags = readVarUint(reader);
  readVarUint(reader); // minimum
  if (flags & 0x01) readVarUint(reader); // maximum
}

function readName(reader: Reader): string {
  const length = readVarUint(reader);
  const end = reader.offset + length;
  if (end > reader.bytes.length)
    throw new Error("Unexpected end of WASM binary");
  let name = "";
  for (let i = reader.offset; i < end; i++) {
    name += String.fromCharCode(reader.bytes[i]);
  }
  reader.offset = end;
  return name;
}

function isWasmHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x73 &&
    bytes[3] === 0x6d &&
    bytes[4] === 0x01
  );
}

function readSections(bytes: Uint8Array): SectionInfo[] {
  const reader: Reader = { bytes, offset: 8 };
  const sections: SectionInfo[] = [];

  while (reader.offset < bytes.length) {
    const id = bytes[reader.offset++];
    const size = readVarUint(reader);
    const start = reader.offset;
    const end = start + size;
    if (end > bytes.length) throw new Error("Truncated WASM section");
    sections.push({ id, start, end });
    reader.offset = end;
  }

  return sections;
}

/** Imported function count — imported functions occupy the lowest indices. */
function countImportedFunctions(
  bytes: Uint8Array,
  section: SectionInfo,
): number {
  const reader: Reader = { bytes, offset: section.start };
  const count = readVarUint(reader);
  let imported = 0;

  for (let i = 0; i < count; i++) {
    readName(reader); // module
    readName(reader); // field
    const kind = bytes[reader.offset++];

    switch (kind) {
      case 0x00: // function
        readVarUint(reader); // type index
        imported++;
        break;
      case 0x01: // table
        reader.offset += 1; // reference type
        readLimits(reader);
        break;
      case 0x02: // memory
        readLimits(reader);
        break;
      case 0x03: // global
        reader.offset += 2; // value type + mutability
        break;
      default:
        throw new Error(`Unsupported WASM import kind 0x${kind.toString(16)}`);
    }
  }

  return imported;
}

/** Declared minimum linear memory, in 64KiB pages. */
function readMemoryPages(bytes: Uint8Array, section: SectionInfo): number {
  const reader: Reader = { bytes, offset: section.start };
  const count = readVarUint(reader);
  if (count === 0) return 0;
  const flags = readVarUint(reader);
  const minimum = readVarUint(reader);
  if (flags & 0x01) readVarUint(reader); // maximum, unused
  return minimum;
}

/** Code-section body sizes, in declaration order. */
function readCodeBodySizes(bytes: Uint8Array, section: SectionInfo): number[] {
  const reader: Reader = { bytes, offset: section.start };
  const count = readVarUint(reader);
  const sizes: number[] = [];

  for (let i = 0; i < count; i++) {
    const bodySize = readVarUint(reader);
    sizes.push(bodySize);
    reader.offset += bodySize;
  }

  return sizes;
}

/** Exported function names, keyed by function index. */
function readExportedFunctionNames(
  bytes: Uint8Array,
  section: SectionInfo,
): Map<number, string> {
  const reader: Reader = { bytes, offset: section.start };
  const count = readVarUint(reader);
  const names = new Map<number, string>();

  for (let i = 0; i < count; i++) {
    const name = readName(reader);
    const kind = bytes[reader.offset++];
    const index = readVarUint(reader);
    if (kind === 0x00 && !names.has(index)) names.set(index, name);
  }

  return names;
}

function invalidEstimate(
  threshold: number,
  message?: string,
): WasmResourceEstimate {
  return {
    valid: false,
    functionCount: 0,
    totalBodyBytes: 0,
    totalMemoryBytes: 0,
    memoryPages: 0,
    threshold,
    functions: [],
    ...(message ? { error: message } : {}),
  };
}

/**
 * Estimate the resource footprint of every function in a WASM module.
 *
 * @param input - compiled WASM bytes (or a buffer view of them)
 * @param options.threshold - instruction-count estimate above which a function is flagged
 */
export function estimateWasmResources(
  input: Uint8Array | ArrayBuffer,
  options?: { threshold?: number },
): WasmResourceEstimate {
  const threshold = options?.threshold ?? DEFAULT_WASM_RESOURCE_THRESHOLD;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (!isWasmHeader(bytes))
    return invalidEstimate(threshold, "Not a valid WASM module");

  try {
    const sections = readSections(bytes);
    const importSection = sections.find((section) => section.id === 2);
    const memorySection = sections.find((section) => section.id === 5);
    const exportSection = sections.find((section) => section.id === 7);
    const codeSection = sections.find((section) => section.id === 10);

    const importedFunctions = importSection
      ? countImportedFunctions(bytes, importSection)
      : 0;
    const memoryPages = memorySection
      ? readMemoryPages(bytes, memorySection)
      : 0;
    const exportedNames = exportSection
      ? readExportedFunctionNames(bytes, exportSection)
      : new Map<number, string>();
    const bodySizes = codeSection ? readCodeBodySizes(bytes, codeSection) : [];

    const totalMemoryBytes = memoryPages * WASM_PAGE_SIZE_BYTES;
    const estimatedMemoryBytes =
      bodySizes.length > 0 ? Math.ceil(totalMemoryBytes / bodySizes.length) : 0;

    const functions: WasmFunctionResourceEstimate[] = bodySizes
      .map((bodyBytes, offset) => {
        const index = importedFunctions + offset;
        return {
          index,
          name: exportedNames.get(index) ?? `func_${index}`,
          bodyBytes,
          estimatedInstructions: bodyBytes,
          estimatedMemoryBytes,
          exceedsThreshold: bodyBytes > threshold,
        };
      })
      .sort((a, b) => b.estimatedInstructions - a.estimatedInstructions);

    return {
      valid: true,
      functionCount: functions.length,
      totalBodyBytes: bodySizes.reduce((total, size) => total + size, 0),
      totalMemoryBytes,
      memoryPages,
      threshold,
      functions,
    };
  } catch (error) {
    return invalidEstimate(
      threshold,
      error instanceof Error ? error.message : "Failed to analyse WASM module",
    );
  }
}

/** Functions whose estimate exceeds the threshold, largest first. */
export function findResourceHeavyFunctions(
  input: Uint8Array | ArrayBuffer,
  options?: { threshold?: number },
): WasmFunctionResourceEstimate[] {
  return estimateWasmResources(input, options).functions.filter(
    (fn) => fn.exceedsThreshold,
  );
}

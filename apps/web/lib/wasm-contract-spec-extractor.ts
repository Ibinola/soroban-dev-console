/**
 * Extract the raw "contractspecv0" custom section bytes from a Soroban
 * contract WASM binary, for ABI decoding. (#925)
 */
const CUSTOM_SECTION_ID = 0;
const WASM_MAGIC_AND_VERSION_LENGTH = 8;

function readVarUint(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  for (;;) {
    const byte = bytes[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, next: pos };
}

export function extractContractSpecSection(wasm: Uint8Array): Uint8Array | null {
  let offset = WASM_MAGIC_AND_VERSION_LENGTH;

  while (offset < wasm.length) {
    const sectionId = wasm[offset++];
    const { value: sectionLength, next } = readVarUint(wasm, offset);
    offset = next;
    const sectionEnd = offset + sectionLength;

    if (sectionId === CUSTOM_SECTION_ID) {
      const { value: nameLength, next: nameStart } = readVarUint(wasm, offset);
      const name = Buffer.from(wasm.slice(nameStart, nameStart + nameLength)).toString("utf-8");
      if (name === "contractspecv0") {
        return wasm.slice(nameStart + nameLength, sectionEnd);
      }
    }

    offset = sectionEnd;
  }

  return null;
}

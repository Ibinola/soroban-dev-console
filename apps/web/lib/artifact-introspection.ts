import { WasmEntry } from "../store/useWasmStore";

export interface ArtifactIntrospection {
  contractId: string;
  wasmHash?: string;
  lastModifiedLedger?: number;
  localArtifact?: WasmEntry;
  hasOnchainCode: boolean;
  hasLocalArtifact: boolean;
}

export function buildArtifactIntrospection(
  contractId: string,
  wasmHash: string | undefined,
  lastModifiedLedger: number | undefined,
  wasms: WasmEntry[],
): ArtifactIntrospection {
  const localArtifact = wasmHash
    ? wasms.find((w) => w.hash === wasmHash)
    : undefined;

  return {
    contractId,
    wasmHash,
    lastModifiedLedger,
    localArtifact,
    hasOnchainCode: !!wasmHash,
    hasLocalArtifact: !!localArtifact,
  };
}

export function formatWasmHash(hash: string | undefined): string {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

export interface WasmSectionSizes {
  code: number;
  data: number;
  custom: number;
  total: number;
}

function readUleb128(buffer: Uint8Array, offset: number): { value: number; length: number } {
  let result = 0;
  let shift = 0;
  let length = 0;
  while (true) {
    if (offset + length >= buffer.length) break;
    const byte = buffer[offset + length];
    length++;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, length };
}

export function parseWasmSectionSizes(buffer: Uint8Array): WasmSectionSizes {
  const sizes = { code: 0, data: 0, custom: 0, total: buffer.length };
  if (buffer.length < 8) return sizes;

  // Check magic \0asm
  if (buffer[0] !== 0x00 || buffer[1] !== 0x61 || buffer[2] !== 0x73 || buffer[3] !== 0x6d) {
    return sizes;
  }

  let offset = 8;
  while (offset < buffer.length) {
    const id = buffer[offset];
    offset++;

    if (offset >= buffer.length) break;

    const { value: size, length: sizeLen } = readUleb128(buffer, offset);
    offset += sizeLen;

    if (id === 10) sizes.code += size;
    else if (id === 11) sizes.data += size;
    else if (id === 0) sizes.custom += size;

    offset += size;
  }
  
  return sizes;
}

// frontend/services/wasm-parser.service.ts
import { parseWasmClientSpec, type WasmParsedSpec } from "@devconsole/soroban-utils";

export async function parseContractWasmSpec(wasmBytes: Uint8Array): Promise<{
  success: boolean;
  spec?: WasmParsedSpec;
  error?: string;
}> {
  try {
    const spec = await parseWasmClientSpec(wasmBytes);
    if (!spec.valid) {
      return {
        success: false,
        error: spec.error || "Invalid WASM binary",
      };
    }

    return {
      success: true,
      spec,
    };
  } catch (error: any) {
    console.error("Failed to parse contract WASM bytecode spec:", error);
    return {
      success: false,
      error: error?.message || "Invalid WASM bytecode or unsupported spec version",
    };
  }
}
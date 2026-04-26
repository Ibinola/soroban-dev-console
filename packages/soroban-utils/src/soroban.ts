import { rpc as SorobanRpc, xdr, Address } from "@stellar/stellar-sdk";

const TESTNET_RPC_URL = "https://soroban-testnet.stellar.org:443";

export const server = new SorobanRpc.Server(TESTNET_RPC_URL);

export async function getContractInfo(contractId: string) {
  try {
    // Fetch the ledger entry for the contract code
    // Note: In a real app, you might need to look up the WASM hash from the Contract Instance first
    // For this Wave 1 MVP, we will try to get the basic ledger entry to prove it exists
    const account = await server.getLedgerEntry(
      xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: new Address(contractId).toScAddress(),
          key: xdr.ScVal.scvLedgerKeyContractInstance(),
          durability: xdr.ContractDataDurability.persistent(),
        }),
      ),
    );

    return account;
  } catch (error) {
    console.error("Error fetching contract:", error);
    return null;
  }
}

export async function fetchContractSpec(contractId: string, rpcUrl: string) {
  const server = new SorobanRpc.Server(rpcUrl);

  try {
    // 1. Get the Contract Instance entry
    const instanceKey = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(contractId).toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
      }),
    );

    const instanceEntry = await server.getLedgerEntry(instanceKey);
    if (
      !instanceEntry ||
      !instanceEntry.val.contractData().val().instance().executable().wasmHash()
    ) {
      throw new Error("No WASM hash found for this contract instance.");
    }

    // 2. Get the WASM hash to find the code entry
    const wasmHash = instanceEntry.val
      .contractData()
      .val()
      .instance()
      .executable()
      .wasmHash();

    // 3. Fetch the Contract Code entry which contains the interface spec
    const codeKey = xdr.LedgerKey.contractCode(
      new xdr.LedgerKeyContractCode({ hash: wasmHash }),
    );

    const codeEntry = await server.getLedgerEntry(codeKey);
    // Note: The spec is stored in the 'metadata' or 'body' depending on the Soroban version
    // For Protocol 20+, we look for the ScSpecEntry array
    return codeEntry;
  } catch (error) {
    console.error("Failed to fetch contract spec:", error);
    throw error;
  }
}

export async function parseWasmMetadata(buffer: Uint8Array | ArrayBuffer): Promise<string[]> {
  try {
    // Try to read Soroban's contract spec custom section (contractspecv0)
    if (typeof WebAssembly !== "undefined") {
      const wasmBytes =
        buffer instanceof Uint8Array ? Uint8Array.from(buffer) : new Uint8Array(buffer);

      const module = await WebAssembly.compile(wasmBytes);
      const sections = WebAssembly.Module.customSections(
        module,
        "contractspecv0",
      );

      if (sections.length > 0) {
        const rawSection = new Uint8Array(sections[0]);
        const decoder = new TextDecoder("utf-8");
        const asText = decoder.decode(rawSection);

        // Heuristic extraction of probable function names from the spec bytes.
        // This avoids depending on full XDR decoding while still surfacing
        // useful names for the UI.
        const candidates =
          asText.match(/[A-Za-z_][A-Za-z0-9_]{2,40}/g) ?? [];

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
        ]);

        const unique = Array.from(
          new Set(
            candidates.filter(
              (name) =>
                !reserved.has(name.toLowerCase()) &&
                // Soroban function names are typically lower_snake_case
                /^[a-z][a-z0-9_]*$/.test(name),
            ),
          ),
        );

        if (unique.length > 0) {
          return unique;
        }
      }
    }

    // Fallback: still return a helpful placeholder so the UI can render
    return ["(No public functions found)"];
  } catch (e) {
    console.error("WASM Parsing Error:", e);
    return ["Parsing failed"];
  }
}

/**
 * Translates complex Soroban RPC error codes into human-readable messages.
 */
export function parseSorobanError(error: any): string {
  const message = error?.message || String(error);

  if (message.includes("VerificationFailed")) {
    return "Contract verification failed. Ensure the WASM file matches the expected interface.";
  }
  if (message.includes("ExceededAllowance")) {
    return "The operation exceeded the provided token allowance. Try increasing the limit.";
  }
  if (message.includes("InvalidAction")) {
    return "Invalid Action: The contract logic rejected this call (e.g., failed assertion).";
  }
  if (message.includes("ResourceLimitExceeded")) {
    return "Resource Limit Exceeded: This transaction requires more CPU or Memory than the network allows.";
  }
  if (message.includes("404")) {
    return "Resource not found: The contract ID or Account does not exist on this network.";
  }

  return message;
}

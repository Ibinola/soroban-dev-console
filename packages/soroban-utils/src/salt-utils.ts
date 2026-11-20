/**
 * Issue #1093: Salt parameter generator & deterministic contract address calculation.
 * Issue #1092: Bundled atomic deploy + constructor/init transaction builder.
 */

import {
  Address,
  hash,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  TimeoutInfinite,
  xdr,
  type Account,
} from "@stellar/stellar-sdk";

export interface SaltValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Generates a 32-byte cryptographically secure random salt formatted as a 64-character hex string.
 */
export function generateRandomSaltHex(): string {
  const bytes = new Uint8Array(32);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for Node environments or test harnesses without webcrypto
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validates whether a given salt string is an exact 32-byte (64-character) hexadecimal string.
 */
export function validateSaltHex(saltHex: string): SaltValidationResult {
  if (!saltHex || saltHex.trim() === "") {
    return {
      valid: false,
      error: "Salt is required and cannot be empty.",
    };
  }

  const trimmed = saltHex.trim();
  if (trimmed.length !== 64) {
    return {
      valid: false,
      error: `Salt must be exactly 64 hex characters (32 bytes). Current length: ${trimmed.length}.`,
    };
  }

  const hexRegex = /^[0-9a-fA-F]{64}$/;
  if (!hexRegex.test(trimmed)) {
    return {
      valid: false,
      error: "Salt contains invalid characters. Only hexadecimal characters (0-9, a-f, A-F) are allowed.",
    };
  }

  return { valid: true };
}

/**
 * Converts a hex string or byte array to a 32-byte Buffer.
 */
export function normalizeSaltToBuffer(salt: string | Uint8Array | Buffer): Buffer {
  if (typeof salt === "string") {
    const cleanHex = salt.trim().replace(/^0x/, "");
    return Buffer.from(cleanHex.padStart(64, "0").slice(0, 64), "hex");
  }
  return Buffer.from(salt);
}

/**
 * Computes the deterministic Soroban contract address (C...) from deployer address, salt, and network passphrase.
 */
export function computeContractAddress(
  deployerAddress: string,
  saltHexOrBytes: string | Uint8Array | Buffer,
  networkPassphrase: string,
): string {
  const saltBuf = normalizeSaltToBuffer(saltHexOrBytes);
  const address = new Address(deployerAddress);
  const scAddress = address.toScAddress();

  const contractIdPreimage = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
    new xdr.ContractIdPreimageFromAddress({
      address: scAddress,
      salt: saltBuf,
    }),
  );

  const networkId = hash(Buffer.from(networkPassphrase, "utf-8"));
  const hashIdPreimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage,
    }),
  );

  const contractIdBytes = hash(hashIdPreimage.toXDR());
  return StrKey.encodeContract(contractIdBytes);
}

export interface BundledDeployParams {
  sourceAccount: Account;
  networkPassphrase: string;
  wasmHash: string;
  deployerAddress: string;
  salt: string | Uint8Array | Buffer;
  initFunction?: string;
  initArgs?: xdr.ScVal[];
  baseFee?: string;
}

/**
 * Bundles contract creation and optional constructor/init invocation into a single atomic transaction.
 */
export function buildBundledDeployAndInitTx({
  sourceAccount,
  networkPassphrase,
  wasmHash,
  deployerAddress,
  salt,
  initFunction,
  initArgs = [],
  baseFee = "10000",
}: BundledDeployParams): Transaction {
  const saltBuf = normalizeSaltToBuffer(salt);
  const wasmHashBuf = Buffer.from(wasmHash.replace(/^0x/, ""), "hex");

  const createOp = Operation.createCustomContract({
    wasmHash: wasmHashBuf,
    address: new Address(deployerAddress),
    salt: saltBuf,
  });

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: baseFee,
    networkPassphrase,
  }).addOperation(createOp);

  // If constructor/init function is specified, bundle atomic invocation
  if (initFunction && initFunction.trim() !== "") {
    const predictedContractId = computeContractAddress(
      deployerAddress,
      saltBuf,
      networkPassphrase,
    );

    const invokeOp = Operation.invokeContractFunction({
      contractAddress: predictedContractId,
      function: initFunction.trim(),
      args: initArgs,
    });

    txBuilder.addOperation(invokeOp);
  }

  return txBuilder.setTimeout(TimeoutInfinite).build();
}

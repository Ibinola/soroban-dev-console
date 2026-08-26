/**
 * xdr-schema-validator.ts
 *
 * Issue #937: XDR schema validator against official Stellar XDR definitions.
 *
 * Validates XDR binary blobs (base64 or hex) against the set of known
 * Stellar protocol XDR types from `@stellar/stellar-sdk`.  Detects:
 *  - Invalid union discriminant tags (out-of-range enum values)
 *  - Unknown type wrappers
 *  - Truncated / malformed buffers
 *
 * Usage
 * -----
 *   import { validateXdr, XDR_TYPE_NAMES } from "@/lib/xdr-schema-validator";
 *
 *   const result = validateXdr("AAAAAgAAA...");
 *   if (result.valid) {
 *     console.log("Detected type:", result.typeName);
 *   } else {
 *     console.error("Validation error:", result.errors);
 *   }
 */

import { xdr } from "@stellar/stellar-sdk";

// ─── Type definitions ─────────────────────────────────────────────────────────

export interface XdrValidationResult {
  valid: boolean;
  /** Matched XDR type name when valid. */
  typeName?: string;
  /** Decoded value (JSON-serialisable) when valid. */
  decoded?: unknown;
  /** Human-readable error messages when invalid. */
  errors: string[];
  /** Input encoding detected: 'base64' | 'hex' | 'unknown'. */
  encoding: "base64" | "hex" | "unknown";
}

// ─── Known XDR type registry ──────────────────────────────────────────────────

/**
 * All XDR types we attempt to parse, in priority order.
 * Each entry maps a human-readable name to its fromXDR factory.
 */
const XDR_TYPE_REGISTRY: Array<{
  name: string;
  fromXdr: (input: string, encoding: "base64" | "hex") => unknown;
}> = [
  {
    name: "TransactionEnvelope",
    fromXdr: (i, e) => xdr.TransactionEnvelope.fromXDR(i, e),
  },
  {
    name: "TransactionResult",
    fromXdr: (i, e) => xdr.TransactionResult.fromXDR(i, e),
  },
  {
    name: "TransactionResultPair",
    fromXdr: (i, e) => xdr.TransactionResultPair.fromXDR(i, e),
  },
  {
    name: "TransactionMeta",
    fromXdr: (i, e) => xdr.TransactionMeta.fromXDR(i, e),
  },
  {
    name: "SorobanTransactionData",
    fromXdr: (i, e) => xdr.SorobanTransactionData.fromXDR(i, e),
  },
  {
    name: "ScVal (Soroban Value)",
    fromXdr: (i, e) => xdr.ScVal.fromXDR(i, e),
  },
  {
    name: "ScAddress",
    fromXdr: (i, e) => xdr.ScAddress.fromXDR(i, e),
  },
  {
    name: "ScError",
    fromXdr: (i, e) => xdr.ScError.fromXDR(i, e),
  },
  {
    name: "LedgerEntry",
    fromXdr: (i, e) => xdr.LedgerEntry.fromXDR(i, e),
  },
  {
    name: "LedgerKey",
    fromXdr: (i, e) => xdr.LedgerKey.fromXDR(i, e),
  },
  {
    name: "ContractDataEntry",
    fromXdr: (i, e) => xdr.ContractDataEntry.fromXDR(i, e),
  },
  {
    name: "ContractCodeEntry",
    fromXdr: (i, e) => xdr.ContractCodeEntry.fromXDR(i, e),
  },
  {
    name: "SorobanAuthorizationEntry",
    fromXdr: (i, e) => xdr.SorobanAuthorizationEntry.fromXDR(i, e),
  },
  {
    name: "AuthorizedInvocation",
    fromXdr: (i, e) => xdr.AuthorizedInvocation.fromXDR(i, e),
  },
  {
    name: "Operation",
    fromXdr: (i, e) => xdr.Operation.fromXDR(i, e),
  },
  {
    name: "OperationResult",
    fromXdr: (i, e) => xdr.OperationResult.fromXDR(i, e),
  },
  {
    name: "AccountEntry",
    fromXdr: (i, e) => xdr.AccountEntry.fromXDR(i, e),
  },
  {
    name: "Asset",
    fromXdr: (i, e) => xdr.Asset.fromXDR(i, e),
  },
  {
    name: "Hash",
    fromXdr: (i, e) => xdr.Hash.fromXDR(i, e),
  },
  {
    name: "PublicKey",
    fromXdr: (i, e) => xdr.PublicKey.fromXDR(i, e),
  },
];

/** All registered type names — useful for populating a type selector in the UI. */
export const XDR_TYPE_NAMES = XDR_TYPE_REGISTRY.map((t) => t.name);

// ─── Encoding detection ───────────────────────────────────────────────────────

function detectEncoding(input: string): "base64" | "hex" | "unknown" {
  const trimmed = input.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) return "hex";
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed)) return "base64";
  return "unknown";
}

// ─── JSON serialisation helper ────────────────────────────────────────────────

function toJson(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (Buffer.isBuffer(v)) return v.toString("hex");
      return v as unknown;
    }),
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate an XDR string against all known Stellar XDR type definitions.
 *
 * @param input   - Base64 or hex-encoded XDR string.
 * @param typeHint - Optional type name from `XDR_TYPE_NAMES` to try first.
 *                   Falls back to exhaustive matching when the hint fails.
 */
export function validateXdr(input: string, typeHint?: string): XdrValidationResult {
  const trimmed = input.trim();
  const errors: string[] = [];

  if (!trimmed) {
    return { valid: false, errors: ["Input is empty."], encoding: "unknown" };
  }

  const encoding = detectEncoding(trimmed);
  if (encoding === "unknown") {
    return {
      valid: false,
      errors: [
        "Input does not appear to be valid base64 or hex. " +
        "Ensure the XDR is encoded as base64 (e.g. AAAAAgAAA...) or lowercase hex.",
      ],
      encoding: "unknown",
    };
  }

  // Build the ordered attempt list: hint first, then the rest
  const orderedTypes = typeHint
    ? [
        ...XDR_TYPE_REGISTRY.filter((t) => t.name === typeHint),
        ...XDR_TYPE_REGISTRY.filter((t) => t.name !== typeHint),
      ]
    : XDR_TYPE_REGISTRY;

  for (const { name, fromXdr } of orderedTypes) {
    try {
      const decoded = fromXdr(trimmed, encoding);
      return {
        valid: true,
        typeName: name,
        decoded: toJson(decoded),
        errors: [],
        encoding,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Collect discriminant / enum errors as they are more informative
      if (
        msg.includes("Unknown") ||
        msg.includes("discriminant") ||
        msg.includes("enum") ||
        msg.includes("invalid") ||
        msg.includes("out of range")
      ) {
        errors.push(`[${name}] ${msg}`);
      }
    }
  }

  // None of the types matched
  const summary =
    errors.length > 0
      ? `XDR validation failed. Discriminant or enum errors detected:\n${errors.slice(0, 5).join("\n")}`
      : "XDR could not be decoded as any known Stellar XDR type. " +
        "The blob may be truncated, corrupted, or use an unsupported encoding.";

  return { valid: false, errors: [summary], encoding };
}

/**
 * Attempt to validate XDR as a specific named type only.
 * Returns a concise result suited for inline UI feedback.
 */
export function validateXdrAs(
  input: string,
  typeName: string,
): XdrValidationResult {
  const entry = XDR_TYPE_REGISTRY.find((t) => t.name === typeName);
  if (!entry) {
    return {
      valid: false,
      errors: [`Unknown type: "${typeName}". Use a name from XDR_TYPE_NAMES.`],
      encoding: "unknown",
    };
  }

  const trimmed = input.trim();
  const encoding = detectEncoding(trimmed);

  if (encoding === "unknown") {
    return {
      valid: false,
      errors: ["Input encoding is not base64 or hex."],
      encoding: "unknown",
    };
  }

  try {
    const decoded = entry.fromXdr(trimmed, encoding);
    return { valid: true, typeName, decoded: toJson(decoded), errors: [], encoding };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [msg], encoding };
  }
}

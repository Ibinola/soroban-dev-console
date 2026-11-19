import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

/**
 * Canonical JSON form of a Soroban `ScVal`.
 *
 * Every value is a tagged object `{ "t": <tag>, "v": <payload> }` so the type
 * survives a JSON round trip and large integers never pass through a JS number:
 *
 *   void                        { t: "void" }
 *   bool                        { t: "bool", v: true }
 *   u32 / i32                   { t: "u32", v: 7 }           (JSON number)
 *   u64 i64 u128 i128 u256 i256 { t: "i128", v: "-12345" }   (decimal string)
 *   timepoint / duration        { t: "timepoint", v: "1700000000" } (decimal string)
 *   symbol / string             { t: "symbol", v: "name" }
 *   bytes                       { t: "bytes", v: "0aff" }    (lower-case hex)
 *   address                     { t: "address", v: "G..." | "C..." }
 *   vec                         { t: "vec", v: [ ...tagged ] }
 *   map                         { t: "map", v: [ [key, value], ... ] } (entry order kept)
 *
 * Error, contract-instance and ledger-key variants are not supported and throw.
 */
export type CanonicalScVal =
  | { t: "void" }
  | { t: "bool"; v: boolean }
  | { t: "u32" | "i32"; v: number }
  | { t: "u64" | "i64" | "u128" | "i128" | "u256" | "i256" | "timepoint" | "duration"; v: string }
  | { t: "symbol" | "string" | "bytes" | "address"; v: string }
  | { t: "vec"; v: CanonicalScVal[] }
  | { t: "map"; v: Array<[CanonicalScVal, CanonicalScVal]> };

export class UnsupportedScValError extends Error {
  constructor(readonly variant: string, readonly path = "$") {
    super(`Unsupported ScVal variant "${variant}" at ${path}`);
    this.name = "UnsupportedScValError";
  }
}

const BIG_TAGS = ["u64", "i64", "u128", "i128", "u256", "i256", "timepoint", "duration"] as const;
type BigTag = (typeof BIG_TAGS)[number];

const BIG_VARIANTS: Record<string, BigTag> = {
  scvU64: "u64",
  scvI64: "i64",
  scvU128: "u128",
  scvI128: "i128",
  scvU256: "u256",
  scvI256: "i256",
  scvTimepoint: "timepoint",
  scvDuration: "duration",
};

/** Serialize an ScVal to its canonical tagged JSON form. */
export function serializeScVal(value: xdr.ScVal, path = "$"): CanonicalScVal {
  const variant = value.type as string;
  switch (variant) {
    case "scvVoid":
      return { t: "void" };
    case "scvBool":
      return { t: "bool", v: Boolean(scValToNative(value)) };
    case "scvU32":
      return { t: "u32", v: Number(scValToNative(value)) };
    case "scvI32":
      return { t: "i32", v: Number(scValToNative(value)) };
    case "scvSymbol":
      return { t: "symbol", v: String(scValToNative(value)) };
    case "scvString":
      return { t: "string", v: String(scValToNative(value)) };
    case "scvBytes":
      return { t: "bytes", v: Buffer.from(scValToNative(value) as Uint8Array).toString("hex") };
    case "scvAddress":
      return { t: "address", v: String(scValToNative(value)) };
    case "scvVec":
      return {
        t: "vec",
        v: (value.vec ?? []).map((item, i) => serializeScVal(item, `${path}[${i}]`)),
      };
    case "scvMap":
      return {
        t: "map",
        v: (value.map ?? []).map((entry, i) => [
          serializeScVal(entry.key, `${path}.map[${i}].key`),
          serializeScVal(entry.val, `${path}.map[${i}].value`),
        ]),
      };
    default: {
      const tag = BIG_VARIANTS[variant];
      if (!tag) throw new UnsupportedScValError(variant, path);
      // scValToNative yields a bigint for these; String() keeps every digit.
      return { t: tag, v: String(scValToNative(value) as bigint | number) };
    }
  }
}

/** JSON text of the canonical form (stable key order: `t` then `v`). */
export function scValToCanonicalJson(value: xdr.ScVal): string {
  return JSON.stringify(serializeScVal(value));
}

// ── Deserialization ────────────────────────────────────────────────────────

export class ScValDeserializeError extends Error {
  constructor(readonly path: string, readonly reason: string) {
    super(`Invalid ScVal at ${path}: ${reason}`);
    this.name = "ScValDeserializeError";
  }
}

const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"];
const MAX_DEPTH = 64;

const INT_RANGES: Record<string, { min: bigint; max: bigint }> = {
  u64: { min: 0n, max: 2n ** 64n - 1n },
  i64: { min: -(2n ** 63n), max: 2n ** 63n - 1n },
  u128: { min: 0n, max: 2n ** 128n - 1n },
  i128: { min: -(2n ** 127n), max: 2n ** 127n - 1n },
  u256: { min: 0n, max: 2n ** 256n - 1n },
  i256: { min: -(2n ** 255n), max: 2n ** 255n - 1n },
  timepoint: { min: 0n, max: 2n ** 64n - 1n },
  duration: { min: 0n, max: 2n ** 64n - 1n },
};

function assertSafeObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ScValDeserializeError(path, "expected an object");
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new ScValDeserializeError(path, "prototype-bearing objects are not allowed");
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      throw new ScValDeserializeError(`${path}.${key}`, "forbidden key");
    }
  }
}

function toBigInt(raw: unknown, tag: string, path: string): bigint {
  if (typeof raw !== "string" || !/^-?(0|[1-9][0-9]*)$/.test(raw)) {
    throw new ScValDeserializeError(`${path}.v`, `${tag} must be a decimal string`);
  }
  const n = BigInt(raw);
  const range = INT_RANGES[tag];
  if (n < range.min || n > range.max) {
    throw new ScValDeserializeError(`${path}.v`, `${tag} out of range`);
  }
  return n;
}

function build(input: unknown, path: string, depth: number): xdr.ScVal {
  if (depth > MAX_DEPTH) throw new ScValDeserializeError(path, `nesting deeper than ${MAX_DEPTH}`);
  assertSafeObject(input, path);
  const tag = input.t;
  if (typeof tag !== "string") throw new ScValDeserializeError(`${path}.t`, "missing type tag");
  const v = input.v;

  switch (tag) {
    case "void":
      return xdr.ScVal.scvVoid();
    case "bool":
      if (typeof v !== "boolean") throw new ScValDeserializeError(`${path}.v`, "bool must be a boolean");
      return xdr.ScVal.scvBool(v);
    case "u32":
    case "i32": {
      const [min, max] = tag === "u32" ? [0, 4294967295] : [-2147483648, 2147483647];
      if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
        throw new ScValDeserializeError(`${path}.v`, `${tag} must be an integer in ${min}..${max}`);
      }
      return nativeToScVal(v, { type: tag });
    }
    case "u64":
    case "i64":
    case "u128":
    case "i128":
    case "u256":
    case "i256":
    case "timepoint":
    case "duration":
      return nativeToScVal(toBigInt(v, tag, path), { type: tag });
    case "symbol":
    case "string":
      if (typeof v !== "string") throw new ScValDeserializeError(`${path}.v`, `${tag} must be a string`);
      if (tag === "symbol" && !/^[A-Za-z0-9_]{0,32}$/.test(v)) {
        throw new ScValDeserializeError(`${path}.v`, "symbol must be 0-32 characters of [A-Za-z0-9_]");
      }
      return nativeToScVal(v, { type: tag });
    case "bytes":
      if (typeof v !== "string" || v.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(v)) {
        throw new ScValDeserializeError(`${path}.v`, "bytes must be an even-length hex string");
      }
      return xdr.ScVal.scvBytes(Buffer.from(v, "hex"));
    case "address":
      try {
        return new Address(String(v)).toScVal();
      } catch {
        throw new ScValDeserializeError(`${path}.v`, "invalid address");
      }
    case "vec":
      if (!Array.isArray(v)) throw new ScValDeserializeError(`${path}.v`, "vec must be an array");
      return xdr.ScVal.scvVec(v.map((item, i) => build(item, `${path}.v[${i}]`, depth + 1)));
    case "map":
      if (!Array.isArray(v)) throw new ScValDeserializeError(`${path}.v`, "map must be an array of [key, value] pairs");
      return xdr.ScVal.scvMap(
        v.map((pair, i) => {
          if (!Array.isArray(pair) || pair.length !== 2) {
            throw new ScValDeserializeError(`${path}.v[${i}]`, "map entry must be a [key, value] pair");
          }
          return new xdr.ScMapEntry({
            key: build(pair[0], `${path}.v[${i}][0]`, depth + 1),
            val: build(pair[1], `${path}.v[${i}][1]`, depth + 1),
          });
        }),
      );
    default:
      throw new ScValDeserializeError(`${path}.t`, `unknown tag "${tag}"`);
  }
}

/** Strictly convert canonical tagged JSON (already parsed) back to an ScVal. */
export function deserializeScVal(input: unknown): xdr.ScVal {
  return build(input, "$", 0);
}

/** Parse canonical JSON text and convert it to an ScVal. */
export function scValFromCanonicalJson(text: string): xdr.ScVal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ScValDeserializeError("$", "not valid JSON");
  }
  return deserializeScVal(parsed);
}

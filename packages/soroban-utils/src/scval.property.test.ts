import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Address, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { deserializeScVal, scValToCanonicalJson, serializeScVal } from "./scval";

/**
 * Bounded property tests for the canonical ScVal codec (#1402).
 *
 * No property-testing library is required: values come from a small seeded
 * generator (mulberry32) with a hard nesting bound, and only the variants the
 * codec supports. When a property fails the report names the seed and the
 * smallest nesting depth at which that same seed still fails, which is enough
 * to reproduce it:  PROPERTY_SEED=<seed> PROPERTY_DEPTH=<depth> npm test
 */

const MAX_DEPTH = 4;
const MAX_WIDTH = 4;
const RUNS = Number(process.env.PROPERTY_RUNS ?? 200);

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    bigint: (bits: number, signed: boolean) => {
      let v = 0n;
      for (let i = 0; i < bits; i += 32) v = (v << 32n) | BigInt(Math.floor(next() * 4294967296));
      v &= (1n << BigInt(bits)) - 1n;
      return signed && v >= 1n << BigInt(bits - 1) ? v - (1n << BigInt(bits)) : v;
    },
  };
}

type Rng = ReturnType<typeof rng>;
const ACCOUNTS = Array.from({ length: 4 }, (_, i) => Keypair.fromRawEd25519Seed(Buffer.alloc(32, i + 1)).publicKey());
const SYMBOL_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";

function genScalar(r: Rng): xdr.ScVal {
  switch (r.int(0, 13)) {
    case 0:
      return xdr.ScVal.scvVoid();
    case 1:
      return nativeToScVal(r.next() < 0.5);
    case 2:
      return nativeToScVal(r.int(0, 4294967295), { type: "u32" });
    case 3:
      return nativeToScVal(r.int(-2147483648, 2147483647), { type: "i32" });
    case 4:
      return nativeToScVal(r.bigint(64, false), { type: "u64" });
    case 5:
      return nativeToScVal(r.bigint(64, true), { type: "i64" });
    case 6:
      return nativeToScVal(r.bigint(128, false), { type: "u128" });
    case 7:
      return nativeToScVal(r.bigint(128, true), { type: "i128" });
    case 8:
      return nativeToScVal(r.bigint(256, false), { type: "u256" });
    case 9:
      return nativeToScVal(r.bigint(256, true), { type: "i256" });
    case 10:
      return nativeToScVal(Array.from({ length: r.int(0, 12) }, () => SYMBOL_CHARS[r.int(0, SYMBOL_CHARS.length - 1)]).join(""), { type: "symbol" });
    case 11:
      return nativeToScVal(Array.from({ length: r.int(0, 20) }, () => String.fromCharCode(r.int(32, 0x2fff))).join(""), { type: "string" });
    case 12:
      return xdr.ScVal.scvBytes(Buffer.from(Array.from({ length: r.int(0, 24) }, () => r.int(0, 255))));
    default:
      return new Address(ACCOUNTS[r.int(0, ACCOUNTS.length - 1)]).toScVal();
  }
}

function genValue(r: Rng, depth: number): xdr.ScVal {
  if (depth <= 0 || r.next() < 0.5) return genScalar(r);
  const width = r.int(0, MAX_WIDTH);
  if (r.next() < 0.5) return xdr.ScVal.scvVec(Array.from({ length: width }, () => genValue(r, depth - 1)));
  return xdr.ScVal.scvMap(
    Array.from({ length: width }, () => new xdr.ScMapEntry({ key: genValue(r, depth - 1), val: genValue(r, depth - 1) })),
  );
}

function nestingDepth(v: xdr.ScVal): number {
  const kids = v.type === "scvVec" ? (v.vec ?? []) : v.type === "scvMap" ? (v.map ?? []).flatMap((e) => [e.key, e.val]) : [];
  return 1 + Math.max(0, ...kids.map(nestingDepth));
}

/** Run `property` over generated values; on failure report the seed and the smallest failing depth. */
function check(name: string, property: (value: xdr.ScVal) => void, baseSeed = 0xc0ffee) {
  const only = process.env.PROPERTY_SEED ? Number(process.env.PROPERTY_SEED) : undefined;
  const seeds = only !== undefined ? [only] : Array.from({ length: RUNS }, (_, i) => baseSeed + i);
  for (const seed of seeds) {
    const startDepth = process.env.PROPERTY_DEPTH ? Number(process.env.PROPERTY_DEPTH) : MAX_DEPTH;
    const fails = (depth: number) => {
      try {
        property(genValue(rng(seed), depth));
        return false;
      } catch {
        return true;
      }
    };
    if (!fails(startDepth)) continue;
    let minimal = startDepth;
    for (let d = 0; d < startDepth; d += 1) {
      if (fails(d)) {
        minimal = d;
        break;
      }
    }
    let detail = "";
    try {
      property(genValue(rng(seed), minimal));
    } catch (e) {
      detail = e instanceof Error ? e.message : String(e);
    }
    assert.fail(`${name} failed. Reproduce with PROPERTY_SEED=${seed} PROPERTY_DEPTH=${minimal}\n${detail}`);
  }
}

describe("ScVal canonical codec properties (#1402)", () => {
  it("generated values stay within the nesting bound and supported variants", () => {
    check("generator bounds", (v) => {
      assert.ok(nestingDepth(v) <= MAX_DEPTH + 1, "nesting too deep");
      serializeScVal(v); // throws on any unsupported variant
    });
  });

  it("round-trips through the canonical codec (XDR equality)", () => {
    check("round trip", (v) => {
      const back = deserializeScVal(JSON.parse(scValToCanonicalJson(v)));
      assert.equal(back.toXDR("base64"), v.toXDR("base64"));
    });
  });

  it("serialization is deterministic and idempotent through JSON", () => {
    check("deterministic", (v) => {
      const once = scValToCanonicalJson(v);
      assert.equal(scValToCanonicalJson(v), once);
      assert.equal(scValToCanonicalJson(deserializeScVal(JSON.parse(once))), once);
    });
  });

  it("canonical JSON never contains a JS number for 64-bit or wider integers", () => {
    check("big integers are strings", (v) => {
      const walk = (j: any): void => {
        if (j.t === "vec") j.v.forEach(walk);
        else if (j.t === "map") j.v.forEach(([k, val]: [unknown, unknown]) => (walk(k), walk(val)));
        else if (["u64", "i64", "u128", "i128", "u256", "i256"].includes(j.t)) assert.equal(typeof j.v, "string");
      };
      walk(serializeScVal(v));
    });
  });

  it("the failure reporter names a reproducible seed", () => {
    assert.throws(() => check("always fails", () => assert.fail("boom"), 42), /PROPERTY_SEED=42 PROPERTY_DEPTH=0/);
  });
});

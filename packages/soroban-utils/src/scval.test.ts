import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Address, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import {
  deserializeScVal,
  scValFromCanonicalJson,
  scValToCanonicalJson,
  serializeScVal,
  ScValDeserializeError,
  UnsupportedScValError,
} from "./scval";

const account = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7)).publicKey();

function roundTrip(value: xdr.ScVal) {
  return deserializeScVal(JSON.parse(scValToCanonicalJson(value)));
}

describe("canonical ScVal serializer (#1385)", () => {
  it("keeps integers beyond the JS safe range exact", () => {
    const big = 2n ** 100n + 12345n;
    const json = serializeScVal(nativeToScVal(big, { type: "i128" }));
    assert.deepEqual(json, { t: "i128", v: big.toString() });
    const max = 2n ** 64n - 1n;
    assert.deepEqual(serializeScVal(nativeToScVal(max, { type: "u64" })), { t: "u64", v: max.toString() });
    const neg = -(2n ** 200n);
    assert.deepEqual(serializeScVal(nativeToScVal(neg, { type: "i256" })), { t: "i256", v: neg.toString() });
  });

  it("serializes bytes as lower-case hex and maps as ordered entry pairs", () => {
    assert.deepEqual(serializeScVal(xdr.ScVal.scvBytes(Buffer.from([0x0a, 0xff]))), { t: "bytes", v: "0aff" });
    const map = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: nativeToScVal("b", { type: "symbol" }), val: nativeToScVal(2, { type: "u32" }) }),
      new xdr.ScMapEntry({ key: nativeToScVal("a", { type: "symbol" }), val: nativeToScVal(1, { type: "u32" }) }),
    ]);
    assert.deepEqual(serializeScVal(map), {
      t: "map",
      v: [
        [{ t: "symbol", v: "b" }, { t: "u32", v: 2 }],
        [{ t: "symbol", v: "a" }, { t: "u32", v: 1 }],
      ],
    });
  });

  it("round-trips nested values", () => {
    const value = xdr.ScVal.scvVec([
      xdr.ScVal.scvVoid(),
      nativeToScVal(true),
      nativeToScVal(-5, { type: "i32" }),
      nativeToScVal(2n ** 90n, { type: "u128" }),
      nativeToScVal("hi there", { type: "string" }),
      xdr.ScVal.scvBytes(Buffer.from("deadbeef", "hex")),
      new Address(account).toScVal(),
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: nativeToScVal("k", { type: "symbol" }),
          val: xdr.ScVal.scvVec([nativeToScVal(1, { type: "u32" })]),
        }),
      ]),
    ]);
    assert.equal(roundTrip(value).toXDR("base64"), value.toXDR("base64"));
  });

  it("rejects unsupported variants explicitly with their path", () => {
    const unsupported = xdr.ScVal.scvVec([xdr.ScVal.scvLedgerKeyContractInstance()]);
    assert.throws(() => serializeScVal(unsupported), (e: unknown) => {
      assert.ok(e instanceof UnsupportedScValError);
      assert.equal(e.path, "$[0]");
      return true;
    });
  });
});

describe("ScVal JSON deserializer (#1386)", () => {
  it("converts every supported tag to the matching ScVal", () => {
    const cases: Array<[unknown, xdr.ScVal]> = [
      [{ t: "void" }, xdr.ScVal.scvVoid()],
      [{ t: "bool", v: false }, nativeToScVal(false)],
      [{ t: "u32", v: 4294967295 }, nativeToScVal(4294967295, { type: "u32" })],
      [{ t: "i32", v: -2147483648 }, nativeToScVal(-2147483648, { type: "i32" })],
      [{ t: "u64", v: "18446744073709551615" }, nativeToScVal(2n ** 64n - 1n, { type: "u64" })],
      [{ t: "i128", v: "-1" }, nativeToScVal(-1n, { type: "i128" })],
      [{ t: "symbol", v: "abc_1" }, nativeToScVal("abc_1", { type: "symbol" })],
      [{ t: "string", v: "héllo" }, nativeToScVal("héllo", { type: "string" })],
      [{ t: "bytes", v: "00ff" }, xdr.ScVal.scvBytes(Buffer.from([0, 255]))],
      [{ t: "address", v: account }, new Address(account).toScVal()],
    ];
    for (const [json, expected] of cases) {
      assert.equal(deserializeScVal(json).toXDR("base64"), expected.toXDR("base64"), JSON.stringify(json));
    }
  });

  it("reports the failing JSON path for invalid tags and out-of-range values", () => {
    const fail = (input: unknown, path: string) =>
      assert.throws(() => deserializeScVal(input), (e: unknown) => {
        assert.ok(e instanceof ScValDeserializeError);
        assert.equal(e.path, path);
        return true;
      });
    fail({ t: "nope" }, "$.t");
    fail({ t: "u32", v: -1 }, "$.v");
    fail({ t: "u32", v: 4294967296 }, "$.v");
    fail({ t: "u64", v: "18446744073709551616" }, "$.v");
    fail({ t: "i128", v: "1.5" }, "$.v");
    fail({ t: "vec", v: [{ t: "void" }, { t: "i32", v: 2147483648 }] }, "$.v[1].v");
    fail({ t: "map", v: [[{ t: "void" }]] }, "$.v[0]");
    fail({ t: "bytes", v: "abc" }, "$.v");
    fail({ t: "address", v: "not-an-address" }, "$.v");
    fail({ v: 1 }, "$.t");
  });

  it("rejects prototype-bearing and polluting objects before traversal", () => {
    class Evil {
      t = "void";
    }
    assert.throws(() => deserializeScVal(new Evil()), /prototype-bearing/);
    assert.throws(() => scValFromCanonicalJson('{"t":"vec","v":[{"t":"void","__proto__":{"x":1}}]}'), /forbidden key/);
    assert.throws(() => deserializeScVal({ t: "vec", v: [], constructor: 1 }), /forbidden key/);
  });

  it("rejects text that is not JSON and absurd nesting", () => {
    assert.throws(() => scValFromCanonicalJson("{oops"), /not valid JSON/);
    let deep: unknown = { t: "void" };
    for (let i = 0; i < 70; i += 1) deep = { t: "vec", v: [deep] };
    assert.throws(() => deserializeScVal(deep), /nesting deeper/);
  });
});

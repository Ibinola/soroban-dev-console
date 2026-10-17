// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Address, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { prettyPrintScVal } from "@devconsole/soroban-utils";

const addr = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();

describe("prettyPrintScVal (#1315)", () => {
  it("prints scalars", () => {
    expect(prettyPrintScVal(xdr.ScVal.scvVoid())).toBe("void");
    expect(prettyPrintScVal(xdr.ScVal.scvBool(true))).toBe("true");
    expect(prettyPrintScVal(nativeToScVal(7, { type: "u32" }))).toBe("7");
    expect(prettyPrintScVal(nativeToScVal(-9, { type: "i32" }))).toBe("-9");
    expect(prettyPrintScVal(nativeToScVal("hi", { type: "string" }))).toBe('"hi"');
    expect(prettyPrintScVal(nativeToScVal("sym", { type: "symbol" }))).toBe("sym");
    expect(prettyPrintScVal(nativeToScVal(123456789012345678901n, { type: "i128" }))).toBe("123456789012345678901");
  });

  it("prints addresses", () => {
    expect(prettyPrintScVal(new Address(addr).toScVal())).toBe(addr);
  });

  it("optionally prefixes leaf types", () => {
    expect(prettyPrintScVal(nativeToScVal(7, { type: "u32" }), { showTypes: true })).toBe("u32(7)");
    expect(prettyPrintScVal(nativeToScVal(5n, { type: "i128" }), { showTypes: true })).toBe("i128(5)");
  });

  it("formats vectors and maps with indentation", () => {
    const v = nativeToScVal([1, 2], { type: "u32" } as never);
    const vec = xdr.ScVal.scvVec([nativeToScVal(1, { type: "u32" }), nativeToScVal(2, { type: "u32" })]);
    expect(v).toBeDefined();
    expect(prettyPrintScVal(vec)).toBe("[\n  1,\n  2\n]");
    expect(prettyPrintScVal(vec, { indent: 0 })).toBe("[1, 2]");
    expect(prettyPrintScVal(xdr.ScVal.scvVec([]))).toBe("[]");

    const map = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: nativeToScVal("b", { type: "symbol" }), val: nativeToScVal(2, { type: "u32" }) }),
      new xdr.ScMapEntry({ key: nativeToScVal("a", { type: "symbol" }), val: nativeToScVal(1, { type: "u32" }) }),
    ]);
    expect(prettyPrintScVal(map, { indent: 0 })).toBe("{b: 2, a: 1}");
    expect(prettyPrintScVal(map, { indent: 0, sortMapKeys: true })).toBe("{a: 1, b: 2}");
  });

  it("indents nested containers", () => {
    const nested = xdr.ScVal.scvVec([xdr.ScVal.scvVec([nativeToScVal(1, { type: "u32" })])]);
    expect(prettyPrintScVal(nested)).toBe("[\n  [\n    1\n  ]\n]");
  });

  it("truncates deep structures and long byte strings", () => {
    const nested = xdr.ScVal.scvVec([xdr.ScVal.scvVec([nativeToScVal(1, { type: "u32" })])]);
    expect(prettyPrintScVal(nested, { indent: 0, maxDepth: 1 })).toBe("[[…]]");
    const bytes = xdr.ScVal.scvBytes(Buffer.alloc(40, 0xab));
    expect(prettyPrintScVal(bytes, { maxBytes: 4 })).toBe("0xabababab… (40 bytes)");
    expect(prettyPrintScVal(xdr.ScVal.scvBytes(Buffer.from([1, 2])))).toBe("0x0102");
  });
});

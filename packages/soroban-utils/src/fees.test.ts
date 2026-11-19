import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FeeError,
  addStroops,
  compareStroops,
  multiplyStroops,
  multiplyStroopsRounded,
  parseStroops,
  stroopsToXlm,
  subtractStroops,
  xlmToStroops,
} from "./fees";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof FeeError);
    return e.code;
  }
  return "none";
};

describe("fee arithmetic (#1388)", () => {
  const big = "900719925474099312345"; // beyond Number.MAX_SAFE_INTEGER

  it("keeps integers beyond MAX_SAFE_INTEGER exact", () => {
    assert.equal(addStroops(big, "1"), "900719925474099312346");
    assert.equal(subtractStroops(big, "345"), "900719925474099312000");
    assert.equal(multiplyStroops(big, "2"), "1801439850948198624690");
    assert.equal(compareStroops(big, "900719925474099312346"), -1);
    assert.equal(addStroops("9007199254740993", "9007199254740993"), "18014398509481986");
  });

  it("rejects negative and malformed inputs", () => {
    assert.equal(code(() => parseStroops("-1")), "NEGATIVE");
    assert.equal(code(() => parseStroops(-1n)), "NEGATIVE");
    assert.equal(code(() => subtractStroops("1", "2")), "NEGATIVE");
    for (const bad of ["", " 1", "1 ", "1e3", "0x10", "01", "1.5", "abc", "--1"]) {
      assert.equal(code(() => parseStroops(bad)), "MALFORMED", bad);
    }
    assert.equal(code(() => parseStroops(undefined as unknown as string)), "MALFORMED");
  });

  it("converts units exactly in both directions", () => {
    assert.equal(stroopsToXlm("1"), "0.0000001");
    assert.equal(stroopsToXlm("10000000"), "1");
    assert.equal(stroopsToXlm("123456789"), "12.3456789");
    assert.equal(xlmToStroops("12.3456789"), "123456789");
    assert.equal(xlmToStroops("0.5"), "5000000");
    assert.equal(xlmToStroops("1"), "10000000");
    assert.equal(stroopsToXlm(xlmToStroops("900719925474099.1234567")), "900719925474099.1234567");
  });

  it("never rounds silently on unit conversion or ratios", () => {
    assert.equal(code(() => xlmToStroops("0.00000001")), "PRECISION_LOSS");
    assert.equal(code(() => xlmToStroops("-1")), "NEGATIVE");
    assert.equal(code(() => xlmToStroops("1,5")), "MALFORMED");
    assert.equal(code(() => multiplyStroops("10", "1", "3")), "PRECISION_LOSS");
    assert.equal(multiplyStroops("9", "1", "3"), "3");
    assert.equal(code(() => multiplyStroops("10", "1", "0")), "DIVIDE_BY_ZERO");
  });

  it("offers explicit round-up for estimates", () => {
    assert.equal(multiplyStroopsRounded("10", "1", "3"), "4");
    assert.equal(multiplyStroopsRounded("9", "1", "3"), "3");
    assert.equal(multiplyStroopsRounded(big, "3", "2"), "1351079888211148968518");
  });
});

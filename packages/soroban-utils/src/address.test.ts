import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { isValidAddress, validateAddress } from "./address";

const account = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();
const contract = StrKey.encodeContract(Buffer.alloc(32, 9));
const code = (v: unknown, o = {}) => {
  const r = validateAddress(v, o);
  return r.ok ? `ok:${r.kind}` : r.code;
};

describe("address validation helper (#1397)", () => {
  it("distinguishes account, contract and malformed forms", () => {
    assert.equal(code(account), "ok:account");
    assert.equal(code(contract), "ok:contract");
    assert.equal(code("GABC"), "WRONG_LENGTH");
  });

  it("returns stable codes for each kind of malformed input", () => {
    assert.equal(code(""), "EMPTY");
    assert.equal(code("   "), "EMPTY");
    assert.equal(code(undefined), "EMPTY");
    assert.equal(code(123), "EMPTY");
    assert.equal(code("X" + account.slice(1)), "INVALID_PREFIX");
    assert.equal(code("G" + "0".repeat(55)), "INVALID_CHARACTERS");
    assert.equal(code("G" + "a".repeat(55)), "INVALID_CHARACTERS");
    const last = account.slice(-1) === "A" ? "B" : "A";
    assert.equal(code(account.slice(0, -1) + last), "INVALID_CHECKSUM");
    const cLast = contract.slice(-1) === "A" ? "B" : "A";
    assert.equal(code(contract.slice(0, -1) + cLast), "INVALID_CHECKSUM");
  });

  it("can require one kind and reports the mismatch separately", () => {
    assert.equal(code(account, { expect: "account" }), "ok:account");
    assert.equal(code(account, { expect: "contract" }), "WRONG_KIND");
    assert.equal(code(contract, { expect: "account" }), "WRONG_KIND");
    assert.equal(code("junk", { expect: "contract" }), "WRONG_LENGTH");
  });

  it("trims surrounding whitespace and returns the cleaned address", () => {
    const r = validateAddress(`  ${account} \n`);
    assert.ok(r.ok);
    assert.equal(r.address, account);
  });

  it("gives every failure a human message and a boolean helper", () => {
    const r = validateAddress("nope");
    assert.ok(!r.ok);
    assert.ok(r.message.length > 0);
    assert.equal(isValidAddress(account), true);
    assert.equal(isValidAddress("nope"), false);
  });
});

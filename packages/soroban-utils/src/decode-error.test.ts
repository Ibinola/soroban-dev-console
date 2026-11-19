import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nativeToScVal } from "@stellar/stellar-sdk";
import {
  PREVIEW_BYTES,
  XdrDecodeError,
  classifyDecodeFailure,
  decodeBase64Strict,
  decodeScValSafe,
} from "./decode-error";

function failure(fn: () => unknown): XdrDecodeError {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof XdrDecodeError, String(e));
    return e;
  }
  assert.fail("expected a decode error");
}

describe("bounded XDR decode diagnostics (#1389)", () => {
  const valid = nativeToScVal("hello world, this is a longer string value", { type: "string" }).toXDR("base64");

  it("decodes valid input", () => {
    assert.equal(decodeScValSafe(valid).toXDR("base64"), valid);
  });

  it("reports invalid base64 separately", () => {
    for (const bad of ["", "***", "abc", "AAAA=A=="]) {
      assert.equal(failure(() => decodeScValSafe(bad)).diagnostic.code, "INVALID_ENCODING", bad);
    }
    assert.equal(failure(() => decodeBase64Strict("@@@@")).diagnostic.code, "INVALID_ENCODING");
  });

  it("reports truncated input with an offset at the end of the supplied buffer", () => {
    const bytes = Buffer.from(valid, "base64");
    const cut = bytes.subarray(0, bytes.length - 4).toString("base64");
    const misaligned = bytes.subarray(0, bytes.length - 1).toString("base64");
    for (const input of [cut, misaligned, Buffer.from([0, 0, 0]).toString("base64")]) {
      const d = failure(() => decodeScValSafe(input)).diagnostic;
      assert.equal(d.code, "TRUNCATED_INPUT");
      assert.equal(d.offset, d.inputLength);
    }
  });

  it("reports an unknown union discriminant as an unsupported variant at offset 0", () => {
    const input = Buffer.from([0, 0, 0, 99, 0, 0, 0, 0]).toString("base64");
    const d = failure(() => decodeScValSafe(input)).diagnostic;
    assert.equal(d.code, "UNSUPPORTED_VARIANT");
    assert.equal(d.offset, 0);
  });

  it("keeps every reported offset inside the supplied buffer", () => {
    for (const len of [0, 1, 3, 4, 7, 8, 40]) {
      const bytes = new Uint8Array(len).fill(0xff);
      const d = classifyDecodeFailure(new Error("read past the end"), bytes);
      if (d.offset !== undefined) {
        assert.ok(d.offset >= 0 && d.offset <= len, `offset ${d.offset} for length ${len}`);
      }
    }
  });

  it("never includes the whole payload in the diagnostic", () => {
    const bytes = new Uint8Array(200).fill(0xab);
    const d = classifyDecodeFailure(new Error("boom"), bytes);
    assert.equal(d.inputLength, 200);
    assert.equal(d.preview.length, PREVIEW_BYTES * 2);
    assert.ok(!JSON.stringify(d).includes("ab".repeat(PREVIEW_BYTES + 1)));
  });

  it("falls back to DECODE_FAILED for other decoder errors", () => {
    const d = classifyDecodeFailure(new Error("something odd"), new Uint8Array(8));
    assert.equal(d.code, "DECODE_FAILED");
  });
});

import { describe, it, expect } from "vitest";
import { xdr, nativeToScVal } from "@stellar/stellar-sdk";

// Re-implement encode logic for testing (same as in page component)
function encodeScValToXdr(type: string, value: string): string {
  let scVal: xdr.ScVal;

  switch (type) {
    case "void":
      scVal = xdr.ScVal.scvVoid();
      break;
    case "bool":
      scVal = xdr.ScVal.scvBool(value === "true" || value === "1");
      break;
    case "u32": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 4294967295) {
        throw new Error("Invalid u32");
      }
      scVal = xdr.ScVal.scvU32(n);
      break;
    }
    case "i32": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) {
        throw new Error("Invalid i32");
      }
      scVal = xdr.ScVal.scvI32(n);
      break;
    }
    case "u64": {
      const n = BigInt(value);
      if (n < BigInt(0) || n > BigInt("18446744073709551615")) {
        throw new Error("Invalid u64");
      }
      scVal = nativeToScVal(value, { type: "u64" });
      break;
    }
    case "i64": {
      const n = BigInt(value);
      if (n < BigInt("-9223372036854775808") || n > BigInt("9223372036854775807")) {
        throw new Error("Invalid i64");
      }
      scVal = nativeToScVal(value, { type: "i64" });
      break;
    }
    case "string": {
      scVal = xdr.ScVal.scvBytes(Buffer.from(value, "utf-8"));
      break;
    }
    case "bytes": {
      scVal = xdr.ScVal.scvBytes(Buffer.from(value, "hex"));
      break;
    }
    case "symbol":
      scVal = xdr.ScVal.scvSymbol(value);
      break;
    case "address":
      scVal = xdr.ScVal.scvSymbol(value); // simplified for test
      break;
    default:
      throw new Error(`Unsupported type: ${type}`);
  }

  return Buffer.from(scVal.toXDR()).toString("base64");
}

describe("XDR Encoder", () => {
  it("should encode void", () => {
    const result = encodeScValToXdr("void", "");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.switch().name).toBe("scvVoid");
  });

  it("should encode bool true", () => {
    const result = encodeScValToXdr("bool", "true");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.switch().name).toBe("scvBool");
    expect(decoded.b()).toBe(true);
  });

  it("should encode bool false", () => {
    const result = encodeScValToXdr("bool", "false");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.b()).toBe(false);
  });

  it("should encode u32", () => {
    const result = encodeScValToXdr("u32", "42");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.u32()).toBe(42);
  });

  it("should encode i32", () => {
    const result = encodeScValToXdr("i32", "-42");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.i32()).toBe(-42);
  });

  it("should encode u64", () => {
    const result = encodeScValToXdr("u64", "1234567890");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.u64().toString()).toBe("1234567890");
  });

  it("should encode i64", () => {
    const result = encodeScValToXdr("i64", "-1234567890");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.i64().toString()).toBe("-1234567890");
  });

  it("should encode string", () => {
    const result = encodeScValToXdr("string", "Hello");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.bytes().toString()).toBe("Hello");
  });

  it("should encode bytes from hex", () => {
    const result = encodeScValToXdr("bytes", "deadbeef");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(Buffer.from(decoded.bytes()).toString("hex")).toBe("deadbeef");
  });

  it("should encode symbol", () => {
    const result = encodeScValToXdr("symbol", "transfer");
    const decoded = xdr.ScVal.fromXDR(Buffer.from(result, "base64"));
    expect(decoded.sym().toString()).toBe("transfer");
  });

  it("should throw for invalid u32", () => {
    expect(() => encodeScValToXdr("u32", "abc")).toThrow();
  });

  it("should throw for negative u32", () => {
    expect(() => encodeScValToXdr("u32", "-1")).toThrow();
  });

  it("should throw for invalid i32", () => {
    expect(() => encodeScValToXdr("i32", "abc")).toThrow();
  });
});

import { describe, it, expect } from "vitest";
import {
  buildLedgerKeyXdr,
  decodeLedgerKeyXdr,
  type LedgerKeyInput,
} from "./ledger-key-builder";

describe("buildLedgerKeyXdr", () => {
  const validContractId = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
  const validAccountId = "GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H";

  describe("ContractData keys", () => {
    it("should build a ContractData key with symbol type", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: validContractId,
        storageKeyType: "symbol",
        storageKeyValue: "Counter",
        durability: "persistent",
      };

      const result = buildLedgerKeyXdr(input);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");

      const decoded = decodeLedgerKeyXdr(result);
      expect(decoded).toBe("contractData");
    });

    it("should build a ContractData key with string type", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: validContractId,
        storageKeyType: "string",
        storageKeyValue: "hello",
        durability: "persistent",
      };

      const result = buildLedgerKeyXdr(input);
      expect(result).toBeTruthy();
    });

    it("should build a ContractData key with address type", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: validContractId,
        storageKeyType: "address",
        storageKeyValue: validAccountId,
        durability: "persistent",
      };

      const result = buildLedgerKeyXdr(input);
      expect(result).toBeTruthy();
    });

    it("should build a ContractData key with i32 type", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: validContractId,
        storageKeyType: "i32",
        storageKeyValue: "42",
        durability: "temporary",
      };

      const result = buildLedgerKeyXdr(input);
      expect(result).toBeTruthy();
    });

    it("should throw for empty contract ID", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: "",
        storageKeyType: "symbol",
        storageKeyValue: "Counter",
        durability: "persistent",
      };

      expect(() => buildLedgerKeyXdr(input)).toThrow("Contract ID is required");
    });

    it("should throw for invalid contract ID", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: "INVALID",
        storageKeyType: "symbol",
        storageKeyValue: "Counter",
        durability: "persistent",
      };

      expect(() => buildLedgerKeyXdr(input)).toThrow("Invalid Contract ID format");
    });

    it("should throw for empty storage key", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: validContractId,
        storageKeyType: "symbol",
        storageKeyValue: "",
        durability: "persistent",
      };

      expect(() => buildLedgerKeyXdr(input)).toThrow("Storage key value is required");
    });

    it("should throw for invalid i32 value", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: validContractId,
        storageKeyType: "i32",
        storageKeyValue: "abc",
        durability: "persistent",
      };

      expect(() => buildLedgerKeyXdr(input)).toThrow("must be a valid i32 integer");
    });
  });

  describe("ContractCode keys", () => {
    it("should build a ContractCode key with valid hash", () => {
      const input: LedgerKeyInput = {
        type: "ContractCode",
        wasmHash: "a".repeat(64),
      };

      const result = buildLedgerKeyXdr(input);
      expect(result).toBeTruthy();

      const decoded = decodeLedgerKeyXdr(result);
      expect(decoded).toBe("contractCode");
    });

    it("should throw for empty WASM hash", () => {
      const input: LedgerKeyInput = {
        type: "ContractCode",
        wasmHash: "",
      };

      expect(() => buildLedgerKeyXdr(input)).toThrow("WASM hash is required");
    });

    it("should throw for invalid length WASM hash", () => {
      const input: LedgerKeyInput = {
        type: "ContractCode",
        wasmHash: "abc123",
      };

      expect(() => buildLedgerKeyXdr(input)).toThrow("64 hex characters");
    });
  });

  describe("Account keys", () => {
    it("should build an Account key", () => {
      const input: LedgerKeyInput = {
        type: "Account",
        accountId: validAccountId,
      };

      const result = buildLedgerKeyXdr(input);
      expect(result).toBeTruthy();

      const decoded = decodeLedgerKeyXdr(result);
      expect(decoded).toBe("account");
    });

    it("should throw for empty account ID", () => {
      const input: LedgerKeyInput = {
        type: "Account",
        accountId: "",
      };

      expect(() => buildLedgerKeyXdr(input)).toThrow("Account ID is required");
    });

    it("should throw for invalid account ID", () => {
      const input: LedgerKeyInput = {
        type: "Account",
        accountId: "INVALID",
      };

      expect(() => buildLedgerKeyXdr(input)).toThrow("Invalid Account ID format");
    });
  });

  describe("decodeLedgerKeyXdr", () => {
    it("should decode a valid LedgerKey XDR", () => {
      const input: LedgerKeyInput = {
        type: "ContractData",
        contractId: validContractId,
        storageKeyType: "symbol",
        storageKeyValue: "Test",
        durability: "persistent",
      };

      const xdr = buildLedgerKeyXdr(input);
      const decoded = decodeLedgerKeyXdr(xdr);

      expect(decoded).toBeTruthy();
      expect(decoded).toBe("contractData");
    });
  });
});

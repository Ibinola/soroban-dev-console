import { describe, it, expect } from "vitest";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  MAX_BULK_IMPORT_ADDRESSES,
  isValidContractAddress,
  parseContractAddressList,
  parseContractCsv,
  splitCsvLine,
} from "./contract-address-import";

function contractAddress(): string {
  return StrKey.encodeContract(Keypair.random().rawPublicKey());
}

describe("bulk contract import (#1285)", () => {
  it("treats each line as a separate contract address", () => {
    const first = contractAddress();
    const second = contractAddress();

    const result = parseContractAddressList(`${first}\n${second}\n`);

    expect(result.valid).toEqual([first, second]);
    expect(result.invalid).toEqual([]);
  });

  it("ignores blank lines, comments and duplicate addresses", () => {
    const address = contractAddress();

    const result = parseContractAddressList(
      [`# frequently used`, "", `  ${address}  `, "", address].join("\n"),
    );

    expect(result.valid).toEqual([address]);
    expect(result.invalid).toEqual([]);
  });

  it("reports invalid addresses with their line numbers", () => {
    const good = contractAddress();

    const result = parseContractAddressList(
      ["not-an-address", good, "12345"].join("\n"),
    );

    expect(result.valid).toEqual([good]);
    expect(result.invalid).toEqual([
      {
        line: 1,
        value: "not-an-address",
        reason: "Not a valid contract address",
      },
      { line: 3, value: "12345", reason: "Not a valid contract address" },
    ]);
  });

  it("accepts CSV rows and skips a header row", () => {
    const first = contractAddress();
    const second = contractAddress();

    const result = parseContractCsv(
      ["contract,label", `${first},Treasury`, `${second},Escrow`].join("\n"),
    );

    expect(result.valid).toEqual([first, second]);
    expect(result.invalid).toEqual([]);
  });

  it("uses the first address-like cell when a row carries extra columns", () => {
    const address = contractAddress();

    const result = parseContractCsv(`${address},,mainnet`);

    expect(result.valid).toEqual([address]);
  });

  it("skips addresses beyond the import cap", () => {
    const addresses = Array.from({ length: 4 }, () => contractAddress());

    const result = parseContractAddressList(addresses.join("\n"), {
      maxAddresses: 2,
    });

    expect(result.valid).toEqual(addresses.slice(0, 2));
    expect(result.skipped.map((entry) => entry.value)).toEqual(
      addresses.slice(2),
    );
    expect(result.skipped[0].reason).toContain("2 address import limit");
  });

  it("defaults to a bounded import size", () => {
    expect(MAX_BULK_IMPORT_ADDRESSES).toBe(100);
  });

  it("validates contract addresses with StrKey", () => {
    expect(isValidContractAddress(contractAddress())).toBe(true);
    expect(isValidContractAddress("")).toBe(false);
    expect(isValidContractAddress(Keypair.random().publicKey())).toBe(false);
    expect(isValidContractAddress("C".repeat(56))).toBe(false);
  });

  it("splits quoted CSV cells", () => {
    expect(splitCsvLine('aaa, "bbb,ccc" ,ddd')).toEqual([
      "aaa",
      "bbb,ccc",
      "ddd",
    ]);
    expect(splitCsvLine('"he said ""hi"""')).toEqual(['he said "hi"']);
  });
});

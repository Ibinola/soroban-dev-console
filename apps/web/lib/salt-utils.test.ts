import { describe, it, expect } from "vitest";
import {
  generateRandomSaltHex,
  validateSaltHex,
  computeContractAddress,
  normalizeSaltToBuffer,
} from "@devconsole/soroban-utils";
import { Keypair } from "@stellar/stellar-sdk";

describe("Deterministic salt parameter and contract address calculation (Issue #1093)", () => {
  const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

  it("generates a valid 32-byte (64-character) hex salt", () => {
    const salt1 = generateRandomSaltHex();
    const salt2 = generateRandomSaltHex();

    expect(salt1.length).toBe(64);
    expect(salt2.length).toBe(64);
    expect(salt1).not.toBe(salt2);
    expect(/^[0-9a-fA-F]{64}$/.test(salt1)).toBe(true);
    expect(/^[0-9a-fA-F]{64}$/.test(salt2)).toBe(true);
  });

  it("validates 64-character hexadecimal salt strings correctly", () => {
    const validSalt = "a".repeat(64);
    expect(validateSaltHex(validSalt).valid).toBe(true);

    const randomValidSalt = generateRandomSaltHex();
    expect(validateSaltHex(randomValidSalt).valid).toBe(true);

    // Too short
    const tooShort = "1234abcd";
    const shortResult = validateSaltHex(tooShort);
    expect(shortResult.valid).toBe(false);
    expect(shortResult.error).toContain("64 hex characters");

    // Too long (65 chars)
    const tooLong = "a".repeat(65);
    const longResult = validateSaltHex(tooLong);
    expect(longResult.valid).toBe(false);
    expect(longResult.error).toContain("64 hex characters");

    // Non-hex characters
    const invalidChars = "g".repeat(64);
    const invalidCharResult = validateSaltHex(invalidChars);
    expect(invalidCharResult.valid).toBe(false);
    expect(invalidCharResult.error).toContain("invalid characters");

    // Empty string
    const emptyResult = validateSaltHex("");
    expect(emptyResult.valid).toBe(false);
  });

  it("normalizes hex salt strings to 32-byte buffers", () => {
    const saltHex = "00".repeat(32);
    const buf = normalizeSaltToBuffer(saltHex);
    expect(buf.length).toBe(32);
    expect(buf.every((b) => b === 0)).toBe(true);
  });

  it("calculates deterministic contract address consistently", () => {
    const keypair = Keypair.random();
    const deployerAddress = keypair.publicKey();
    const salt = "11".repeat(32);

    const address1 = computeContractAddress(deployerAddress, salt, TESTNET_PASSPHRASE);
    const address2 = computeContractAddress(deployerAddress, salt, TESTNET_PASSPHRASE);

    expect(address1).toBe(address2);
    expect(address1.startsWith("C")).toBe(true);
    expect(address1.length).toBe(56);
  });

  it("produces different contract addresses for different salts or deployers", () => {
    const keypair1 = Keypair.random();
    const keypair2 = Keypair.random();
    const saltA = "aa".repeat(32);
    const saltB = "bb".repeat(32);

    const addrA1 = computeContractAddress(keypair1.publicKey(), saltA, TESTNET_PASSPHRASE);
    const addrA2 = computeContractAddress(keypair1.publicKey(), saltB, TESTNET_PASSPHRASE);
    const addrB1 = computeContractAddress(keypair2.publicKey(), saltA, TESTNET_PASSPHRASE);

    expect(addrA1).not.toBe(addrA2);
    expect(addrA1).not.toBe(addrB1);
  });

  it("produces different contract addresses on different networks", () => {
    const keypair = Keypair.random();
    const salt = "12".repeat(32);
    const publicNetPassphrase = "Public Global Stellar Network ; September 2015";

    const testnetAddr = computeContractAddress(keypair.publicKey(), salt, TESTNET_PASSPHRASE);
    const pubnetAddr = computeContractAddress(keypair.publicKey(), salt, publicNetPassphrase);

    expect(testnetAddr).not.toBe(pubnetAddr);
  });
});

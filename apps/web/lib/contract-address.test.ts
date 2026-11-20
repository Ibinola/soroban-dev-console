// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASES,
  computeContractAddress,
  deriveAddressesAcrossNetworks,
  deriveContractAddress,
  deriveContractAddressFromLabel,
  saltFromLabel,
} from "@devconsole/soroban-utils";

const deployer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7)).publicKey();
const other = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 8)).publicKey();

describe("contract address derivation (#1316)", () => {
  it("derives a stable, valid contract address", () => {
    const params = { deployer, salt: "ab".repeat(32), networkPassphrase: NETWORK_PASSPHRASES.testnet };
    const a = deriveContractAddress(params);
    expect(a).toBe(deriveContractAddress(params));
    expect(StrKey.isValidContract(a)).toBe(true);
    expect(a).toBe(computeContractAddress(deployer, params.salt, params.networkPassphrase));
  });

  it("changes with the deployer, salt and network", () => {
    const base = { deployer, salt: "ab".repeat(32), networkPassphrase: NETWORK_PASSPHRASES.testnet };
    const a = deriveContractAddress(base);
    expect(deriveContractAddress({ ...base, deployer: other })).not.toBe(a);
    expect(deriveContractAddress({ ...base, salt: "cd".repeat(32) })).not.toBe(a);
    expect(deriveContractAddress({ ...base, networkPassphrase: NETWORK_PASSPHRASES.mainnet })).not.toBe(a);
  });

  it("derives the salt from a label deterministically", () => {
    expect(saltFromLabel("my-token")).toBe(saltFromLabel("  my-token "));
    expect(saltFromLabel("my-token")).toMatch(/^[0-9a-f]{64}$/);
    expect(saltFromLabel("my-token")).not.toBe(saltFromLabel("other"));
    expect(() => saltFromLabel("   ")).toThrow(/empty/);
  });

  it("derives an address from a label", () => {
    const a = deriveContractAddressFromLabel(deployer, "v1", NETWORK_PASSPHRASES.testnet);
    expect(a).toBe(
      deriveContractAddress({ deployer, salt: saltFromLabel("v1"), networkPassphrase: NETWORK_PASSPHRASES.testnet }),
    );
  });

  it("derives a distinct address on each known network", () => {
    const all = deriveAddressesAcrossNetworks(deployer, "ab".repeat(32));
    expect(Object.keys(all).sort()).toEqual(["futurenet", "mainnet", "testnet"]);
    expect(new Set(Object.values(all)).size).toBe(3);
  });

  it("rejects non-account deployers", () => {
    expect(() =>
      deriveContractAddress({ deployer: "not-an-address", salt: "ab".repeat(32), networkPassphrase: "x" }),
    ).toThrow(/valid G/);
  });
});

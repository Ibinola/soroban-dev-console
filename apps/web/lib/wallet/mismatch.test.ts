import { describe, it, expect } from "vitest";
import {
  isWalletNetworkMismatch,
  passphraseToNetworkName,
  resolveNetworkConfig,
} from "./mismatch";

describe("isWalletNetworkMismatch", () => {
  it("returns false when no recorded network id is supplied", () => {
    expect(
      isWalletNetworkMismatch({
        recordedNetworkId: null,
        recordedNetworkPassphrase: "anything",
        currentNetworkId: "testnet",
        currentNetworkPassphrase: "Test SDF Network ; September 2015",
      }),
    ).toBe(false);
  });

  it("returns false when the wallet passphrase matches the app passphrase", () => {
    const testnetPass = "Test SDF Network ; September 2015";
    expect(
      isWalletNetworkMismatch({
        recordedNetworkId: "testnet",
        recordedNetworkPassphrase: testnetPass,
        currentNetworkId: "testnet",
        currentNetworkPassphrase: testnetPass,
      }),
    ).toBe(false);
  });

  it("returns true when the wallet passphrase differs from the app passphrase", () => {
    expect(
      isWalletNetworkMismatch({
        recordedNetworkId: "testnet",
        recordedNetworkPassphrase: "Test SDF Network ; September 2015",
        currentNetworkId: "mainnet",
        currentNetworkPassphrase: "Public Global Stellar Network ; September 2015",
      }),
    ).toBe(true);
  });

  it("falls back to network-id comparison when passphrase is unavailable", () => {
    expect(
      isWalletNetworkMismatch({
        recordedNetworkId: "testnet",
        recordedNetworkPassphrase: null,
        currentNetworkId: "mainnet",
        currentNetworkPassphrase: null,
      }),
    ).toBe(true);

    expect(
      isWalletNetworkMismatch({
        recordedNetworkId: "testnet",
        recordedNetworkPassphrase: null,
        currentNetworkId: "testnet",
        currentNetworkPassphrase: null,
      }),
    ).toBe(false);
  });

  it("ignores empty-string passphrases and falls back to network id", () => {
    expect(
      isWalletNetworkMismatch({
        recordedNetworkId: "mainnet",
        recordedNetworkPassphrase: "",
        currentNetworkId: "testnet",
        currentNetworkPassphrase: null,
      }),
    ).toBe(true);
  });
});

describe("passphraseToNetworkName", () => {
  const testnetPass = "Test SDF Network ; September 2015";
  const mainnetPass = "Public Global Stellar Network ; September 2015";

  it("resolves testnet by passphrase", () => {
    expect(passphraseToNetworkName(testnetPass)).toBe("Testnet");
  });

  it("resolves mainnet by passphrase", () => {
    expect(passphraseToNetworkName(mainnetPass)).toBe("Mainnet");
  });

  it("returns Unknown network for null/unknown passports", () => {
    expect(passphraseToNetworkName(null)).toBe("Unknown network");
    expect(passphraseToNetworkName("not-a-real-passphrase")).toBe(
      "Unknown network",
    );
  });

  it("resolves custom networks after the defaults", () => {
    const custom = [
      {
        id: "my-net",
        name: "Acme Net",
        rpcUrl: "http://x",
        networkPassphrase: "Acme Net ; 2024",
      },
    ];
    expect(passphraseToNetworkName("Acme Net ; 2024", custom)).toBe("Acme Net");
  });
});

describe("resolveNetworkConfig", () => {
  it("returns testnet when network id is missing", () => {
    expect(resolveNetworkConfig(null).id).toBe("testnet");
    expect(resolveNetworkConfig(undefined).id).toBe("testnet");
  });

  it("returns testnet for unknown ids", () => {
    expect(resolveNetworkConfig("not-real").id).toBe("testnet");
  });

  it("resolves a default network by id", () => {
    expect(resolveNetworkConfig("mainnet").id).toBe("mainnet");
  });
});

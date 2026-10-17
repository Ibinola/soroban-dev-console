/**
 * Deterministic contract address derivation helpers built on
 * `computeContractAddress`. A contract deployed from the same deployer with
 * the same salt on the same network always gets the same `C…` address, so a
 * human-readable label can serve as a stable deployment identity.
 */

import { StrKey, hash } from "@stellar/stellar-sdk";
import { computeContractAddress } from "./salt-utils";

export const NETWORK_PASSPHRASES = {
  mainnet: "Public Global Stellar Network ; September 2015",
  testnet: "Test SDF Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
} as const;

export type KnownNetwork = keyof typeof NETWORK_PASSPHRASES;

export interface DeriveAddressParams {
  /** `G…` account that will submit the deployment. */
  deployer: string;
  /** 32-byte salt as 64 hex characters, or raw bytes. */
  salt: string | Uint8Array;
  networkPassphrase: string;
}

/** SHA-256 of a UTF-8 label, as a 64-character hex salt. */
export function saltFromLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed === "") throw new Error("Salt label must not be empty");
  return Buffer.from(hash(Buffer.from(trimmed, "utf-8"))).toString("hex");
}

/** Derives the contract address a deployment with these parameters will get. */
export function deriveContractAddress(params: DeriveAddressParams): string {
  if (!StrKey.isValidEd25519PublicKey(params.deployer)) {
    throw new Error("Deployer must be a valid G… account address");
  }
  return computeContractAddress(params.deployer, params.salt, params.networkPassphrase);
}

/** Same as {@link deriveContractAddress} but with the salt derived from a label. */
export function deriveContractAddressFromLabel(
  deployer: string,
  label: string,
  networkPassphrase: string,
): string {
  return deriveContractAddress({ deployer, salt: saltFromLabel(label), networkPassphrase });
}

/** The address a deployment would get on each well-known network. */
export function deriveAddressesAcrossNetworks(
  deployer: string,
  salt: string | Uint8Array,
): Record<KnownNetwork, string> {
  const out = {} as Record<KnownNetwork, string>;
  for (const network of Object.keys(NETWORK_PASSPHRASES) as KnownNetwork[]) {
    out[network] = deriveContractAddress({
      deployer,
      salt,
      networkPassphrase: NETWORK_PASSPHRASES[network],
    });
  }
  return out;
}

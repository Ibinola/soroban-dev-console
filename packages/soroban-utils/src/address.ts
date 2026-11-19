import { StrKey } from "@stellar/stellar-sdk";

export type AddressKind = "account" | "contract";

/** Stable codes suitable for field-level UI messages. */
export type AddressErrorCode =
  | "EMPTY"
  | "WRONG_LENGTH"
  | "INVALID_PREFIX"
  | "INVALID_CHARACTERS"
  | "INVALID_CHECKSUM"
  | "WRONG_KIND";

export type AddressValidation =
  | { ok: true; kind: AddressKind; address: string }
  | { ok: false; code: AddressErrorCode; message: string };

export interface AddressValidationOptions {
  /** Require a specific kind; the other kind then fails with `WRONG_KIND`. */
  expect?: AddressKind;
}

const ADDRESS_LENGTH = 56;
const BASE32 = /^[A-Z2-7]+$/;

const MESSAGES: Record<AddressErrorCode, string> = {
  EMPTY: "Enter an address.",
  WRONG_LENGTH: "An address is exactly 56 characters.",
  INVALID_PREFIX: "An account address starts with G and a contract address with C.",
  INVALID_CHARACTERS: "Addresses use only capital letters A-Z and digits 2-7.",
  INVALID_CHECKSUM: "The checksum does not match; check the address for typos.",
  WRONG_KIND: "This is a valid address, but not of the expected kind.",
};

function fail(code: AddressErrorCode): AddressValidation {
  return { ok: false, code, message: MESSAGES[code] };
}

/**
 * Validate a Stellar address. The SDK's StrKey implementation decides validity
 * (version byte and checksum); the cheaper shape checks only pick the most
 * helpful error code for a malformed value.
 */
export function validateAddress(input: unknown, options: AddressValidationOptions = {}): AddressValidation {
  if (typeof input !== "string" || input.trim() === "") return fail("EMPTY");
  const value = input.trim();

  let kind: AddressKind | null = null;
  try {
    if (StrKey.isValidEd25519PublicKey(value)) kind = "account";
    else if (StrKey.isValidContract(value)) kind = "contract";
  } catch {
    kind = null;
  }

  if (kind) {
    if (options.expect && options.expect !== kind) return fail("WRONG_KIND");
    return { ok: true, kind, address: value };
  }

  if (value.length !== ADDRESS_LENGTH) return fail("WRONG_LENGTH");
  if (value[0] !== "G" && value[0] !== "C") return fail("INVALID_PREFIX");
  if (!BASE32.test(value)) return fail("INVALID_CHARACTERS");
  return fail("INVALID_CHECKSUM");
}

/** Convenience boolean form. */
export function isValidAddress(input: unknown, options: AddressValidationOptions = {}): boolean {
  return validateAddress(input, options).ok;
}

/**
 * W7-FE-003: Stellar Asset Contract (SAC) operation builder.
 *
 * SAC admin methods (transfer, mint, burn, clawback) all share the same
 * signature pattern when called via the SAC contract handle:
 *   - Admin-only methods require the SAC contract address to be
 *     supplied as the first argument.
 *   - All amounts are i128.
 *
 * These helpers keep the `Operation` construction in one place so the
 * modal (and any future direct-call UI) can rely on a single source of
 * truth.
 */

import { Address, Contract, nativeToScVal, xdr } from "@stellar/stellar-sdk";

export type SacAction = "transfer" | "burn" | "mint" | "clawback";

export interface SacCallParams {
  /** SAC contract id (C-... strkey) */
  contractId: string;
  /** SAC admin action to perform */
  action: SacAction;
  /** Positive integer amount as a string to avoid Number precision loss */
  amount: string;
  /**
   * Recipient address (G..., C..., or M... strkey).
   * - Required for `mint` (recipient gets the new tokens).
   * - Required for `clawback` (holder we're reclaiming from).
   * - Not used for `burn` — see `from`.
   */
  recipient?: string;
  /**
   * Source address to debit.
   * - Required for `transfer` (sender).
   * - Required for `burn` (holder whose balance shrinks).
   * - For `clawback`, set `recipient` instead (the holder whose balance shrinks).
   */
  from?: string;
}

/**
 * Build a single SAC admin `xdr.Operation`.
 *
 * The Stellar Asset Contract WASM exposes its dispatch directly to host
 * functions:
 *   - `transfer(env, from, to, amount)`
 *   - `mint(env, to, amount)`
 *   - `burn(env, from, amount)`
 *   - `clawback(env, from, amount)`
 *
 * When invoked externally via `Contract.call(...)`, the args are passed
 * verbatim — the SAC contract address is *not* prepended. (The
 * `TokenClient` helper in stellar-sdk pre-prepends it for you, but we
 * call the contract directly here.)
 *
 * Throws if required addresses are missing or the amount is invalid.
 */
export function buildSacCallOperation({
  contractId,
  action,
  amount,
  recipient,
  from,
}: SacCallParams): xdr.Operation {
  if (!contractId) {
    throw new Error("SAC contractId is required.");
  }
  if (!isPositiveIntString(amount)) {
    throw new Error("Amount must be a positive integer.");
  }

  const contract = new Contract(contractId);
  const amountSc = nativeToScVal(BigInt(amount), { type: "i128" });

  switch (action) {
    case "transfer": {
      requireAddress("transfer", "from", from);
      requireAddress("transfer", "to", recipient);
      return contract.call(
        "transfer",
        new Address(from!).toScVal(),
        new Address(recipient!).toScVal(),
        amountSc,
      );
    }
    case "mint": {
      requireAddress("mint", "to", recipient);
      return contract.call(
        "mint",
        new Address(recipient!).toScVal(),
        amountSc,
      );
    }
    case "burn": {
      requireAddress("burn", "from", from);
      return contract.call(
        "burn",
        new Address(from!).toScVal(),
        amountSc,
      );
    }
    case "clawback": {
      requireAddress("clawback", "from (holder)", recipient);
      return contract.call(
        "clawback",
        new Address(recipient!).toScVal(),
        amountSc,
      );
    }
    default: {
      const exhaustive: never = action;
      throw new Error(`Unsupported SAC action: ${String(exhaustive)}`);
    }
  }
}

/**
 * Returns true if the input parses as a positive integer (>0).
 * Accepts decimal strings only — no floats, no exponents.
 */
export function isPositiveIntString(amount: string): boolean {
  if (typeof amount !== "string" || amount.length === 0) return false;
  return /^[1-9][0-9]*$/.test(amount.trim());
}

function requireAddress(
  action: SacAction,
  field: string,
  value: string | undefined,
): void {
  if (!value || !value.trim()) {
    throw new Error(`SAC ${action} requires a ${field} address.`);
  }
}

import {
  Address,
  Operation,
  TimeoutInfinite,
  TransactionBuilder,
  nativeToScVal,
  xdr,
  type Account,
  type Memo,
  type Transaction,
} from "@stellar/stellar-sdk";
import { normalizeSaltToBuffer } from "./salt-utils";

export type SorobanOperationSpec =
  | {
      type: "invoke";
      contractId: string;
      method: string;
      /** Native JS values are converted with `nativeToScVal`; ScVals pass through. */
      args?: (xdr.ScVal | unknown)[];
    }
  | { type: "uploadWasm"; wasm: Uint8Array | Buffer }
  | {
      type: "createContract";
      wasmHash: string;
      deployer: string;
      salt: string | Uint8Array | Buffer;
      constructorArgs?: xdr.ScVal[];
    };

export interface BuildSorobanTxParams {
  sourceAccount: Account;
  networkPassphrase: string;
  operations: SorobanOperationSpec[];
  /** Base fee in stroops (default 100). */
  fee?: string;
  /** Seconds the transaction stays valid for; omit for no upper bound. */
  timeoutSeconds?: number;
  memo?: Memo;
}

function toScVal(value: unknown): xdr.ScVal {
  return (value instanceof xdr.ScVal ? value : nativeToScVal(value)) as unknown as xdr.ScVal;
}

function buildOperation(spec: SorobanOperationSpec): xdr.Operation {
  switch (spec.type) {
    case "invoke":
      return Operation.invokeContractFunction({
        contract: spec.contractId,
        function: spec.method,
        args: (spec.args ?? []).map(toScVal),
      });
    case "uploadWasm":
      return Operation.uploadContractWasm({ wasm: Buffer.from(spec.wasm) });
    case "createContract":
      return Operation.createCustomContract({
        address: new Address(spec.deployer),
        wasmHash: Buffer.from(spec.wasmHash.replace(/^0x/, ""), "hex"),
        salt: normalizeSaltToBuffer(spec.salt),
        constructorArgs: spec.constructorArgs,
      });
  }
}

/**
 * Builds an unsigned transaction containing Soroban operations. Soroban
 * allows a single host-function operation per transaction, so more than one
 * operation is rejected up front rather than at submission.
 */
export function buildSorobanTransaction(params: BuildSorobanTxParams): Transaction {
  const { sourceAccount, networkPassphrase, operations, fee = "100", timeoutSeconds, memo } = params;
  if (operations.length === 0) throw new Error("At least one operation is required");
  if (operations.length > 1) {
    throw new Error("A Soroban transaction can contain only one host-function operation");
  }

  const builder = new TransactionBuilder(sourceAccount, { fee, networkPassphrase });
  for (const op of operations) builder.addOperation(buildOperation(op));
  if (memo) builder.addMemo(memo);
  builder.setTimeout(timeoutSeconds ?? TimeoutInfinite);
  return builder.build();
}

/** Convenience wrapper for the common case: invoking one contract function. */
export function buildInvokeTransaction(
  params: Omit<BuildSorobanTxParams, "operations"> & {
    contractId: string;
    method: string;
    args?: unknown[];
  },
): Transaction {
  const { contractId, method, args, ...rest } = params;
  return buildSorobanTransaction({
    ...rest,
    operations: [{ type: "invoke", contractId, method, args }],
  });
}

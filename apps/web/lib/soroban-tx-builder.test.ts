// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Account, Keypair, Memo, xdr } from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASES,
  buildInvokeTransaction,
  buildSorobanTransaction,
  deriveContractAddress,
} from "@devconsole/soroban-utils";

const source = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();
const contractId = deriveContractAddress({
  deployer: source,
  salt: "11".repeat(32),
  networkPassphrase: NETWORK_PASSPHRASES.testnet,
});
const networkPassphrase = NETWORK_PASSPHRASES.testnet;
const account = () => new Account(source, "100");

describe("buildSorobanTransaction (#1314)", () => {
  it("builds an invoke transaction with native and ScVal args", () => {
    const tx = buildInvokeTransaction({
      sourceAccount: account(),
      networkPassphrase,
      contractId,
      method: "transfer",
      args: [source, 10n, xdr.ScVal.scvBool(true)],
    });
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0].type).toBe("invokeHostFunction");
    expect(tx.source).toBe(source);
    expect(tx.sequence).toBe("101");
    expect(tx.fee).toBe("100");
  });

  it("applies fee, memo and timeout", () => {
    const tx = buildSorobanTransaction({
      sourceAccount: account(),
      networkPassphrase,
      fee: "5000",
      memo: Memo.text("hi"),
      timeoutSeconds: 60,
      operations: [{ type: "invoke", contractId, method: "ping" }],
    });
    expect(tx.fee).toBe("5000");
    expect(Buffer.from(tx.memo.value as Uint8Array).toString()).toBe("hi");
    expect(Number(tx.timeBounds?.maxTime)).toBeGreaterThan(0);
  });

  it("builds wasm upload and create-contract transactions", () => {
    const upload = buildSorobanTransaction({
      sourceAccount: account(),
      networkPassphrase,
      operations: [{ type: "uploadWasm", wasm: Buffer.from([0, 97, 115, 109]) }],
    });
    expect(upload.operations[0].type).toBe("invokeHostFunction");

    const create = buildSorobanTransaction({
      sourceAccount: account(),
      networkPassphrase,
      operations: [{ type: "createContract", wasmHash: "aa".repeat(32), deployer: source, salt: "bb".repeat(32) }],
    });
    expect(create.operations[0].type).toBe("invokeHostFunction");
  });

  it("rejects empty and multi-operation requests", () => {
    const base = { sourceAccount: account(), networkPassphrase };
    expect(() => buildSorobanTransaction({ ...base, operations: [] })).toThrow(/at least one/i);
    const op = { type: "invoke" as const, contractId, method: "a" };
    expect(() => buildSorobanTransaction({ ...base, operations: [op, op] })).toThrow(/only one/i);
  });
});

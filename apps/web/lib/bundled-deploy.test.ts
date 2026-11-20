import { describe, it, expect } from "vitest";
import {
  buildBundledDeployAndInitTx,
  computeContractAddress,
  convertToScVal,
} from "@devconsole/soroban-utils";
import { Account, Keypair, xdr } from "@stellar/stellar-sdk";

describe("Bundled deploy and constructor initialization transaction builder (Issue #1092)", () => {
  const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

  it("builds a deploy-only transaction when no init function is provided", () => {
    const keypair = Keypair.random();
    const sourceAccount = new Account(keypair.publicKey(), "100");
    const wasmHash = "ab".repeat(32);
    const salt = "01".repeat(32);

    const tx = buildBundledDeployAndInitTx({
      sourceAccount,
      networkPassphrase: TESTNET_PASSPHRASE,
      wasmHash,
      deployerAddress: keypair.publicKey(),
      salt,
    });

    expect(tx.operations.length).toBe(1);
    expect(tx.operations[0].type).toBe("createCustomContract");
  });

  it("builds an atomic bundled deploy and init invocation transaction", () => {
    const keypair = Keypair.random();
    const sourceAccount = new Account(keypair.publicKey(), "100");
    const wasmHash = "ff".repeat(32);
    const salt = "99".repeat(32);

    const predictedContractId = computeContractAddress(
      keypair.publicKey(),
      salt,
      TESTNET_PASSPHRASE,
    );

    const adminArg = convertToScVal("address", keypair.publicKey());
    const decimalArg = convertToScVal("u32", 7);

    const tx = buildBundledDeployAndInitTx({
      sourceAccount,
      networkPassphrase: TESTNET_PASSPHRASE,
      wasmHash,
      deployerAddress: keypair.publicKey(),
      salt,
      initFunction: "initialize",
      initArgs: [adminArg, decimalArg],
    });

    // Bundled atomic transaction must contain both operations:
    // 1. createCustomContract
    // 2. invokeHostFunction (invokeContractFunction) targeting the predicted contract ID
    expect(tx.operations.length).toBe(2);
    expect(tx.operations[0].type).toBe("createCustomContract");
    expect(tx.operations[1].type).toBe("invokeHostFunction");

    const hostFunction = (tx.operations[1] as any).func;
    expect(hostFunction).toBeDefined();
    // Verify hostFunction is invokeContract
    expect(hostFunction.switch().name).toBe("hostFunctionTypeInvokeContract");
    const invokeArgs = hostFunction.invokeContract();
    expect(invokeArgs.contractAddress().address().switch().name).toBe("scAddressTypeContract");
    expect(invokeArgs.functionName().toString()).toBe("initialize");
    expect(invokeArgs.args().length).toBe(2);
  });

  it("supports constructor with __constructor naming convention", () => {
    const keypair = Keypair.random();
    const sourceAccount = new Account(keypair.publicKey(), "500");
    const wasmHash = "12".repeat(32);
    const salt = "34".repeat(32);

    const nameArg = convertToScVal("string", "MyToken");

    const tx = buildBundledDeployAndInitTx({
      sourceAccount,
      networkPassphrase: TESTNET_PASSPHRASE,
      wasmHash,
      deployerAddress: keypair.publicKey(),
      salt,
      initFunction: "__constructor",
      initArgs: [nameArg],
    });

    expect(tx.operations.length).toBe(2);
    expect(tx.operations[0].type).toBe("createCustomContract");
    expect(tx.operations[1].type).toBe("invokeHostFunction");
  });
});

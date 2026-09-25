import { describe, it, expect, beforeEach } from "vitest";
import { useDeploymentLogStore } from "./useDeploymentLogStore";

describe("useDeploymentLogStore (issue #1096)", () => {
  beforeEach(() => {
    useDeploymentLogStore.setState({ entries: [] });
  });

  it("logs a successful deployment with a timestamp and generated id", () => {
    useDeploymentLogStore.getState().logDeployment({
      wasmFileName: "token.wasm",
      wasmHash: "hash123",
      salt: "abcd1234",
      contractId: "CCONTRACT123",
      txHash: "txhash123",
      status: "success",
      network: "testnet",
    });

    const { entries } = useDeploymentLogStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      wasmFileName: "token.wasm",
      contractId: "CCONTRACT123",
      status: "success",
    });
    expect(entries[0].id).toBeTruthy();
    expect(entries[0].timestamp).toBeGreaterThan(0);
  });

  it("logs a failed deployment with the error message and null contract/tx fields", () => {
    useDeploymentLogStore.getState().logDeployment({
      wasmFileName: "token.wasm",
      wasmHash: "hash123",
      salt: null,
      contractId: null,
      txHash: null,
      status: "failed",
      errorMessage: "Simulation failed",
      network: "testnet",
    });

    const { entries } = useDeploymentLogStore.getState();
    expect(entries[0].status).toBe("failed");
    expect(entries[0].errorMessage).toBe("Simulation failed");
    expect(entries[0].contractId).toBeNull();
  });

  it("prepends new entries so the most recent deployment is first", () => {
    const log = useDeploymentLogStore.getState().logDeployment;
    log({ wasmFileName: "a.wasm", wasmHash: "h1", salt: null, contractId: "C1", txHash: null, status: "success", network: "testnet" });
    log({ wasmFileName: "b.wasm", wasmHash: "h2", salt: null, contractId: "C2", txHash: null, status: "success", network: "testnet" });

    const { entries } = useDeploymentLogStore.getState();
    expect(entries[0].wasmFileName).toBe("b.wasm");
    expect(entries[1].wasmFileName).toBe("a.wasm");
  });

  it("clears the log", () => {
    useDeploymentLogStore.getState().logDeployment({
      wasmFileName: "a.wasm", wasmHash: "h1", salt: null, contractId: "C1", txHash: null, status: "success", network: "testnet",
    });
    useDeploymentLogStore.getState().clearLog();
    expect(useDeploymentLogStore.getState().entries).toHaveLength(0);
  });
});

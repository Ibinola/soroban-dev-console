import { describe, it, expect, beforeEach } from "vitest";
import { useContractStore } from "./useContractStore";

describe("useContractStore (issue #1098 alias assignment)", () => {
  beforeEach(() => {
    useContractStore.setState({ contracts: [] });
  });

  it("defaults the contract name when no alias is given", () => {
    useContractStore.getState().addContract("CABCDEFGH1234", "testnet");
    const [contract] = useContractStore.getState().contracts;
    expect(contract.name).toBe("Contract CABC");
  });

  it("uses the given alias as the contract name", () => {
    useContractStore.getState().addContract("CABCDEFGH1234", "testnet", "My Custom Token");
    const [contract] = useContractStore.getState().contracts;
    expect(contract.name).toBe("My Custom Token");
  });

  it("falls back to the default name when the alias is blank/whitespace", () => {
    useContractStore.getState().addContract("CABCDEFGH1234", "testnet", "   ");
    const [contract] = useContractStore.getState().contracts;
    expect(contract.name).toBe("Contract CABC");
  });

  it("does not overwrite an existing contract's alias on a duplicate add", () => {
    useContractStore.getState().addContract("CABCDEFGH1234", "testnet", "First Alias");
    useContractStore.getState().addContract("CABCDEFGH1234", "testnet", "Second Alias");
    const { contracts } = useContractStore.getState();
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("First Alias");
  });
});

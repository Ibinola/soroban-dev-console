import { describe, it, expect, vi } from "vitest";
import { buildContractExplorerHref, copyContractId } from "./contract-explorer-link";

describe("buildContractExplorerHref (issue #1094)", () => {
  it("links to the in-app contract explorer route for the given contract ID", () => {
    const contractId = "CABCDEFGH1234567890";
    expect(buildContractExplorerHref(contractId)).toBe(`/contracts/${contractId}`);
  });
});

describe("copyContractId (issue #1094)", () => {
  it("writes the contract ID to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await copyContractId("CABCDEFGH1234567890");

    expect(writeText).toHaveBeenCalledWith("CABCDEFGH1234567890");
  });
});

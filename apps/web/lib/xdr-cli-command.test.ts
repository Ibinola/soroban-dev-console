import { describe, it, expect } from "vitest";
import {
  XDR_CLI_TARGETS,
  buildXdrCliCommand,
  getXdrCliTarget,
  quoteShellArg,
} from "./xdr-cli-command";

describe("XDR_CLI_TARGETS", () => {
  it("offers the documented command types", () => {
    expect(XDR_CLI_TARGETS.map((t) => t.label)).toEqual(["stellar xdr decode", "stellar tx submit"]);
  });

  it("falls back to the first target for an unknown id", () => {
    expect(getXdrCliTarget("nope" as never).id).toBe("xdr-decode");
  });
});

describe("quoteShellArg", () => {
  it("wraps a plain value in single quotes", () => {
    expect(quoteShellArg("AAAAAA==")).toBe("'AAAAAA=='");
  });

  it("escapes embedded single quotes so the argument stays one token", () => {
    expect(quoteShellArg("a'b")).toBe("'a'\\''b'");
  });
});

describe("buildXdrCliCommand", () => {
  it("builds a decode command with the payload quoted", () => {
    expect(buildXdrCliCommand("xdr-decode", "AAAAAA==")).toBe("stellar xdr decode --input 'AAAAAA=='");
  });

  it("adds the type flag when a concrete type hint is given", () => {
    expect(buildXdrCliCommand("xdr-decode", "AAAAAA==", { type: "ScVal" })).toBe(
      "stellar xdr decode --input 'AAAAAA==' --type ScVal",
    );
  });

  it("skips the type flag for the auto hint", () => {
    expect(buildXdrCliCommand("xdr-decode", "AAAAAA==", { type: "auto" })).toBe(
      "stellar xdr decode --input 'AAAAAA=='",
    );
  });

  it("builds a submit command and never passes a type", () => {
    expect(buildXdrCliCommand("tx-submit", "AAAAAgAAAA==", { type: "ScVal" })).toBe(
      "stellar tx submit --tx 'AAAAAgAAAA=='",
    );
  });

  it("appends the network when one is provided", () => {
    expect(buildXdrCliCommand("tx-submit", "AAAAAA==", { network: "testnet" })).toBe(
      "stellar tx submit --tx 'AAAAAA==' --network testnet",
    );
  });

  it("strips newlines and spaces the way a pasted blob carries them", () => {
    expect(buildXdrCliCommand("xdr-decode", "AAAA\n  AgAA\n  AA==")).toBe(
      "stellar xdr decode --input 'AAAAAgAAAA=='",
    );
  });

  it("returns an empty string when there is nothing to copy", () => {
    expect(buildXdrCliCommand("xdr-decode", "   \n ")).toBe("");
  });
});

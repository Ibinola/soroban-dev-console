import { describe, it, expect } from "vitest";
import { buildStellarCliCommand } from "./xdr-cli-command";

describe("buildStellarCliCommand (issue #1107)", () => {
  const xdr = "AAAAAgAAAAB7v2dX";

  it("builds an xdr decode command without a --type flag when auto-detecting", () => {
    const cmd = buildStellarCliCommand({ xdr, commandType: "xdr-decode", typeHint: "auto" });
    expect(cmd).toBe(`echo '${xdr}' | stellar xdr decode`);
  });

  it("builds an xdr decode command with an explicit --type flag", () => {
    const cmd = buildStellarCliCommand({ xdr, commandType: "xdr-decode", typeHint: "TransactionEnvelope" });
    expect(cmd).toBe(`echo '${xdr}' | stellar xdr decode --type 'TransactionEnvelope'`);
  });

  it("builds a tx submit command", () => {
    const cmd = buildStellarCliCommand({ xdr, commandType: "tx-submit" });
    expect(cmd).toBe(`echo '${xdr}' | stellar tx submit`);
  });

  it("safely shell-quotes XDR values containing single quotes", () => {
    const tricky = "AAAA'; rm -rf /";
    const cmd = buildStellarCliCommand({ xdr: tricky, commandType: "xdr-decode" });
    expect(cmd).toBe(`echo 'AAAA'\\''; rm -rf /' | stellar xdr decode`);
  });
});

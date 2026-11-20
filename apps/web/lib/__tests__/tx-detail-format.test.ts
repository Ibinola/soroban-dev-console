import { describe, expect, it } from "vitest";
import {
  formatRelativeTimestamp,
  formatUtcTimestamp,
  getLedgerExplorerUrl,
} from "../tx-detail-format";

describe("tx detail timestamp formatting", () => {
  it("formats UTC timestamps", () => {
    expect(formatUtcTimestamp("2026-11-20T12:34:56.000Z")).toBe(
      "2026-11-20 12:34:56 UTC",
    );
  });

  it("formats relative timestamps", () => {
    const now = Date.parse("2026-11-20T12:35:56.000Z");
    expect(formatRelativeTimestamp("2026-11-20T12:35:26.000Z", now)).toBe(
      "30 secs ago",
    );
    expect(formatRelativeTimestamp("2026-11-20T12:30:56.000Z", now)).toBe(
      "5 mins ago",
    );
    expect(formatRelativeTimestamp("2026-11-20T10:35:56.000Z", now)).toBe(
      "2 hrs ago",
    );
    expect(formatRelativeTimestamp("2026-11-18T12:35:56.000Z", now)).toBe(
      "2 days ago",
    );
  });

  it("builds ledger explorer links", () => {
    expect(getLedgerExplorerUrl("testnet", 12345)).toBe(
      "https://stellar.expert/explorer/testnet/ledger/12345",
    );
    expect(getLedgerExplorerUrl("mainnet", 99)).toBe(
      "https://stellar.expert/explorer/public/ledger/99",
    );
  });
});

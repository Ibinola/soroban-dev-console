import { describe, expect, it } from "vitest";
import {
  eventsCsvFilename,
  eventsToCsv,
  escapeCsvField,
  filterEventsByDate,
  type ExportableEvent,
} from "./events-csv";

const ev = (over: Partial<ExportableEvent> = {}): ExportableEvent => ({
  id: "1",
  ts: "2026-03-10T12:00:00Z",
  type: "transfer",
  topic: ["transfer", "GFROM"],
  data: '{"amount":"10"}',
  txHash: "abc123",
  ledger: 42,
  ...over,
});

describe("events CSV export (#1309)", () => {
  it("writes a header and one row per event with the required columns", () => {
    expect(eventsToCsv([ev()])).toBe(
      'timestamp,topic,data,transaction_hash,ledger_sequence\r\n2026-03-10T12:00:00Z,transfer/GFROM,"{""amount"":""10""}",abc123,42\r\n',
    );
  });

  it("includes only the selected columns, in canonical order", () => {
    expect(eventsToCsv([ev()], ["ledger", "timestamp"])).toBe("timestamp,ledger_sequence\r\n2026-03-10T12:00:00Z,42\r\n");
  });

  it("writes only the header when there are no events", () => {
    expect(eventsToCsv([], ["topic"])).toBe("topic\r\n");
  });

  it("leaves the transaction hash blank when unknown", () => {
    expect(eventsToCsv([ev({ txHash: undefined })], ["txHash"])).toBe("transaction_hash\r\n\r\n");
  });

  it("escapes quotes, commas and newlines", () => {
    expect(escapeCsvField('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField(null)).toBe("");
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(escapeCsvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvField("@cmd")).toBe("'@cmd");
    expect(escapeCsvField("-1+1")).toBe("'-1+1");
  });

  describe("filterEventsByDate", () => {
    const events = [
      ev({ id: "a", ts: "2026-03-09T23:59:59Z" }),
      ev({ id: "b", ts: "2026-03-10T00:00:00Z" }),
      ev({ id: "c", ts: "2026-03-11T23:59:59Z" }),
      ev({ id: "d", ts: "2026-03-12T00:00:00Z" }),
    ];

    it("is inclusive on both whole days", () => {
      expect(filterEventsByDate(events, { from: "2026-03-10", to: "2026-03-11" }).map((e) => e.id)).toEqual(["b", "c"]);
    });

    it("supports open-ended ranges", () => {
      expect(filterEventsByDate(events, { from: "2026-03-11" }).map((e) => e.id)).toEqual(["c", "d"]);
      expect(filterEventsByDate(events, { to: "2026-03-09" }).map((e) => e.id)).toEqual(["a"]);
      expect(filterEventsByDate(events, {})).toHaveLength(4);
    });

    it("drops events with unparseable timestamps", () => {
      expect(filterEventsByDate([ev({ ts: "not a date" })], {})).toEqual([]);
    });
  });

  it("names the file {contractId}-events-{date}.csv", () => {
    expect(eventsCsvFilename("CABC", new Date("2026-03-10T15:00:00Z"))).toBe("CABC-events-2026-03-10.csv");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAuditCsv,
  resolveCsvColumns,
  escapeCsvCell,
  AUDIT_CSV_COLUMNS,
} from "./audit-csv.js";
import type { AuditCsvRow } from "./audit-csv.js";

function sampleRow(overrides: Partial<AuditCsvRow> = {}): AuditCsvRow {
  return {
    createdAt: new Date("2026-01-15T10:30:00.000Z"),
    action: "share.created",
    actor: "owner-key-hash",
    resourceType: "share",
    summary: "Created share for workspace ws-1",
    metadata: { ip: "10.0.0.8", request: { path: "/api/shares" } },
    ...overrides,
  };
}

describe("audit CSV transformer", () => {
  it("exposes the five documented export columns", () => {
    assert.deepEqual(AUDIT_CSV_COLUMNS, ["timestamp", "event", "user", "ip", "details"]);
  });

  it("defaults to all columns when none are selected", () => {
    assert.deepEqual(resolveCsvColumns(undefined), AUDIT_CSV_COLUMNS);
    assert.deepEqual(resolveCsvColumns([]), AUDIT_CSV_COLUMNS);
  });

  it("resolves a requested subset, preserving order and case-insensitivity", () => {
    assert.deepEqual(resolveCsvColumns(["Event", "Timestamp"]), ["event", "timestamp"]);
    assert.deepEqual(resolveCsvColumns(["user", "IP"]), ["user", "ip"]);
  });

  it("drops unknown and duplicate columns but falls back to all columns", () => {
    assert.deepEqual(resolveCsvColumns(["event", "unknown_one", "event"]), ["event"]);
    assert.deepEqual(resolveCsvColumns(["bogus"]), AUDIT_CSV_COLUMNS);
  });

  it("quotes cells containing commas, quotes or newlines and doubles inner quotes", () => {
    assert.equal(escapeCsvCell("plain"), "plain");
    assert.equal(escapeCsvCell("left, right"), "\"left, right\"");
    assert.equal(escapeCsvCell('say "hi"'), "\"say \"\"hi\"\"\"");
    assert.equal(escapeCsvCell("line1\nline2"), "\"line1\nline2\"");
    assert.equal(escapeCsvCell(null), "");
    assert.equal(escapeCsvCell({ a: 1 }), "\"{""a"":1}\"");
  });

  it("renders a header row and only the selected columns", () => {
    const csv = buildAuditCsv([sampleRow()], ["event", "user"]);

    assert.equal(
      csv,
      ["Event Type,User", "share.created,owner-key-hash"].join("\n"),
    );
  });

  it("extracts the client IP from metadata and falls back to blank", () => {
    const withIp = buildAuditCsv([sampleRow()], ["ip"]);
    assert.equal(withIp, ["IP", "10.0.0.8"].join("\n"));

    const withoutIpRow = sampleRow({ metadata: { note: "no ip" } });
    const withoutIp = buildAuditCsv([withoutIpRow], ["ip"]);
    assert.equal(withoutIp, ["IP", ""].join("\n"));
  });

  it("renders timestamp, event, user, ip and details for a full row", () => {
    const csv = buildAuditCsv([sampleRow()]);
    const lines = csv.split("\n");

    assert.equal(lines[0], "Timestamp,Event Type,User,IP,Details");
    assert.equal(
      lines[1],
      "2026-01-15T10:30:00.000Z,share.created,owner-key-hash,10.0.0.8,Created share for workspace ws-1",
    );
  });

  it("emits a header-only document for empty result sets", () => {
    assert.equal(buildAuditCsv([]), "Timestamp,Event Type,User,IP,Details");
  });
});
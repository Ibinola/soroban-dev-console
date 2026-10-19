import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AUDIT_EXPORT_MAX_ROWS,
  resolveAuditExportFilters,
  resolveAuditExportRowLimit,
} from "./audit-export.js";

describe("audit export options (#1273)", () => {
  it("caps an export at 10,000 rows by default", () => {
    assert.equal(DEFAULT_AUDIT_EXPORT_MAX_ROWS, 10_000);
    assert.equal(resolveAuditExportRowLimit(undefined, {}), 10_000);
  });

  it("reads the ceiling from AUDIT_EXPORT_MAX_ROWS", () => {
    assert.equal(
      resolveAuditExportRowLimit(undefined, { AUDIT_EXPORT_MAX_ROWS: "25" }),
      25,
    );

    for (const value of ["", "not-a-number", "0", "-5"]) {
      assert.equal(
        resolveAuditExportRowLimit(undefined, { AUDIT_EXPORT_MAX_ROWS: value }),
        DEFAULT_AUDIT_EXPORT_MAX_ROWS,
        `expected fallback for AUDIT_EXPORT_MAX_ROWS=${JSON.stringify(value)}`,
      );
    }
  });

  it("only lets a caller lower the ceiling, never raise it", () => {
    assert.equal(resolveAuditExportRowLimit(50, {}), 50);
    assert.equal(
      resolveAuditExportRowLimit(999_999, {}),
      DEFAULT_AUDIT_EXPORT_MAX_ROWS,
    );
    assert.equal(
      resolveAuditExportRowLimit(0, {}),
      DEFAULT_AUDIT_EXPORT_MAX_ROWS,
    );
    assert.equal(
      resolveAuditExportRowLimit(Number.NaN, {}),
      DEFAULT_AUDIT_EXPORT_MAX_ROWS,
    );

    assert.equal(
      resolveAuditExportRowLimit(500, { AUDIT_EXPORT_MAX_ROWS: "100" }),
      100,
    );
  });

  it("maps the from/to aliases onto the canonical date filters", () => {
    assert.deepEqual(
      resolveAuditExportFilters({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      }),
      {
        createdAfter: "2026-01-01T00:00:00.000Z",
        createdBefore: "2026-02-01T00:00:00.000Z",
      },
    );
  });

  it("maps the type alias onto the action filter", () => {
    assert.deepEqual(resolveAuditExportFilters({ type: "share.created" }), {
      action: "share.created",
    });
    assert.deepEqual(resolveAuditExportFilters({ action: "a", type: "b" }), {
      action: "a",
    });
  });

  it("prefers the canonical names and drops empty values", () => {
    assert.deepEqual(
      resolveAuditExportFilters({
        actor: "",
        type: "x",
        createdAfter: "2026-01-01T00:00:00.000Z",
        from: "2020-01-01T00:00:00.000Z",
      }),
      { action: "x", createdAfter: "2026-01-01T00:00:00.000Z" },
    );
    assert.deepEqual(resolveAuditExportFilters({}), {});
  });
});

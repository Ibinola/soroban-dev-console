import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAuditExportManifest,
  normalizeAuditExportFilters,
  sha256Hex,
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

describe("audit export manifest (#1378)", () => {
  const content = "id,actor\n1,alice\n";
  const generatedAt = new Date("2026-02-03T04:05:06.000Z");

  it("records normalized filters, time, row count and the SHA-256 of the content", () => {
    const manifest = buildAuditExportManifest({
      format: "csv",
      filename: "audit-log-2026-02-03.csv",
      filters: { resourceType: " workspace ", actor: "alice", action: "", createdAfter: undefined },
      rowCount: 1,
      content,
      generatedAt,
    });
    assert.deepEqual(manifest, {
      version: 1,
      format: "csv",
      filename: "audit-log-2026-02-03.csv",
      filters: { actor: "alice", resourceType: "workspace" },
      generatedAt: "2026-02-03T04:05:06.000Z",
      rowCount: 1,
      sha256: sha256Hex(content),
    });
    assert.match(manifest.sha256, /^[0-9a-f]{64}$/);
  });

  it("changes the digest when the content changes and is stable otherwise", () => {
    const base = { format: "json" as const, filename: "a.json", rowCount: 0, generatedAt };
    assert.equal(buildAuditExportManifest({ ...base, content: "x" }).sha256, buildAuditExportManifest({ ...base, content: "x" }).sha256);
    assert.notEqual(buildAuditExportManifest({ ...base, content: "x" }).sha256, buildAuditExportManifest({ ...base, content: "y" }).sha256);
  });

  it("orders filter keys deterministically and drops unknown keys", () => {
    const filters = normalizeAuditExportFilters({ resourceId: "r", actor: "a", bogus: "x", createdBefore: "2026-01-01" } as never);
    assert.deepEqual(Object.keys(filters), ["actor", "createdBefore", "resourceId"]);
  });

  it("never carries secrets, row data or authentication material", () => {
    const manifest = buildAuditExportManifest({
      format: "csv",
      filename: "f.csv",
      filters: { actor: "alice", authorization: "Bearer SECRET", token: "t" } as never,
      rowCount: 1,
      content: "password,SECRET\nhunter2,SECRET\n",
      generatedAt,
    });
    const text = JSON.stringify(manifest);
    for (const leaked of ["SECRET", "hunter2", "Bearer", "token"]) assert.ok(!text.includes(leaked), leaked);
  });
});

import { describe, it, expect } from "vitest";

interface ExportPayload {
  format: "csv" | "json";
  records: unknown[];
  exportedAt: string;
}

function buildExportPayload(records: unknown[], format: "csv" | "json"): ExportPayload {
  return { format, records, exportedAt: new Date().toISOString() };
}

function parseImport(raw: string, format: "csv" | "json"): unknown[] {
  if (format === "json") return JSON.parse(raw);
  return raw.trim().split("\n").slice(1).map((line) => line.split(","));
}

describe("import/export flow regression", () => {
  it("builds a valid JSON export payload", () => {
    const p = buildExportPayload([{ id: 1 }, { id: 2 }], "json");
    expect(p.format).toBe("json");
    expect(p.records).toHaveLength(2);
    expect(p.exportedAt).toBeTruthy();
  });

  it("parses a JSON import correctly", () => {
    const records = parseImport('[{"id":1},{"id":2}]', "json");
    expect(records).toHaveLength(2);
  });

  it("parses a CSV import skipping the header row", () => {
    const csv = "id,name\n1,Alice\n2,Bob";
    const records = parseImport(csv, "csv");
    expect(records).toHaveLength(2);
  });
});

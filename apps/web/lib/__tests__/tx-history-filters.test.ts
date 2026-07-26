import { describe, it, expect } from "vitest";
import type { NormalizedTx } from "@/lib/history-utils";

// Helper to create a NormalizedTx fixture
function makeTx(overrides: Partial<NormalizedTx> = {}): NormalizedTx {
  return {
    id: "tx-" + Math.random().toString(36).slice(2),
    hash: "hash-" + Math.random().toString(36).slice(2),
    successful: true,
    createdAt: new Date().toISOString(),
    operationCount: 1,
    operationSummary: "Contract Call",
    sourceAccount: "GBZXN7PIRZGNMHGA7MUUUFFAUYVSF74BWXME4R37P2N6F5N4AUM5546F",
    feePaid: 100,
    ...overrides,
  };
}

// Pure filter logic extracted for testing (mirrors the tx/page.tsx useMemo logic)
function applyFilters(
  records: NormalizedTx[],
  {
    methodFilter = "",
    statusFilter = "all" as "all" | "success" | "error",
    dateFrom = "",
    dateTo = "",
  } = {},
): NormalizedTx[] {
  return records.filter((tx) => {
    if (methodFilter && !tx.operationSummary.toLowerCase().includes(methodFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter === "success" && !tx.successful) return false;
    if (statusFilter === "error" && tx.successful) return false;

    if (dateFrom || dateTo) {
      const ts = new Date(tx.createdAt).getTime();
      const fromMs = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const toMs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
      if (ts < fromMs || ts > toMs) return false;
    }
    return true;
  });
}

// Pagination helper
function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

describe("tx history filters (#736)", () => {
  const records: NormalizedTx[] = [
    makeTx({ successful: true, operationSummary: "Contract Call" }),
    makeTx({ successful: false, operationSummary: "Payment" }),
    makeTx({ successful: true, operationSummary: "Payment" }),
    makeTx({ successful: true, operationSummary: "Create Account" }),
  ];

  it("returns all records with default filters", () => {
    expect(applyFilters(records)).toHaveLength(4);
  });

  it("filters by method text search (case-insensitive)", () => {
    const result = applyFilters(records, { methodFilter: "payment" });
    expect(result).toHaveLength(2);
    result.forEach((tx) =>
      expect(tx.operationSummary.toLowerCase()).toContain("payment"),
    );
  });

  it("filters by status = success", () => {
    const result = applyFilters(records, { statusFilter: "success" });
    expect(result.every((tx) => tx.successful)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it("filters by status = error", () => {
    const result = applyFilters(records, { statusFilter: "error" });
    expect(result.every((tx) => !tx.successful)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no records match", () => {
    const result = applyFilters(records, { methodFilter: "nonexistent-method" });
    expect(result).toHaveLength(0);
  });
});

describe("tx history pagination (#736)", () => {
  const records = Array.from({ length: 45 }, (_, i) => makeTx({ id: `tx-${i}` }));

  it("returns first page of 20", () => {
    const page1 = paginate(records, 1, 20);
    expect(page1).toHaveLength(20);
    expect(page1[0].id).toBe("tx-0");
  });

  it("returns second page", () => {
    const page2 = paginate(records, 2, 20);
    expect(page2).toHaveLength(20);
    expect(page2[0].id).toBe("tx-20");
  });

  it("returns partial last page", () => {
    const page3 = paginate(records, 3, 20);
    expect(page3).toHaveLength(5);
  });

  it("calculates total pages correctly", () => {
    const totalPages = Math.max(1, Math.ceil(records.length / 20));
    expect(totalPages).toBe(3);
  });
});

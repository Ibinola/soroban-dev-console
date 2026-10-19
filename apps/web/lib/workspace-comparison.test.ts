import { describe, it, expect } from "vitest";
import type { WorkspaceSnapshot } from "@/store/workspace-schema";
import {
  compareWorkspaceSnapshots,
  formatWorkspaceComparisonReport,
  summarizeWorkspaceComparison,
} from "./workspace-comparison";

function snapshot(
  overrides: Partial<WorkspaceSnapshot> = {},
): WorkspaceSnapshot {
  return {
    version: 1,
    id: "ws-1",
    name: "Payments",
    contractIds: [],
    savedCallIds: [],
    artifactRefs: [],
    selectedNetwork: "testnet",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("workspace comparison (#1289)", () => {
  it("classifies added, removed, modified and unchanged contracts", () => {
    const shared = "C" + "A".repeat(55);
    const removed = "C" + "B".repeat(55);
    const added = "C" + "D".repeat(55);

    const comparison = compareWorkspaceSnapshots(
      snapshot({ contractIds: [shared, removed] }),
      snapshot({ id: "ws-2", name: "Payments", contractIds: [shared, added] }),
    );

    expect(comparison.added.map((c) => c.contractId)).toEqual([added]);
    expect(comparison.removed.map((c) => c.contractId)).toEqual([removed]);
    expect(comparison.modified).toEqual([]);
    expect(comparison.unchanged.map((c) => c.contractId)).toEqual([shared]);
    expect(comparison.summary).toEqual({
      baseContractCount: 2,
      compareContractCount: 2,
      added: 1,
      removed: 1,
      modified: 0,
      unchanged: 1,
    });
  });

  it("reports the specific change for modified contracts", () => {
    const shared = "C" + "A".repeat(55);

    const comparison = compareWorkspaceSnapshots(
      snapshot({ contractIds: [shared], name: "Payments" }),
      snapshot({ id: "ws-2", name: "Payments v2", contractIds: [shared] }),
    );

    expect(comparison.modified).toHaveLength(1);
    expect(comparison.modified[0].changes).toEqual([
      { field: "workspaceName", before: "Payments", after: "Payments v2" },
    ]);
  });

  it("captures workspace metadata changes", () => {
    const comparison = compareWorkspaceSnapshots(
      snapshot(),
      snapshot({ id: "ws-2", name: "Payments", selectedNetwork: "mainnet" }),
    );

    expect(comparison.metadata).toEqual([
      { field: "selectedNetwork", before: "testnet", after: "mainnet" },
    ]);
  });

  it("summarises the difference in one line", () => {
    const comparison = compareWorkspaceSnapshots(
      snapshot({ contractIds: ["C" + "A".repeat(55)] }),
      snapshot({ id: "ws-2", contractIds: [] }),
    );

    expect(comparison.summary.removed).toBe(1);
    expect(summarizeWorkspaceComparison(comparison)).toBe(
      "1 removed between “Payments” and “Payments”.",
    );
  });

  it("reports identical workspaces as having no differences", () => {
    const base = snapshot();

    expect(
      summarizeWorkspaceComparison(compareWorkspaceSnapshots(base, base)),
    ).toContain("No differences");
  });

  it("exports a markdown summary report", () => {
    const added = "C" + "D".repeat(55);
    const comparison = compareWorkspaceSnapshots(
      snapshot(),
      snapshot({ id: "ws-2", name: "Payments v2", contractIds: [added] }),
    );

    const report = formatWorkspaceComparisonReport(comparison);

    expect(report).toContain("# Workspace comparison");
    expect(report).toContain("| Added | 1 |");
    expect(report).toContain("## Added");
    expect(report).toContain(`\`${added}\``);
    expect(report).toContain("- name: Payments → Payments v2");
  });

  it("omits empty sections from the report", () => {
    const base = snapshot({ contractIds: ["C" + "A".repeat(55)] });

    const report = formatWorkspaceComparisonReport(
      compareWorkspaceSnapshots(base, base),
    );

    expect(report).not.toContain("## Removed");
    expect(report).not.toContain("## Added");
  });
});

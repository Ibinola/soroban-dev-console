/**
 * Issue #1289: workspace comparison view — diffing two workspace states.
 *
 * Complements `diffWorkspaceSnapshots` (which reports field-level conflicts for
 * sync) with a comparison-shaped result: which contracts were added, removed or
 * modified, plus a summary report that can be downloaded or copied.
 */

import type { WorkspaceSnapshot } from "@/store/workspace-schema";

export type WorkspaceComparisonStatus =
  "added" | "removed" | "modified" | "unchanged";

export interface WorkspaceContractChange {
  contractId: string;
  status: WorkspaceComparisonStatus;
  /** Field-level changes, empty for added/removed contracts. */
  changes: Array<{ field: string; before: string; after: string }>;
}

export interface WorkspaceComparison {
  /** Left/baseline workspace. */
  base: { id: string; name: string };
  /** Right/target workspace. */
  compare: { id: string; name: string };
  added: WorkspaceContractChange[];
  removed: WorkspaceContractChange[];
  modified: WorkspaceContractChange[];
  unchanged: WorkspaceContractChange[];
  /** Workspace metadata changes (name, network, …) keyed by field. */
  metadata: Array<{ field: string; before: string; after: string }>;
  summary: {
    baseContractCount: number;
    compareContractCount: number;
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

const METADATA_FIELDS = [
  "name",
  "selectedNetwork",
  "cloudId",
  "archived",
] as const;

function describe(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
}

/**
 * Compare two workspace snapshots.
 *
 * Contract identity is the contract address (the snapshot's `contractIds`
 * entries), so a contract present in both workspaces is classified as
 * `unchanged`, or `modified` when its owning workspace metadata differs in a way
 * that affects it (currently the network it is bound to).
 */
export function compareWorkspaceSnapshots(
  base: WorkspaceSnapshot,
  compare: WorkspaceSnapshot,
): WorkspaceComparison {
  const baseIds = new Set(base.contractIds);
  const compareIds = new Set(compare.contractIds);

  const added: WorkspaceContractChange[] = [];
  const removed: WorkspaceContractChange[] = [];
  const modified: WorkspaceContractChange[] = [];
  const unchanged: WorkspaceContractChange[] = [];

  for (const contractId of compare.contractIds) {
    if (!baseIds.has(contractId)) {
      added.push({ contractId, status: "added", changes: [] });
    }
  }

  for (const contractId of base.contractIds) {
    if (!compareIds.has(contractId)) {
      removed.push({ contractId, status: "removed", changes: [] });
      continue;
    }

    const changes: WorkspaceContractChange["changes"] = [];
    if (base.name !== compare.name) {
      // The contract is bound to a renamed workspace: report the rename against
      // each shared contract so the UI can show "renamed" on the row itself.
      changes.push({
        field: "workspaceName",
        before: base.name,
        after: compare.name,
      });
    }

    if (changes.length > 0) {
      modified.push({ contractId, status: "modified", changes });
    } else {
      unchanged.push({ contractId, status: "unchanged", changes: [] });
    }
  }

  const metadata: WorkspaceComparison["metadata"] = [];
  for (const field of METADATA_FIELDS) {
    const before = describe(base[field]);
    const after = describe(compare[field]);
    if (before !== after) metadata.push({ field, before, after });
  }

  return {
    base: { id: base.id, name: base.name },
    compare: { id: compare.id, name: compare.name },
    added,
    removed,
    modified,
    unchanged,
    metadata,
    summary: {
      baseContractCount: base.contractIds.length,
      compareContractCount: compare.contractIds.length,
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged: unchanged.length,
    },
  };
}

/** One-line summary suitable for a toast or a PR comment. */
export function summarizeWorkspaceComparison(
  comparison: WorkspaceComparison,
): string {
  const { added, removed, modified } = comparison.summary;
  const parts = [
    added > 0 ? `${added} added` : null,
    removed > 0 ? `${removed} removed` : null,
    modified > 0 ? `${modified} modified` : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) {
    return `No differences between “${comparison.base.name}” and “${comparison.compare.name}”.`;
  }

  return `${parts.join(", ")} between “${comparison.base.name}” and “${comparison.compare.name}”.`;
}

/** Issue #1289: render the comparison as a downloadable markdown report. */
export function formatWorkspaceComparisonReport(
  comparison: WorkspaceComparison,
): string {
  const lines: string[] = [
    `# Workspace comparison`,
    "",
    `- Base: ${comparison.base.name} (${comparison.base.id})`,
    `- Compare: ${comparison.compare.name} (${comparison.compare.id})`,
    "",
    `## Summary`,
    "",
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Contracts in base | ${comparison.summary.baseContractCount} |`,
    `| Contracts in compare | ${comparison.summary.compareContractCount} |`,
    `| Added | ${comparison.summary.added} |`,
    `| Removed | ${comparison.summary.removed} |`,
    `| Modified | ${comparison.summary.modified} |`,
    `| Unchanged | ${comparison.summary.unchanged} |`,
  ];

  const section = (title: string, changes: WorkspaceContractChange[]) => {
    if (changes.length === 0) return;
    lines.push("", `## ${title}`, "");
    for (const change of changes) {
      const detail =
        change.changes.length > 0
          ? ` (${change.changes.map((c) => `${c.field}: ${c.before} → ${c.after}`).join("; ")})`
          : "";
      lines.push(`- \`${change.contractId}\`${detail}`);
    }
  };

  section("Added", comparison.added);
  section("Removed", comparison.removed);
  section("Modified", comparison.modified);

  if (comparison.metadata.length > 0) {
    lines.push("", "## Workspace metadata", "");
    for (const entry of comparison.metadata) {
      lines.push(`- ${entry.field}: ${entry.before} → ${entry.after}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

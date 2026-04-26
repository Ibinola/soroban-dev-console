/**
 * FE-060: Dependency diagnostics for imported and shared workspace artifacts.
 *
 * Provides utilities to detect and report missing ABI, WASM, or metadata
 * dependencies that prevent full functionality of imported/shared workspaces.
 */

import type { NormalizedContractSpec } from "@devconsole/soroban-utils";
import type { WasmEntry } from "@/store/useWasmStore";
import type { SerializedWorkspace } from "@/lib/workspace-serializer";

export type DependencyIssue = {
  type: "missing-abi" | "missing-wasm" | "broken-reference" | "incomplete-artifact";
  severity: "error" | "warning";
  entityId: string;
  entityType: "contract" | "wasm" | "reference";
  description: string;
  recoveryPath?: string;
};

export type DependencyDiagnostics = {
  hasIssues: boolean;
  issues: DependencyIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    byType: Record<DependencyIssue["type"], number>;
  };
};

/**
 * Check for missing ABI dependencies
 */
function checkAbiDependencies(
  contracts: SerializedWorkspace["contracts"],
  abiSpecs: Record<string, NormalizedContractSpec>,
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];

  contracts.forEach((contract) => {
    const hasAbi = abiSpecs[contract.id];
    
    if (!hasAbi) {
      issues.push({
        type: "missing-abi",
        severity: "error",
        entityId: contract.id,
        entityType: "contract",
        description: `Contract ${contract.id} is missing ABI specification`,
        recoveryPath: "Import the contract's ABI or redeploy from source",
      });
    }
  });

  return issues;
}

/**
 * Check for missing WASM dependencies
 */
function checkWasmDependencies(
  contracts: SerializedWorkspace["contracts"],
  wasms: WasmEntry[],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const wasmMap = new Map(wasms.map(w => [w.hash, w]));

  // Note: Contract type doesn't have wasmHash property directly
  // This would need to be extended based on actual reference structure
  // For now, we'll check if any WASM entries are orphaned
  wasms.forEach((wasm) => {
    const isReferenced = contracts.some((contract) => 
      // This would need to be updated when contract references are implemented
      false // For now, we'll assume all WASM should be referenced
    );

    if (!isReferenced && !wasm.pinnedBy?.length) {
      issues.push({
        type: "missing-wasm",
        severity: "warning",
        entityId: wasm.hash,
        entityType: "wasm",
        description: `WASM artifact ${wasm.hash} is not referenced by any contract`,
        recoveryPath: "Associate WASM with a contract or pin to prevent cleanup",
      });
    }
  });

  return issues;
}

/**
 * Check for broken references between artifacts
 */
function checkBrokenReferences(
  contracts: SerializedWorkspace["contracts"],
  wasms: WasmEntry[],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const contractIds = new Set(contracts.map(c => c.id));
  const wasmHashes = new Set(wasms.map(w => w.hash));

  // Check for contracts that might have incomplete references
  contracts.forEach((contract) => {
    // Basic consistency check - contracts should have valid IDs
    if (!contract.id || contract.id.trim() === "") {
      issues.push({
        type: "broken-reference",
        severity: "error",
        entityId: contract.id || "unknown",
        entityType: "contract",
        description: `Contract has invalid or missing ID`,
        recoveryPath: "Re-import workspace with valid contract data",
      });
    }
  });

  return issues;
}

/**
 * Check for incomplete artifacts (partial metadata)
 */
function checkIncompleteArtifacts(
  contracts: SerializedWorkspace["contracts"],
  wasms: WasmEntry[],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];

  wasms.forEach((wasm) => {
    if (!wasm.functions || wasm.functions.length === 0) {
      issues.push({
        type: "incomplete-artifact",
        severity: "warning",
        entityId: wasm.hash,
        entityType: "wasm",
        description: `WASM ${wasm.hash} has no function metadata`,
        recoveryPath: "Rebuild WASM with function exports or add metadata manually",
      });
    }

    if (!wasm.name || wasm.name.trim() === "") {
      issues.push({
        type: "incomplete-artifact",
        severity: "warning",
        entityId: wasm.hash,
        entityType: "wasm",
        description: `WASM ${wasm.hash} has no name metadata`,
        recoveryPath: "Add name metadata to WASM artifact",
      });
    }

    if (wasm.parseError) {
      issues.push({
        type: "incomplete-artifact",
        severity: "error",
        entityId: wasm.hash,
        entityType: "wasm",
        description: `WASM ${wasm.hash} has parse errors`,
        recoveryPath: "Rebuild WASM from source to fix parse errors",
      });
    }
  });

  return issues;
}

/**
 * Run comprehensive dependency diagnostics on a workspace
 */
export function diagnoseDependencies(
  workspace: SerializedWorkspace,
  abiSpecs: Record<string, NormalizedContractSpec>,
  wasms: WasmEntry[],
): DependencyDiagnostics {
  const allIssues = [
    ...checkAbiDependencies(workspace.contracts, abiSpecs),
    ...checkWasmDependencies(workspace.contracts, wasms),
    ...checkBrokenReferences(workspace.contracts, wasms),
    ...checkIncompleteArtifacts(workspace.contracts, wasms),
  ];

  const summary = {
    total: allIssues.length,
    errors: allIssues.filter(i => i.severity === "error").length,
    warnings: allIssues.filter(i => i.severity === "warning").length,
    byType: allIssues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<DependencyIssue["type"], number>),
  };

  return {
    hasIssues: allIssues.length > 0,
    issues: allIssues,
    summary,
  };
}

/**
 * Get recovery actions for a set of issues
 */
export function getRecoveryActions(issues: DependencyIssue[]): Array<{
  action: string;
  description: string;
  issues: DependencyIssue[];
}> {
  const actions = new Map<string, DependencyIssue[]>();

  issues.forEach(issue => {
    const key = issue.recoveryPath || "Manual intervention required";
    if (!actions.has(key)) {
      actions.set(key, []);
    }
    actions.get(key)!.push(issue);
  });

  return Array.from(actions.entries()).map(([action, relatedIssues]) => ({
    action,
    description: action,
    issues: relatedIssues,
  }));
}

/**
 * Format diagnostic summary for display
 */
export function formatDiagnosticSummary(diagnostics: DependencyDiagnostics): string {
  if (!diagnostics.hasIssues) {
    return "All dependencies resolved";
  }

  const parts: string[] = [];
  
  if (diagnostics.summary.errors > 0) {
    parts.push(`${diagnostics.summary.errors} error(s)`);
  }
  
  if (diagnostics.summary.warnings > 0) {
    parts.push(`${diagnostics.summary.warnings} warning(s)`);
  }

  return parts.join(", ");
}

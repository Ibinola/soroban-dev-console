/**
 * FE-059: Pre-import review and selective restore workflow.
 *
 * Provides a preview system for workspace imports so users can see
 * what will be restored, what was repaired, and what may be skipped
 * before any local state is overwritten.
 */

import type { SerializedWorkspace, ValidationResult } from "@/lib/workspace-serializer";
import type { Contract } from "@/store/useContractStore";
import type { SavedCall } from "@/store/useSavedCallsStore";
import type { WorkspaceNote } from "@/store/workspace-schema";

export interface ImportPreview {
  workspace: SerializedWorkspace["workspace"];
  contracts: Contract[];
  savedCalls: SavedCall[];
  notes: WorkspaceNote[];
  validation: ValidationResult;
  statistics: {
    totalContracts: number;
    importableContracts: number;
    totalCalls: number;
    importableCalls: number;
    totalNotes: number;
    importableNotes: number;
  };
}

export interface ImportSelection {
  restoreWorkspace: boolean;
  restoreContracts: boolean;
  restoreSavedCalls: boolean;
  restoreNotes: boolean;
  selectedContractIds?: string[];
  selectedCallIds?: string[];
  selectedNoteIds?: string[];
}

export interface ImportReviewOptions {
  autoSelectAll?: boolean;
  requireUserConfirmation?: boolean;
}

/**
 * Generate a preview of what will be imported
 */
export function generateImportPreview(
  raw: unknown,
  options: ImportReviewOptions = {}
): ImportPreview {
  const { payload, validation } = importWorkspace(raw);
  
  const totalContracts = payload.contracts?.length || 0;
  const totalCalls = payload.savedCalls?.length || 0;
  const totalNotes = payload.notes?.length || 0;

  // Determine what can be imported vs what will be dropped
  const importableContracts = totalContracts;
  const importableCalls = totalCalls;
  const importableNotes = totalNotes;

  return {
    workspace: payload.workspace,
    contracts: payload.contracts || [],
    savedCalls: payload.savedCalls || [],
    notes: payload.notes || [],
    validation,
    statistics: {
      totalContracts,
      importableContracts,
      totalCalls,
      importableCalls,
      totalNotes,
      importableNotes,
    },
  };
}

/**
 * Apply user selections to the import preview
 */
export function applyImportSelection(
  preview: ImportPreview,
  selection: ImportSelection,
): SerializedWorkspace {
  const selectedContracts = selection.restoreContracts
    ? preview.contracts.filter((c) => 
        selection.selectedContractIds?.includes(c.id) ?? 
        (options.autoSelectAll ?? true)
      )
    : [];

  const selectedCalls = selection.restoreSavedCalls
    ? preview.savedCalls.filter((c) => 
        selection.selectedCallIds?.includes(c.id) ?? 
        (options.autoSelectAll ?? true)
      )
    : [];

  const selectedNotes = selection.restoreNotes
    ? preview.notes.filter((n) => 
        selection.selectedNoteIds?.includes(n.id) ?? 
        (options.autoSelectAll ?? true)
      )
    : [];

  return {
    version: preview.workspace.version,
    exportedAt: preview.workspace.exportedAt,
    workspace: {
      ...preview.workspace,
      contractIds: selectedContracts.map(c => c.id),
      savedCallIds: selectedCalls.map(c => c.id),
      artifactRefs: preview.workspace.artifactRefs || [],
    },
    contracts: selectedContracts,
    savedCalls: selectedCalls,
    notes: selectedNotes,
  };
}

/**
 * Format validation issues for display
 */
export function formatValidationSummary(validation: ValidationResult): {
  hasIssues: boolean;
  errorCount: number;
  warningCount: number;
  summary: string;
  issues: Array<{
    type: 'error' | 'warning';
    message: string;
  count?: number;
  items?: string[];
  }>;
} {
  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;
  const hasIssues = errorCount > 0 || warningCount > 0;

  const issues = [
    ...validation.errors.map((error, index) => ({
      type: 'error' as const,
      message: error,
      count: 1,
    })),
    ...validation.warnings.length > 0 ? [{
      type: 'warning' as const,
      message: validation.warnings.join('; '),
      count: validation.warnings.length,
      items: validation.warnings,
    }] : [],
  ];

  let summary = '';
  if (errorCount > 0) {
    summary = `${errorCount} error${errorCount !== 1 ? 's' : ''}`;
  }
  if (warningCount > 0) {
    summary += (summary ? ', ' : '') + `${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
  }

  return {
    hasIssues,
    errorCount,
    warningCount,
    summary: summary || 'No issues detected',
    issues,
  };
}

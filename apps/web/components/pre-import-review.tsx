"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileJson,
  Download,
  Upload,
  Eye,
  EyeOff,
  GitFork,
  Package,
  Trash2,
  Info,
} from "lucide-react";
import {
  generateImportPreview,
  applyImportSelection,
  formatValidationSummary,
  type ImportPreview,
  type ImportSelection,
  type ImportReviewOptions,
} from "@/lib/pre-import-review";
import type { SerializedWorkspace } from "@/lib/workspace-serializer";

interface PreImportReviewProps {
  raw: unknown;
  onConfirm: (selection: ImportSelection) => void;
  onCancel: () => void;
  options?: ImportReviewOptions;
}

export function PreImportReview({ raw, onConfirm, onCancel, options = {} }: PreImportReviewProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selection, setSelection] = useState<ImportSelection>({
    restoreWorkspace: true,
    restoreContracts: true,
    restoreSavedCalls: true,
    restoreNotes: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Generate preview when raw data changes
  useState(() => {
    if (raw) {
      setIsLoading(true);
      try {
        const importPreview = generateImportPreview(raw, options);
        setPreview(importPreview);
        
        // Auto-select all if no issues or if option is set
        if (importPreview.validation.errors.length === 0 && options.autoSelectAll) {
          setSelection({
            restoreWorkspace: true,
            restoreContracts: true,
            restoreSavedCalls: true,
            restoreNotes: true,
          });
        }
      } catch (error) {
        console.error("Failed to generate import preview:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [raw, options]);

  const handleConfirm = () => {
    if (!preview) return;
    
    const finalSelection = selection.restoreWorkspace ? selection : {
      ...selection,
      restoreWorkspace: false,
      restoreContracts: false,
      restoreSavedCalls: false,
      restoreNotes: false,
    };

    onConfirm(finalSelection);
  };

  const handleCancel = () => {
    onCancel();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
          <span>Analyzing workspace data...</span>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <FileJson className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium">No valid workspace data found</p>
          <p className="text-sm text-muted-foreground">
            The provided file could not be parsed as a valid workspace export.
          </p>
        </div>
      </div>
    );
  }

  const validation = formatValidationSummary(preview.validation);

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Pre-Import Review
            {preview.validation.errors.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {preview.validation.errors.length} Error{preview.validation.errors.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {preview.validation.warnings.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {preview.validation.warnings.length} Warning{preview.validation.warnings.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Review what will be restored before importing this workspace. Invalid imports will not modify your local data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Validation Summary */}
          {validation.hasIssues && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Import Issues Detected</h4>
                  <p className="text-sm text-yellow-700">{validation.summary}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {validation.issues.map((issue, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Badge variant={issue.type === 'error' ? 'destructive' : 'secondary'} className="shrink-0">
                      {issue.type.replace('-', ' ')}
                    </Badge>
                    <span>{issue.message}</span>
                    {issue.count && issue.count > 1 && (
                      <span className="text-muted-foreground"> ({issue.count} instances)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-md border p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{preview.statistics.totalContracts}</div>
              <div className="text-sm text-muted-foreground">Contracts</div>
              <div className="text-xs text-muted-foreground">
                {preview.statistics.importableContracts} of {preview.statistics.totalContracts}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{preview.statistics.totalCalls}</div>
              <div className="text-sm text-muted-foreground">Saved Calls</div>
              <div className="text-xs text-muted-foreground">
                {preview.statistics.importableCalls} of {preview.statistics.totalCalls}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{preview.statistics.totalNotes}</div>
              <div className="text-sm text-muted-foreground">Notes</div>
              <div className="text-xs text-muted-foreground">
                {preview.statistics.importableNotes} of {preview.statistics.totalNotes}
              </div>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="space-y-4">
            <h4 className="font-medium mb-3">Select What to Restore</h4>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.restoreWorkspace}
                  onChange={(e) => setSelection(prev => ({ ...prev, restoreWorkspace: e.target.checked }))}
                  className="h-4 w-4"
                />
                <div>
                  <div className="font-medium">Workspace Settings</div>
                  <div className="text-sm text-muted-foreground">
                    Network, contracts, and basic configuration
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.restoreContracts}
                  onChange={(e) => setSelection(prev => ({ ...prev, restoreContracts: e.target.checked }))}
                  className="h-4 w-4"
                  disabled={preview.statistics.totalContracts === 0}
                />
                <div>
                  <div className="font-medium">Contracts ({preview.statistics.importableContracts})</div>
                  <div className="text-sm text-muted-foreground">
                    Contract references and saved interactions
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.restoreSavedCalls}
                  onChange={(e) => setSelection(prev => ({ ...prev, restoreSavedCalls: e.target.checked }))}
                  className="h-4 w-4"
                  disabled={preview.statistics.totalCalls === 0}
                />
                <div>
                  <div className="font-medium">Saved Calls ({preview.statistics.importableCalls})</div>
                  <div className="text-sm text-muted-foreground">
                    Saved function calls and their parameters
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.restoreNotes}
                  onChange={(e) => setSelection(prev => ({ ...prev, restoreNotes: e.target.checked }))}
                  className="h-4 w-4"
                  disabled={preview.statistics.totalNotes === 0}
                />
                <div>
                  <div className="font-medium">Notes ({preview.statistics.importableNotes})</div>
                  <div className="text-sm text-muted-foreground">
                    Annotations and documentation
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            
            <Button
              onClick={handleConfirm}
              className="flex-1"
              disabled={preview.validation.errors.length > 0 && !selection.restoreWorkspace}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Import Selected
            </Button>
          </div>

          {/* Warning for invalid imports */}
          {preview.validation.errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Cannot Import This Workspace</h4>
                  <p className="text-sm text-red-700">
                    This workspace contains critical errors that must be fixed before it can be imported.
                    Please repair the original export and try again.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useWorkspaceStore, type MergeStrategy } from "@/store/useWorkspaceStore";
import type { WorkspaceDiff } from "@/store/useWorkspaceStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import { AlertTriangle, GitMerge, ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Issue #743: Workspace conflict resolution modal.
 *
 * Shown when localRevision !== remoteRevision during sync.
 * Displays a side-by-side diff of local vs remote workspace state.
 * Offers three resolution strategies:
 *   - Keep Local: discard remote, keep your changes
 *   - Keep Remote: discard local, use server version
 *   - Merge (additive): union of contractIds, savedCallIds from both
 */

function diffLabel(field: WorkspaceDiff["field"]): string {
  const labels: Record<string, string> = {
    name: "Workspace name",
    selectedNetwork: "Network",
    contractIds: "Contracts",
    savedCallIds: "Saved calls",
    artifactRefs: "Artifacts",
  };
  return labels[field] ?? String(field);
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? "none" : `${value.length} item${value.length !== 1 ? "s" : ""}`;
  }
  return String(value ?? "—");
}

export function WorkspaceConflictModal() {
  const { pendingConflict, resolveConflict, dismissConflict } = useWorkspaceStore();

  if (!pendingConflict) return null;

  const { diffs, localRevision, remoteRevision } = pendingConflict;

  const handleResolve = (strategy: MergeStrategy) => {
    resolveConflict(strategy);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) dismissConflict(); }}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        aria-label="Workspace conflict resolution"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Workspace Conflict Detected
          </DialogTitle>
          <DialogDescription>
            Your local changes (revision {localRevision}) conflict with the server version (revision{" "}
            {remoteRevision}). Choose how to resolve the conflict below.
          </DialogDescription>
        </DialogHeader>

        {/* Diff table */}
        {diffs.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-1/4">Field</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-[37.5%]">
                    <span className="flex items-center gap-1">
                      <ArrowLeft className="h-3.5 w-3.5" /> Your version
                    </span>
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-[37.5%]">
                    <span className="flex items-center gap-1">
                      <ArrowRight className="h-3.5 w-3.5" /> Server version
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {diffs.map((diff, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{diffLabel(diff.field)}</td>
                    <td className="px-4 py-2 text-blue-700 dark:text-blue-400 font-mono text-xs">
                      {formatValue(diff.local)}
                    </td>
                    <td className="px-4 py-2 text-purple-700 dark:text-purple-400 font-mono text-xs">
                      {formatValue(diff.remote)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="mt-4 flex flex-col gap-3 sm:flex-col">
          {/* Strategy descriptions */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={() => handleResolve("keep-local")}
              className="flex flex-col gap-1 rounded-md border border-blue-200 bg-blue-50 p-3 text-left hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:hover:bg-blue-900/50"
            >
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Keep Local</span>
              <span className="text-xs text-muted-foreground">
                Your changes win. Server version is discarded.
              </span>
            </button>

            <button
              onClick={() => handleResolve("keep-remote")}
              className="flex flex-col gap-1 rounded-md border border-purple-200 bg-purple-50 p-3 text-left hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/40 dark:hover:bg-purple-900/50"
            >
              <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">Keep Remote</span>
              <span className="text-xs text-muted-foreground">
                Server version wins. Your local changes are discarded.
              </span>
            </button>

            <button
              onClick={() => handleResolve("merge-additive")}
              className="flex flex-col gap-1 rounded-md border border-green-200 bg-green-50 p-3 text-left hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:hover:bg-green-900/50"
            >
              <span className="flex items-center gap-1 text-sm font-semibold text-green-700 dark:text-green-400">
                <GitMerge className="h-3.5 w-3.5" /> Merge
              </span>
              <span className="text-xs text-muted-foreground">
                Combine contracts &amp; saved calls from both. No changes lost.
              </span>
            </button>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={dismissConflict}>
              Decide later
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

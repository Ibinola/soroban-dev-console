"use client";

import { ArrowRight, Edit3, Minus, Plus } from "lucide-react";

import { Badge } from "@devconsole/ui";
import { DiffResult } from "@/lib/diff-utils";

export function StateDiffViewer({ diffs }: { diffs: DiffResult[] }) {
  if (diffs.length === 0)
    return (
      <p className="text-xs italic text-muted-foreground">
        No state changes detected.
      </p>
    );

  return (
    <div className="space-y-3">
      {diffs.map((diff, i) => (
        <div
          key={i}
          className="rounded-md border bg-muted/20 p-2 font-mono text-[10px]"
        >
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            {diff.type === "added" && (
              <Badge className="border-green-200 bg-green-500/10 text-green-600">
                <Plus className="mr-1 h-3 w-3" /> Added
              </Badge>
            )}
            {diff.type === "modified" && (
              <Badge className="border-blue-200 bg-blue-500/10 text-blue-600">
                <Edit3 className="mr-1 h-3 w-3" /> Changed
              </Badge>
            )}
            {diff.type === "deleted" && (
              <Badge className="border-red-200 bg-red-500/10 text-red-600">
                <Minus className="mr-1 h-3 w-3" /> Removed
              </Badge>
            )}
            <span className="truncate opacity-60 max-w-[200px]" title={diff.key}>
              Key: {diff.keyDecoded ?? diff.key.substring(0, 12) + "…"}
            </span>
            {diff.valueType && diff.valueType !== "raw" && (
              <span className="opacity-40 text-[9px]">{diff.valueType}</span>
            )}
          </div>

          <div className="grid grid-cols-[1fr,20px,1fr] items-center gap-2 overflow-x-auto p-1">
            <div
              className="truncate rounded bg-red-500/5 p-1 text-red-700/70"
              title={diff.oldValue ?? undefined}
            >
              {diff.oldValue ?? "∅"}
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <div
              className="truncate rounded bg-green-500/5 p-1 text-green-700"
              title={diff.newValue ?? undefined}
            >
              {diff.newValue ?? "∅"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

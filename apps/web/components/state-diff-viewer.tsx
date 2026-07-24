"use client";

import { useMemo } from "react";
import { ArrowRight, Edit3, Minus, Plus } from "lucide-react";

import { Badge } from "@devconsole/ui";
import { XdrTooltip } from "@devconsole/ui";
import { decodeXdr } from "@devconsole/soroban-utils";
import { DiffResult } from "@/lib/diff-utils";

/** Heuristic: a value looks like base64 XDR if it is at least 60
 * characters long and matches the canonical base64 alphabet with valid
 * trailing padding. Most ledger-key XDRs are >= 60 chars, and the regex
 * rejects plain hex / numeric sequences. */
function looksLikeBase64Xdr(s: string | null | undefined): s is string {
  return (
    !!s && s.length >= 60 && /^[A-Za-z0-9+/]+={0,2}$/.test(s)
  );
}

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
            <span
              className="max-w-[200px] truncate opacity-60"
              title={diff.key}
            >
              Key: {diff.keyDecoded ?? diff.key.substring(0, 12) + "…"}
            </span>
            {diff.valueType && diff.valueType !== "raw" && (
              <span className="text-[9px] opacity-40">{diff.valueType}</span>
            )}
          </div>

          <div className="grid grid-cols-[1fr,20px,1fr] items-center gap-2 overflow-x-auto p-1">
            <DiffValueCell value={diff.oldValue} accent="red" />
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <DiffValueCell value={diff.newValue} accent="green" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Single diff cell — wraps raw-looking base64 XDR with <XdrTooltip /> so
 * users can hover to view decoded structure. */
function DiffValueCell({
  value,
  accent,
}: {
  value: string | null | undefined;
  accent: "red" | "green";
}) {
  const decoded = useMemo(
    () => (looksLikeBase64Xdr(value) ? decodeXdr(value) : null),
    [value],
  );
  const display = value ?? "∅";
  const className =
    accent === "red"
      ? "truncate rounded bg-red-500/5 p-1 text-red-700/70"
      : "truncate rounded bg-green-500/5 p-1 text-green-700";

  if (looksLikeBase64Xdr(value)) {
    return (
      <XdrTooltip value={value} decoded={decoded}>
        <span className={className + " cursor-pointer underline decoration-dotted"} title={value}>
          {display.length > 20 ? display.slice(0, 18) + "…" : display}
        </span>
      </XdrTooltip>
    );
  }
  return (
    <div className={className} title={value ?? undefined}>
      {display}
    </div>
  );
}

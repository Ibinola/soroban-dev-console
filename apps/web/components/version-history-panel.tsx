"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import type { NormalizedContractSpec } from "@devconsole/soroban-utils";
import { useContractVersionStore } from "@/store/useContractVersionStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { buildVersionOptions, diffVersions, formatFunctionSignature } from "@/lib/version-history";

const STATUS_STYLE: Record<string, string> = {
  added: "text-green-700",
  removed: "text-red-700",
  changed: "text-yellow-700",
  unchanged: "text-muted-foreground",
};

/** Browse recorded ABI versions of a contract and compare any two. */
export function VersionHistoryPanel({
  contractId,
  currentSpec,
}: {
  contractId: string;
  currentSpec: NormalizedContractSpec | undefined;
}) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const allSnapshots = useContractVersionStore((s) => s.snapshots);
  const snapshots = useMemo(
    () => allSnapshots.filter((s) => s.workspaceId === workspaceId && s.contractId === contractId),
    [allSnapshots, workspaceId, contractId],
  );
  const options = useMemo(() => buildVersionOptions(snapshots, currentSpec), [snapshots, currentSpec]);

  const [viewKey, setViewKey] = useState<string>("");
  const [fromKey, setFromKey] = useState<string>("");
  const [toKey, setToKey] = useState<string>("");

  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No versions recorded yet. A snapshot of the current ABI is saved each time you submit an upgrade.
      </p>
    );
  }

  const viewed = options.find((o) => o.key === viewKey) ?? options[0];
  const from = options.find((o) => o.key === fromKey) ?? options[options.length - 1];
  const to = options.find((o) => o.key === toKey) ?? options[0];
  const diff = from.key !== to.key ? diffVersions(from.spec, to.spec) : null;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-1 font-semibold">
        <History className="h-3 w-3" /> Version history ({snapshots.length})
      </div>

      <div className="space-y-1">
        <label htmlFor="version-view" className="text-muted-foreground">
          View ABI of
        </label>
        <select
          id="version-view"
          className="h-8 w-full rounded-md border bg-background px-2"
          value={viewed.key}
          onChange={(e) => setViewKey(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <ul className="max-h-32 overflow-y-auto rounded-md border p-2 font-mono">
          {viewed.spec.functions.length === 0 ? (
            <li className="text-muted-foreground">No functions in this version.</li>
          ) : (
            viewed.spec.functions.map((f) => <li key={f.name}>{formatFunctionSignature(f)}</li>)
          )}
        </ul>
      </div>

      {options.length > 1 && (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="version-from" className="text-muted-foreground">
                Compare from
              </label>
              <select
                id="version-from"
                className="h-8 w-full rounded-md border bg-background px-2"
                value={from.key}
                onChange={(e) => setFromKey(e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="version-to" className="text-muted-foreground">
                to
              </label>
              <select
                id="version-to"
                className="h-8 w-full rounded-md border bg-background px-2"
                value={to.key}
                onChange={(e) => setToKey(e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {diff === null ? (
            <p className="text-muted-foreground">Choose two different versions to compare.</p>
          ) : (
            <ul className="space-y-1 rounded-md border p-2" aria-label="ABI differences">
              {diff.functions
                .filter((f) => f.status !== "unchanged")
                .map((f) => (
                  <li key={f.name} className={STATUS_STYLE[f.status]}>
                    <span className="font-semibold">{f.status}</span> {f.name}
                    {f.changes && <span className="text-muted-foreground"> — {f.changes.join("; ")}</span>}
                  </li>
                ))}
              {diff.summary.added + diff.summary.removed + diff.summary.changed === 0 && (
                <li className="text-muted-foreground">No ABI differences.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

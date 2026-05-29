"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

export type FairnessSort =
  | "default"
  | "budget_headroom_desc"
  | "review_responsiveness_desc"
  | "verification_ready";

export interface FairnessFilters {
  sort: FairnessSort;
  verificationReady: boolean;
  hasBudgetHeadroom: boolean;
  abuseQueueOnly: boolean;
}

export const DEFAULT_FILTERS: FairnessFilters = {
  sort: "default",
  verificationReady: false,
  hasBudgetHeadroom: false,
  abuseQueueOnly: false,
};

const SORT_OPTIONS: { value: FairnessSort; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "budget_headroom_desc", label: "Most budget headroom" },
  { value: "review_responsiveness_desc", label: "Most responsive reviewers" },
  { value: "verification_ready", label: "Verification-ready first" },
];

interface FairnessFilterBarProps {
  filters: FairnessFilters;
  onChange: (filters: FairnessFilters) => void;
  className?: string;
}

/**
 * FE-204: Fairness-focused filtering and sorting for Wave issue discovery.
 * Helps contributors find issues by budget headroom, verification readiness,
 * review responsiveness, and abuse-sensitive queues.
 */
export function FairnessFilterBar({
  filters,
  onChange,
  className = "",
}: FairnessFilterBarProps) {
  const [open, setOpen] = useState(false);

  const activeCount = [
    filters.sort !== "default",
    filters.verificationReady,
    filters.hasBudgetHeadroom,
    filters.abuseQueueOnly,
  ].filter(Boolean).length;

  function reset() {
    onChange({ ...DEFAULT_FILTERS });
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          aria-expanded={open}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Fairness filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-md border bg-card p-3 space-y-3">
          {/* Sort */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="fairness-sort">
              Sort by
            </label>
            <select
              id="fairness-sort"
              value={filters.sort}
              onChange={(e) =>
                onChange({ ...filters, sort: e.target.value as FairnessSort })
              }
              className="w-full rounded border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle filters */}
          <div className="space-y-2">
            <p className="text-xs font-medium">Filter by</p>
            {[
              {
                key: "verificationReady" as const,
                label: "Verification-ready issues only",
              },
              {
                key: "hasBudgetHeadroom" as const,
                label: "Has remaining budget headroom",
              },
              {
                key: "abuseQueueOnly" as const,
                label: "Abuse-sensitive queue only",
              },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters[key]}
                  onChange={(e) => onChange({ ...filters, [key]: e.target.checked })}
                  className="rounded border-muted"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

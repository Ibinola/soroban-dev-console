"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BudgetUsageDashboard } from "@/components/budget-usage-dashboard";
import { BurnRateWidgets } from "@/components/burn-rate-widgets";
import {
  FairnessFilterBar,
  DEFAULT_FILTERS,
  type FairnessFilters,
} from "@/components/fairness-filter-bar";
import { getBudgetFixture } from "@/lib/budget-fixtures";

function BudgetDashboardContent() {
  const searchParams = useSearchParams();
  const fixture = searchParams.get("fixture");
  const { scopes, burnRates } = getBudgetFixture(fixture);
  const [filters, setFilters] = useState<FairnessFilters>({ ...DEFAULT_FILTERS });

  return (
    <>
      <FairnessFilterBar filters={filters} onChange={setFilters} />
      <BudgetUsageDashboard scopes={scopes} />
      <div>
        <h2 className="text-sm font-semibold mb-3">Burn rate</h2>
        <BurnRateWidgets items={burnRates} />
      </div>
    </>
  );
}

export default function BudgetsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Budget dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Repo and org point budget usage for Wave 5.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
            Loading budget data…
          </div>
        }
      >
        <BudgetDashboardContent />
      </Suspense>
    </div>
  );
}

import type { BudgetScope } from "@/components/budget-usage-dashboard";
import type { BurnRateData } from "@/components/burn-rate-widgets";

/** Default maintainer dashboard — org healthy, repo near cap. */
export const BUDGET_SCOPES_HEALTHY: BudgetScope[] = [
  { label: "Org: stellar-org", allocated: 50_000, consumed: 32_000, reserved: 5_000 },
  { label: "Repo: soroban-dev-console", allocated: 10_000, consumed: 8_500, reserved: 800 },
];

export const BURN_RATES_HEALTHY: BurnRateData[] = [
  {
    scope: "stellar-org",
    dailyBurnRate: 1200,
    daysRemaining: 11,
    trend: "up",
    remainingPoints: 13_000,
    totalPoints: 50_000,
  },
  {
    scope: "soroban-dev-console",
    dailyBurnRate: 300,
    daysRemaining: 2,
    trend: "up",
    remainingPoints: 700,
    totalPoints: 10_000,
  },
];

/** Repo scope exhausted; org still has headroom. */
export const BUDGET_SCOPES_REPO_EXHAUSTED: BudgetScope[] = [
  { label: "Org: stellar-org", allocated: 50_000, consumed: 40_000, reserved: 5_000 },
  { label: "Repo: soroban-dev-console", allocated: 10_000, consumed: 9_500, reserved: 500 },
];

export const BURN_RATES_REPO_EXHAUSTED: BurnRateData[] = [
  {
    scope: "stellar-org",
    dailyBurnRate: 800,
    daysRemaining: 6,
    trend: "stable",
    remainingPoints: 5_000,
    totalPoints: 50_000,
  },
  {
    scope: "soroban-dev-console",
    dailyBurnRate: 400,
    daysRemaining: 0,
    trend: "up",
    remainingPoints: 0,
    totalPoints: 10_000,
  },
];

export type BudgetFixture = "healthy" | "repo-exhausted";

export function getBudgetFixture(fixture?: string | null): {
  scopes: BudgetScope[];
  burnRates: BurnRateData[];
} {
  if (fixture === "repo-exhausted") {
    return { scopes: BUDGET_SCOPES_REPO_EXHAUSTED, burnRates: BURN_RATES_REPO_EXHAUSTED };
  }
  return { scopes: BUDGET_SCOPES_HEALTHY, burnRates: BURN_RATES_HEALTHY };
}

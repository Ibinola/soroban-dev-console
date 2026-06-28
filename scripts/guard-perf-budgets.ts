const BUDGETS: Record<string, { maxKB: number; maxFCP: number; maxLCP: number }> = {
  "/": { maxKB: 200, maxFCP: 1800, maxLCP: 2500 },
  "/contracts": { maxKB: 250, maxFCP: 2000, maxLCP: 3000 },
  "/tx-builder": { maxKB: 220, maxFCP: 2000, maxLCP: 3000 },
  "/appeals": { maxKB: 180, maxFCP: 1500, maxLCP: 2500 },
};

interface PageMetrics {
  route: string;
  bundleKB: number;
  fcp: number;
  lcp: number;
}

export function checkBudgets(metrics: PageMetrics[]): string[] {
  const violations: string[] = [];
  for (const m of metrics) {
    const b = BUDGETS[m.route];
    if (!b) continue;
    if (m.bundleKB > b.maxKB) violations.push(m.route + ": bundle " + m.bundleKB + "KB > " + b.maxKB + "KB");
    if (m.fcp > b.maxFCP) violations.push(m.route + ": FCP " + m.fcp + "ms > " + b.maxFCP + "ms");
    if (m.lcp > b.maxLCP) violations.push(m.route + ": LCP " + m.lcp + "ms > " + b.maxLCP + "ms");
  }
  return violations;
}

export function printBudgetReport(metrics: PageMetrics[]): void {
  const violations = checkBudgets(metrics);
  if (!violations.length) { console.log("All performance budgets met."); return; }
  console.error("Budget violations:");
  for (const v of violations) console.error("  - " + v);
  process.exit(1);
}

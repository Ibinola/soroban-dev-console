# Wave 5 Fairness Verification Test Plan (QA-201)

**Issue:** [#361](https://github.com/Ibinola/soroban-dev-console/issues/361)  
**Blocked by:** BE-201 (budget accounting API)  
**Last updated:** 2026-05-29

## Purpose

Validate that Wave 5 point budgets enforce fairness across **organization caps**, **repository caps**, **reservation edge cases**, and **budget exhaustion** under realistic maintainer workflows—without silent over-allocation or ambiguous headroom.

## Scope

| Area | What we verify | Primary surfaces |
|------|----------------|------------------|
| Org cap | Headroom = cap − used − reserved; near-exhaustion thresholds | `/budgets`, `BudgetUsageDashboard` |
| Repo cap | Per-repo scope can exhaust independently of org | `/budgets?fixture=repo-exhausted` |
| Reservations | Reserve within headroom; release returns capacity; no duplicate active holds | `budget-accounting.ts`, API tests |
| Exhaustion | Zero headroom blocks new reservations; UI warnings | E2E + accounting tests |
| Maintainer workflow | Dashboard, burn rate, notifications, fairness filters | `/budgets`, `/notifications` |

## Test matrix

| ID | Scenario | Expected behavior | Automated coverage |
|----|----------|-------------------|-------------------|
| F-01 | Org cap headroom | `700` pts remaining for 10k cap with 8.5k used + 800 reserved | `fairness-verification.test.ts` → `computeHeadroom` |
| F-02 | Repo cap tighter than org | Repo headroom `300` pts with high consumption | `fairness-verification.test.ts` → `computeHeadroom` |
| F-03 | Near exhaustion (&lt;20% headroom) | `isNearExhaustion` true for repo mock | API test + E2E warning copy on `/budgets` |
| F-04 | Full exhaustion | `isExhausted` true; `canReserve` rejects | API test + E2E `?fixture=repo-exhausted` |
| F-05 | Over-reservation | Request &gt; headroom returns structured denial | `canReserve` API test |
| F-06 | Valid reservation | Reserved total increases; headroom decreases | `canReserve` API test |
| F-07 | Release reservation | Reserved decreases; headroom increases | `releaseReservation` API test |
| F-08 | Consume reservation | Reserved → used transition | `consumeReservation` API test |
| F-09 | Duplicate active reservation | Second hold on same `issueRef` denied | `assertNoDuplicateActiveReservation` API test |
| F-10 | Issue exceeds budget | Badge/action shows “Exceeds budget” | E2E (component fixture) |
| F-11 | Issue low budget | Warning when assignment fits but headroom tight | `evaluateIssueBudget` API test |
| F-12 | Maintainer dashboard | Org + repo scopes, consumed/reserved legend | `e2e/fairness-verification.spec.ts` |
| F-13 | Burn rate at risk | `~Nd remaining` when days &lt; 7 | E2E burn-rate widgets |
| F-14 | Budget notification | Links to `/budgets` | E2E `/notifications` |
| F-15 | Fairness filters | Budget headroom sort + filter toggles | E2E on `/budgets` |

## Automated suites

### API — budget accounting rules

```bash
npx tsx --test apps/api/src/fairness-verification.test.ts
```

**Source of truth:** `apps/api/src/modules/budget/budget-accounting.ts`  
**11 tests** covering caps, reservations, exhaustion, and issue-level evaluation (FE-203 parity).

When BE-201 lands, `BudgetService` should delegate to these helpers (or equivalent Prisma-backed logic) so API integration tests extend this suite without rewriting rules.

### Playwright E2E — maintainer & contributor surfaces

```bash
npm run test:e2e -w web -- e2e/fairness-verification.spec.ts
```

**Fixtures:** `apps/web/lib/budget-fixtures.ts`

| Query param | Use case |
|-------------|----------|
| (default) | Org healthy, repo near cap |
| `?fixture=repo-exhausted` | Repo scope at 0 headroom |

### CI

Existing workflows pick up changes automatically:

- **API job:** `npm run test -w api` (includes `dist/fairness-verification.test.js` after build)
- **E2E job:** `npm run test:e2e -w web` (path filter: `apps/web/e2e/**`)

## Regression artifacts

| Artifact | Location | When |
|----------|----------|------|
| Playwright HTML report | `apps/web/playwright-report/` | E2E failure |
| Screenshots / video | `apps/web/test-results/` | E2E failure |
| Node test TAP output | CI API job log | API failure |

## Manual maintainer workflow (optional smoke)

1. Open `/budgets` — confirm org and repo scopes, progress bars, and “Budget nearly exhausted” on repo scope (default fixture).
2. Open `/budgets?fixture=repo-exhausted` — confirm repo scope shows 0 remaining and burn widget at risk.
3. Open `/notifications` — filter Budget; confirm low-budget alert links to `/budgets`.
4. On `/budgets`, open **Fairness filters** — enable “Has remaining budget headroom”; confirm active filter badge.
5. (When API wired) `POST /api/budget/reservations` over headroom → `400` with insufficient headroom message.

## BE-201 integration checklist

When budget service implementation replaces stubs in `budget.service.ts`:

- [ ] `setOrganizationBudget` writes `OrganizationBudget` and emits `cap_set` event
- [ ] `reservePoints` uses `canReserve` + `assertNoDuplicateActiveReservation`
- [ ] `releaseReservation` uses `releaseReservation` accounting helper
- [ ] `getBudgetMetrics` returns `BudgetMetrics` contract matching `api-contracts`
- [ ] Add integration tests with Prisma test DB (extend `fairness-verification.test.ts` or new `budget.service.integration.test.ts`)
- [ ] Remove `return {} as any` stubs

## Related tracks

- **BE-201** — Organization budget model and API
- **BE-202** — Point reservations
- **BE-203** — Issue-card budget signals (`budget-aware-issue-card.tsx`)
- **BE-204** — Budget events / fairness filters (`fairness-filter-bar.tsx`)

## Ownership

| Role | Responsibility |
|------|----------------|
| QA | Keep matrix and fixtures aligned with product rules; extend E2E when new surfaces ship |
| BE | Wire `BudgetService` to `budget-accounting.ts`; add persistence integration tests |
| FE | Keep dashboard mocks/fixtures in sync with contract shapes |

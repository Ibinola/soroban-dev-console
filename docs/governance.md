# Repository Governance

> DEVOPS-206: Authoritative reference for issue scoping, budget monitoring, verification-sensitive flows, and fairness escalation during Stellar Wave windows.

## Issue Scoping

### Scope Boundaries

Each issue must be self-contained and independently mergeable. Before opening or accepting an issue:

- **One concern per issue.** A single PR should not mix feature work, refactoring, and documentation unless they are inseparable.
- **Explicit acceptance criteria.** Every issue must list verifiable conditions that define "done". Vague criteria ("improve performance") are not acceptable.
- **Track ID prefix.** Issues must carry a track prefix in the title (e.g., `[DEVOPS-212]`, `[FE-045]`) so CI and tooling can correlate them.
- **Blocked-by declared upfront.** If an issue depends on another, list it in the `Blocked By` field. Do not open a PR for a blocked issue.

### Issue Templates

Use the provided templates for all new issues:

| Template | When to use |
|----------|-------------|
| **Audit Regression** | A previously passing check now fails |
| **Cleanup-only Work** | Non-functional refactoring or debt reduction |
| **Backlog Gap / Follow-up** | Missing feature or audit follow-up |

For issues that don't fit a template, include: context, expected outcome, implementation notes, and acceptance criteria.

### Sizing and Difficulty

| Label | Expected PR size | Review SLA |
|-------|-----------------|------------|
| Easy | < 100 lines changed | 1 business day |
| Medium | 100–400 lines changed | 2 business days |
| Hard | > 400 lines changed | 3 business days |

Hard issues should be split into smaller deliverables where possible.

---

## Budget Monitoring

### CI Minute Budgets

CI minutes are a shared resource. Maintainers should monitor usage weekly and act when thresholds are approached.

**Targets per PR (approximate):**

| Job | Target runtime |
|-----|---------------|
| Web (build + lint + typecheck + test) | ≤ 5 min |
| API (build + lint + test) | ≤ 3 min |
| Package Validation (per package) | ≤ 2 min |
| DevOps (drift + integrity) | ≤ 2 min |
| Contracts (per contract) | ≤ 3 min |

**If a job consistently exceeds its target:**

1. Check Turbo cache hit rate — a low hit rate means cache keys are too broad or inputs are misconfigured.
2. Review `turbo.json` inputs for the affected task. Overly broad globs invalidate the cache unnecessarily.
3. Check for unnecessary `dependsOn` chains that force sequential execution.
4. File a `[DEVOPS-*]` issue with timing data before making changes.

### Artifact Retention

| Artifact | Retention |
|----------|-----------|
| Bundle analysis (`bundle-analysis`) | 30 days |
| Playwright report (`playwright-report`) | 30 days |
| Turbo cache (`.turbo`) | Managed by `actions/cache` (7-day eviction) |

Reduce retention days for artifacts that are rarely consulted to save storage budget.

---

## Verification-Sensitive Flows

Some workflows touch shared infrastructure or produce outputs that affect other contributors. These require extra care.

### Runtime Drift Check (`npm run check-drift`)

**What it does:** Verifies that documented ports and URLs in `README.md`, `docs/architecture.md`, and `.env.example` files match the canonical values in `packages/api-contracts/src/runtime-defaults.ts`.

**When it runs:** On any PR that touches `scripts/**`, `.env.example` files, `README.md`, or `docs/architecture.md`.

**Maintainer responsibilities:**
- `runtime-defaults.ts` is the single source of truth. Never update docs or env examples directly without updating this file first.
- If the canonical value itself must change, update `runtime-defaults.ts`, then run `npm run check-drift` locally to find all files that need updating.
- Do not suppress drift failures with `continue-on-error`. They indicate real configuration skew.

### Dependency Integrity Check (`npm run check-integrity`)

**What it does:** Verifies lockfile consistency, workspace dependency version alignment, and critical shared dependency versions.

**When it runs:** On any PR that touches `**/package.json` or `package-lock.json`.

**Maintainer responsibilities:**
- Always commit `package-lock.json` changes alongside `package.json` changes.
- When adding a dependency, pin to an exact or tightly bounded version (`^x.y.z`).
- Critical shared deps (`react`, `next`, `@stellar/stellar-sdk`, `tailwindcss`) must use the same version across all packages. Check with `npm run check-integrity` before opening a PR.
- Never run `npm install --legacy-peer-deps` without understanding why the conflict exists.

### Database Migrations

Migrations are irreversible in production. Follow this checklist before merging any migration:

1. Run `npx prisma validate` to confirm schema is valid.
2. Run `bash scripts/verify-migrations.sh` to confirm migration history is consistent.
3. Test the migration on a fresh database (`npx prisma migrate reset` in a dev environment).
4. Document any data transformation in the PR description.
5. If the migration drops a column or table, confirm no live code still references it.

### Wave-Prep Workflows

During Stellar Wave windows, the following scripts are used for release preparation. They must be run in order and their output reviewed before tagging a release:

```bash
# 1. Verify all shared package artifacts are present
npx tsx scripts/verify-build-order.ts

# 2. Check for runtime configuration drift
npm run check-drift

# 3. Check dependency integrity
npm run check-integrity

# 4. Validate branch workflow compliance
npx tsx scripts/validate-branch-workflow.ts

# 5. Run smoke SSR/prerender check
npx tsx scripts/smoke-ssr-prerender.ts
```

If any step fails, **do not proceed to tagging**. File an issue with the failure output and assign it to the current wave maintainer.

---

## Fairness and Appeals

### Contribution Fairness

During Stellar Wave windows, issue assignment is managed to ensure equitable distribution:

- No contributor should hold more than **3 open assigned issues** simultaneously.
- Issues blocked for more than **5 business days** should be reassigned or split.
- Hard issues should not be assigned to contributors who have not completed at least one Medium issue in the current wave.

### Raising a Fairness Concern

If you believe an issue was incorrectly scoped, unfairly assigned, or that acceptance criteria were applied inconsistently:

1. **Comment on the issue** with a clear, factual description of the concern. Avoid personal language.
2. **Tag the wave maintainer** (listed in the current wave tracking issue) for visibility.
3. If unresolved within **2 business days**, open a [GitHub Discussion](https://github.com/Ibinola/soroban-dev-console/discussions) in the "Governance" category with the issue number and a summary.

### Appeals Process

| Stage | Action | Owner | SLA |
|-------|--------|-------|-----|
| 1 | Comment on issue | Contributor | Immediate |
| 2 | Wave maintainer review | Wave maintainer | 2 business days |
| 3 | GitHub Discussion | Any contributor | Open |
| 4 | Repository admin decision | [@Ibinola](https://github.com/Ibinola) | 5 business days |

Admin decisions are final for the current wave. Systemic issues should be raised as governance improvement issues for the next wave.

### What Is Not an Appeal

- Disagreement with a technical approach (use PR review comments).
- Requests to lower acceptance criteria to get a PR merged faster (criteria exist to protect quality).
- Disputes about CI flakiness (follow [docs/flaky-check-quarantine.md](./flaky-check-quarantine.md)).

---

## Maintainer Checklist for Wave Windows

Before a wave opens:

- [ ] Confirm all issue templates are up to date.
- [ ] Verify `main` branch protection rules are active (see [docs/branch-protection.md](./branch-protection.md)).
- [ ] Run `npm run check-drift` and `npm run check-integrity` on `main` — both must pass.
- [ ] Confirm CI minute budget headroom in the GitHub Actions usage dashboard.
- [ ] Assign a wave maintainer and post the tracking issue.

During a wave:

- [ ] Review open PRs daily for stale reviews (> 2 business days without activity).
- [ ] Monitor CI job runtimes for regressions against the targets above.
- [ ] Reassign blocked issues promptly.

After a wave closes:

- [ ] Run the full wave-prep workflow (see above) before tagging the release.
- [ ] Post a wave retrospective issue summarizing: issues completed, CI budget used, fairness concerns raised, and process improvements for the next wave.

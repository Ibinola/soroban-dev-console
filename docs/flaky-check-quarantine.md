# Flaky Check Quarantine Process

> DEVOPS-213: How to identify, quarantine, and graduate flaky CI jobs without weakening required protections.

## What Is a Flaky Check?

A flaky check is a CI job that passes and fails non-deterministically on the same code. Flaky checks erode trust in CI and cause unnecessary re-runs. This process provides a structured way to handle them without disabling required protections.

## Quarantine State

All quarantine state lives in `.github/flaky-quarantine.json`. This file is committed to the repository so the quarantine list is visible to all maintainers and tracked in git history.

```json
{
  "quarantined": [
    {
      "job": "E2E Tests",
      "reason": "Playwright timing issue on slow runners — tracked in #42",
      "quarantined_at": "2025-01-15T10:00:00Z",
      "review_by": "2025-01-29"
    }
  ],
  "graduated": []
}
```

## Quarantine Script

```bash
# Detect flakiness by re-running a job 5 times
TEST_CMD="npm run test:run -w web" \
  ./scripts/quarantine-flaky-check.sh detect "Web Unit Tests" 5

# Manually quarantine a known-flaky job
./scripts/quarantine-flaky-check.sh add "E2E Tests" "Playwright timing issue — see #42"

# List all quarantined jobs
./scripts/quarantine-flaky-check.sh list

# Print CI-friendly report (exits 1 if any quarantine is overdue)
./scripts/quarantine-flaky-check.sh report

# Graduate a fixed job out of quarantine
./scripts/quarantine-flaky-check.sh remove "E2E Tests"
```

## Automated Workflow

The `flaky-quarantine.yml` workflow runs every Monday at 06:00 UTC and:

1. Runs `report` to list all quarantined jobs and flag overdue ones.
2. Uploads the quarantine state as a workflow artifact (retained 90 days).
3. Posts a `::warning::` annotation in the Actions UI if any quarantine is overdue.

You can also trigger it manually from the Actions tab to run flaky detection on a specific job.

## Quarantine Rules

1. **Quarantine does not disable the check.** The job still runs in CI. Failures are annotated but do not block merge while the job is under investigation.
2. **Every quarantine has a review date** (14 days from quarantine by default). The weekly workflow flags overdue entries.
3. **Quarantines must be resolved.** Either fix the root cause and graduate the job, or open a tracking issue and extend the review date with a comment explaining why.
4. **Required checks remain required.** Quarantine is a tracking mechanism, not a bypass. If a required check is flaky, the fix is to stabilize it — not to remove it from the required list.

## Resolving a Flaky Check

1. Identify the root cause (timing, test isolation, external dependency, resource contention).
2. Apply the fix in a PR.
3. Run the detection script to confirm stability: `TEST_CMD="..." ./scripts/quarantine-flaky-check.sh detect "<job>" 10`
4. Graduate the job: `./scripts/quarantine-flaky-check.sh remove "<job>"`
5. Commit the updated `.github/flaky-quarantine.json`.

## Common Causes and Fixes

| Cause | Fix |
|-------|-----|
| Timing / async race | Add explicit waits; avoid `setTimeout` in tests |
| Shared test state | Isolate test data; use `beforeEach` cleanup |
| External service dependency | Mock the service in unit/integration tests |
| Port conflicts | Use dynamic port allocation |
| Resource exhaustion on CI runner | Reduce parallelism; add retry logic |

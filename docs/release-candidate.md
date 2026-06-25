# Release Candidate Workflow

> DEVOPS-204: How to build, validate, and package a release candidate before each Wave cutover.

## Overview

The `release-candidate.yml` workflow replaces ad hoc pre-wave checks with a single, repeatable gate. It runs the full validation matrix across every layer of the monorepo, captures structured output, and uploads a signed RC manifest artifact. A wave cutover should only proceed after this workflow completes green.

## When to Run

| Trigger | When |
|---------|------|
| `workflow_dispatch` | Manually, before opening a Wave cutover window |
| Push to `release/**` | Automatically on any release branch push |

## Layers

The workflow runs these jobs in parallel, then gates on all of them:

| Job | What it validates |
|-----|-------------------|
| `devops` | Runtime-port drift (`check-drift`), lockfile/workspace integrity (`check-integrity`), queue topology validation, log redaction compliance |
| `web` | Lint, typecheck, build, unit tests, build-order verification, SSR/prerender smoke |
| `api` | Lint, build, unit tests (with Prisma client generation) |
| `api-schema` | Prisma schema validity and migration consistency (`verify-migrations.sh`) |
| `api-contracts` | `@devconsole/api-contracts` builds and typechecks cleanly |
| `contracts` | All Soroban fixture contracts compile and pass `cargo test` |
| `e2e` | Playwright end-to-end suite against the built web app |
| `rc-gate` | Asserts all layers passed; writes the RC summary; uploads the RC manifest |

## Running Manually

1. Go to **Actions → Release Candidate → Run workflow**.
2. Enter the wave identifier (e.g. `wave-5`). This is embedded in the RC manifest.
3. Select the branch or tag to cut from.
4. Click **Run workflow**.

```bash
# Equivalent via CLI
gh workflow run release-candidate.yml \
  --ref release/wave-5 \
  --field wave_label=wave-5
```

## Release evidence bundle (DEVOPS-216)

On success, `rc-gate` also runs `scripts/generate-release-evidence.ts` and uploads a **`release-evidence-<run_id>`** artifact (90 days) containing:

- `manifest.json` — structured metadata, git range, check results, CI layers
- `EVIDENCE.md` — maintainer/auditor report with repro commands
- `checks/*.log` — full validation output
- `git/` — commit range files
- `service-health.json` — health probe notes
- `release-evidence-bundle.tar.gz` — portable archive

See [release-evidence-bundle.md](./release-evidence-bundle.md) for local usage and failure interpretation.

## RC Manifest (legacy)

`rc-gate` uploads `manifest.json` from the evidence bundle as `rc-manifest-<run_id>` for backward compatibility. The canonical format matches:

```json
{
  "wave": "wave-5",
  "sha": "<commit-sha>",
  "ref": "refs/heads/release/wave-5",
  "run_id": "12345678",
  "actor": "maintainer",
  "timestamp": "2026-05-28T15:00:00Z",
  "layers": {
    "devops": "success",
    "web": "success",
    "api": "success",
    "api-schema": "success",
    "api-contracts": "success",
    "contracts": "success",
    "e2e": "success"
  }
}
```

Download it from the Actions run page or via CLI:

```bash
gh run download <run_id> --name rc-manifest-<run_id>
```

## Interpreting Failures

Every job writes actionable output to the **GitHub Actions step summary**. The `devops` job in particular surfaces the exact drift or integrity issue with a local repro command.

| Failure | Local repro |
|---------|-------------|
| Runtime drift | `npm run check-drift` |
| Dependency integrity | `npm run check-integrity` |
| Migration inconsistency | `bash scripts/verify-migrations.sh` |
| Build order violation | `npx tsx scripts/verify-build-order.ts` |
| SSR/prerender regression | `npx tsx scripts/smoke-ssr-prerender.ts` |

## Wave Cutover Checklist

1. Create a `release/<wave>` branch from the commit you intend to cut.
2. Run the Release Candidate workflow on that branch.
3. Download and archive the RC manifest artifact.
4. Confirm all layers show `"success"` in the manifest.
5. Proceed with the wave cutover.

If any layer fails, fix the root cause on the release branch, push, and re-run. Do not open the cutover window until the workflow is fully green.

## Artifacts

| Artifact | Retention | Contents |
|----------|-----------|----------|
| `rc-bundle-analysis-<run_id>` | 30 days | Next.js bundle analysis from the web build |
| `rc-playwright-report-<run_id>` | 30 days | Playwright HTML report from E2E tests |
| `release-evidence-<run_id>` | 90 days | Full evidence bundle (manifest, logs, git range, tarball) |
| `rc-manifest-<run_id>` | 90 days | `manifest.json` only (compat alias) |

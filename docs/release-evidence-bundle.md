# Release Evidence Bundle (DEVOPS-216)

> Automated audit artifact for wave-prep release candidates. Builds on [DEVOPS-204](./release-candidate.md).

## Overview

The release evidence bundle captures everything a maintainer or auditor needs to sign off on a wave cutover:

| Artifact | Contents |
|----------|----------|
| `manifest.json` | Machine-readable summary (git range, checks, CI layers, health probes) |
| `EVIDENCE.md` | Human-readable report with repro commands for failures |
| `git/` | Commit range, oneline log, metadata |
| `checks/*.log` | Full stdout/stderr for each validation command |
| `service-health.json` | Best-effort API/web health probe notes |
| `release-evidence-bundle.tar.gz` | Compressed archive of the directory |

Failures print **actionable repro steps** to the console and mark failing checks in `EVIDENCE.md` — no silent drift.

## When to generate

| Context | Command |
|---------|---------|
| **Local wave prep** | `npm run release-evidence -- --wave wave-5` |
| **Quick local check** (skip SSR smoke) | `npm run release-evidence -- --wave wave-5 --quick` |
| **CI** | Automatic in `release-candidate.yml` → `rc-gate` job |
| **Metadata only** | `npm run release-evidence -- --wave wave-5 --skip-checks --layer-results ./layers.json` |

## Local usage

```bash
# Full bundle (includes SSR smoke — builds web app)
npm run release-evidence -- --wave wave-5 --base origin/main

# Faster iteration (skips smoke-ssr-prerender)
npm run release-evidence -- --wave wave-5 --quick

# Custom output directory
npm run release-evidence -- --wave wave-5 --output ./artifacts/rc-wave-5
```

### Prerequisites

- `git fetch origin main` so commit range resolves
- `npm ci` at repo root
- For `verify-build-order`: build shared packages first (`npx turbo run build --filter=./packages/*`)
- For `prisma-validate`: `npm run prisma:generate -w api`

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | All required checks passed; bundle ready for archive |
| `1` | One or more required checks failed, or CI layer results include `failure` |

## Checks included

| ID | Category | Required | Skipped with `--quick` |
|----|----------|----------|------------------------|
| `check-drift` | config | yes | |
| `check-integrity` | config | yes | |
| `validate-branch-workflow` | validation | no (warn) | |
| `verify-build-order` | build | yes | |
| `prisma-validate` | validation | yes | |
| `verify-migrations` | validation | no (warn) | |
| `smoke-ssr-prerender` | build | no (warn) | yes |

## CI integration

The **Release Candidate** workflow (`/.github/workflows/release-candidate.yml`) runs after all validation layers pass:

1. Writes CI layer results to JSON
2. Runs `generate-release-evidence.ts` with `--quick` and GitHub metadata
3. Uploads `release-evidence-<run_id>` artifact (90-day retention)
4. Appends `EVIDENCE.md` to the GitHub Actions step summary

Trigger via Actions UI or:

```bash
gh workflow run release-candidate.yml \
  --ref release/wave-5 \
  --field wave_label=wave-5
```

Download the bundle:

```bash
gh run download <run_id> --name release-evidence-<run_id>
tar -xzf release-evidence-bundle.tar.gz
```

## manifest.json schema

```json
{
  "schemaVersion": "1.0",
  "wave": "wave-5",
  "timestamp": "2026-05-29T12:00:00Z",
  "git": {
    "head": "<sha>",
    "branch": "release/wave-5",
    "baseRef": "origin/main",
    "baseSha": "<sha>",
    "commitRange": "<base>..<head>",
    "commitCount": 42
  },
  "ci": {
    "runId": "12345678",
    "sha": "<sha>",
    "ref": "refs/heads/release/wave-5",
    "actor": "maintainer",
    "repository": "owner/repo"
  },
  "ciLayers": {
    "devops": "success",
    "web": "success"
  },
  "checks": [ { "id": "check-drift", "status": "pass", "logFile": "checks/check-drift.log" } ],
  "serviceHealth": { "probes": [ { "name": "api", "status": "unreachable" } ] },
  "summary": { "ready": true, "requiredChecksPassed": true, "ciLayersPassed": true }
}
```

## Interpreting failures

Example console output:

```
❌ Release evidence bundle has failing required checks:

  • Runtime config drift (check-drift)
    Reproduce: npm run check-drift
    Log: release-evidence/checks/check-drift.log
    Summary: Total drifts found: 2
```

Open the log file for full command output. Fix locally, re-run `npm run release-evidence`, and archive the new bundle.

## Wave cutover checklist

1. Run [Release Candidate](./release-candidate.md) workflow on `release/<wave>`.
2. Download `release-evidence-<run_id>` artifact.
3. Confirm `manifest.json` → `summary.ready` is `true`.
4. Review `EVIDENCE.md` and `git/commits-oneline.txt` for the intended commit range.
5. Archive the tarball in your wave audit record.
6. Proceed with cutover only when CI layers and required checks are green.

## Related

- [release-candidate.md](./release-candidate.md) — RC workflow and layer matrix
- `npm run wave-prep` — local subset of validation (does not produce a bundle)
- `scripts/generate-release-evidence.ts` — bundle generator implementation

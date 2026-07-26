# Dependency Update Policy for Wave-Critical Packages

> DEVOPS-210 — Controlled update workflow for critical dependencies.

## Overview

This document defines the policy for updating dependencies in the Soroban DevConsole monorepo, with a focus on packages that are critical to Wave operations. The goal is to accept security and reliability updates without destabilising live Wave operations.

## Wave-Critical Packages

The following packages are classified as Wave-critical. Updates to these packages require the full review process described below.

| Package | Reason |
|---------|--------|
| `next` | Core web framework — breaking changes affect all pages |
| `react` / `react-dom` | UI runtime — version mismatches cause subtle bugs |
| `@stellar/stellar-sdk` | Blockchain integration — API changes break contract interactions |
| `@nestjs/core` / `@nestjs/common` | API framework — breaking changes affect all modules |
| `@prisma/client` / `prisma` | Database ORM — schema/migration compatibility |
| `tailwindcss` | CSS framework — major versions change class names |
| `typescript` | Type system — stricter checks can break builds |
| `zod` | Validation — schema API changes affect all validators |

## Update Categories

### Patch Updates (x.y.Z)

- **Policy:** Apply automatically via the dependency update workflow.
- **Review:** Automated CI must pass; no manual review required.
- **Merge:** Auto-merge if all CI checks pass.

### Minor Updates (x.Y.z)

- **Policy:** Apply automatically for non-Wave-critical packages; manual review for Wave-critical packages.
- **Review:** One maintainer approval required for Wave-critical packages.
- **Merge:** Manual merge after review.

### Major Updates (X.y.z)

- **Policy:** Never automatic. Requires a dedicated PR with migration notes.
- **Review:** Two maintainer approvals required.
- **Merge:** Only during a non-Wave period (not within 2 weeks of a Wave launch).
- **Testing:** Full E2E test suite must pass.

## Automated Update Workflow

The `.github/workflows/dependency-updates.yml` workflow runs weekly and:

1. Checks for available updates using `npm outdated`.
2. Opens individual PRs for patch updates to Wave-critical packages.
3. Opens individual PRs for all patch and minor updates to non-critical packages.
4. Labels PRs with `dependencies`, `automated`, and the appropriate severity.
5. Posts a summary comment listing skipped major updates.

### PR Naming Convention

```
chore(deps): update <package> from <old> to <new> [patch|minor|major]
```

### Labels

| Label | Meaning |
|-------|---------|
| `dependencies` | All dependency update PRs |
| `automated` | Created by the update workflow |
| `wave-critical` | Affects a Wave-critical package |
| `security` | Addresses a known CVE |
| `major-update` | Major version bump (requires manual process) |

## Security Updates

Security updates (CVEs) bypass the normal schedule and are handled as follows:

1. **Detection:** `npm audit` runs in CI on every push. The `devops` job fails if high/critical vulnerabilities are found.
2. **Triage:** On-call maintainer reviews the advisory within 24 hours.
3. **Patch:** If a patched version is available, open a PR immediately regardless of Wave schedule.
4. **Workaround:** If no patch is available, document the risk and apply a workaround (e.g., `npm audit fix --force` with careful review, or `overrides` in `package.json`).
5. **Escalation:** Critical CVEs with no patch → notify Stellar Discord #dev-security.

## Pre-Wave Freeze

During the **2 weeks before a Wave launch**:

- No major updates.
- Minor updates to Wave-critical packages require explicit maintainer sign-off.
- Patch updates and security fixes are still allowed.
- The freeze period is enforced by convention; the CI does not block merges automatically.

## Verification

After any dependency update:

```bash
# 1. Verify lockfile integrity
npm run check-integrity

# 2. Run the full test suite
npm run test:run -w web
npm run test -w api

# 3. Run the wave-prep gate
npm run wave-prep
```

All three must pass before merging a dependency update PR.

## Maintenance

- Review this policy before each Wave launch.
- Update the Wave-critical packages list when new core dependencies are added.
- Run `npm audit` locally before opening a Wave launch PR.

# Branch Protection, Required Checks, and Release Discipline

> DEVOPS-211: Authoritative reference for the merge model and CI gate requirements.

## Protected Branches

| Branch | Protection level |
|--------|-----------------|
| `main` | Fully protected — no direct pushes; all changes via PR |

Direct pushes to `main` are rejected. All work must go through a pull request, regardless of contributor role.

## Required Status Checks

A PR cannot be merged until **all** of the following CI jobs pass:

| Job | Trigger condition |
|-----|-------------------|
| `Web` | Any change under `apps/web/**` or `packages/ui/**` |
| `API` | Any change under `apps/api/**` or `packages/api-contracts/**` |
| `Package Validation` | Any change under `packages/**` |
| `Contracts` | Any change under `contracts/**` |
| `DevOps` | Any change to `scripts/**`, `.env.example` files, `README.md`, or `docs/architecture.md` |
| `E2E Tests` | Any change to `apps/web/e2e/**` or when `Web` runs |

Jobs that are not triggered by a given PR (path-filtered out) are considered passing by default. The `changes` job in `ci.yml` controls which jobs run via `dorny/paths-filter`.

## Review Requirements

- At least **1 approving review** is required before merge.
- Reviews are dismissed automatically when new commits are pushed to the PR branch.
- The PR author cannot approve their own PR.

## Merge Strategy

- **Squash merge** is the preferred strategy for feature and fix branches. This keeps `main` history linear and readable.
- Merge commits are allowed for release branches where preserving individual commits matters.
- Rebase merges are discouraged — they rewrite SHAs and complicate bisect.

## Branch Naming

| Prefix | Use case |
|--------|----------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation-only changes |
| `refactor/` | Non-functional code changes |
| `test/` | Test additions or updates |
| `chore/` | Maintenance, dependency bumps |
| `release/` | Release preparation branches |

## Release Discipline

### Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **PATCH** (`x.y.Z`): Backwards-compatible bug fixes.
- **MINOR** (`x.Y.0`): New backwards-compatible features.
- **MAJOR** (`X.0.0`): Breaking changes.

### Release Process

1. Create a `release/vX.Y.Z` branch from `main`.
2. Bump the version in `package.json` (root and affected workspaces).
3. Update `CHANGELOG.md` with the release notes.
4. Open a PR from `release/vX.Y.Z` → `main`. All required checks must pass.
5. After merge, tag the commit: `git tag vX.Y.Z && git push origin vX.Y.Z`.
6. GitHub Actions (or a maintainer) publishes the release from the tag.

### Hotfixes

For urgent fixes to a released version:

1. Branch from the release tag: `git checkout -b fix/critical-bug vX.Y.Z`.
2. Apply the fix, open a PR to `main`.
3. After merge, cherry-pick to any active release branches if needed.
4. Tag a new patch release.

## Bypassing Checks (Emergency Only)

Branch protection bypass is restricted to repository admins and requires a written justification in the PR description. Any bypass must be followed by a post-incident review issue within 48 hours.

## Keeping CI Green

- Never merge a PR with failing required checks.
- If a check is flaky, follow the quarantine process in [docs/flaky-check-quarantine.md](./flaky-check-quarantine.md) rather than re-running until it passes.
- The `DevOps` job runs `check-drift` and `check-integrity` — keep these passing to prevent configuration drift.

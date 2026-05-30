# Branch and PR Workflow for Wave Work

## Branch naming

Branches must follow this pattern:

```
<track>/<id>-<short-slug>
```

Examples:
- `feat/dx-201-wave-simulator`
- `feat/qa-212-concurrency-tests`
- `fix/be-214-ledger-drift`

## Creating a branch

Use the helper so naming stays consistent:

```bash
bash scripts/wave-branch-helper.sh start feat dx-201 wave-simulator
```

This checks out `main`, pulls, and creates `feat/dx-201-wave-simulator`.

## Linking issues

Every PR body must include a `Closes #<n>` line for each issue it resolves. The helper prints a ready-to-paste `gh pr create` command:

```bash
bash scripts/wave-branch-helper.sh pr 376 377 378 379
```

## PR checklist

Before opening a PR:

1. `npm run lint` — no new lint errors
2. `npm run typecheck` — types pass
3. `npm run build` — build succeeds
4. Working tree is clean (`git status` shows nothing uncommitted)
5. Branch is up to date with `main`

## Merging

- All PRs target `main` on `Ibinola/soroban-dev-console`.
- One PR per contributor account per Wave batch.
- Squash-merge is preferred for DX and QA tracks.

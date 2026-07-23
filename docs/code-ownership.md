# Code Ownership

Code ownership is enforced via [`.github/CODEOWNERS`](../.github/CODEOWNERS).
GitHub will automatically request a review from the listed owner(s) when a pull request touches the corresponding paths.

## Ownership Map

| Path | Owner | Description |
|---|---|---|
| `apps/web/` | @Ibinola | Next.js frontend — contract interaction, deploy wizard, workspace, share links |
| `apps/api/` | @Ibinola | NestJS backend — workspaces, shares, RPC proxy, health, audit |
| `contracts/` | @Ibinola | Soroban smart contract fixtures and test harnesses |
| `packages/` | @Ibinola | Shared libraries — UI components, soroban-utils, api-contracts |
| `.github/` | @Ibinola | CI workflows, issue templates, CODEOWNERS, dependabot |
| `scripts/` | @Ibinola | DevOps scripts — drift checks, integrity checks, release evidence |
| `docs/` | @Ibinola | Architecture, runbooks, observability, contributing guides |

## Updating Ownership

Edit `.github/CODEOWNERS` directly. Changes take effect on the next pull request.
See [GitHub CODEOWNERS documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) for syntax details.

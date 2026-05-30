# Seed Data Explorer

The seed data explorer (`scripts/explore-seed-data.ts`) lets you inspect the local SQLite database without opening a GUI or writing raw SQL.

## Requirements

Install `better-sqlite3` (one-time):

```bash
npm install -g better-sqlite3
```

## Usage

```bash
# Explore all tables in the default dev database
tsx scripts/explore-seed-data.ts

# Point at a specific database file
tsx scripts/explore-seed-data.ts --db apps/api/operator.db

# Filter to one table
tsx scripts/explore-seed-data.ts --table budget_scopes

# Machine-readable JSON output (pipe to jq etc.)
tsx scripts/explore-seed-data.ts --json | jq '.point_ledger_entries'
```

## Tables covered

| Table | Contents |
|---|---|
| `workspaces` | Workspace records |
| `saved_contracts` | Pinned contracts per workspace |
| `saved_interactions` | Saved function calls |
| `workspace_artifacts` | WASM uploads and metadata |
| `share_links` | Snapshot share tokens |
| `audit_logs` | Mutation audit trail |
| `point_ledger_entries` | Contributor point history |
| `budget_scopes` | Org/repo budget caps and usage |
| `budget_reservations` | Active and released reservations |
| `contributor_verifications` | Verification state per contributor |
| `appeal_cases` | Open and resolved appeals |
| `review_windows` | Maintainer review window records |

## Seeding data first

If the tables are empty, run the seed script:

```bash
cd apps/api && npx prisma db seed
```

Or use the Wave fixture generators to seed operational scenarios:

```bash
tsx scripts/wave-fixtures.ts --scenario exhausted-budget
```

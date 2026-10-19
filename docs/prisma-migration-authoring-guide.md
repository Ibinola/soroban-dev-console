# Prisma Migration Authoring Guide

How to add or change database tables in `apps/api` without breaking other
contributors' databases or losing data. Read this before you open a pull
request that touches `apps/api/prisma/schema.prisma`.

- [Ground rules](#ground-rules)
- [Naming conventions](#naming-conventions)
- [Authoring workflow](#authoring-workflow)
- [Preserving existing data](#preserving-existing-data)
- [Testing a migration](#testing-a-migration)
- [Annotated example](#annotated-example)
- [Common pitfalls](#common-pitfalls)
- [Pull request checklist](#pull-request-checklist)

## Ground rules

- **Every schema change ships with a migration.** Other environments only
  run `prisma migrate deploy`. A change that exists only in `schema.prisma`
  never reaches them.
- **Never edit a migration that has been merged.** Prisma stores a checksum
  of each applied migration. Editing one breaks every database that already
  applied it. Fix mistakes with a new migration.
- **Never hand-edit `migration_lock.toml`.** It records the provider
  (`sqlite`) and is managed by Prisma.
- **Don't use `prisma db push` for schema work you plan to commit.** It
  changes the database without recording a migration, which causes drift
  (see [troubleshooting issue 14](./troubleshooting.md#14-prisma-migrate-dev-says-drift-was-detected-and-asks-to-reset)).

## Naming conventions

Migration folders follow `<timestamp>_<descriptive_name>`:

```
apps/api/prisma/migrations/
├── 20260325150000_init_sqlite/
├── 20260424062555_add_workspace_revision/
├── 20260723193000_add_workspace_archived/
└── 20260726120000_add_share_view_count_and_access_log/
```

**Timestamp.** `YYYYMMDDHHMMSS` in UTC. Prisma generates it when you run
`migrate dev`, so don't type it by hand. Migrations are applied in timestamp
order.

**Descriptive name.** Pass it with `--name`. Rules:

| Rule                                                                      | Good                        | Avoid                 |
| ------------------------------------------------------------------------- | --------------------------- | --------------------- |
| `snake_case`, lower case                                                  | `add_workspace_tags`        | `AddWorkspaceTags`    |
| Start with a verb: `add`, `drop`, `rename`, `alter`, `backfill`, `create` | `add_share_link_network`    | `share_link_network`  |
| Name the table and what changes                                           | `drop_feedback_tag_batches` | `cleanup`, `fix`      |
| One concern per migration                                                 | `add_workspace_archived`    | `misc_schema_updates` |
| No issue numbers alone (put them in the PR)                               | `add_share_access_log`      | `issue_1249`          |

**Unique timestamps.** Two folders in this repo share the timestamp
`20260726120000` (`add_share_view_count_and_access_log` and
`add_workspace_tags`). They were hand-renamed to the same second, so their
relative order now depends on string sorting of the name. Don't do this. If
you rebase onto `main` and your migration's timestamp is now older than one
that landed in the meantime, regenerate yours (see
[pitfall 6](#6-migration-order-conflicts-after-a-rebase)).

## Authoring workflow

All commands run from `apps/api`.

1. **Start from a clean, up-to-date database.**

   ```bash
   git pull origin main
   npx prisma migrate deploy   # apply anything new from main
   ```

2. **Edit `prisma/schema.prisma`.** Map every model to a `snake_case` table
   with `@@map`, and every multi-word field to a `snake_case` column with
   `@map`, to match existing models:

   ```prisma
   network String @default("testnet") @map("network")
   ```

3. **Generate the migration without applying it**, so you can review and
   edit the SQL first:

   ```bash
   npx prisma migrate dev --create-only --name add_share_link_network
   ```

4. **Read the generated `migration.sql`.** Check the warnings comment block
   at the top. Prisma lists data it is about to drop there. Add data-preserving
   SQL if needed (see [Preserving existing data](#preserving-existing-data)).

5. **Apply it and regenerate the client:**

   ```bash
   npx prisma migrate dev
   ```

   This applies the pending migration and runs `prisma generate`.

6. **Update the seed** (`prisma/seed.ts`) if the new column or table should
   have demo data, and confirm `npm run db:seed` still succeeds.

7. **Test it** as described in [Testing a migration](#testing-a-migration).

## Preserving existing data

Contributors' local databases and any hosted database already contain rows.
A migration must leave every existing row valid and keep its data.

**Adding a required column.** An existing row has no value for the new column.
Do one of these:

- Give the column a `@default(...)`. Prisma emits
  `ADD COLUMN ... NOT NULL DEFAULT ...`, which SQLite applies in place.
- Or add the column as optional (`String?`), backfill it with an `UPDATE`,
  and make it required in a **later** migration once all rows have values.

**Renaming a column or table.** Prisma can't tell a rename from a
drop-and-add. By default it generates a `DROP` and an `ADD`, which **loses the
data**. Edit the generated SQL to use a rename instead:

```sql
-- Generated (loses data):
-- ALTER TABLE "workspaces" DROP COLUMN "description";
-- ALTER TABLE "workspaces" ADD COLUMN "summary" TEXT;

-- Replace with:
ALTER TABLE "workspaces" RENAME COLUMN "description" TO "summary";
```

**Changing a column's type or nullability.** SQLite can't alter a column in
place, so Prisma rebuilds the table: it creates `new_<table>`, copies rows
with `INSERT INTO ... SELECT`, drops the old table and renames the new one.
Check that the `SELECT` copies every column and converts values safely.
Rows that fail a new `NOT NULL` constraint make the whole migration fail.

**Dropping a column or table.** Only drop data that is truly unused. Remove
all code that reads it in an earlier pull request, then drop it in a later
one. This keeps a deploy of the older code from crashing against the new
schema. Call out the drop in your PR description.

**Moving data between tables.** Put the `INSERT ... SELECT` or `UPDATE`
statements in the same migration that creates the target, after the
`CREATE TABLE`, so the copy runs exactly once.

## Testing a migration

Run all three stages before you open the pull request.

### 1. Run it against existing data

Testing against an empty database hides most data bugs. Start from a
database with rows in it:

```bash
git stash                     # set your schema change aside
npm run db:bootstrap          # main's schema plus seed data
git stash pop
npx prisma migrate dev        # apply your migration on top of real rows
```

### 2. Verify the result

```bash
npx prisma migrate status     # expect "Database schema is up to date!"
npx prisma validate           # same check CI runs
sqlite3 prisma/dev.db ".schema share_links"     # inspect the table
sqlite3 prisma/dev.db "SELECT network, COUNT(*) FROM share_links GROUP BY 1;"
npm run build && npm run test # API tests against the new client
bash ../../scripts/verify-migrations.sh          # run from apps/api
```

`npx prisma studio` gives you a browser view of the data if you prefer it to
`sqlite3`.

### 3. Prove you can roll back

Prisma has no automatic "down" migrations. Write and test a down script so a
bad deploy can be reverted.

1. **Generate the down script** after editing `schema.prisma` but **before**
   applying your migration. At that point, the database still has the old
   schema:

   ```bash
   npx prisma migrate diff \
     --from-schema-datamodel prisma/schema.prisma \
     --to-schema-datasource prisma/schema.prisma \
     --script > down.sql
   ```

2. **Apply your migration** with `npx prisma migrate dev`.
3. **Roll back** and mark the migration as rolled back:

   ```bash
   npx prisma db execute --file ./down.sql --schema prisma/schema.prisma
   npx prisma migrate resolve --rolled-back <timestamp>_<name>
   ```

4. **Re-apply** it with `npx prisma migrate deploy` to confirm it runs cleanly
   a second time.

Paste the `down.sql` contents into your PR description. Don't commit it to the
migration folder, because Prisma would treat it as part of the migration.

> Data removed by an up migration can't be restored by a down script. That is
> another reason to drop columns only in a separate, later PR.

For a disposable local reset at any point, run `npm run db:bootstrap`.

## Annotated example

**Goal:** record which network each share link was created on. Existing share
links should inherit their workspace's `selected_network`.

**Schema change** in `prisma/schema.prisma`:

```prisma
model ShareLink {
  // ...existing fields
  network String @default("testnet") @map("network")
}
```

**Generate:**

```bash
npx prisma migrate dev --create-only --name add_share_link_network
```

**Edited** `migrations/20261019120000_add_share_link_network/migration.sql`:

```sql
-- Generated by Prisma. A required column needs a default, otherwise SQLite
-- rejects the ALTER on a table that already has rows. The default also
-- covers rows created by older API builds that don't set the field yet.
-- AlterTable
ALTER TABLE "share_links" ADD COLUMN "network" TEXT NOT NULL DEFAULT 'testnet';

-- Added by hand: backfill from the owning workspace so existing links record
-- their real network instead of the 'testnet' placeholder. Without this, every
-- mainnet or futurenet share link would be mislabelled.
-- Safe to run once: it only reads workspaces and updates the new column.
UPDATE "share_links"
SET "network" = (
  SELECT "selected_network"
  FROM "workspaces"
  WHERE "workspaces"."id" = "share_links"."workspace_id"
);
-- No NULL guard is needed: workspace_id is a required foreign key with
-- ON DELETE CASCADE, so every share link has a workspace row to read from.
```

**Down script** (in the PR description, not committed):

```sql
-- SQLite 3.35+ supports DROP COLUMN directly. Prisma's diff may instead
-- emit a table rebuild (new_share_links + INSERT ... SELECT); both are fine.
ALTER TABLE "share_links" DROP COLUMN "network";
```

**Verify:**

```bash
npx prisma migrate dev
sqlite3 prisma/dev.db \
  "SELECT s.network, w.selected_network FROM share_links s JOIN workspaces w ON w.id = s.workspace_id;"
# Every row should show matching values in both columns.
```

## Common pitfalls

### 1. Required column without a default

`ALTER TABLE ... ADD COLUMN ... NOT NULL` fails on a table with rows, or Prisma
rebuilds the table and the copy fails. Add `@default(...)` or add the column
as optional and backfill it.

### 2. A rename that Prisma generated as drop and add

The data in the old column is silently deleted. Always read the generated SQL
and replace the pair with `RENAME COLUMN` or `ALTER TABLE ... RENAME TO`.

### 3. Making an optional field required

Changing `String?` to `String` fails if any row is `NULL`. Backfill first,
either in an earlier migration or in an `UPDATE` placed before the table
rebuild in the same migration.

### 4. Breaking changes for running code

Dropping or renaming a column that the deployed API still reads causes runtime
errors between the migration and the code deploy. Use expand-and-contract:

1. Add the new column and write to both columns.
2. Switch reads to the new column.
3. Drop the old column in a later PR.

### 5. Editing a merged migration

This causes `The migration ... was modified after it was applied` for everyone
who already ran it. Revert your edit and write a new migration.

### 6. Migration order conflicts after a rebase

If `main` gained a migration with a newer timestamp than yours, your
migration now sorts before it, while databases that already applied `main`'s
migration will see yours as out of order. Regenerate:

```bash
rm -r prisma/migrations/<your_migration>
npx prisma migrate dev --create-only --name <same_name>
# re-apply any hand edits to the new migration.sql
```

### 7. SQLite-only SQL

The API uses SQLite today, but `.env.example` mentions hosted Postgres for
demo deployments. Keep hand-written SQL portable where you can. Avoid
SQLite-specific functions in backfills when a standard expression works.

### 8. Forgetting `prisma generate`

The TypeScript client goes stale and typecheck fails with missing fields.
`migrate dev` runs `generate` for you. After `migrate deploy` or a
`git pull`, run `npx prisma generate` yourself.

### 9. Committing `dev.db`

`apps/api/prisma/dev.db` is tracked in git, so running migrations locally
shows it as modified. Your local rows are personal state and don't belong in
a pull request. Discard the change before you commit:

```bash
git restore apps/api/prisma/dev.db
```

### 10. JSON columns

SQLite stores Prisma `Json` fields as `TEXT` (see the `tags` column in
`20260726120000_add_workspace_tags`). Backfills that write JSON must write
valid JSON strings, such as `'[]'`, not bare values.

## Pull request checklist

- [ ] Migration folder name is `<generated timestamp>_<verb_table_change>`.
- [ ] Generated SQL reviewed. No unintended `DROP`.
- [ ] Existing rows stay valid (default, backfill or nullable).
- [ ] Applied against a seeded database, then verified with
      `prisma migrate status` and a data query.
- [ ] Down script written, tested, and pasted into the PR description.
- [ ] `prisma/seed.ts` updated if needed, and `npm run db:seed` passes.
- [ ] `npx prisma validate`, `npm run typecheck -w api` and API tests pass.
- [ ] `dev.db` is not staged.

## Related docs

- [Prisma migration CI check](./prisma-migration-ci-check-guide.md)
- [Troubleshooting: Database](./troubleshooting.md#database)
- [Prisma: Generating down migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/generating-down-migrations)

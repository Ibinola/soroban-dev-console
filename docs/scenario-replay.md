# Scenario Replay Packs

Replay packs reconstruct specific operational events locally from captured context so engineers can investigate fairness or abuse cases without accessing live data.

## Available packs

| Pack | Path | Use case |
|---|---|---|
| Fairness investigation | `scripts/replay-packs/fairness-investigation.ts` | Contributor claims unfair budget rejection or cancellation timing |
| Abuse investigation | `scripts/replay-packs/abuse-investigation.ts` | Suspected duplicate submissions, automated farming, or flag review |

## Usage

### Fairness investigation

```bash
# Seed default fairness scenario
tsx scripts/replay-packs/fairness-investigation.ts

# With a specific contributor ID and database
tsx scripts/replay-packs/fairness-investigation.ts \
  --contributor alice-stellar \
  --db apps/api/dev.db
```

### Abuse investigation

```bash
tsx scripts/replay-packs/abuse-investigation.ts

# With a specific contributor
tsx scripts/replay-packs/abuse-investigation.ts --contributor suspect-contributor
```

## After seeding

Inspect the seeded state:

```bash
tsx scripts/explore-seed-data.ts
tsx scripts/inspect-wave-state.ts summary
```

Each pack prints its expected investigation questions at the end.

## Adding a new pack

1. Create `scripts/replay-packs/<name>.ts` following the pattern of existing packs.
2. The pack must:
   - Accept `--db <path>` and `--contributor <id>` flags
   - Print numbered steps as it seeds each table
   - Print investigation questions at the end
   - Use `upsert()` so it is safe to re-run
3. Add the pack to the table in this doc.

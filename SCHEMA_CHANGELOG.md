# Schema Changelog

Documents every schema version change across all persisted Zustand stores.
Bump `STORE_SCHEMA_VERSION` in `apps/web/store/schema-version.ts` whenever any
persisted store's shape changes, and add an entry here.

---

## Version 2 (current) — `STORE_SCHEMA_VERSION = 2`

**Stores affected:** `soroban-workspaces`

**Changes:**

- `WorkspaceSnapshot` now carries an explicit `version: 2` field to enable
  idempotent re-migration if the persist key is replayed.
- `savedCalls` array field renamed to `savedCallIds` for naming consistency.
- `artifactRefs: WorkspaceArtifactRef[]` added (was absent in v1). Default: `[]`.
- `checkpoints`, `pendingConflict`, `contractBookmarks` added to root store
  state (not part of the snapshot schema, but persisted at the store level).
- `cloudId` and `syncState` added to root state for cloud sync tracking.

**Migration path (v1 → v2):**

```ts
// store-migration.ts — fromVersion: 1, toVersion: 2
migrate(persisted) {
  // Renames savedCalls → savedCallIds, sets version: 2, adds artifactRefs: []
  // Legacy workspaces missing 'version' field are upgraded to shape v2
}
```

The v1 → v2 migration is idempotent: workspaces that already carry
`version: 2` are returned unchanged.

---

## Version 1 — `STORE_SCHEMA_VERSION = 1`

**Stores affected:** `soroban-workspaces`

**Changes from v0:**

- Introduced `WorkspaceSnapshot` typed shape replacing the previous freeform
  workspace objects.
- Added `artifactRefs` array (was missing in v0 raw data). Default: `[]`.
- Added `selectedNetwork` string field. Default: `"testnet"`.
- Added `createdAt` and `updatedAt` numeric timestamps.

**Migration path (v0 → v1):**

```ts
// store-migration.ts — fromVersion: 0, toVersion: 1
migrate(persisted) {
  // Maps raw workspace objects to WorkspaceSnapshot shape
  // Defaults missing fields: artifactRefs: [], selectedNetwork: "testnet"
}
```

---

## Version 0 — initial schema

**Shape:** ad-hoc workspace objects with `id`, `name`, `contractIds`, optional
`savedCalls` array. No `version` field.

---

## Other persisted stores

The following stores do not currently use versioned migrations. Their shapes
are considered stable. If any field is added or removed, bump
`STORE_SCHEMA_VERSION` and add a migration step here.

| Store key                    | Zustand store               | Schema version |
| ---------------------------- | --------------------------- | -------------- |
| `soroban-sync-queue`         | `useSyncQueueStore`         | unversioned    |
| `soroban-workspace-activity` | `useWorkspaceActivityStore` | unversioned    |
| `soroban-saved-calls`        | `useSavedCallsStore`        | unversioned    |
| `soroban-settings`           | `useSettingsStore`          | unversioned    |
| `soroban-network-store`      | `useNetworkStore`           | unversioned    |

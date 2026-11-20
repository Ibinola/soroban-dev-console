# Workspace export format specification

Exported workspaces are a single JSON document.

| Field | Type | Description |
|---|---|---|
| `schemaVersion` | integer | Format version. Increment on any breaking change. |
| `exportedAt` | ISO-8601 string | Export timestamp (UTC). |
| `workspace.id` | string | Workspace identifier. |
| `workspace.name` | string | Display name. |
| `workspace.network` | string | Network profile key (e.g. `testnet`). |
| `workspace.contracts[]` | array | Saved contracts: `{ id, name, address, interface? }`. |
| `workspace.savedCalls[]` | array | Saved invocations: `{ contractId, method, args }`. |

Rules:
- Readers must reject a `schemaVersion` newer than they support and may migrate older ones.
- Unknown fields must be ignored, not rejected.
- Secrets (private keys, seeds) must never appear in an export.

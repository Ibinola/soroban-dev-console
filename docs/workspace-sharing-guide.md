# Workspace Sharing and Collaboration Guide

Share links let you give someone a read-only view of a workspace: its
contracts, saved calls and notes. The recipient can browse it or fork it into
their own copy. This guide covers creating links, the options you can set,
forking, managing links, and the security model.

- [How sharing works](#how-sharing-works)
- [Create a share link](#create-a-share-link)
- [Access control options](#access-control-options)
- [What recipients see](#what-recipients-see)
- [Fork a shared workspace](#fork-a-shared-workspace)
- [Manage and revoke share links](#manage-and-revoke-share-links)
- [Security considerations](#security-considerations)
- [API reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## How sharing works

```
Your browser                       API                         Recipient
────────────                       ───                         ─────────
Workspace ──snapshot──► POST /shares ──► share_links row
                                         (token, snapshot,
                                          expiry, revoked)
                                              │
   /share/<token> ◄──────────────── GET /shares/<token> ◄──── opens link
                                              │
   /share/<token>/fork ─► copies snapshot into the recipient's
                          local workspaces (their browser)
```

Keep these points in mind:

- **A link is a snapshot.** It captures the workspace at the moment you create
  the link. Later edits to your workspace do **not** appear on existing links.
  To share an update, create a new link and revoke the old one.
- **Every link is read-only.** Recipients can't change your workspace. Forking
  gives them an independent copy.
- **The token is the credential.** Anyone who has the URL can open it until it
  expires or you revoke it.

## Create a share link

1. Open **Settings** and scroll to the **Share Links** card.
2. Make sure the workspace you want to share is the active workspace.
3. Fill in the **New share link** form:

   | Field                           | What it does                                                                                            |
   | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
   | **Label**                       | Optional name shown in your link list. Defaults to the workspace name.                                  |
   | **Expiration**                  | `1 Hour`, `24 Hours` (default), `7 Days` or `Never`. See [Expiration](#expiration).                     |
   | **Exclude Custom Auth Headers** | On by default. Strips credentials from the snapshot. See [Credential stripping](#credential-stripping). |

4. Click **Create**. The link appears at the top of the list with an
   **Active** badge.
5. Click the copy icon to copy the URL, which looks like
   `http://localhost:3000/share/<token>`.

**First share from a workspace.** Share links are stored by the API, so the
workspace needs a cloud copy. If the workspace hasn't been synced yet,
**Create** syncs it first and then creates the link. Until a workspace is
synced, the list shows _"Sync your workspace to the cloud first to manage
share links."_

**Owner key.** Creating, listing and revoking links requires your owner key.
If creation fails with an owner-key error, set one up as described in
[Troubleshooting issue 10](./troubleshooting.md#10-mutations-fail-with-owner-key-must-be-at-least-32-characters-long).

## Access control options

| Option               | Supported | Notes                                                             |
| -------------------- | --------- | ----------------------------------------------------------------- |
| Read-only access     | Always    | Every link is read-only. There is no editable share mode.         |
| Expiration           | Yes       | Preset durations in the UI, up to 1 year through the API.         |
| Revocation           | Yes       | Takes effect immediately.                                         |
| Credential stripping | Yes       | On by default.                                                    |
| Password protection  | **No**    | Not implemented. See [Password protection](#password-protection). |
| Per-recipient access | **No**    | Links are not tied to a user. Anyone with the URL has access.     |

### Read-only

The shared view at `/share/<token>` shows a **Read-Only Shared Workspace
Preview** banner and has no editing controls. Recipients can only edit a
[fork](#fork-a-shared-workspace), which is a separate copy.

### Expiration

- The UI offers **1 Hour**, **24 Hours**, **7 Days** and **Never**.
- Through the API you can set any expiry from 1 second up to **1 year** from
  creation, using `expiresInSeconds` or an ISO `expiresAt`. Past dates and
  dates more than a year out are rejected with `400`.
- Once a link expires, opening it shows **Link Expired** (HTTP `410`). The
  link stays in your list with an **Expired** badge.
- **Never** means the link stays valid until you revoke it. Choose it only for
  content you would be comfortable seeing forwarded.

### Password protection

Share links have **no password option**. To limit who can open a link:

- Use the shortest expiration that works, and revoke the link once the
  recipient has opened or forked it. The **Last accessed** time in your list
  tells you when that happened.
- Send the URL through a private channel, not a public issue or chat.
- For sensitive work, skip share links. Use **Export Backup** in **Settings**
  and send the file through a channel with its own access control. The backup
  covers all your local contracts, saved calls and networks, not only one
  workspace, so trim it before sending.

### Credential stripping

With **Exclude Custom Auth Headers** checked, the API scans the snapshot
before saving it and replaces sensitive values with `[REDACTED]`. It catches:

- Well-known auth headers: `Authorization`, `Proxy-Authorization`, `Cookie`,
  `Set-Cookie`, `X-API-Key`, `X-Auth-Token`, `X-Access-Token`, `X-Owner-Key`
  and similar.
- Any key containing `secret`, such as `clientSecret` or `rpc_secret`.
- `X-` prefixed keys containing `key` or `token`.

When anything is stripped, the link shows a **Sensitive headers stripped**
badge. Hover over it to see which fields were removed.

The scan is deliberately narrow, so ordinary contract data isn't damaged. A
plain field named `token`, a key inside a saved-call argument, or a secret
written in a note is **not** removed. Review the workspace before sharing
it. See [Security considerations](#security-considerations).

### Size limits

A snapshot can be up to **500 KB** and up to **10 levels** of nesting. Larger
workspaces are rejected with `400`. Remove unused saved calls or notes.

## What recipients see

Opening `/share/<token>` shows:

- The read-only banner with a **Fork to My Workspaces** button.
- The workspace name and network.
- The workspace's contracts and saved calls.
- Dependency diagnostics, which flag contracts or artifacts the recipient
  doesn't have locally.

Recipients don't need an owner key or a connected wallet to view a link.
Every visit increments the link's view count and is recorded in its access
log.

If the link can't be opened, the page explains why:

| Page title       | HTTP | Meaning                                                             |
| ---------------- | ---- | ------------------------------------------------------------------- |
| Link Revoked     | 403  | The owner revoked the link.                                         |
| Link Expired     | 410  | The expiry has passed.                                              |
| Link Unavailable | 404  | The token doesn't exist, or was purged.                             |
| Invalid Link     | 400  | The token or snapshot is malformed, or uses an unsupported version. |

## Fork a shared workspace

Forking copies a shared snapshot into a new workspace you own, so you can
edit and build on it.

1. Open the share link and click **Fork to My Workspaces**. This opens
   `/share/<token>/fork`.
2. The page loads the snapshot and checks it for compatibility with your
   version of DevConsole:
   - **Compatibility notes** (yellow): the payload was auto-repaired, for
     example because it came from an older schema version. The fork will work.
   - **Validation errors** (red): parts of the snapshot are invalid. The fork
     may be incomplete. Check the listed items after forking.
3. Review **What will be imported**: number of contracts, number of saved
   calls, network, and the source token.
4. Enter a name under **New workspace name**. The default is
   `<original name> (Fork)`.
5. Click **Fork & Open**.

**What happens next:**

- A new workspace is created in **your browser** on the same network as the
  original, and becomes your active workspace.
- Its contracts and saved calls are copied into it. Saved calls keep their
  original IDs, so forking the same link twice reuses existing saved calls
  instead of duplicating them.
- Workspace notes are not imported by the fork page.
- You're redirected to the home page with a confirmation toast.

**What a fork does not do:**

- It never changes the original workspace or the share link.
- It doesn't stay in sync. Later changes on either side aren't propagated.
- It isn't stored by the API until you sync it, for example by creating a
  share link from it.

You can't fork a revoked or expired link. The fork page shows **Cannot Fork**
with the reason.

## Manage and revoke share links

The **Share Links** card in **Settings** lists every link for the active
workspace, newest first. Click the refresh icon to reload it.

Each row shows:

- **Label**, or the token if the link has no label.
- **Status badge**: **Active**, **Expired** or **Revoked**.
- **Sensitive headers stripped**, if credential stripping removed anything.
- **Created** and **Expires** dates.
- **View count** (eye icon), and **Last accessed** as a relative time.

Row actions:

| Action | Icon     | Available when      | Effect                             |
| ------ | -------- | ------------------- | ---------------------------------- |
| Copy   | Copy     | Not revoked         | Copies the full share URL          |
| Open   | External | Active              | Opens the shared view in a new tab |
| Revoke | Trash    | Not already revoked | Disables the link immediately      |

**Revoking.** A revoked link immediately returns **Link Revoked** to anyone who
opens it, and can't be forked. Revocation can't be undone. To share again,
create a new link. Revoking an already-revoked link is a harmless no-op.

**Updating shared content.** Links are snapshots, so to share changes:

1. Create a new link from the updated workspace.
2. Send the new URL.
3. Revoke the old link.

**Access history.** The full access log for a link, with the last 50 visits
including time, IP address and user agent, is available from the
[stats endpoint](#api-reference).

**Cleanup.** Expired and revoked links stay in the list until an operator
purges them with `DELETE /shares/cleanup`. Purged tokens show **Link Unavailable**.

## Security considerations

- **Treat a share URL like a password.** The token (24 random bytes) is the
  only thing protecting the link. Anyone who has it, including through a
  forwarded message, browser history or a screenshot, can view the snapshot
  until it expires or is revoked.
- **Review before you share.** The snapshot includes contract IDs, saved-call
  function names and arguments, workspace notes, and workspace metadata.
  Credential stripping only removes header-shaped keys. Remove secrets from
  notes and arguments yourself.
- **Never share your owner key.** It is separate from share links and grants
  full control of your workspaces. Recipients never need it to view a link.
- **Prefer short expirations.** Use **1 Hour** or **24 Hours** for one-off
  reviews. Avoid **Never** unless the content is effectively public.
- **Watch the access signals.** An unexpected jump in view count, or access
  long after your recipient has finished, suggests the link has spread.
  Revoke it.
- **Network context leaks intent.** A link reveals which network you work on
  and which contracts you're interacting with. Consider this before sharing
  mainnet workspaces.
- **Built-in protections:**
  - Public resolution is limited to **30 requests per minute per IP**, to
    prevent token guessing. Failed lookups are logged.
  - Link creation, revocation and forking are written to the audit log, along
    with the list of stripped fields.
  - Public responses never include the workspace ID or owner key.
- **For operators:** `DELETE /shares/cleanup` is not protected by the
  owner-key guard. It only deletes links that are already expired or revoked,
  but you should restrict it at the network or proxy layer in hosted
  deployments.

## API reference

All endpoints are served by the API (default `http://localhost:4000`).
Owner-only endpoints need the `x-owner-key` header.

| Method   | Path                             | Auth   | Purpose                                            |
| -------- | -------------------------------- | ------ | -------------------------------------------------- |
| `POST`   | `/shares`                        | Owner  | Create a link                                      |
| `GET`    | `/shares/:token`                 | Public | Resolve a link (rate limited)                      |
| `DELETE` | `/shares/:token`                 | Owner  | Revoke a link                                      |
| `GET`    | `/shares/workspace/:workspaceId` | Owner  | List links (`skip`, `take`, `sortBy`, `sortOrder`) |
| `GET`    | `/shares/:token/stats`           | Owner  | View count and last 50 access-log entries          |
| `POST`   | `/shares/:token/fork`            | Owner  | Fork into a new **API-stored** workspace           |
| `DELETE` | `/shares/cleanup`                | None   | Purge expired and revoked links                    |

Create request body:

```json
{
  "workspaceId": "clx…",
  "label": "Review for audit team",
  "snapshotJson": "{\"version\":2,\"workspace\":{…}}",
  "expiresInSeconds": 86400,
  "excludeCustomAuthHeaders": true
}
```

The response includes `sanitized` and `strippedSensitiveKeys` so clients can
show which fields were removed.

> **API fork vs. UI fork.** The web UI forks into your browser's local
> storage. The `POST /shares/:token/fork` endpoint creates a workspace in the
> API database instead. It copies contract IDs and the network, but creates
> saved interactions as placeholders without their function names or
> arguments. Use the UI fork when you need the saved calls intact.

## Troubleshooting

| Problem                                                    | Fix                                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| "Failed to create share: Owner key must be at least 32…"   | Set a strong owner key ([troubleshooting issue 10](./troubleshooting.md#10-mutations-fail-with-owner-key-must-be-at-least-32-characters-long)). |
| "Snapshot data exceeds maximum size of 500KB"              | Remove unused saved calls or notes.                                                                                                             |
| "Share expiration date cannot exceed 1 year from now"      | Pick a shorter expiry (API only, since the UI presets are all within range).                                                                    |
| Recipient sees **Link Expired** or **Link Revoked**        | Create a new link and send it.                                                                                                                  |
| Recipient gets `429 Too Many Requests`                     | Wait for the `Retry-After` period ([troubleshooting issue 20](./troubleshooting.md#20-opening-a-share-link-returns-429-too-many-requests)).     |
| Recipient doesn't see your latest changes                  | Links are snapshots. Create a new link.                                                                                                         |
| Shared contracts show as missing in dependency diagnostics | The recipient needs the contract's ABI or WASM locally, or must be on the same network.                                                         |

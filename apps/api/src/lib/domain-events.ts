/**
 * DEVOPS-004: Structured domain events for workspace, share, and RPC lifecycle.
 *
 * Events are emitted via NestJS EventEmitter and can be subscribed to
 * independently of console logging.
 */

// ── Workspace events ──────────────────────────────────────────────────────────

export const WORKSPACE_CREATED = "workspace.created" as const;
export const WORKSPACE_UPDATED = "workspace.updated" as const;
export const WORKSPACE_DELETED = "workspace.deleted" as const;
export const WORKSPACE_IMPORTED = "workspace.imported" as const;
export const WORKSPACE_EXPORTED = "workspace.exported" as const;

export interface WorkspaceCreatedEvent {
  workspaceId: string;
  ownerKey: string;
  name: string;
  selectedNetwork: string;
}

export interface WorkspaceUpdatedEvent {
  workspaceId: string;
  ownerKey: string;
  changes: Partial<{ name: string; description: string; selectedNetwork: string }>;
}

export interface WorkspaceDeletedEvent {
  workspaceId: string;
  ownerKey: string;
}

export interface WorkspaceImportedEvent {
  workspaceId: string;
  ownerKey: string;
  version: number;
}

export interface WorkspaceExportedEvent {
  workspaceId: string;
  ownerKey: string;
}

// ── Share events ──────────────────────────────────────────────────────────────

export const SHARE_CREATED = "share.created" as const;
export const SHARE_RESOLVED = "share.resolved" as const;
export const SHARE_REVOKED = "share.revoked" as const;

export interface ShareCreatedEvent {
  shareId: string;
  workspaceId: string;
  /** token is redacted — never log the raw token */
  tokenHint: string;
}

export interface ShareResolvedEvent {
  shareId: string;
  workspaceId: string;
}

export interface ShareRevokedEvent {
  shareId: string;
  workspaceId: string;
}

// ── RPC events ────────────────────────────────────────────────────────────────

export const RPC_PROXIED = "rpc.proxied" as const;
export const RPC_CACHE_HIT = "rpc.cache_hit" as const;
export const RPC_UPSTREAM_ERROR = "rpc.upstream_error" as const;

export interface RpcProxiedEvent {
  network: string;
  method: string;
  statusCode: number;
  durationMs: number;
  cached: boolean;
}

export interface RpcCacheHitEvent {
  network: string;
  method: string;
}

export interface RpcUpstreamErrorEvent {
  network: string;
  method: string;
  errorName: string;
}

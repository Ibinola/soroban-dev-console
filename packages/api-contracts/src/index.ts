/**
 * Shared API contracts and types for Soroban Dev Console
 */

export * from "./runtime-defaults.js";

// ── Runtime Config ────────────────────────────────────────────────────────

export const RUNTIME_CONFIG_VERSION = 1 as const;

export type RuntimeProfile = "local" | "demo" | "production";

export interface RuntimeNetworkEntry {
  id: string;
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
}

export interface RuntimeFixtureEntry {
  key: string;
  label: string;
  description: string;
  network: string;
  contractId: string | null;
}

export interface RuntimeFeatureFlags {
  enableSharing: boolean;
  enableMultiOp: boolean;
  enableTokenDashboard: boolean;
  enableAuditLog: boolean;
  enableRpcGateway: boolean;
}

export interface RuntimeConfig {
  version: typeof RUNTIME_CONFIG_VERSION;
  profile: RuntimeProfile;
  networks: RuntimeNetworkEntry[];
  fixtures: RuntimeFixtureEntry[];
  flags: RuntimeFeatureFlags;
}

// ── Fixture Manifest ─────────────────────────────────────────────────────

export const FIXTURE_MANIFEST_SCHEMA_VERSION = 1 as const;

export interface FixtureContract {
  key: string;
  label: string;
  description: string;
  network: "testnet" | "local";
  contractId: string | null;
  /** SHA-256 hex of the compiled WASM, if known */
  wasmHash?: string | null;
  version?: string;
}

export interface ArtifactManifestEntry {
  key: string;
  wasmHash: string | null;
  version: string;
  builtAt: string | null;
}

export interface FixtureManifestPayload {
  schemaVersion: typeof FIXTURE_MANIFEST_SCHEMA_VERSION;
  generatedAt: string;
  fixtures: FixtureContract[];
  artifacts: ArtifactManifestEntry[];
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    path?: string;
  };
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export type ApiEnvelope<T> = ApiResponse<T> | ApiErrorResponse;

// ── Workspaces ────────────────────────────────────────────────────────────────

export interface WorkspaceContract {
  contractId: string;
  network: string;
}

export interface WorkspaceInteraction {
  functionName: string;
  argumentsJson: unknown;
}

export interface WorkspaceArtifact {
  kind: string;
  name: string;
  network: string;
  hash: string | null;
  metadata?: unknown;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string | null;
  selectedNetwork: string;
  /** BE-006: Current revision for optimistic concurrency control. */
  revision: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  savedContracts: WorkspaceContract[];
  savedInteractions: WorkspaceInteraction[];
  artifacts: WorkspaceArtifact[];
  shares: ShareSummary[];
}

export interface CreateWorkspacePayload {
  name: string;
  description?: string;
  selectedNetwork?: string;
  contracts?: WorkspaceContract[];
  interactions?: WorkspaceInteraction[];
}

export interface UpdateWorkspacePayload {
  name?: string;
  description?: string;
  selectedNetwork?: string;
  contracts?: WorkspaceContract[];
  interactions?: WorkspaceInteraction[];
  /** BE-006: Pass the current revision to enable optimistic concurrency control. */
  revision?: number;
}

// ── Shares ───────────────────────────────────────────────────────────────────

export interface ShareSummary {
  id: string;
  token: string;
  label: string | null;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
}

export interface ShareDetail extends ShareSummary {
  snapshotJson: unknown;
  workspaceId: string;
}

export interface CreateSharePayload {
  workspaceId: string;
  snapshotJson: unknown;
  label?: string;
  expiresInSeconds?: number;
}

// ── Transaction Status ─────────────────────────────────────────────────────────

export type NormalizedTransactionStatus = "pending" | "success" | "failed";

export interface NormalizedTransactionResult {
  status: NormalizedTransactionStatus;
  hash?: string;
  ledger?: number;
  createdAt?: string;
  resultXdr?: string;
  resultMetaXdr?: string;
  error?: string;
  diagnostics?: {
    cpuInsns?: number;
    memBytes?: number;
    minResourceFee?: string;
  };
}

export interface NormalizedSimulationPayload {
  ok: boolean;
  error?: string;
  resultXdr?: string;
  minResourceFee?: string;
  auth: Array<{
    address: string;
    kind: "account" | "contract" | "unknown";
  }>;
  requiredAuthKeys: string[];
  stateChangesCount: number;
  cpuInsns?: number;
  memBytes?: number;
}

/**
 * Shared API contracts and types for Soroban Dev Console
 */

export * from "./runtime-defaults";

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

// ── Contributor Verification (BE-206) ────────────────────────────────────────

export type VerificationStatus = "pending" | "verified" | "failed" | "expired";

export interface VerificationEventPayload {
  /** Idempotency key — provider-assigned event ID */
  eventId: string;
  contributorId: string;
  provider: string;
  status: VerificationStatus;
  verifiedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface VerificationEventResult {
  id: string;
  contributorId: string;
  provider: string;
  status: VerificationStatus;
  eventId: string;
  processedAt: string;
}

// ── Maintainer Review Context (BE-209) ───────────────────────────────────────

export type ReviewDecision = "approved" | "changes_requested" | "commented" | "dismissed";

export interface ReviewContextPayload {
  pullRequestId: string;
  repositoryId: string;
  reviewerId: string;
  decision: ReviewDecision;
  commentCount: number;
  requestedChangesCount: number;
  mergeStatus: "open" | "merged" | "closed";
  reviewedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewContextSummary {
  id: string;
  pullRequestId: string;
  repositoryId: string;
  reviewerId: string;
  decision: ReviewDecision;
  commentCount: number;
  requestedChangesCount: number;
  mergeStatus: string;
  reviewedAt: string;
  createdAt: string;
}

export interface AppealContext {
  pullRequestId: string;
  repositoryId: string;
  reviews: ReviewContextSummary[];
  totalComments: number;
  totalRequestedChanges: number;
  approvalCount: number;
  latestMergeStatus: string;
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

// ── Wave Program (BE-207, BE-208, BE-211, BE-213) ─────────────────────────────

export type WaveAction = "claim" | "appeal" | "reward";

export type AppealStatus = "open" | "under_review" | "resolved" | "rejected";

export interface AppealCaseSummary {
  id: string;
  issueRef: string;
  status: AppealStatus;
  reason: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  resolvedAt: Date | string | null;
  resolution: string | null;
}

export interface CreateAppealPayload {
  issueRef: string;
  reason: string;
  evidenceJson?: unknown;
}

export interface TransitionAppealPayload {
  status: AppealStatus;
  resolution?: string;
}

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type ModerationReasonCode =
  | "CLEAN"
  | "VELOCITY_ANOMALY"
  | "DUPLICATE_SUBMISSION"
  | "PATTERN_MATCH"
  | "MANUAL_FLAG";

export interface RiskScorePayload {
  issueRef: string;
  recentSubmissionCount?: number;
  duplicateDetected?: boolean;
  patternMatched?: boolean;
  manualFlag?: boolean;
}

export interface RiskScoreResponse {
  severity: RiskSeverity;
  reasonCode: ModerationReasonCode;
}

export interface ReviewWindowPolicy {
  maintainerReviewWindowHours: number;
  appealDeadlineHours: number;
  appealMaxOpenHours: number;
}

export interface ReviewSchedule {
  submittedAt: string;
  maintainerReviewDeadline: string;
  automatedEvalEligibleAt: string;
  appealDeadline: string;
  policy: ReviewWindowPolicy;
}

export interface AppealTimingResult {
  withinWindow: boolean;
  reason?: string;
  appealDeadline: string;
}

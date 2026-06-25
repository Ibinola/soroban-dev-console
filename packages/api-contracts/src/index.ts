/**
 * Shared API contracts and types for Soroban Dev Console
 */

export * from "./runtime-defaults";
export * from "./admin-sdk";

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

// ── Support Tickets (BE-215) ──────────────────────────────────────────────────

export type TicketCategory = "verification" | "payout" | "appeal" | "bug" | "abuse";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface SupportTicketSummary {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  reporterKey: string;
  assigneeKey: string | null;
  tags: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateSupportTicketPayload {
  subject: string;
  body: string;
  category: TicketCategory;
  priority?: TicketPriority;
  tags?: string[];
}

export interface UpdateSupportTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeKey?: string;
  tags?: string[];
}

// ── Maintainer Dashboard (BE-217) ─────────────────────────────────────────────

export interface TriageQueueView {
  total: number;
  byCategory: Record<string, SupportTicketSummary[]>;
}

export interface AppealListView {
  total: number;
  tickets: SupportTicketSummary[];
}

export interface VerificationBottlenecksView {
  total: number;
  tickets: SupportTicketSummary[];
}

export interface BudgetView {
  statusCounts: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  byCategory: Array<{ category: TicketCategory; count: number }>;
}

export interface MaintainerDashboardSummary {
  triageQueue: TriageQueueView;
  appealList: AppealListView;
  verificationBottlenecks: VerificationBottlenecksView;
  budgetView: BudgetView;
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

// ── AI-210: Coordinated abuse pattern detection ───────────────────────────────

export type AbuseEventKind =
  | "appeal_submitted"
  | "issue_claimed"
  | "contributor_registered"
  | "duplicate_submission"
  | "rapid_resubmission";

export type AbusePatternKind =
  | "VELOCITY_CLUSTER"
  | "APPEAL_FLOODING"
  | "ISSUE_FARMING"
  | "SHARED_METADATA"
  | "DUPLICATE_APPEAL_CLUSTER";

export type CoordinatedRiskLevel = "low" | "medium" | "high" | "critical";

export interface AbuseEventPayload {
  contributorId: string;
  issueRef: string;
  kind: AbuseEventKind;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface DetectedPatternSummary {
  kind: AbusePatternKind;
  contributorIds: string[];
  issueRefs: string[];
  description: string;
}

export interface CoordinatedAbuseReportResponse {
  analysedEventCount: number;
  patterns: DetectedPatternSummary[];
  overallRisk: CoordinatedRiskLevel;
  requiresHumanReview: boolean;
  generatedAt: string;
}

// ── Budget Accounting (BE-201, BE-202, BE-203, BE-204) ───────────────────────────

export type BudgetEventType = 
  | "cap_set" 
  | "reservation_created" 
  | "reservation_released" 
  | "points_used" 
  | "points_released" 
  | "reconciliation_drift";

export type ReservationStatus = "pending" | "active" | "released" | "cancelled";

export type ReservationType = "labeling" | "assignment" | "approval" | "merge" | "rollback";

export interface OrganizationBudgetSummary {
  organizationId: string;
  capPoints: number;
  usedPoints: number;
  reservedPoints: number;
  releasedPoints: number;
  headroomPoints: number;
  updatedAt: string;
  createdAt: string;
}

export interface PointReservationSummary {
  id: string;
  organizationId: string;
  contributorId: string;
  issueRef: string;
  reservationType: ReservationType;
  points: number;
  status: ReservationStatus;
  createdAt: string;
  releasedAt: string | null;
}

export interface BudgetEventSummary {
  id: string;
  organizationId: string;
  contributorId: string;
  eventType: BudgetEventType;
  points: number;
  referenceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface BudgetMetrics {
  caps: OrganizationBudgetSummary[];
  consumption: {
    organizationId: string;
    totalUsed: number;
    byContributor: Array<{
      contributorId: string;
      usedPoints: number;
      reservations: PointReservationSummary[];
    }>;
  }[];
  headroom: {
    organizationId: string;
    availablePoints: number;
    reservedPoints: number;
    usedPoints: number;
  }[];
  reservations: PointReservationSummary[];
  recentEvents: BudgetEventSummary[];
}

export interface GetBudgetMetricsQuery {
  organizationId?: string;
  contributorId?: string;
  limit?: number;
  offset?: number;
  includeReservations?: boolean;
  includeEvents?: boolean;
}

// ── AI-201: Prompt & Policy Registry ─────────────────────────────────────────

export type PromptPolicyKind = "prompt" | "policy" | "threshold" | "model_version";

export interface PromptPolicyEntrySummary {
  id: string;
  key: string;
  version: number;
  kind: PromptPolicyKind;
  content: string;
  isActive: boolean;
  publishedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreatePromptPolicyPayload {
  key: string;
  kind: PromptPolicyKind;
  content: string;
  notes?: string;
  publishedBy?: string;
}

export interface ActivatePromptPolicyPayload {
  publishedBy?: string;
}

// ── AI-202: Review Context AI Preprocessor ───────────────────────────────────

export type ReviewSignal = "strong_approval" | "approval" | "neutral" | "changes_requested" | "rejected";

export interface AIReadyReviewContext {
  pullRequestId: string;
  repositoryId: string;
  signal: ReviewSignal;
  confidence: number;
  reviewerCount: number;
  approvalCount: number;
  changesRequestedCount: number;
  totalComments: number;
  totalRequestedChanges: number;
  latestMergeStatus: string;
  humanOverrideRecommended: boolean;
  preprocessedAt: string;
}

// ── INFRA-213: Data Retention ─────────────────────────────────────────────────

export interface RetentionPolicy {
  resource: string;
  retentionDays: number;
  description: string;
}

export interface RetentionRunResult {
  resource: string;
  deletedCount: number;
  cutoffDate: string;
  dryRun: boolean;
}

export interface RetentionRunSummary {
  ranAt: string;
  dryRun: boolean;
  results: RetentionRunResult[];
  totalDeleted: number;
}

// ── INFRA-214: Feature Flag & Config Distribution ────────────────────────────

export type WaveFeatureKey =
  | "wave5_ai_appeals"
  | "wave5_budget_accounting"
  | "wave5_contributor_verification"
  | "wave5_point_ledger"
  | "wave5_notifications"
  | "wave5_review_context"
  | "wave5_data_retention";

export interface WaveFeatureFlag {
  key: WaveFeatureKey;
  enabled: boolean;
  rolloutPercent: number;
  overriddenBy: string | null;
  updatedAt: string;
}

export interface WaveRuntimeControls {
  flags: WaveFeatureFlag[];
  version: number;
  generatedAt: string;
}

export interface SetFeatureFlagPayload {
  enabled: boolean;
  rolloutPercent?: number;
  overriddenBy?: string;
}

export interface SetOrganizationBudgetPayload {
  organizationId: string;
  capPoints: number;
}

export interface ReservePointsPayload {
  organizationId: string;
  contributorId: string;
  issueRef: string;
  reservationType: ReservationType;
  points: number;
}

export interface ReleaseReservationPayload {
  reservationId: string;
}

export interface ReconcileBudgetPayload {
  organizationId: string;
  dryRun?: boolean;
}

// ── AI Appeal Pipeline (AI-203, AI-207) ───────────────────────────────────────

export interface EvidencePackInput {
  appealId: string;
  pullRequestId: string;
  workflowContext?: Record<string, unknown>;
}

export interface ReviewEvidencePack {
  appealId: string;
  issueRef: string;
  pullRequestId: string;
  assembledAt: string;
  appeal: {
    reason: string;
    status: string;
    createdAt: string;
    resolvedAt: string | null;
    resolution: string | null;
    evidenceJson: Record<string, unknown> | null;
  };
  reviewSummary: {
    totalReviews: number;
    approvalCount: number;
    changesRequestedCount: number;
    totalComments: number;
    latestMergeStatus: string;
    reviewTimeline: Array<{
      reviewerId: string;
      decision: string;
      commentCount: number;
      reviewedAt: string;
    }>;
  };
  priorDecisions: Array<{
    outcome: string;
    modelVersion: string | null;
    humanOverride: boolean;
    rationaleSummary: string | null;
    decidedAt: string;
  }>;
  workflowContext: Record<string, unknown> | null;
}

export interface AppealExplanation {
  appealId: string;
  outcome: "approved" | "rejected" | "escalated";
  confidence: "high" | "medium" | "low";
  requiresHumanReview: boolean;
  headline: string;
  detail: string;
  nextSteps: string[];
  generatedAt: string;
}

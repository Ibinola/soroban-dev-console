export interface VerificationState {
  contributorId: string;
  status: "pending" | "approved" | "rejected" | "under_review";
  submittedAt: string;
  reviewedAt?: string;
}

export interface BudgetFixture {
  orgId: string;
  repoId: string;
  capPoints: number;
  usedPoints: number;
  reservedPoints: number;
}

export interface AppealFixture {
  appealId: string;
  contributorId: string;
  issueRef: string;
  status: "open" | "under_review" | "approved" | "rejected";
  submittedAt: string;
}

export interface QueueFixture {
  queueId: string;
  kind: "verification" | "appeal" | "abuse_report";
  depth: number;
  oldestEntryAt: string;
}

export interface RpcTraceFixture {
  callId: string;
  method: string;
  params: Record<string, unknown>;
  error?: string;
  durationMs: number;
  timestamp: string;
}

export interface SupportTicketFixture {
  ticketId: string;
  contributorId: string;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
}

// ── Verification state builders ───────────────────────────────────────────────

export function makeVerificationState(
  overrides: Partial<VerificationState> = {},
): VerificationState {
  return {
    contributorId: overrides.contributorId ?? `contributor-${Date.now()}`,
    status: overrides.status ?? "pending",
    submittedAt: overrides.submittedAt ?? new Date().toISOString(),
    ...overrides,
  };
}

export function makePendingVerification(contributorId: string): VerificationState {
  return makeVerificationState({ contributorId, status: "pending" });
}

export function makeApprovedVerification(contributorId: string): VerificationState {
  return makeVerificationState({
    contributorId,
    status: "approved",
    reviewedAt: new Date().toISOString(),
  });
}

export function makeRejectedVerification(contributorId: string): VerificationState {
  return makeVerificationState({
    contributorId,
    status: "rejected",
    reviewedAt: new Date().toISOString(),
  });
}

// ── Budget fixture builders ───────────────────────────────────────────────────

export function makeBudgetFixture(overrides: Partial<BudgetFixture> = {}): BudgetFixture {
  return {
    orgId: overrides.orgId ?? `org-${Date.now()}`,
    repoId: overrides.repoId ?? `repo-${Date.now()}`,
    capPoints: overrides.capPoints ?? 1000,
    usedPoints: overrides.usedPoints ?? 0,
    reservedPoints: overrides.reservedPoints ?? 0,
    ...overrides,
  };
}

export function makeExhaustedBudget(orgId: string, repoId: string): BudgetFixture {
  return makeBudgetFixture({ orgId, repoId, capPoints: 100, usedPoints: 100, reservedPoints: 0 });
}

export function makeNearExhaustionBudget(orgId: string, repoId: string): BudgetFixture {
  return makeBudgetFixture({ orgId, repoId, capPoints: 100, usedPoints: 85, reservedPoints: 10 });
}

export function makeHealthyBudget(orgId: string, repoId: string): BudgetFixture {
  return makeBudgetFixture({ orgId, repoId, capPoints: 1000, usedPoints: 200, reservedPoints: 50 });
}

// ── Appeal fixture builders ───────────────────────────────────────────────────

export function makeAppealFixture(overrides: Partial<AppealFixture> = {}): AppealFixture {
  return {
    appealId: overrides.appealId ?? `appeal-${Date.now()}`,
    contributorId: overrides.contributorId ?? `contributor-${Date.now()}`,
    issueRef: overrides.issueRef ?? "owner/repo#1",
    status: overrides.status ?? "open",
    submittedAt: overrides.submittedAt ?? new Date().toISOString(),
    ...overrides,
  };
}

// ── Queue fixture builders ────────────────────────────────────────────────────

export function makeQueueFixture(overrides: Partial<QueueFixture> = {}): QueueFixture {
  return {
    queueId: overrides.queueId ?? `queue-${Date.now()}`,
    kind: overrides.kind ?? "verification",
    depth: overrides.depth ?? 0,
    oldestEntryAt: overrides.oldestEntryAt ?? new Date().toISOString(),
    ...overrides,
  };
}

export function makeBackloggedQueue(kind: QueueFixture["kind"], depth = 50): QueueFixture {
  return makeQueueFixture({
    kind,
    depth,
    oldestEntryAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

// ── RPC trace fixture builders ────────────────────────────────────────────────

export function makeRpcTraceFixture(overrides: Partial<RpcTraceFixture> = {}): RpcTraceFixture {
  return {
    callId: overrides.callId ?? `call-${Date.now()}`,
    method: overrides.method ?? "invokeContractFunction",
    params: overrides.params ?? {},
    durationMs: overrides.durationMs ?? 100,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    ...overrides,
  };
}

export function makeFailedRpcTrace(method: string, error: string): RpcTraceFixture {
  return makeRpcTraceFixture({
    method,
    error,
    durationMs: 0,
  });
}

// ── Support ticket fixture builders ───────────────────────────────────────────

export function makeSupportTicketFixture(
  overrides: Partial<SupportTicketFixture> = {},
): SupportTicketFixture {
  return {
    ticketId: overrides.ticketId ?? `ticket-${Date.now()}`,
    contributorId: overrides.contributorId ?? `contributor-${Date.now()}`,
    subject: overrides.subject ?? "Test support ticket",
    status: overrides.status ?? "open",
    priority: overrides.priority ?? "medium",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

export function assertBudgetSolvent(budget: BudgetFixture): void {
  const headroom = budget.capPoints - budget.usedPoints - budget.reservedPoints;
  if (headroom < 0) {
    throw new Error(
      `Budget integrity violation: headroom=${headroom} for org=${budget.orgId} repo=${budget.repoId}`,
    );
  }
}

export function assertVerificationTerminal(state: VerificationState): void {
  if (state.status !== "approved" && state.status !== "rejected") {
    throw new Error(
      `Expected terminal verification state but got: ${state.status}`,
    );
  }
}

// ── Point ledger assertion helpers ───────────────────────────────────────────

export interface LedgerEntry {
  contributorId: string;
  eventType: string;
  points: number;
}

export function computeBalance(entries: LedgerEntry[], contributorId: string): number {
  return entries
    .filter((e) => e.contributorId === contributorId)
    .reduce((sum, e) => sum + e.points, 0);
}

export function assertLedgerConsistency(entries: LedgerEntry[]): void {
  const contributors = [...new Set(entries.map((e) => e.contributorId))];
  for (const id of contributors) {
    const balance = computeBalance(entries, id);
    if (balance < 0) {
      throw new Error(`Negative ledger balance for contributor=${id}: ${balance}`);
    }
  }
}

// ── General helper ───────────────────────────────────────────────────────────

export function randomId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

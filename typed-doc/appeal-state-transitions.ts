/**
 * Issue #501 (BE-332): Separate appeal case state transitions
 *
 * Problem: AppealCase model has a freeform status field. AppealDecisionsService
 * records outcomes but doesn't enforce transitions or validate that terminal
 * states are respected.
 *
 * Solution: Implement an explicit state machine for appeal lifecycle with
 * allowed transitions, terminal state validation, and retry tracking.
 */

// ---- FIXED: appeal-decisions.service.ts — state machine ----

export const APPEAL_STATES = {
  OPEN: "open",
  UNDER_REVIEW: "under_review",
  RESOLVED: "resolved",
  REJECTED: "rejected",
  ESCALATED: "escalated",
  RETRY: "retry",
} as const;

const APPEAL_TRANSITIONS: Record<string, string[]> = {
  [APPEAL_STATES.OPEN]: [APPEAL_STATES.UNDER_REVIEW, APPEAL_STATES.RETRY],
  [APPEAL_STATES.UNDER_REVIEW]: [APPEAL_STATES.RESOLVED, APPEAL_STATES.REJECTED, APPEAL_STATES.ESCALATED],
  [APPEAL_STATES.ESCALATED]: [APPEAL_STATES.RESOLVED, APPEAL_STATES.REJECTED],
  [APPEAL_STATES.RESOLVED]: [],         // terminal
  [APPEAL_STATES.REJECTED]: [APPEAL_STATES.RETRY],  // can retry if rejected
  [APPEAL_STATES.RETRY]: [APPEAL_STATES.UNDER_REVIEW],
};

const TERMINAL_STATES = new Set([APPEAL_STATES.RESOLVED]);

@Injectable()
export class AppealDecisionsService {
  constructor(
    private readonly repository: AppealDecisionsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async record(dto: RecordAppealDecisionDto) {
    // Fetch the appeal case
    const appeal = await this.prisma.appealCase.findUnique({
      where: { id: dto.appealId },
    });
    if (!appeal) throw new NotFoundException(`Appeal ${dto.appealId} not found`);

    // Validate transition
    if (TERMINAL_STATES.has(appeal.status as string)) {
      throw new BadRequestException(
        `Appeal ${dto.appealId} is in terminal state '${appeal.status}' — no further transitions allowed`
      );
    }

    const decision = await this.repository.create({
      data: {
        appealId: dto.appealId,
        contributorId: dto.contributorId,
        outcome: dto.outcome,
        modelVersion: dto.modelVersion ?? null,
        humanOverride: dto.humanOverride ?? false,
        rationaleSummary: dto.rationaleSummary ?? null,
        reviewedBy: dto.reviewedBy ?? null,
      },
    });

    // Compute next state based on outcome
    const nextState = this.computeNextState(appeal.status as string, dto.outcome);
    const allowed = APPEAL_TRANSITIONS[appeal.status as string] ?? [];
    if (!allowed.includes(nextState)) {
      throw new BadRequestException(
        `Cannot transition appeal from '${appeal.status}' to '${nextState}'. ` +
        `Allowed: ${allowed.join(", ") || "none (terminal state)"}`
      );
    }

    await this.prisma.appealCase.update({
      where: { id: dto.appealId },
      data: {
        status: nextState,
        resolvedAt: TERMINAL_STATES.has(nextState) ? new Date() : undefined,
        resolution: dto.rationaleSummary ?? null,
      },
    });

    void this.audit.log({
      actor: dto.reviewedBy ?? dto.contributorId,
      action: "appeal.state_transitioned",
      resourceType: "appeal_case",
      resourceId: dto.appealId,
      summary: `Appeal ${dto.appealId}: ${appeal.status} → ${nextState} (${dto.outcome})`,
      metadata: { from: appeal.status, to: nextState, outcome: dto.outcome },
    });

    return decision;
  }

  /** Retry a rejected appeal — resets to RETRY state for re-evaluation. */
  async retry(appealId: string, reason: string) {
    const appeal = await this.prisma.appealCase.findUnique({
      where: { id: appealId },
    });
    if (!appeal) throw new NotFoundException(`Appeal ${appealId} not found`);

    if (appeal.status !== APPEAL_STATES.REJECTED) {
      throw new BadRequestException(
        `Only rejected appeals can be retried. Current state: ${appeal.status}`
      );
    }

    await this.prisma.appealCase.update({
      where: { id: appealId },
      data: {
        status: APPEAL_STATES.RETRY,
        metadata: { ...(appeal.metadata as any), retryReason: reason, retriedAt: new Date().toISOString() },
      },
    });

    await this.audit.log({
      actor: "system:appeal-decisions",
      action: "appeal.retried",
      resourceType: "appeal_case",
      resourceId: appealId,
      summary: `Appeal ${appealId} queued for retry: ${reason}`,
    });
  }

  private computeNextState(currentStatus: string, outcome: string): string {
    const outcomeMap: Record<string, Record<string, string>> = {
      [APPEAL_STATES.OPEN]: { approved: APPEAL_STATES.RESOLVED, rejected: APPEAL_STATES.REJECTED, escalated: APPEAL_STATES.ESCALATED },
      [APPEAL_STATES.UNDER_REVIEW]: { approved: APPEAL_STATES.RESOLVED, rejected: APPEAL_STATES.REJECTED, escalated: APPEAL_STATES.ESCALATED },
      [APPEAL_STATES.ESCALATED]: { approved: APPEAL_STATES.RESOLVED, rejected: APPEAL_STATES.REJECTED, escalated: APPEAL_STATES.ESCALATED },
      [APPEAL_STATES.RETRY]: { approved: APPEAL_STATES.RESOLVED, rejected: APPEAL_STATES.REJECTED, escalated: APPEAL_STATES.UNDER_REVIEW },
    };
    return outcomeMap[currentStatus]?.[outcome] ?? APPEAL_STATES.RESOLVED;
  }
}

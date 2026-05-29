/**
 * BE-201: Pure budget accounting rules for Wave 5 fairness verification.
 *
 * Encapsulates org/repo cap headroom, reservation edge cases, and exhaustion
 * checks without Prisma so QA and BE can share one source of truth.
 */

export interface BudgetScopeState {
  capPoints: number;
  usedPoints: number;
  reservedPoints: number;
}

export interface ReservationRecord {
  issueRef: string;
  status: "pending" | "active" | "released" | "cancelled";
  points: number;
}

export interface ReserveResult {
  ok: boolean;
  reason?: string;
  nextState?: BudgetScopeState;
}

export function computeHeadroom(state: BudgetScopeState): number {
  return Math.max(0, state.capPoints - state.usedPoints - state.reservedPoints);
}

export function computeHeadroomRatio(state: BudgetScopeState): number {
  if (state.capPoints <= 0) return 0;
  return computeHeadroom(state) / state.capPoints;
}

export function isNearExhaustion(
  state: BudgetScopeState,
  threshold = 0.2,
): boolean {
  return computeHeadroomRatio(state) < threshold;
}

export function isExhausted(state: BudgetScopeState): boolean {
  return computeHeadroom(state) === 0;
}

export function canReserve(
  state: BudgetScopeState,
  points: number,
): ReserveResult {
  if (points <= 0) {
    return { ok: false, reason: "Reservation points must be greater than zero." };
  }
  const headroom = computeHeadroom(state);
  if (points > headroom) {
    return {
      ok: false,
      reason: `Insufficient budget headroom: ${headroom} available, ${points} requested.`,
    };
  }
  return {
    ok: true,
    nextState: {
      ...state,
      reservedPoints: state.reservedPoints + points,
    },
  };
}

export function releaseReservation(
  state: BudgetScopeState,
  points: number,
): BudgetScopeState {
  return {
    ...state,
    reservedPoints: Math.max(0, state.reservedPoints - points),
  };
}

export function consumeReservation(
  state: BudgetScopeState,
  points: number,
): BudgetScopeState {
  const released = Math.min(points, state.reservedPoints);
  return {
    ...state,
    reservedPoints: state.reservedPoints - released,
    usedPoints: state.usedPoints + released,
  };
}

export function assertNoDuplicateActiveReservation(
  existing: ReservationRecord[],
  issueRef: string,
): { ok: boolean; reason?: string } {
  const hasActive = existing.some(
    (r) =>
      r.issueRef === issueRef &&
      (r.status === "pending" || r.status === "active"),
  );
  if (hasActive) {
    return {
      ok: false,
      reason: `An active reservation already exists for issue "${issueRef}".`,
    };
  }
  return { ok: true };
}

export interface IssueBudgetEvaluation {
  pointValue: number;
  remainingBudget: number;
  wouldExceedBudget: boolean;
  lowBudgetWarning: boolean;
}

/** Mirrors FE-203 issue-card budget signals from scope totals. */
export function evaluateIssueBudget(
  state: BudgetScopeState,
  pointValue: number,
  lowBudgetThreshold = 0.2,
): IssueBudgetEvaluation {
  const remainingBudget = computeHeadroom(state);
  const wouldExceedBudget = pointValue > remainingBudget;
  const remainingAfter = remainingBudget - pointValue;
  const lowBudgetWarning =
    !wouldExceedBudget &&
    state.capPoints > 0 &&
    remainingAfter / state.capPoints < lowBudgetThreshold;

  return {
    pointValue,
    remainingBudget,
    wouldExceedBudget,
    lowBudgetWarning,
  };
}

export function toOrganizationSummary(
  organizationId: string,
  state: BudgetScopeState,
  timestamps: { createdAt: string; updatedAt: string },
) {
  const headroomPoints = computeHeadroom(state);
  return {
    organizationId,
    capPoints: state.capPoints,
    usedPoints: state.usedPoints,
    reservedPoints: state.reservedPoints,
    releasedPoints: 0,
    headroomPoints,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };
}

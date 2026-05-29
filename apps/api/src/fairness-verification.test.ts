/**
 * QA-201: Wave 5 fairness verification — budget accounting rules.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoDuplicateActiveReservation,
  canReserve,
  computeHeadroom,
  consumeReservation,
  evaluateIssueBudget,
  isExhausted,
  isNearExhaustion,
  releaseReservation,
  type BudgetScopeState,
} from "./modules/budget/budget-accounting.js";

const ORG_CAP: BudgetScopeState = {
  capPoints: 10_000,
  usedPoints: 8_500,
  reservedPoints: 800,
};

const REPO_CAP: BudgetScopeState = {
  capPoints: 10_000,
  usedPoints: 9_200,
  reservedPoints: 500,
};

test("computeHeadroom: org and repo caps derive remaining points correctly", () => {
  assert.equal(computeHeadroom(ORG_CAP), 700);
  assert.equal(computeHeadroom(REPO_CAP), 300);
});

test("isNearExhaustion: flags repo scope below 20% headroom", () => {
  assert.equal(isNearExhaustion(ORG_CAP), true);
  assert.equal(isNearExhaustion(REPO_CAP), true);
  assert.equal(
    isNearExhaustion({ capPoints: 10_000, usedPoints: 5_000, reservedPoints: 0 }),
    false,
  );
});

test("isExhausted: true only when no headroom remains", () => {
  assert.equal(isExhausted(REPO_CAP), false);
  assert.equal(
    isExhausted({ capPoints: 1_000, usedPoints: 900, reservedPoints: 100 }),
    true,
  );
});

test("canReserve: rejects reservation exceeding headroom", () => {
  const result = canReserve(REPO_CAP, 500);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /insufficient budget headroom/i);
});

test("canReserve: allows reservation within headroom", () => {
  const result = canReserve(REPO_CAP, 200);
  assert.equal(result.ok, true);
  assert.equal(result.nextState?.reservedPoints, 700);
});

test("releaseReservation: returns points to available pool", () => {
  const after = releaseReservation(REPO_CAP, 300);
  assert.equal(after.reservedPoints, 200);
  assert.equal(computeHeadroom(after), 600);
});

test("consumeReservation: moves reserved points to used", () => {
  const after = consumeReservation(REPO_CAP, 200);
  assert.equal(after.reservedPoints, 300);
  assert.equal(after.usedPoints, 9_400);
});

test("assertNoDuplicateActiveReservation: blocks second active hold on same issue", () => {
  const existing = [
    { issueRef: "soroban-dev-console#42", status: "active" as const, points: 100 },
  ];
  const dup = assertNoDuplicateActiveReservation(existing, "soroban-dev-console#42");
  assert.equal(dup.ok, false);
  assert.match(dup.reason ?? "", /active reservation already exists/i);

  const ok = assertNoDuplicateActiveReservation(existing, "soroban-dev-console#99");
  assert.equal(ok.ok, true);
});

test("evaluateIssueBudget: exceeds budget when point value over headroom", () => {
  const eval_ = evaluateIssueBudget(REPO_CAP, 500);
  assert.equal(eval_.wouldExceedBudget, true);
  assert.equal(eval_.lowBudgetWarning, false);
});

test("evaluateIssueBudget: low budget warning when assignment fits but headroom tight", () => {
  const eval_ = evaluateIssueBudget(REPO_CAP, 50);
  assert.equal(eval_.wouldExceedBudget, false);
  assert.equal(eval_.lowBudgetWarning, true);
});

test("maintainer workflow: exhaustion blocks new reservations after cap consumed", () => {
  const exhausted = { capPoints: 5_000, usedPoints: 4_500, reservedPoints: 500 };
  assert.equal(isExhausted(exhausted), true);
  const attempt = canReserve(exhausted, 1);
  assert.equal(attempt.ok, false);
});

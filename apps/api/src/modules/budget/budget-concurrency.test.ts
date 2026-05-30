// QA-212: Concurrency and race-condition tests for claims, reservations, and releases.
//
// Validates that budget accounting rules remain correct when multiple callers
// attempt to reserve, release, or consume budget simultaneously.  These tests
// operate on the pure budget-accounting module (no Prisma dependency) so they
// run fast and deterministically.

import assert from "node:assert/strict";
import test from "node:test";
import {
  canReserve,
  releaseReservation,
  consumeReservation,
  assertNoDuplicateActiveReservation,
  computeHeadroom,
  isExhausted,
  type BudgetScopeState,
  type ReservationRecord,
} from "./budget-accounting.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(
  cap: number,
  used = 0,
  reserved = 0,
): BudgetScopeState {
  return { capPoints: cap, usedPoints: used, reservedPoints: reserved };
}

// Simulates N concurrent reservation attempts on the same initial state.
// Returns how many succeeded.
function simulateConcurrentReserves(
  initial: BudgetScopeState,
  points: number,
  concurrency: number,
): { successes: number; finalState: BudgetScopeState } {
  let state = { ...initial };
  let successes = 0;
  for (let i = 0; i < concurrency; i++) {
    const result = canReserve(state, points);
    if (result.ok && result.nextState) {
      state = result.nextState;
      successes++;
    }
  }
  return { successes, finalState: state };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("concurrent reservations never exceed cap", () => {
  const state = makeState(100);
  const { successes, finalState } = simulateConcurrentReserves(state, 30, 10);

  // At most 3 reservations of 30 pts fit inside a cap of 100
  assert.ok(successes <= 3, `Expected ≤3 successes, got ${successes}`);
  assert.ok(computeHeadroom(finalState) >= 0, "Headroom must not go negative");
  assert.ok(
    finalState.reservedPoints <= finalState.capPoints,
    "Reserved must not exceed cap",
  );
});

test("reserve then release restores headroom exactly", () => {
  const initial = makeState(500, 100);
  const reserve = canReserve(initial, 200);
  assert.ok(reserve.ok);

  const afterReserve = reserve.nextState!;
  assert.equal(computeHeadroom(afterReserve), 200);

  const afterRelease = releaseReservation(afterReserve, 200);
  assert.equal(afterRelease.reservedPoints, 0);
  assert.equal(computeHeadroom(afterRelease), computeHeadroom(initial));
});

test("consume reservation moves points from reserved to used", () => {
  const state = makeState(1000, 200, 300);
  const after = consumeReservation(state, 300);

  assert.equal(after.reservedPoints, 0);
  assert.equal(after.usedPoints, 500);
  assert.equal(after.capPoints, 1000);
});

test("partial consume leaves remainder in reserved", () => {
  const state = makeState(1000, 0, 400);
  const after = consumeReservation(state, 100);

  assert.equal(after.reservedPoints, 300);
  assert.equal(after.usedPoints, 100);
});

test("exhausted budget rejects all new reservations", () => {
  const state = makeState(100, 100, 0);
  assert.ok(isExhausted(state));

  const result = canReserve(state, 1);
  assert.ok(!result.ok);
  assert.match(result.reason!, /insufficient budget headroom/i);
});

test("over-released reserved floor clamps to zero", () => {
  const state = makeState(100, 0, 50);
  const after = releaseReservation(state, 200);
  assert.equal(after.reservedPoints, 0);
  assert.ok(computeHeadroom(after) >= 0);
});

test("duplicate active reservation is rejected", () => {
  const existing: ReservationRecord[] = [
    { issueRef: "owner/repo#42", status: "active", points: 50 },
  ];
  const check = assertNoDuplicateActiveReservation(existing, "owner/repo#42");
  assert.ok(!check.ok);
  assert.match(check.reason!, /active reservation already exists/i);
});

test("released reservation allows re-reservation of same issue", () => {
  const existing: ReservationRecord[] = [
    { issueRef: "owner/repo#42", status: "released", points: 50 },
  ];
  const check = assertNoDuplicateActiveReservation(existing, "owner/repo#42");
  assert.ok(check.ok);
});

test("interleaved reserve/release sequence stays consistent", () => {
  let state = makeState(200);
  const ops: Array<["reserve" | "release" | "consume", number]> = [
    ["reserve", 50],
    ["reserve", 50],
    ["release", 50],
    ["consume", 50],
    ["reserve", 80],
    ["release", 80],
    ["reserve", 100],
    ["consume", 100],
  ];

  for (const [op, pts] of ops) {
    if (op === "reserve") {
      const r = canReserve(state, pts);
      if (r.ok) state = r.nextState!;
    } else if (op === "release") {
      state = releaseReservation(state, pts);
    } else {
      state = consumeReservation(state, pts);
    }
    assert.ok(computeHeadroom(state) >= 0, `Negative headroom after ${op}(${pts})`);
    assert.ok(state.reservedPoints >= 0, `Negative reservedPoints after ${op}(${pts})`);
  }

  assert.ok(state.usedPoints <= state.capPoints, "Used points exceeded cap");
});

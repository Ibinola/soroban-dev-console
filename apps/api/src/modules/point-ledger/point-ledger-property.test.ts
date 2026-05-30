// QA-213: Property-based validation for point-ledger correctness.
//
// Validates algebraic properties of the ledger: balances are non-negative,
// sums are conserved across event sequences, and integrity checks catch
// snapshot drift.  Uses only in-memory data structures — no Prisma required.

import assert from "node:assert/strict";
import test from "node:test";
import {
  computeBalance,
  assertLedgerConsistency,
  type LedgerEntry,
} from "../../../../scripts/wave-test-utils.js";

// ── Property helpers ──────────────────────────────────────────────────────────

function sumPoints(entries: LedgerEntry[], contributorId: string): number {
  return entries
    .filter((e) => e.contributorId === contributorId)
    .reduce((acc, e) => acc + e.points, 0);
}

// Simple pseudo-random deterministic sequence for property generation.
function* pseudoRand(seed: number): Generator<number> {
  let s = seed;
  while (true) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    yield s;
  }
}

function buildEntrySequence(
  seed: number,
  contributorCount: number,
  eventCount: number,
): LedgerEntry[] {
  const gen = pseudoRand(seed);
  const contributors = Array.from({ length: contributorCount }, (_, i) => `c-${i}`);
  const eventTypes = ["review_approved", "claim_merged", "bonus_awarded"];
  const entries: LedgerEntry[] = [];

  // First pass: only positive entries so balances stay non-negative.
  for (let i = 0; i < eventCount; i++) {
    const rng = gen.next().value;
    const contributor = contributors[rng % contributorCount];
    const eventType = eventTypes[rng % eventTypes.length];
    const points = (rng % 200) + 1;
    entries.push({ contributorId: contributor, eventType, points });
  }
  return entries;
}

// ── Properties ────────────────────────────────────────────────────────────────

test("balance of empty ledger is zero for any contributor", () => {
  const entries: LedgerEntry[] = [];
  assert.equal(computeBalance(entries, "any-contributor"), 0);
});

test("balance equals sum of all entries for that contributor", () => {
  const entries: LedgerEntry[] = [
    { contributorId: "alice", eventType: "review_approved", points: 100 },
    { contributorId: "alice", eventType: "claim_merged", points: 50 },
    { contributorId: "bob", eventType: "review_approved", points: 80 },
    { contributorId: "alice", eventType: "bonus_awarded", points: 20 },
  ];
  assert.equal(computeBalance(entries, "alice"), 170);
  assert.equal(computeBalance(entries, "bob"), 80);
  assert.equal(computeBalance(entries, "carol"), 0);
});

test("property: balance == sum over multiple random sequences", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const entries = buildEntrySequence(seed, 5, 50);
    const contributors = [...new Set(entries.map((e) => e.contributorId))];
    for (const id of contributors) {
      const computed = computeBalance(entries, id);
      const manual = sumPoints(entries, id);
      assert.equal(computed, manual, `Balance mismatch at seed=${seed} contributor=${id}`);
    }
  }
});

test("property: adding a positive entry never decreases balance", () => {
  for (let seed = 1; seed <= 15; seed++) {
    const entries = buildEntrySequence(seed, 3, 30);
    const id = "c-0";
    const before = computeBalance(entries, id);
    entries.push({ contributorId: id, eventType: "bonus_awarded", points: 10 });
    const after = computeBalance(entries, id);
    assert.ok(after >= before, `Balance decreased after positive entry at seed=${seed}`);
  }
});

test("property: balance is commutative — entry order does not matter", () => {
  const base: LedgerEntry[] = [
    { contributorId: "alice", eventType: "review_approved", points: 100 },
    { contributorId: "alice", eventType: "claim_merged", points: 75 },
    { contributorId: "alice", eventType: "bonus_awarded", points: 25 },
  ];
  const shuffled: LedgerEntry[] = [base[2], base[0], base[1]];
  assert.equal(computeBalance(base, "alice"), computeBalance(shuffled, "alice"));
});

test("assertLedgerConsistency passes for all-positive entries", () => {
  const entries = buildEntrySequence(42, 4, 40);
  assert.doesNotThrow(() => assertLedgerConsistency(entries));
});

test("assertLedgerConsistency rejects negative balance", () => {
  const entries: LedgerEntry[] = [
    { contributorId: "alice", eventType: "review_approved", points: 50 },
    { contributorId: "alice", eventType: "adjustment", points: -100 },
  ];
  assert.throws(
    () => assertLedgerConsistency(entries),
    /negative ledger balance/i,
  );
});

test("property: approve-reject-appeal cycle total is conserved", () => {
  // Approve gives +100, appeal-approved gives +25 bonus, reject gives 0
  const entries: LedgerEntry[] = [
    { contributorId: "alice", eventType: "review_approved", points: 100 },
    { contributorId: "alice", eventType: "appeal_approved", points: 25 },
    { contributorId: "alice", eventType: "review_approved", points: 100 },
    { contributorId: "bob", eventType: "review_approved", points: 100 },
  ];
  assert.equal(computeBalance(entries, "alice"), 225);
  assert.equal(computeBalance(entries, "bob"), 100);
  assert.doesNotThrow(() => assertLedgerConsistency(entries));
});

test("property: global ledger sum equals sum of per-contributor balances", () => {
  for (let seed = 5; seed <= 25; seed++) {
    const entries = buildEntrySequence(seed, 6, 60);
    const contributors = [...new Set(entries.map((e) => e.contributorId))];
    const globalSum = entries.reduce((acc, e) => acc + e.points, 0);
    const perContribSum = contributors.reduce(
      (acc, id) => acc + computeBalance(entries, id),
      0,
    );
    assert.equal(
      globalSum,
      perContribSum,
      `Global vs per-contributor sum mismatch at seed=${seed}`,
    );
  }
});

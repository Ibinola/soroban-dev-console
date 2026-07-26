import crypto from "crypto";

const SEED_TRANSACTIONS = parseInt(process.env.SEED_TRANSACTIONS ?? "500", 10);
const SEED_REVIEWS = parseInt(process.env.SEED_REVIEWS ?? "200", 10);
const SEED_APPEALS = parseInt(process.env.SEED_APPEALS ?? "50", 10);

const BUDGET_ID = process.env.PERF_BUDGET_ID ?? "budget-perf-001";
const MAINTAINER_ID = process.env.PERF_MAINTAINER_ID ?? "maintainer-perf-001";
const CONTRIBUTOR_IDS = Array.from(
  { length: 20 },
  (_, i) => `contributor-perf-${String(i + 1).padStart(3, "0")}`
);

const MERCHANT_NAMES = [
  "Office Depot",
  "Amazon Business",
  "Staples",
  "Dell Technologies",
  "Adobe Systems",
  "GitHub",
  "Slack Technologies",
  "Zoom Video",
  "Atlassian",
  "Unknown Vendor",
];
const MCCS = ["5112", "5045", "7372", "5734", "5999", "5065"];
const STATUSES = [
  "cleared",
  "cleared",
  "cleared",
  "flagged",
  "pending",
  "reversed",
] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomChoice<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}
function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

interface TransactionRow {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  merchant_name: string;
  merchant_category_code: string;
  posted_at: string;
  budget_id: string;
  contributor_id: string;
  flags: string[];
}

function generateTransaction(index: number): TransactionRow {
  const status = randomChoice(STATUSES);
  const flags =
    status === "flagged"
      ? randomChoice([
          ["out-of-policy"],
          ["missing-receipt"],
          ["out-of-policy", "missing-receipt"],
        ])
      : [];

  return {
    id: `tx-perf-${String(index).padStart(6, "0")}`,
    amount_cents: randomInt(500, 250_000),
    currency: "USD",
    status,
    merchant_name: randomChoice(MERCHANT_NAMES),
    merchant_category_code: randomChoice(MCCS),
    posted_at: randomDate(
      new Date("2025-01-01"),
      new Date("2025-06-30")
    ).toISOString(),
    budget_id: BUDGET_ID,
    contributor_id: randomChoice(CONTRIBUTOR_IDS),
    flags,
  };
}

interface ReviewRow {
  review_id: string;
  transaction_id: string;
  reviewer_id: string;
  decision: "approved" | "rejected" | null;
  notes: string;
  reviewed_at: string | null;
}

function generateReview(index: number, transactionId: string): ReviewRow {
  const decision = randomChoice(["approved", "approved", "rejected", null] as const);
  return {
    review_id: `rev-perf-${String(index).padStart(6, "0")}`,
    transaction_id: transactionId,
    reviewer_id: MAINTAINER_ID,
    decision,
    notes: decision === "rejected" ? "Receipt not provided." : "",
    reviewed_at: decision ? new Date().toISOString() : null,
  };
}

interface AppealRow {
  appeal_id: string;
  review_id: string;
  reason: string;
  submitted_at: string;
  outcome: "pending" | "overturned" | "upheld";
}

function generateAppeal(index: number, reviewId: string): AppealRow {
  return {
    appeal_id: `appeal-perf-${String(index).padStart(6, "0")}`,
    review_id: reviewId,
    reason: "Receipt was submitted via email.",
    submitted_at: new Date().toISOString(),
    outcome: randomChoice(["pending", "pending", "overturned", "upheld"] as const),
  };
}

async function main() {
  console.log("🌱 seed-perf: starting");
  console.log(`   transactions : ${SEED_TRANSACTIONS}`);
  console.log(`   reviews      : ${SEED_REVIEWS}`);
  console.log(`   appeals      : ${SEED_APPEALS}`);
  console.log(`   budget_id    : ${BUDGET_ID}`);
  console.log(`   maintainer   : ${MAINTAINER_ID}`);

  const transactions = Array.from({ length: SEED_TRANSACTIONS }, (_, i) =>
    generateTransaction(i + 1)
  );

  const flaggedIds = transactions
    .filter((t) => t.status === "flagged")
    .map((t) => t.id);

  const reviews = Array.from({ length: SEED_REVIEWS }, (_, i) =>
    generateReview(i + 1, flaggedIds[i % flaggedIds.length] ?? transactions[i % transactions.length].id)
  );

  const rejectedReviewIds = reviews
    .filter((r) => r.decision === "rejected")
    .map((r) => r.review_id);

  const appeals = Array.from({ length: SEED_APPEALS }, (_, i) =>
    generateAppeal(i + 1, rejectedReviewIds[i % Math.max(1, rejectedReviewIds.length)])
  );

  console.log("\n✅ seed-perf complete (dry run — wire db client to persist)");
  console.log(`   Generated ${transactions.length} transactions`);
  console.log(`   Generated ${reviews.length} reviews`);
  console.log(`   Generated ${appeals.length} appeals`);

  // Emit env-var hints so the test runner can pick up the IDs
  console.log("\n# Add to your .env.perf or CI environment:");
  console.log(`PERF_BUDGET_ID=${BUDGET_ID}`);
  console.log(`PERF_MAINTAINER_ID=${MAINTAINER_ID}`);
}

main().catch((err) => {
  console.error("seed-perf failed:", err);
  process.exit(1);
});

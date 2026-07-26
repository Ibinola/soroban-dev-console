import { jest } from "@jest/globals";

export interface RawTransaction {
  id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "cleared" | "flagged" | "reversed";
  merchant_name: string;
  merchant_category_code: string;
  posted_at: string; // ISO-8601
  budget_id: string;
  contributor_id: string;
  receipt_url?: string;
  flags?: string[];
}

export interface NormalizedTransaction {
  id: string;
  amount: { cents: number; formatted: string; currency: string };
  status: RawTransaction["status"];
  merchant: { name: string; categoryCode: string };
  postedAt: Date;
  budgetId: string;
  contributorId: string;
  receiptUrl: string | null;
  flags: string[];
  requiresVerification: boolean;
}

export interface RawReview {
  review_id: string;
  transaction_id: string;
  reviewer_id: string;
  decision: "approved" | "rejected" | "escalated" | null;
  notes?: string;
  reviewed_at?: string;
  appeal?: {
    appeal_id: string;
    reason: string;
    submitted_at: string;
    outcome: "pending" | "overturned" | "upheld";
  };
}

export interface NormalizedReview {
  reviewId: string;
  transactionId: string;
  reviewerId: string;
  decision: RawReview["decision"];
  notes: string;
  reviewedAt: Date | null;
  appeal: {
    appealId: string;
    reason: string;
    submittedAt: Date;
    outcome: "pending" | "overturned" | "upheld";
  } | null;
  isPending: boolean;
  isAppealed: boolean;
}

export function normalizeTransaction(raw: RawTransaction): NormalizedTransaction {
  const absAmount = Math.abs(raw.amount_cents);
  const sign = raw.amount_cents < 0 ? "-" : "";
  const dollars = Math.floor(absAmount / 100);
  const cents = String(absAmount % 100).padStart(2, "0");
  return {
    id: raw.id,
    amount: {
      cents: raw.amount_cents,
      formatted: `${sign}${raw.currency === "USD" ? "$" : raw.currency}${dollars}.${cents}`,
      currency: raw.currency,
    },
    status: raw.status,
    merchant: {
      name: raw.merchant_name,
      categoryCode: raw.merchant_category_code,
    },
    postedAt: new Date(raw.posted_at),
    budgetId: raw.budget_id,
    contributorId: raw.contributor_id,
    receiptUrl: raw.receipt_url ?? null,
    flags: raw.flags ?? [],
    requiresVerification: raw.status === "flagged" || (raw.flags ?? []).length > 0,
  };
}

export function normalizeReview(raw: RawReview): NormalizedReview {
  return {
    reviewId: raw.review_id,
    transactionId: raw.transaction_id,
    reviewerId: raw.reviewer_id,
    decision: raw.decision,
    notes: raw.notes ?? "",
    reviewedAt: raw.reviewed_at ? new Date(raw.reviewed_at) : null,
    appeal: raw.appeal
      ? {
          appealId: raw.appeal.appeal_id,
          reason: raw.appeal.reason,
          submittedAt: new Date(raw.appeal.submitted_at),
          outcome: raw.appeal.outcome,
        }
      : null,
    isPending: raw.decision === null,
    isAppealed: raw.appeal !== undefined,
  };
}

const RAW_TX_STANDARD: RawTransaction = {
  id: "tx-snapshot-001",
  amount_cents: 4999,
  currency: "USD",
  status: "cleared",
  merchant_name: "Office Depot",
  merchant_category_code: "5112",
  posted_at: "2025-03-15T14:22:00.000Z",
  budget_id: "budget-Q1-ops",
  contributor_id: "contrib-42",
};

const RAW_TX_FLAGGED: RawTransaction = {
  id: "tx-snapshot-002",
  amount_cents: 129_99,
  currency: "USD",
  status: "flagged",
  merchant_name: "Unknown Vendor",
  merchant_category_code: "5999",
  posted_at: "2025-03-16T09:05:00.000Z",
  budget_id: "budget-Q1-ops",
  contributor_id: "contrib-07",
  flags: ["out-of-policy", "missing-receipt"],
};

const RAW_TX_NEGATIVE: RawTransaction = {
  id: "tx-snapshot-003",
  amount_cents: -2_500,
  currency: "USD",
  status: "reversed",
  merchant_name: "Office Depot",
  merchant_category_code: "5112",
  posted_at: "2025-03-17T11:00:00.000Z",
  budget_id: "budget-Q1-ops",
  contributor_id: "contrib-42",
};

const RAW_REVIEW_PENDING: RawReview = {
  review_id: "rev-snapshot-001",
  transaction_id: "tx-snapshot-002",
  reviewer_id: "maintainer-99",
  decision: null,
};

const RAW_REVIEW_REJECTED_WITH_APPEAL: RawReview = {
  review_id: "rev-snapshot-002",
  transaction_id: "tx-snapshot-002",
  reviewer_id: "maintainer-99",
  decision: "rejected",
  notes: "Receipt not provided within 5 business days.",
  reviewed_at: "2025-03-18T08:00:00.000Z",
  appeal: {
    appeal_id: "appeal-snapshot-001",
    reason: "Receipt was emailed separately — see attachment.",
    submitted_at: "2025-03-19T10:30:00.000Z",
    outcome: "pending",
  },
};

const RAW_REVIEW_APPROVED: RawReview = {
  review_id: "rev-snapshot-003",
  transaction_id: "tx-snapshot-001",
  reviewer_id: "maintainer-12",
  decision: "approved",
  reviewed_at: "2025-03-15T17:00:00.000Z",
};

describe("QA-205 | Snapshot: normalizeTransaction", () => {
  it("matches snapshot for a standard cleared transaction", () => {
    const result = normalizeTransaction(RAW_TX_STANDARD);
    // Freeze the Date so the snapshot is deterministic
    const serialized = JSON.parse(
      JSON.stringify(result, (_, v) => (v instanceof Date ? v.toISOString() : v))
    );
    expect(serialized).toMatchSnapshot();
  });

  it("matches snapshot for a flagged transaction with policy violations", () => {
    const result = normalizeTransaction(RAW_TX_FLAGGED);
    const serialized = JSON.parse(
      JSON.stringify(result, (_, v) => (v instanceof Date ? v.toISOString() : v))
    );
    expect(serialized).toMatchSnapshot();
  });

  it("matches snapshot for a reversed (negative-amount) transaction", () => {
    const result = normalizeTransaction(RAW_TX_NEGATIVE);
    const serialized = JSON.parse(
      JSON.stringify(result, (_, v) => (v instanceof Date ? v.toISOString() : v))
    );
    expect(serialized).toMatchSnapshot();
  });

  it("sets requiresVerification=true for flagged transactions", () => {
    expect(normalizeTransaction(RAW_TX_FLAGGED).requiresVerification).toBe(true);
  });

  it("sets requiresVerification=false for cleared transactions with no flags", () => {
    expect(normalizeTransaction(RAW_TX_STANDARD).requiresVerification).toBe(false);
  });

  it("formats the amount string correctly for cents-only amounts", () => {
    const tx: RawTransaction = { ...RAW_TX_STANDARD, amount_cents: 99 };
    expect(normalizeTransaction(tx).amount.formatted).toBe("$0.99");
  });

  it("formats the amount string correctly for negative amounts", () => {
    expect(normalizeTransaction(RAW_TX_NEGATIVE).amount.formatted).toBe("-$25.00");
  });
});

describe("QA-205 | Snapshot: normalizeReview", () => {
  it("matches snapshot for a pending review", () => {
    const result = normalizeReview(RAW_REVIEW_PENDING);
    const serialized = JSON.parse(
      JSON.stringify(result, (_, v) => (v instanceof Date ? v.toISOString() : v))
    );
    expect(serialized).toMatchSnapshot();
  });

  it("matches snapshot for a rejected review with an active appeal", () => {
    const result = normalizeReview(RAW_REVIEW_REJECTED_WITH_APPEAL);
    const serialized = JSON.parse(
      JSON.stringify(result, (_, v) => (v instanceof Date ? v.toISOString() : v))
    );
    expect(serialized).toMatchSnapshot();
  });

  it("matches snapshot for an approved review without an appeal", () => {
    const result = normalizeReview(RAW_REVIEW_APPROVED);
    const serialized = JSON.parse(
      JSON.stringify(result, (_, v) => (v instanceof Date ? v.toISOString() : v))
    );
    expect(serialized).toMatchSnapshot();
  });

  it("sets isPending=true and isAppealed=false for a pending review", () => {
    const result = normalizeReview(RAW_REVIEW_PENDING);
    expect(result.isPending).toBe(true);
    expect(result.isAppealed).toBe(false);
  });

  it("sets isAppealed=true for a review with an appeal", () => {
    expect(normalizeReview(RAW_REVIEW_REJECTED_WITH_APPEAL).isAppealed).toBe(true);
  });

  it("returns null for reviewedAt when the review has not been actioned", () => {
    expect(normalizeReview(RAW_REVIEW_PENDING).reviewedAt).toBeNull();
  });

  it("returns null appeal when no appeal is present", () => {
    expect(normalizeReview(RAW_REVIEW_APPROVED).appeal).toBeNull();
  });
});

describe("QA-205 | Snapshot: contract stability — field-level assertions", () => {
  /**
   * These tests are intentionally field-by-field so that when the snapshot
   * diff fires, the failing test name directly names the broken field.
   */
  it("transaction: id passes through unchanged", () => {
    expect(normalizeTransaction(RAW_TX_STANDARD).id).toBe("tx-snapshot-001");
  });

  it("transaction: amount.cents is the raw integer", () => {
    expect(normalizeTransaction(RAW_TX_STANDARD).amount.cents).toBe(4999);
  });

  it("transaction: postedAt is a Date instance", () => {
    expect(normalizeTransaction(RAW_TX_STANDARD).postedAt).toBeInstanceOf(Date);
  });

  it("review: appeal.submittedAt is a Date instance", () => {
    const result = normalizeReview(RAW_REVIEW_REJECTED_WITH_APPEAL);
    expect(result.appeal!.submittedAt).toBeInstanceOf(Date);
  });
});

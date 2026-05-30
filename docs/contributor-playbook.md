# Contributor Playbook — Wave 5

This playbook walks through the contributor journey under Wave 5: upfront verification, fair review windows, and how to submit a strong appeal when needed.

---

## 1. Before you claim an issue

### Complete verification first

Wave 5 requires identity verification before you can claim budget-backed issues. Start early — it can take up to 3 business days.

1. Navigate to the Verification section (`/verification`).
2. Submit the required evidence (wallet address, contribution history link, or org membership proof).
3. Wait for maintainer approval. You will receive a notification when your status changes.

**If you are rejected:** Read the rejection reason carefully. Gather the missing evidence and resubmit. One resubmission is allowed per verification cycle.

### Check budget availability

Before claiming, check that the repo scope has headroom:

```bash
tsx scripts/inspect-wave-state.ts budgets --repo <repo-id>
```

A near-exhausted scope may delay approval. Watch for the budget warning banner on the issue page.

---

## 2. Claiming and working on issues

### Claim

Click **Claim** on the issue page. This creates a point reservation and starts your review window.

### Review window

You have a fixed review window (typically 7–14 days) to submit your work. The countdown is visible on your dashboard. If you need more time, request an extension before the window closes.

### Submitting work

Open a PR following the [branch-pr-workflow](branch-pr-workflow.md). Link the issue with `Closes #<n>` in the PR body.

---

## 3. After a decision

### Approved

Points are credited to your ledger when the PR is merged. Check your balance:

```bash
tsx scripts/inspect-wave-state.ts ledger --contributor <your-id>
```

### Rejected

You will receive a rejection reason. If you believe the decision was incorrect, submit an appeal within 7 days.

---

## 4. Submitting an appeal

A strong appeal includes:

1. **The specific decision** you are contesting (PR number, review outcome, date).
2. **Evidence** that directly contradicts the rejection reason (diff link, test output, external reference).
3. **What you expected** vs what happened.

Appeals without evidence are unlikely to succeed. The AI pre-screener evaluates evidence completeness before routing to a maintainer.

### Navigate to the Appeal form

Go to `/appeals/new` and fill in the form. You will receive a confirmation with an appeal ID.

### Track your appeal

```
/appeals/<appeal-id>
```

The status will progress through: `open` → `under_review` → `approved` or `rejected`.

---

## 5. Reference

- [maintainer-playbook.md](maintainer-playbook.md) — how maintainers evaluate your work
- [env-profiles.md](env-profiles.md) — environment setup for local testing
- [branch-pr-workflow.md](branch-pr-workflow.md) — naming and PR conventions
- [governance.md](governance.md) — escalation process

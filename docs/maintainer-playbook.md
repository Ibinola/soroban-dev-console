# Maintainer Playbook — Wave 5

This playbook covers how maintainers operate under Wave 5 rules: managing budgets, unblocking contributors in verification, and following up on AI-flagged appeals.

---

## 1. Budget management

### Check current budget state

```bash
tsx scripts/inspect-wave-state.ts budgets
tsx scripts/inspect-wave-state.ts summary
```

### When budgets run hot

**Symptom:** Repo or org scope headroom drops below 20%.

**Actions:**
1. Run `tsx scripts/inspect-wave-state.ts budgets --repo <repo>` to see which scope is constrained.
2. Check `tsx scripts/inspect-wave-state.ts reservations --status active` for stale reservations that can be released.
3. If a scope is exhausted, coordinate with the org admin to raise the cap or defer lower-priority issues.
4. Update the issue queue to reflect which items are paused pending budget.

### Budget ledger drift

If the dashboard shows a mismatch between recorded and computed totals, run:

```bash
tsx scripts/inspect-wave-state.ts ledger
```

Contact the ops team if drift exceeds 5%.

---

## 2. Contributor verification

### When contributors are blocked on verification

**Symptom:** A contributor cannot claim issues because their verification is pending or rejected.

**Actions:**
1. Check `tsx scripts/inspect-wave-state.ts summary` for pending verification count.
2. Navigate to the Verification queue dashboard (`/verification`).
3. For pending: review submitted evidence and approve or request additional information.
4. For rejected: inform the contributor of what evidence is missing and invite resubmission.

### SLAs

| State | Target resolution |
|---|---|
| pending | ≤ 3 business days |
| under_review | ≤ 5 business days |

---

## 3. AI appeal follow-up

### When an AI appeal needs human review

Wave 5 uses automated appeal pre-screening. The AI assigns a confidence score; low-confidence cases are routed to the human queue.

**Actions:**
1. Check the Appeal queue dashboard (`/appeals`).
2. For each human-escalated appeal, review: the original decision context, the contributor's evidence, and the AI summary.
3. Override if the AI recommendation appears incorrect. Document the override reason in the appeal record.
4. Inform the contributor of the final outcome within 5 business days of escalation.

### Appeal queue backlog

If the queue depth exceeds 20:
1. Triage by age — resolve oldest first.
2. Batch-approve straightforward cases where evidence is unambiguous.
3. Escalate systemic issues (pattern of similar appeals) to the Wave ops channel.

---

## 4. Local debugging

Reproduce any state locally:

```bash
# Seed a scenario matching production conditions
tsx scripts/wave-simulator.ts --scenario budget-pressure
tsx scripts/wave-simulator.ts --scenario full-wave

# Inspect the resulting state
tsx scripts/explore-seed-data.ts
tsx scripts/inspect-wave-state.ts summary
```

---

## 5. Reference

- [env-profiles.md](env-profiles.md) — environment setup
- [wave5-fairness-test-plan.md](wave5-fairness-test-plan.md) — test coverage matrix
- [governance.md](governance.md) — escalation paths
- [runbooks.md](runbooks.md) — operational runbooks

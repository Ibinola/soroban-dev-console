# Verification Abuse Threat Model (Wave 5)

This document outlines the specific abuse paths identified for the Wave 5 contributor verification process and maps them to concrete mitigation controls implemented in the Soroban Dev Console architecture.

## Overview

The Wave 5 platform relies on an upfront verification gate before contributors can claim, reserve, or merge points for paid issues. Because significant payouts are tied to these identities, the incentive for verification abuse is high.

## Threat Vectors & Mitigations

### 1. Upfront Verification Bypass (Sybil & Automated KYB)
**Threat:** Attackers script the automated KYC/KYB flow, bypassing liveness checks or exploiting API replay to mass-verify phantom identities.
**Impact:** Sybil attacks draining organizational point budgets.
**Mitigation:** 
- `ContributorVerificationService` maps verification events to a `VerificationEvent` with a unique `eventId` and enforces strict 1:1 status mappings to prevent replays.

### 2. Duplicate Account Linkage (Staged Identities)
**Threat:** A single verified physical identity links multiple `ownerKey` tokens (via multiple GitHub/Discord SSO accounts) to circumvent individual payout caps or limits.
**Impact:** Unfair distribution and point monopolization.
**Mitigation:** 
- Database constraints enforce a strict `1:1` relationship between a `contributorId` (representing a verified human/entity) and their point ledger, preventing budget double-dipping. 

### 3. Staged Claims & Double-Spend Transitions
**Threat:** Attackers exploit timing windows during issue assignment vs payout transitions to "double-spend" organization budget headroom by rapidly claiming multiple issues concurrently before the budget lock updates.
**Impact:** Organizational budget cap exhaustion and negative headroom drift.
**Mitigation:**
- Implemented `@@unique([contributorId, issueRef, reservationType])` in `PointReservation` to prevent multiple pending/active reservations for the same issue action.
- Application-level wrapper (`budget-accounting.ts: assertNoDuplicateActiveReservation`) alongside Prisma `P2002` checks ensure database transaction atomicity prevents race conditions.

### 4. Support-Assisted Bypass & Impersonation (Social Engineering)
**Threat:** An attacker uses the Support Ticket or Appeal system to trick a maintainer into overriding verification status, or an unauthorized user abuses generic `PATCH /support-tickets` endpoints to mutate `assigneeKey` or `status` representing themselves as an authorized decider.
**Impact:** Complete bypass of the automated KYC pipeline via manual overrides.
**Mitigation:**
- Support Ticket update pathways (`SupportTicketsService.update`) enforce strict owner/assignee authorization rules. Only authorized support administrators can assign themselves or transition critical Verification and Appeal tickets.
- Overrides on the `ContributorVerification` model enforce explicit audit logging (`AuditLog`) mapping the maintainer's ID to the action.

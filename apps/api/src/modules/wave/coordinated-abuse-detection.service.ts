/**
 * AI-210: Coordinated abuse pattern detection across contributors, issues, and appeals.
 *
 * Detects coordinated rule-breaking, contributor farming, and suspicious appeal
 * clusters. Produces operator-review signals — never automated punishments.
 *
 * Explicit inputs  → analyse(events[])
 * Explicit outputs → CoordinatedAbuseReport (patterns[], overallRisk, requiresHumanReview)
 * Review boundary  → requiresHumanReview=true for any risk above "low"; humans
 *                    inspect and decide — the service never takes action itself.
 */

import { Injectable, Logger } from "@nestjs/common";

// ── Input types ──────────────────────────────────────────────────────────────

export type AbuseEventKind =
  | "appeal_submitted"
  | "issue_claimed"
  | "contributor_registered"
  | "duplicate_submission"
  | "rapid_resubmission";

export interface AbuseEvent {
  contributorId: string;
  issueRef: string;
  kind: AbuseEventKind;
  /** ISO-8601 timestamp of the event. */
  occurredAt: string;
  /** Optional metadata (IP hash, device fingerprint, etc.) */
  metadata?: Record<string, unknown>;
}

// ── Output types ─────────────────────────────────────────────────────────────

export type AbusePatternKind =
  | "VELOCITY_CLUSTER"      // many events from one contributor in a short window
  | "APPEAL_FLOODING"       // contributor submitted many appeals in a short window
  | "ISSUE_FARMING"         // one issue claimed by many contributors in quick succession
  | "SHARED_METADATA"       // multiple contributors share suspicious metadata values
  | "DUPLICATE_APPEAL_CLUSTER"; // identical appeal content from different contributors

export type CoordinatedRiskLevel = "low" | "medium" | "high" | "critical";

export interface DetectedPattern {
  kind: AbusePatternKind;
  /** IDs of contributors involved. */
  contributorIds: string[];
  /** Issue refs involved, if applicable. */
  issueRefs: string[];
  /** Human-readable explanation safe for operator display. */
  description: string;
  /** Numeric signal strength 0–100 (internal; not shown to contributors). */
  _signalStrength: number;
}

export interface CoordinatedAbuseReport {
  analysedEventCount: number;
  patterns: DetectedPattern[];
  overallRisk: CoordinatedRiskLevel;
  /**
   * Always true when overallRisk is "medium" or above.
   * Operators must review before taking any action.
   */
  requiresHumanReview: boolean;
  generatedAt: string;
}

// ── Configurable thresholds (measurable, tunable) ────────────────────────────

export interface AbuseDetectionPolicy {
  /** Max events per contributor within windowMs before VELOCITY_CLUSTER fires. */
  velocityEventLimit: number;
  /** Max appeal submissions per contributor within windowMs before APPEAL_FLOODING fires. */
  appealFloodLimit: number;
  /** Max unique contributors claiming the same issue within windowMs before ISSUE_FARMING fires. */
  issueFarmingContributorLimit: number;
  /** Time window in milliseconds for all sliding-window checks. */
  windowMs: number;
}

export const DEFAULT_ABUSE_DETECTION_POLICY: AbuseDetectionPolicy = {
  velocityEventLimit: 10,
  appealFloodLimit: 5,
  issueFarmingContributorLimit: 4,
  windowMs: 60 * 60 * 1000, // 1 hour
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CoordinatedAbuseDetectionService {
  private readonly logger = new Logger(CoordinatedAbuseDetectionService.name);

  /**
   * Analyse a batch of recent events for coordinated abuse patterns.
   * Returns a report with detected patterns and an overall risk level.
   * Never modifies state or triggers automated actions.
   */
  analyse(
    events: AbuseEvent[],
    policy: Partial<AbuseDetectionPolicy> = {},
  ): CoordinatedAbuseReport {
    const resolved: AbuseDetectionPolicy = { ...DEFAULT_ABUSE_DETECTION_POLICY, ...policy };
    const patterns: DetectedPattern[] = [];

    patterns.push(
      ...this.detectVelocityClusters(events, resolved),
      ...this.detectAppealFlooding(events, resolved),
      ...this.detectIssueFarming(events, resolved),
      ...this.detectSharedMetadata(events),
    );

    const overallRisk = this.toRiskLevel(patterns);
    const requiresHumanReview = overallRisk !== "low";

    const report: CoordinatedAbuseReport = {
      analysedEventCount: events.length,
      patterns,
      overallRisk,
      requiresHumanReview,
      generatedAt: new Date().toISOString(),
    };

    if (requiresHumanReview) {
      this.logger.warn(
        JSON.stringify({
          event: "coordinated_abuse_flagged",
          overallRisk,
          patternCount: patterns.length,
          patternKinds: patterns.map((p) => p.kind),
        }),
      );
    }

    return report;
  }

  // ── Detectors ──────────────────────────────────────────────────────────────

  private detectVelocityClusters(
    events: AbuseEvent[],
    policy: AbuseDetectionPolicy,
  ): DetectedPattern[] {
    const byContributor = groupBy(events, (e) => e.contributorId);
    const patterns: DetectedPattern[] = [];

    for (const [contributorId, contribEvents] of Object.entries(byContributor)) {
      const withinWindow = filterWindow(contribEvents, policy.windowMs);
      if (withinWindow.length >= policy.velocityEventLimit) {
        patterns.push({
          kind: "VELOCITY_CLUSTER",
          contributorIds: [contributorId],
          issueRefs: unique(withinWindow.map((e) => e.issueRef)),
          description: `Contributor ${contributorId} generated ${withinWindow.length} events within the detection window.`,
          _signalStrength: Math.min(100, withinWindow.length * 8),
        });
      }
    }

    return patterns;
  }

  private detectAppealFlooding(
    events: AbuseEvent[],
    policy: AbuseDetectionPolicy,
  ): DetectedPattern[] {
    const appealEvents = events.filter((e) => e.kind === "appeal_submitted");
    const byContributor = groupBy(appealEvents, (e) => e.contributorId);
    const patterns: DetectedPattern[] = [];

    for (const [contributorId, contribAppeals] of Object.entries(byContributor)) {
      const withinWindow = filterWindow(contribAppeals, policy.windowMs);
      if (withinWindow.length >= policy.appealFloodLimit) {
        patterns.push({
          kind: "APPEAL_FLOODING",
          contributorIds: [contributorId],
          issueRefs: unique(withinWindow.map((e) => e.issueRef)),
          description: `Contributor ${contributorId} submitted ${withinWindow.length} appeals within the detection window.`,
          _signalStrength: Math.min(100, withinWindow.length * 15),
        });
      }
    }

    return patterns;
  }

  private detectIssueFarming(
    events: AbuseEvent[],
    policy: AbuseDetectionPolicy,
  ): DetectedPattern[] {
    const claimEvents = events.filter((e) => e.kind === "issue_claimed");
    const byIssue = groupBy(claimEvents, (e) => e.issueRef);
    const patterns: DetectedPattern[] = [];

    for (const [issueRef, issueEvents] of Object.entries(byIssue)) {
      const withinWindow = filterWindow(issueEvents, policy.windowMs);
      const uniqueContributors = unique(withinWindow.map((e) => e.contributorId));
      if (uniqueContributors.length >= policy.issueFarmingContributorLimit) {
        patterns.push({
          kind: "ISSUE_FARMING",
          contributorIds: uniqueContributors,
          issueRefs: [issueRef],
          description: `Issue ${issueRef} was claimed by ${uniqueContributors.length} distinct contributors within the detection window.`,
          _signalStrength: Math.min(100, uniqueContributors.length * 20),
        });
      }
    }

    return patterns;
  }

  private detectSharedMetadata(events: AbuseEvent[]): DetectedPattern[] {
    // Detect multiple contributors sharing an identical suspicious metadata value
    // (e.g., same IP hash or device fingerprint).
    const metaIndex = new Map<string, Set<string>>();

    for (const e of events) {
      if (!e.metadata) continue;
      for (const [key, val] of Object.entries(e.metadata)) {
        if (!val || typeof val !== "string") continue;
        const signature = `${key}:${val}`;
        if (!metaIndex.has(signature)) metaIndex.set(signature, new Set());
        metaIndex.get(signature)!.add(e.contributorId);
      }
    }

    const patterns: DetectedPattern[] = [];

    for (const [signature, contributors] of metaIndex.entries()) {
      if (contributors.size >= 3) {
        patterns.push({
          kind: "SHARED_METADATA",
          contributorIds: Array.from(contributors),
          issueRefs: [],
          description: `${contributors.size} contributors share metadata value "${signature}".`,
          _signalStrength: Math.min(100, contributors.size * 25),
        });
      }
    }

    return patterns;
  }

  // ── Aggregation ────────────────────────────────────────────────────────────

  private toRiskLevel(patterns: DetectedPattern[]): CoordinatedRiskLevel {
    if (patterns.length === 0) return "low";
    const maxSignal = Math.max(...patterns.map((p) => p._signalStrength));
    if (maxSignal >= 80) return "critical";
    if (maxSignal >= 50) return "high";
    if (maxSignal >= 20) return "medium";
    return "low";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

function filterWindow(events: AbuseEvent[], windowMs: number): AbuseEvent[] {
  const cutoff = Date.now() - windowMs;
  return events.filter((e) => new Date(e.occurredAt).getTime() >= cutoff);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Issue #493 (BE-324): Stabilize review context persistence
 *
 * Problem: ReviewContext model stores raw PR review data but lacks
 * versioning, schema enforcement, and normalized shape guarantees.
 * AI and maintainer flows may read inconsistently-shaped records.
 *
 * Solution: Add versioned schema, validation layer, and a migration
 * path for existing records. Introduce a ReviewContextVersion model
 * for audit trail of changes to review context.
 */

// ---- Prisma schema additions ----
model ReviewContext {
  id                    String    @id @default(cuid())
  pullRequestId         String    @map("pull_request_id")
  repositoryId          String    @map("repository_id")
  reviewerId            String    @map("reviewer_id")
  decision              String
  commentCount          Int       @default(0) @map("comment_count")
  requestedChangesCount Int       @default(0) @map("requested_changes_count")
  mergeStatus           String    @map("merge_status")
  schemaVersion         Int       @default(2) @map("schema_version")  // BE-324: versioned shape
  reviewedAt            DateTime  @map("reviewed_at")
  metadata              Json?
  createdAt             DateTime  @default(now()) @map("created_at")

  @@index([pullRequestId])
  @@index([repositoryId, reviewerId])
  @@map("review_contexts")
}

// NEW: immutable version history for each review context
model ReviewContextVersion {
  id            String   @id @default(cuid())
  contextId     String   @map("context_id")
  schemaVersion Int      @default(2) @map("schema_version")
  snapshot      Json               // full payload at that version
  changedBy     String   @map("changed_by")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([contextId, schemaVersion])
  @@map("review_context_versions")
}

// ---- FIXED: review-context.service.ts — schema validation & versioning ----
import { z } from "zod";

const ReviewContextSchemaV2 = z.object({
  pullRequestId: z.string().min(1),
  repositoryId: z.string().min(1),
  reviewerId: z.string().min(1),
  decision: z.enum(["approved", "changes_requested", "commented", "dismissed"]),
  commentCount: z.number().int().min(0),
  requestedChangesCount: z.number().int().min(0),
  mergeStatus: z.enum(["mergeable", "conflicting", "blocked", "unknown"]),
  reviewedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

// Normalize V1 records to V2 on read
function normalizeToV2(record: any): ReviewContextPayload {
  return {
    pullRequestId: record.pullRequestId,
    repositoryId: record.repositoryId,
    reviewerId: record.reviewerId,
    decision: record.decision,
    commentCount: record.commentCount ?? 0,
    requestedChangesCount: record.requestedChangesCount ?? 0,
    mergeStatus: record.mergeStatus ?? "unknown",
    reviewedAt: record.reviewedAt,
    metadata: {
      ...(record.metadata ?? {}),
      _normalizedAt: new Date().toISOString(),
      _originalSchemaVersion: record.schemaVersion ?? 1,
    },
  };
}

@Injectable()
export class ReviewContextService {
  async record(payload: ReviewContextPayload): Promise<ReviewContextSummary> {
    // Validate against current schema
    const parsed = ReviewContextSchemaV2.parse(payload);

    const record = await this.prisma.reviewContext.create({
      data: {
        pullRequestId: parsed.pullRequestId,
        repositoryId: parsed.repositoryId,
        reviewerId: parsed.reviewerId,
        decision: parsed.decision,
        commentCount: parsed.commentCount,
        requestedChangesCount: parsed.requestedChangesCount,
        mergeStatus: parsed.mergeStatus,
        schemaVersion: 2,
        reviewedAt: new Date(parsed.reviewedAt),
        metadata: (parsed.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    // Create version snapshot
    await this.prisma.reviewContextVersion.create({
      data: {
        contextId: record.id,
        schemaVersion: 2,
        snapshot: record as any,
        changedBy: `reviewer:${payload.reviewerId}`,
      },
    });

    return this.toSummary(record);
  }

  async getAppealContext(pullRequestId: string): Promise<AppealContext> {
    const reviews = await this.prisma.reviewContext.findMany({
      where: { pullRequestId },
      orderBy: { reviewedAt: "asc" },
    });

    if (reviews.length === 0) {
      throw new NotFoundException(`No review context found for PR ${pullRequestId}`);
    }

    // Normalize all records to V2 shape for consistent reads
    const normalized = reviews.map((r) => normalizeToV2(r));
    const latest = normalized[normalized.length - 1];

    return {
      pullRequestId,
      repositoryId: latest.repositoryId,
      reviews: normalized.map((r) => this.toSummary(r)),
      mergedDecision: latest.decision,
      totalReviews: normalized.length,
    };
  }

  /** Get version history for a specific review context record. */
  async getVersionHistory(contextId: string) {
    return this.prisma.reviewContextVersion.findMany({
      where: { contextId },
      orderBy: { createdAt: "desc" },
    });
  }
}

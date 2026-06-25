/**
 * AI-935: Build a reusable feedback-tagging assistant.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray, IsOptional } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const FEEDBACK_TAGGER_MODEL_VERSION = "rules-v1.0.0" as const;

export type FeedbackTag =
  | "bug-report"
  | "feature-request"
  | "performance"
  | "ux"
  | "documentation"
  | "question"
  | "positive"
  | "unclear";

export interface TaggedFeedback {
  text: string;
  tags: FeedbackTag[];
  confidence: number;
  needsManualReview: boolean;
}

export class TagFeedbackDto {
  @IsString()
  batchId!: string;

  @IsArray()
  feedbackItems!: string[];

  @IsOptional()
  @IsString()
  context?: string;
}

const TAG_RULES: Array<{ pattern: RegExp; tag: FeedbackTag; weight: number }> = [
  { pattern: /bug|error|broken|crash|fail|not working|doesn't work/i, tag: "bug-report", weight: 1 },
  { pattern: /slow|performance|latency|timeout|lag/i, tag: "performance", weight: 1 },
  { pattern: /feature|request|would be nice|add|support for|please add/i, tag: "feature-request", weight: 1 },
  { pattern: /ui|ux|design|layout|button|click|interface|confusing/i, tag: "ux", weight: 1 },
  { pattern: /doc|documentation|readme|example|unclear|how to/i, tag: "documentation", weight: 1 },
  { pattern: /question|how|what|why|where|when\?/i, tag: "question", weight: 1 },
  { pattern: /great|love|awesome|excellent|good job|well done|thanks/i, tag: "positive", weight: 1 },
];

function tagItem(text: string): TaggedFeedback {
  const matchedTags: FeedbackTag[] = [];
  let totalWeight = 0;

  for (const rule of TAG_RULES) {
    if (rule.pattern.test(text)) {
      matchedTags.push(rule.tag);
      totalWeight += rule.weight;
    }
  }

  const tags = matchedTags.length > 0 ? matchedTags : (["unclear"] as FeedbackTag[]);
  const confidence = matchedTags.length > 0
    ? Math.min(totalWeight / TAG_RULES.length + 0.3, 1)
    : 0.1;

  return {
    text,
    tags,
    confidence: Math.round(confidence * 1000) / 1000,
    needsManualReview: confidence < 0.5 || tags.includes("unclear"),
  };
}

function buildSummary(tagged: TaggedFeedback[]): Record<FeedbackTag, number> {
  const summary = {} as Record<FeedbackTag, number>;
  for (const item of tagged) {
    for (const tag of item.tags) {
      summary[tag] = (summary[tag] ?? 0) + 1;
    }
  }
  return summary;
}

@Injectable()
export class FeedbackTaggerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async tag(dto: TagFeedbackDto, actorKey: string) {
    const taggedItems = dto.feedbackItems.map(tagItem);
    const tagSummary = buildSummary(taggedItems);
    const needsReviewCount = taggedItems.filter((t) => t.needsManualReview).length;

    const record = await this.prisma.feedbackTagBatch.upsert({
      where: { batchId: dto.batchId },
      create: {
        batchId: dto.batchId,
        itemCount: dto.feedbackItems.length,
        taggedItems: taggedItems as unknown as Prisma.InputJsonValue,
        tagSummary: tagSummary as unknown as Prisma.InputJsonValue,
        needsReviewCount,
        modelVersion: FEEDBACK_TAGGER_MODEL_VERSION,
      },
      update: {
        itemCount: dto.feedbackItems.length,
        taggedItems: taggedItems as unknown as Prisma.InputJsonValue,
        tagSummary: tagSummary as unknown as Prisma.InputJsonValue,
        needsReviewCount,
        modelVersion: FEEDBACK_TAGGER_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "feedback.batch.tagged",
      resourceType: "feedback_tag_batch",
      resourceId: record.id,
      summary: `Batch ${dto.batchId}: ${dto.feedbackItems.length} item(s) tagged, ${needsReviewCount} need review`,
      metadata: { modelVersion: FEEDBACK_TAGGER_MODEL_VERSION, tagSummary } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByBatch(batchId: string) {
    const record = await this.prisma.feedbackTagBatch.findUnique({ where: { batchId } });
    if (!record) throw new NotFoundException("No feedback tag batch found for this ID");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.feedbackTagBatch.findMany({ orderBy: { createdAt: "desc" } });
  }
}

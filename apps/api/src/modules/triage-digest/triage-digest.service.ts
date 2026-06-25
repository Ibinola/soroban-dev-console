/**
 * AI-933: Create maintainer triage digests.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray, IsNumber, IsOptional } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const TRIAGE_DIGEST_MODEL_VERSION = "rules-v1.0.0" as const;

export interface IssueSnapshot {
  number: number;
  title: string;
  state: "open" | "blocked" | "in_progress" | "needs_attention";
  assignee?: string;
  ageHours: number;
}

export interface DigestHighlight {
  category: string;
  count: number;
  items: string[];
}

export class GenerateTriageDigestDto {
  @IsString()
  digestId!: string;

  @IsArray()
  issues!: IssueSnapshot[];

  @IsOptional()
  @IsNumber()
  staleThresholdHours?: number;
}

function classify(issues: IssueSnapshot[], staleThresholdHours: number): {
  changed: IssueSnapshot[];
  blocked: IssueSnapshot[];
  needsAttention: IssueSnapshot[];
  stale: IssueSnapshot[];
} {
  return {
    changed: issues.filter((i) => i.state === "in_progress"),
    blocked: issues.filter((i) => i.state === "blocked"),
    needsAttention: issues.filter((i) => i.state === "needs_attention"),
    stale: issues.filter((i) => i.state === "open" && i.ageHours >= staleThresholdHours),
  };
}

function buildHighlights(classified: ReturnType<typeof classify>): DigestHighlight[] {
  const highlights: DigestHighlight[] = [];

  const add = (category: string, items: IssueSnapshot[]) => {
    if (items.length > 0) {
      highlights.push({
        category,
        count: items.length,
        items: items.map((i) => `#${i.number}: ${i.title}${i.assignee ? ` (@${i.assignee})` : ""}`),
      });
    }
  };

  add("Needs Attention", classified.needsAttention);
  add("Blocked", classified.blocked);
  add("Stale (no recent activity)", classified.stale);
  add("In Progress", classified.changed);

  return highlights;
}

function buildText(highlights: DigestHighlight[]): string {
  const lines = ["# Maintainer Triage Digest", ""];
  for (const h of highlights) {
    lines.push(`## ${h.category} (${h.count})`);
    for (const item of h.items) lines.push(`- ${item}`);
    lines.push("");
  }
  if (highlights.length === 0) lines.push("No issues require immediate attention.");
  return lines.join("\n").trimEnd();
}

@Injectable()
export class TriageDigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async generate(dto: GenerateTriageDigestDto, actorKey: string) {
    const staleThreshold = dto.staleThresholdHours ?? 72;
    const classified = classify(dto.issues, staleThreshold);
    const highlights = buildHighlights(classified);
    const digestText = buildText(highlights);
    const actionableCount = classified.blocked.length + classified.needsAttention.length + classified.stale.length;

    const record = await this.prisma.triageDigest.upsert({
      where: { digestId: dto.digestId },
      create: {
        digestId: dto.digestId,
        issueCount: dto.issues.length,
        highlights: highlights as unknown as Prisma.InputJsonValue,
        digestText,
        actionableCount,
        modelVersion: TRIAGE_DIGEST_MODEL_VERSION,
      },
      update: {
        issueCount: dto.issues.length,
        highlights: highlights as unknown as Prisma.InputJsonValue,
        digestText,
        actionableCount,
        modelVersion: TRIAGE_DIGEST_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "triage.digest.generated",
      resourceType: "triage_digest",
      resourceId: record.id,
      summary: `Digest ${dto.digestId}: ${dto.issues.length} issue(s), ${actionableCount} actionable`,
      metadata: { modelVersion: TRIAGE_DIGEST_MODEL_VERSION, actionableCount } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByDigestId(digestId: string) {
    const record = await this.prisma.triageDigest.findUnique({ where: { digestId } });
    if (!record) throw new NotFoundException("No triage digest found for this digest ID");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.triageDigest.findMany({ orderBy: { createdAt: "desc" } });
  }
}

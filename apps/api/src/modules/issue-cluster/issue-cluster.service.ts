/**
 * AI-921: Cluster related issues for maintainer triage.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const CLUSTER_MODEL_VERSION = "rules-v1.0.0" as const;

export class ClusterIssuesDto {
  @IsArray()
  issueRefs!: string[];

  @IsString()
  theme!: string;
}

function computeClusterKey(issueRefs: string[], theme: string): string {
  const sorted = [...issueRefs].sort().join(",");
  return `${theme}:${sorted}`.slice(0, 128);
}

function computeLabel(issueRefs: string[], theme: string): string {
  return `${theme} cluster (${issueRefs.length} issues)`;
}

function computeConfidence(issueRefs: string[], theme: string): number {
  // Naive confidence: higher with more issues sharing the theme prefix
  const themeMatches = issueRefs.filter((ref) =>
    ref.toLowerCase().includes(theme.toLowerCase()),
  ).length;
  const ratio = issueRefs.length > 0 ? themeMatches / issueRefs.length : 0;
  return Math.round((0.4 + ratio * 0.6) * 1000) / 1000;
}

@Injectable()
export class IssueClusterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async cluster(dto: ClusterIssuesDto, actorKey: string) {
    const clusterKey = computeClusterKey(dto.issueRefs, dto.theme);
    const label = computeLabel(dto.issueRefs, dto.theme);
    const confidence = computeConfidence(dto.issueRefs, dto.theme);

    const record = await this.prisma.issueCluster.upsert({
      where: { clusterKey },
      create: {
        clusterKey,
        label,
        issueRefs: dto.issueRefs as unknown as Prisma.InputJsonValue,
        theme: dto.theme,
        confidence,
        modelVersion: CLUSTER_MODEL_VERSION,
      },
      update: {
        label,
        issueRefs: dto.issueRefs as unknown as Prisma.InputJsonValue,
        theme: dto.theme,
        confidence,
        modelVersion: CLUSTER_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "issue.clustered",
      resourceType: "issue_cluster",
      resourceId: record.id,
      summary: `Clustered ${dto.issueRefs.length} issues under theme "${dto.theme}"`,
      metadata: { modelVersion: CLUSTER_MODEL_VERSION } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getCluster(clusterKey: string) {
    const record = await this.prisma.issueCluster.findUnique({ where: { clusterKey } });
    if (!record) throw new NotFoundException("Cluster not found");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.issueCluster.findMany({ orderBy: { createdAt: "desc" } });
  }
}

/**
 * AI-925: Explain contract diffs in plain language.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray, IsOptional } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const CONTRACT_DIFF_MODEL_VERSION = "rules-v1.0.0" as const;

export interface DiffHunk {
  section: string;
  before: string;
  after: string;
}

export interface PlainExplanation {
  section: string;
  change: string;
  impact: string;
  breakingChange: boolean;
}

export class ExplainContractDiffDto {
  @IsString()
  diffId!: string;

  @IsString()
  contractName!: string;

  @IsArray()
  hunks!: DiffHunk[];

  @IsOptional()
  @IsString()
  context?: string;
}

const SECTION_PATTERNS: Array<{ pattern: RegExp; explain: (before: string, after: string) => { change: string; impact: string; breaking: boolean } }> = [
  {
    pattern: /fn\s+\w+|pub fn/,
    explain: (before, after) => {
      const addedFns = after.split("\n").filter((l) => l.trim().startsWith("pub fn") && !before.includes(l.trim()));
      const removedFns = before.split("\n").filter((l) => l.trim().startsWith("pub fn") && !after.includes(l.trim()));
      const change = [
        addedFns.length > 0 ? `Added ${addedFns.length} function(s)` : "",
        removedFns.length > 0 ? `Removed ${removedFns.length} function(s)` : "",
      ].filter(Boolean).join("; ") || "Modified function signature or body";
      return { change, impact: "Callers may need to update invocations", breaking: removedFns.length > 0 };
    },
  },
  {
    pattern: /struct\s+\w+|enum\s+\w+/,
    explain: (_before, _after) => ({
      change: "Data type definition changed",
      impact: "Serialization format may differ; on-chain state could be affected",
      breaking: true,
    }),
  },
  {
    pattern: /#\[contracttype\]|#\[contract\]/,
    explain: (_before, _after) => ({
      change: "Contract attribute or type annotation modified",
      impact: "ABI compatibility may be affected",
      breaking: true,
    }),
  },
];

function explainHunk(hunk: DiffHunk): PlainExplanation {
  for (const rule of SECTION_PATTERNS) {
    if (rule.pattern.test(hunk.before) || rule.pattern.test(hunk.after)) {
      const { change, impact, breaking } = rule.explain(hunk.before, hunk.after);
      return { section: hunk.section, change, impact, breakingChange: breaking };
    }
  }
  return {
    section: hunk.section,
    change: "Minor change in logic or comments",
    impact: "Behavior may differ subtly; review carefully",
    breakingChange: false,
  };
}

@Injectable()
export class ContractDiffExplainerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async explain(dto: ExplainContractDiffDto, actorKey: string) {
    const explanations = dto.hunks.map(explainHunk);
    const breakingCount = explanations.filter((e) => e.breakingChange).length;

    const record = await this.prisma.contractDiffExplanation.upsert({
      where: { diffId: dto.diffId },
      create: {
        diffId: dto.diffId,
        contractName: dto.contractName,
        explanations: explanations as unknown as Prisma.InputJsonValue,
        breakingCount,
        modelVersion: CONTRACT_DIFF_MODEL_VERSION,
      },
      update: {
        contractName: dto.contractName,
        explanations: explanations as unknown as Prisma.InputJsonValue,
        breakingCount,
        modelVersion: CONTRACT_DIFF_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "contract.diff.explained",
      resourceType: "contract_diff_explanation",
      resourceId: record.id,
      summary: `Contract ${dto.contractName} diff ${dto.diffId}: ${explanations.length} hunk(s), ${breakingCount} breaking`,
      metadata: { modelVersion: CONTRACT_DIFF_MODEL_VERSION, breakingCount } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByDiff(diffId: string) {
    const record = await this.prisma.contractDiffExplanation.findUnique({ where: { diffId } });
    if (!record) throw new NotFoundException("No contract diff explanation found for this diff");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.contractDiffExplanation.findMany({ orderBy: { createdAt: "desc" } });
  }
}

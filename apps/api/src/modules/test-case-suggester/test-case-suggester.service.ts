/**
 * AI-922: Suggest test cases from change diffs.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const SUGGESTER_MODEL_VERSION = "rules-v1.0.0" as const;

export interface TestSuggestion {
  description: string;
  targetFile: string;
  testType: "unit" | "integration" | "e2e";
}

export class SuggestTestCasesDto {
  @IsString()
  pullRequestId!: string;

  @IsArray()
  changedFiles!: string[];
}

function suggestForFile(filePath: string): TestSuggestion | null {
  if (filePath.endsWith(".service.ts")) {
    return {
      description: `Unit test for ${filePath}`,
      targetFile: filePath.replace(".service.ts", ".service.spec.ts"),
      testType: "unit",
    };
  }
  if (filePath.endsWith(".controller.ts")) {
    return {
      description: `Integration test for ${filePath}`,
      targetFile: filePath.replace(".controller.ts", ".controller.spec.ts"),
      testType: "integration",
    };
  }
  if (filePath.endsWith(".module.ts") || filePath.endsWith(".ts")) {
    return {
      description: `Unit test for ${filePath}`,
      targetFile: filePath.replace(".ts", ".spec.ts"),
      testType: "unit",
    };
  }
  return null;
}

@Injectable()
export class TestCaseSuggesterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async suggest(dto: SuggestTestCasesDto, actorKey: string) {
    const suggestions: TestSuggestion[] = dto.changedFiles
      .map(suggestForFile)
      .filter((s): s is TestSuggestion => s !== null);

    const diffSummary = `${dto.changedFiles.length} files changed: ${dto.changedFiles.slice(0, 3).join(", ")}${dto.changedFiles.length > 3 ? "..." : ""}`;

    const record = await this.prisma.testCaseSuggestion.create({
      data: {
        pullRequestId: dto.pullRequestId,
        suggestions: suggestions as unknown as Prisma.InputJsonValue,
        diffSummary,
        modelVersion: SUGGESTER_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "test.cases.suggested",
      resourceType: "test_case_suggestion",
      resourceId: record.id,
      summary: `${suggestions.length} test suggestions for PR ${dto.pullRequestId}`,
      metadata: { modelVersion: SUGGESTER_MODEL_VERSION } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByPr(pullRequestId: string) {
    const record = await this.prisma.testCaseSuggestion.findFirst({
      where: { pullRequestId },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw new NotFoundException("No suggestions found for this PR");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.testCaseSuggestion.findMany({ orderBy: { createdAt: "desc" } });
  }
}

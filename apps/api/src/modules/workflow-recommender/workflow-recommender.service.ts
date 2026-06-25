/**
 * AI-930: Recommend the best workflow for a task.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsOptional, IsArray } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const WORKFLOW_RECOMMENDER_MODEL_VERSION = "rules-v1.0.0" as const;

export interface WorkflowStep {
  order: number;
  action: string;
  command?: string;
  docs?: string;
}

export interface WorkflowRecommendation {
  workflowName: string;
  description: string;
  steps: WorkflowStep[];
  relevanceScore: number;
}

export class RecommendWorkflowDto {
  @IsString()
  taskId!: string;

  @IsString()
  taskDescription!: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

const WORKFLOW_CATALOG: Array<{
  name: string;
  description: string;
  keywords: string[];
  steps: WorkflowStep[];
}> = [
  {
    name: "fix-and-pr",
    description: "Standard bug fix or feature implementation workflow",
    keywords: ["fix", "bug", "implement", "feature", "add", "change"],
    steps: [
      { order: 1, action: "Create a feature branch", command: "git checkout -b fix/issue-<number>-<description>" },
      { order: 2, action: "Implement the fix following project conventions" },
      { order: 3, action: "Run lint", command: "npm run lint -w api" },
      { order: 4, action: "Run type check", command: "npm run typecheck -w api" },
      { order: 5, action: "Commit and push", command: "git push origin <branch>" },
      { order: 6, action: "Open a PR to the base repo", docs: "CONTRIBUTING.md" },
    ],
  },
  {
    name: "database-migration",
    description: "Workflow for adding or modifying Prisma schema models",
    keywords: ["database", "schema", "migration", "prisma", "model", "table"],
    steps: [
      { order: 1, action: "Update apps/api/prisma/schema.prisma" },
      { order: 2, action: "Generate Prisma client", command: "npx prisma generate", docs: "apps/api" },
      { order: 3, action: "Push schema changes", command: "npx prisma db push" },
      { order: 4, action: "Update affected services and tests" },
      { order: 5, action: "Run tests", command: "npm run test -w api" },
    ],
  },
  {
    name: "add-api-module",
    description: "Workflow for adding a new NestJS module to the API",
    keywords: ["module", "service", "controller", "nestjs", "api", "endpoint"],
    steps: [
      { order: 1, action: "Create module directory under apps/api/src/modules/<name>" },
      { order: 2, action: "Create service, controller, and module files" },
      { order: 3, action: "Register module in app.module.ts" },
      { order: 4, action: "Add Prisma schema model if persistence is needed" },
      { order: 5, action: "Write regression spec" },
      { order: 6, action: "Run lint and typecheck", command: "npm run lint -w api && npm run typecheck -w api" },
    ],
  },
  {
    name: "debug-rpc",
    description: "Workflow for diagnosing RPC proxy or contract interaction issues",
    keywords: ["rpc", "contract", "transaction", "stellar", "soroban", "debug"],
    steps: [
      { order: 1, action: "Check RPC proxy logs for correlation IDs" },
      { order: 2, action: "Verify network endpoints in .env" },
      { order: 3, action: "Test with health endpoint", command: "curl http://localhost:4000/health" },
      { order: 4, action: "Inspect rpc module", docs: "apps/api/src/modules/rpc" },
    ],
  },
];

function scoreWorkflow(catalog: typeof WORKFLOW_CATALOG[0], task: string, tags: string[]): number {
  const lower = task.toLowerCase();
  const allTerms = [...tags.map((t) => t.toLowerCase()), ...lower.split(/\s+/)];
  const hits = catalog.keywords.filter((kw) => allTerms.some((term) => term.includes(kw) || kw.includes(term)));
  return hits.length / catalog.keywords.length;
}

function recommend(taskDescription: string, tags: string[]): WorkflowRecommendation[] {
  return WORKFLOW_CATALOG
    .map((w) => ({ ...w, relevanceScore: scoreWorkflow(w, taskDescription, tags) }))
    .filter((w) => w.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .map(({ name, description, steps, relevanceScore }) => ({
      workflowName: name,
      description,
      steps,
      relevanceScore: Math.round(relevanceScore * 1000) / 1000,
    }));
}

@Injectable()
export class WorkflowRecommenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async recommend(dto: RecommendWorkflowDto, actorKey: string) {
    const recommendations = recommend(dto.taskDescription, dto.tags ?? []);
    const topWorkflow = recommendations[0]?.workflowName ?? "fix-and-pr";

    const record = await this.prisma.workflowRecommendation.upsert({
      where: { taskId: dto.taskId },
      create: {
        taskId: dto.taskId,
        taskDescription: dto.taskDescription,
        recommendations: recommendations as unknown as Prisma.InputJsonValue,
        topWorkflow,
        modelVersion: WORKFLOW_RECOMMENDER_MODEL_VERSION,
      },
      update: {
        taskDescription: dto.taskDescription,
        recommendations: recommendations as unknown as Prisma.InputJsonValue,
        topWorkflow,
        modelVersion: WORKFLOW_RECOMMENDER_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "workflow.recommended",
      resourceType: "workflow_recommendation",
      resourceId: record.id,
      summary: `Task ${dto.taskId} matched ${recommendations.length} workflow(s); top: ${topWorkflow}`,
      metadata: { modelVersion: WORKFLOW_RECOMMENDER_MODEL_VERSION, topWorkflow } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByTask(taskId: string) {
    const record = await this.prisma.workflowRecommendation.findUnique({ where: { taskId } });
    if (!record) throw new NotFoundException("No workflow recommendation found for this task");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.workflowRecommendation.findMany({ orderBy: { createdAt: "desc" } });
  }
}

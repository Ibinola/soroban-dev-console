/**
 * AI-928: Suggest fixture synthesis for tests.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray, IsOptional } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const FIXTURE_SYNTHESIS_MODEL_VERSION = "rules-v1.0.0" as const;

export interface FixtureSuggestion {
  name: string;
  type: string;
  description: string;
  template: Record<string, unknown>;
}

export class SynthesizeFixturesDto {
  @IsString()
  contextId!: string;

  @IsArray()
  targetFlows!: string[];

  @IsOptional()
  @IsArray()
  existingFixtures?: string[];
}

function inferType(flow: string): string {
  const f = flow.toLowerCase();
  if (f.includes("workspace")) return "workspace";
  if (f.includes("ticket") || f.includes("support")) return "support_ticket";
  if (f.includes("wave") || f.includes("appeal")) return "wave_entry";
  if (f.includes("budget")) return "budget_entry";
  if (f.includes("rpc") || f.includes("contract")) return "rpc_request";
  return "generic";
}

function buildTemplate(type: string): Record<string, unknown> {
  const templates: Record<string, Record<string, unknown>> = {
    workspace: { id: "ws-fixture-001", name: "test-workspace", network: "testnet", ownerId: "owner-key-fixture" },
    support_ticket: { id: "tkt-fixture-001", subject: "Test ticket", category: "general", priority: "normal", status: "open" },
    wave_entry: { id: "wave-fixture-001", contributorKey: "contributor-fixture", waveId: "wave-001", status: "pending" },
    budget_entry: { id: "budget-fixture-001", organizationId: "org-fixture", limit: 1000, used: 0, currency: "XLM" },
    rpc_request: { id: "rpc-fixture-001", method: "simulateTransaction", network: "testnet", params: {} },
    generic: { id: "fixture-001", type: "generic", data: {} },
  };
  return templates[type] ?? templates.generic;
}

function synthesize(flows: string[], existing: string[]): FixtureSuggestion[] {
  const covered = new Set(existing.map((f) => f.toLowerCase()));
  return flows
    .filter((flow) => !covered.has(flow.toLowerCase()))
    .map((flow) => {
      const type = inferType(flow);
      return {
        name: `${type}-${flow.toLowerCase().replace(/\s+/g, "-")}-fixture`,
        type,
        description: `Deterministic fixture for the "${flow}" flow`,
        template: buildTemplate(type),
      };
    });
}

@Injectable()
export class FixtureSynthesisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async synthesize(dto: SynthesizeFixturesDto, actorKey: string) {
    const suggestions = synthesize(dto.targetFlows, dto.existingFixtures ?? []);

    const record = await this.prisma.fixtureSynthesisResult.upsert({
      where: { contextId: dto.contextId },
      create: {
        contextId: dto.contextId,
        targetFlows: dto.targetFlows as unknown as Prisma.InputJsonValue,
        suggestions: suggestions as unknown as Prisma.InputJsonValue,
        modelVersion: FIXTURE_SYNTHESIS_MODEL_VERSION,
      },
      update: {
        targetFlows: dto.targetFlows as unknown as Prisma.InputJsonValue,
        suggestions: suggestions as unknown as Prisma.InputJsonValue,
        modelVersion: FIXTURE_SYNTHESIS_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "fixture.synthesis.generated",
      resourceType: "fixture_synthesis_result",
      resourceId: record.id,
      summary: `Generated ${suggestions.length} fixture suggestion(s) for context ${dto.contextId}`,
      metadata: { modelVersion: FIXTURE_SYNTHESIS_MODEL_VERSION, count: suggestions.length } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByContext(contextId: string) {
    const record = await this.prisma.fixtureSynthesisResult.findUnique({ where: { contextId } });
    if (!record) throw new NotFoundException("No fixture synthesis result found for this context");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.fixtureSynthesisResult.findMany({ orderBy: { createdAt: "desc" } });
  }
}

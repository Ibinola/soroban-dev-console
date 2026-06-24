/**
 * AI-201: Versioned prompt and policy registry for appeal evaluation.
 *
 * Stores prompts, policies, thresholds, and model version pins.
 * Each key can have multiple versions; only one is active at a time.
 * Human operators can activate, inspect, or roll back any version.
 */

import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import type {
  CreatePromptPolicyPayload,
  PromptPolicyEntrySummary,
} from "@devconsole/api-contracts";

@Injectable()
export class PromptPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(payload: CreatePromptPolicyPayload): Promise<PromptPolicyEntrySummary> {
    const latest = await this.prisma.promptPolicyEntry.findFirst({
      where: { key: payload.key },
      orderBy: { version: "desc" },
    });
    const nextVersion = latest ? latest.version + 1 : 1;

    const entry = await this.prisma.promptPolicyEntry.create({
      data: {
        key: payload.key,
        version: nextVersion,
        kind: payload.kind,
        content: payload.content,
        notes: payload.notes ?? null,
        publishedBy: payload.publishedBy ?? null,
        isActive: false,
      },
    });

    void this.audit.log({
      actor: payload.publishedBy ?? "system",
      action: "prompt_policy.created",
      resourceType: "prompt_policy_entry",
      resourceId: entry.id,
      summary: `Created ${entry.kind} "${entry.key}" v${entry.version}`,
    });

    return this.toSummary(entry);
  }

  async activate(
    key: string,
    version: number,
    publishedBy?: string,
  ): Promise<PromptPolicyEntrySummary> {
    const entry = await this.prisma.promptPolicyEntry.findUnique({
      where: { key_version: { key, version } },
    });
    if (!entry) throw new NotFoundException(`Entry "${key}" v${version} not found`);

    // Deactivate all other versions for this key, then activate target
    await this.prisma.$transaction([
      this.prisma.promptPolicyEntry.updateMany({
        where: { key, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.promptPolicyEntry.update({
        where: { key_version: { key, version } },
        data: { isActive: true, publishedBy: publishedBy ?? entry.publishedBy },
      }),
    ]);

    void this.audit.log({
      actor: publishedBy ?? "system",
      action: "prompt_policy.activated",
      resourceType: "prompt_policy_entry",
      resourceId: entry.id,
      summary: `Activated ${entry.kind} "${key}" v${version}`,
    });

    return this.toSummary(
      (await this.prisma.promptPolicyEntry.findUnique({
        where: { key_version: { key, version } },
      }))!,
    );
  }

  async getActive(key: string): Promise<PromptPolicyEntrySummary> {
    const entry = await this.prisma.promptPolicyEntry.findFirst({
      where: { key, isActive: true },
    });
    if (!entry) throw new NotFoundException(`No active entry found for key "${key}"`);
    return this.toSummary(entry);
  }

  async listByKey(key: string): Promise<PromptPolicyEntrySummary[]> {
    const entries = await this.prisma.promptPolicyEntry.findMany({
      where: { key },
      orderBy: { version: "desc" },
    });
    return entries.map((e) => this.toSummary(e));
  }

  async listByKind(kind: string): Promise<PromptPolicyEntrySummary[]> {
    const entries = await this.prisma.promptPolicyEntry.findMany({
      where: { kind },
      orderBy: [{ key: "asc" }, { version: "desc" }],
    });
    return entries.map((e) => this.toSummary(e));
  }

  private toSummary(e: {
    id: string;
    key: string;
    version: number;
    kind: string;
    content: string;
    isActive: boolean;
    publishedBy: string | null;
    notes: string | null;
    createdAt: Date;
  }): PromptPolicyEntrySummary {
    return {
      id: e.id,
      key: e.key,
      version: e.version,
      kind: e.kind as PromptPolicyEntrySummary["kind"],
      content: e.content,
      isActive: e.isActive,
      publishedBy: e.publishedBy,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
    };
  }
}

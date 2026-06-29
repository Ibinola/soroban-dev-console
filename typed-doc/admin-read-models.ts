/**
 * Issue #504 (BE-335): Build searchable admin read models
 *
 * Problem: Admin dashboard queries require expensive joins across
 * workspaces, support tickets, audit logs, budgets, and verification
 * events. With SQLite, these joins degrade dashboard performance.
 *
 * Solution: Precompute denormalized read models that are materialised
 * on write and served via a simple read API.
 */

// ---- Prisma schema additions ----
model AdminWorkspaceSummary {
  id          String   @id
  ownerKey    String   @map("owner_key")
  name        String
  contractCount Int    @default(0) @map("contract_count")
  shareCount  Int      @default(0) @map("share_count")
  artifactCount Int    @default(0) @map("artifact_count")
  lastActive  DateTime @map("last_active")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([ownerKey])
  @@index([lastActive])
  @@map("admin_workspace_summaries")
}

model AdminSupportSummary {
  id            String   @id
  totalTickets  Int      @default(0) @map("total_tickets")
  openTickets   Int      @default(0) @map("open_tickets")
  resolvedTickets Int   @default(0) @map("resolved_tickets")
  byCategory    Json                @map("by_category")   // {"verification": 5, "bug": 2, ...}
  updatedAt     DateTime @default(now()) @map("updated_at")

  @@map("admin_support_summaries")
}

model AdminBudgetSummary {
  id              String   @id
  organizationId  String   @unique @map("organization_id")
  capPoints       Int      @default(0) @map("cap_points")
  usedPoints      Int      @default(0) @map("used_points")
  reservedPoints  Int      @default(0) @map("reserved_points")
  utilizationPct  Float    @default(0) @map("utilization_pct")
  updatedAt       DateTime @default(now()) @map("updated_at")

  @@map("admin_budget_summaries")
}

// ---- Admin read-model service ----
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";

@Injectable()
export class AdminReadModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshWorkspaceSummary(workspaceId: string): Promise<void> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: { select: { savedContracts: true, shares: true, artifacts: true } },
      },
    });
    if (!ws) return;

    await this.prisma.adminWorkspaceSummary.upsert({
      where: { id: workspaceId },
      update: {
        contractCount: ws._count.savedContracts,
        shareCount: ws._count.shares,
        artifactCount: ws._count.artifacts,
        lastActive: ws.updatedAt,
      },
      create: {
        id: workspaceId,
        ownerKey: ws.ownerKey,
        name: ws.name,
        contractCount: ws._count.savedContracts,
        shareCount: ws._count.shares,
        artifactCount: ws._count.artifacts,
        lastActive: ws.updatedAt,
      },
    });
  }

  async refreshSupportSummary(): Promise<void> {
    const tickets = await this.prisma.supportTicket.groupBy({
      by: ["category", "status"],
      _count: { id: true },
    });

    const byCategory: Record<string, number> = {};
    let total = 0, open = 0, resolved = 0;

    for (const t of tickets) {
      const key = `${t.category}:${t.status}`;
      byCategory[key] = t._count.id;
      total += t._count.id;
      if (t.status === "open") open += t._count.id;
      if (t.status === "resolved") resolved += t._count.id;
    }

    await this.prisma.adminSupportSummary.upsert({
      where: { id: "global" },
      update: { totalTickets: total, openTickets: open, resolvedTickets: resolved, byCategory },
      create: { id: "global", totalTickets: total, openTickets: open, resolvedTickets: resolved, byCategory },
    });
  }

  async refreshBudgetSummaries(): Promise<void> {
    const budgets = await this.prisma.organizationBudget.findMany();
    for (const b of budgets) {
      const pct = b.capPoints > 0 ? (b.usedPoints + b.reservedPoints) / b.capPoints : 0;
      await this.prisma.adminBudgetSummary.upsert({
        where: { organizationId: b.organizationId },
        update: {
          capPoints: b.capPoints,
          usedPoints: b.usedPoints,
          reservedPoints: b.reservedPoints,
          utilizationPct: pct,
        },
        create: {
          id: b.id,
          organizationId: b.organizationId,
          capPoints: b.capPoints,
          usedPoints: b.usedPoints,
          reservedPoints: b.reservedPoints,
          utilizationPct: pct,
        },
      });
    }
  }

  async getWorkspaceSummaries(limit = 50, offset = 0) {
    return this.prisma.adminWorkspaceSummary.findMany({
      orderBy: { lastActive: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async getSupportSummary() {
    return this.prisma.adminSupportSummary.findUnique({ where: { id: "global" } });
  }

  async getBudgetSummaries() {
    return this.prisma.adminBudgetSummary.findMany({
      orderBy: { utilizationPct: "desc" },
    });
  }
}

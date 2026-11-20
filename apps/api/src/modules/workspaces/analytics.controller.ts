import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminKeyGuard } from "../../common/guards/admin-key.guard.js";
import { PrismaService } from "../../lib/prisma.service.js";
import {
  TtlCache,
  aggregateWorkspaceAnalytics,
  type WorkspaceAnalytics,
} from "../../lib/workspace-analytics.js";

function parseDate(value: string | undefined, name: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${name} must be an ISO date`);
  return d;
}

@ApiTags("analytics")
@Controller("analytics")
@UseGuards(AdminKeyGuard)
export class AnalyticsController {
  private readonly cache = new TtlCache<WorkspaceAnalytics>();

  constructor(private readonly prisma: PrismaService) {}

  /** Aggregated workspace usage; admin only, cached for 5 minutes per range. */
  @ApiOperation({ summary: "Workspace usage analytics (admin)" })
  @Get("workspaces")
  workspaces(@Query("from") fromRaw?: string, @Query("to") toRaw?: string) {
    const from = parseDate(fromRaw, "from");
    const to = parseDate(toRaw, "to");
    return this.cache.getOrCompute(`${fromRaw ?? ""}|${toRaw ?? ""}`, async () => {
      const [workspaces, interactions] = await Promise.all([
        this.prisma.workspace.findMany({
          select: { id: true, createdAt: true, updatedAt: true },
        }),
        this.prisma.savedInteraction.findMany({
          select: { workspaceId: true, functionName: true, createdAt: true },
        }),
      ]);
      return aggregateWorkspaceAnalytics(workspaces, interactions, { from, to });
    });
  }
}

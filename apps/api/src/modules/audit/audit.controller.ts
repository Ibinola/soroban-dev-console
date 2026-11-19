import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import type { Response } from "express";
import { AuditService } from "../../lib/audit.service.js";
import { PruneAuditLogsDto } from "./prune-audit-logs.dto.js";
import { ListAuditDto } from "./audit.dto.js";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { resolveAuditExportFilters } from "./audit-export.js";
import { AdminKeyGuard } from "../../common/guards/admin-key.guard.js";
import { BadRequestException, Put } from "@nestjs/common";

import { ApiOperation, ApiTags } from "@nestjs/swagger";
@ApiTags("audit")
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // Issue #951: export sanitized audit logs as a downloadable JSON file.
  // Issue #1273: `?format=csv` returns the CSV document instead, same filters.
  @ApiOperation({ summary: "Export audit logs" })
  @Get("export")
  async exportAuditLogs(
    @Query(new ValidationPipe({ transform: true })) query: ListAuditDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (query.format?.toLowerCase() === "csv") {
      return this.writeCsvResponse(response, query);
    }

    const { filename, payload } = await this.auditService.exportToJson(
      resolveAuditExportFilters(query),
    );

    response.setHeader("Content-Type", "application/json");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    return payload;
  }

  // Issue #1128: export audit logs as a CSV file with customizable columns.
  // Issue #1273: also accepts the `from` / `to` / `type` filter aliases.
  @ApiOperation({ summary: "Export audit csv" })
  @Get("export/csv")
  async exportAuditCsv(
    @Query(new ValidationPipe({ transform: true })) query: ListAuditDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.writeCsvResponse(response, query);
  }

  /** Issue #1273: shared CSV response writer for both export routes. */
  private async writeCsvResponse(
    response: Response,
    query: ListAuditDto,
  ): Promise<string> {
    const { filename, csv } = await this.auditService.exportToCsv(
      resolveAuditExportFilters(query),
      query.columns
        ?.split(",")
        .map((column) => column.trim())
        .filter(Boolean),
    );

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    return csv;
  }

  /**
   * #1378: manifest for an export (normalized filters, generation time, row
   * count and SHA-256 of the export body). The body is not returned here; pass
   * `snapshotAt` (and the same filters) to the export route to get content that
   * matches the digest exactly.
   */
  @ApiOperation({ summary: "Export manifest" })
  @Get("export/manifest")
  async exportManifest(
    @Query(new ValidationPipe({ transform: true })) query: ListAuditDto,
    @Query("snapshotAt") snapshotAt?: string,
  ) {
    const format = query.format?.toLowerCase() === "json" ? "json" : "csv";
    const { manifest } = await this.auditService.exportWithManifest(
      format,
      resolveAuditExportFilters(query),
      query.columns?.split(",").map((c) => c.trim()).filter(Boolean),
      this.parseSnapshot(snapshotAt),
    );
    return { manifest, snapshotAt: manifest.generatedAt };
  }

  /** #1378: the same export, returned with its checksum headers. */
  @ApiOperation({ summary: "Export with checksum" })
  @Get("export/verified")
  async exportVerified(
    @Query(new ValidationPipe({ transform: true })) query: ListAuditDto,
    @Query("snapshotAt") snapshotAt: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const format = query.format?.toLowerCase() === "json" ? "json" : "csv";
    const { filename, body, manifest } = await this.auditService.exportWithManifest(
      format,
      resolveAuditExportFilters(query),
      query.columns?.split(",").map((c) => c.trim()).filter(Boolean),
      this.parseSnapshot(snapshotAt),
    );
    response.setHeader("Content-Type", format === "csv" ? "text/csv; charset=utf-8" : "application/json");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.setHeader("X-Audit-Export-SHA256", manifest.sha256);
    response.setHeader("X-Audit-Export-Rows", String(manifest.rowCount));
    return body;
  }

  private parseSnapshot(value?: string): Date | undefined {
    if (value === undefined || value === "") return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "snapshotAt must be an ISO 8601 date" });
    }
    return date;
  }

  /** #1376: read the effective audit retention (admin only). */
  @ApiOperation({ summary: "Get audit retention" })
  @UseGuards(AdminKeyGuard)
  @Get("retention")
  getRetention() {
    return this.auditService.getRetentionSettings();
  }

  /** #1376: change audit retention at runtime (admin only, bounded, audited). */
  @ApiOperation({ summary: "Set audit retention" })
  @UseGuards(AdminKeyGuard)
  @Put("retention")
  async setRetention(@Body() body: { retentionDays?: unknown }) {
    const updated = await this.auditService.setRetentionDays(body?.retentionDays, "admin");
    if (!updated) {
      const { min, max } = this.auditService.getRetentionSettings();
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `retentionDays must be a whole number between ${min} and ${max}`,
      });
    }
    return updated;
  }

  /** #1377: verify a stream's audit hash chain (admin only). */
  @ApiOperation({ summary: "Verify audit hash chain" })
  @UseGuards(AdminKeyGuard)
  @Get("verify")
  async verifyChain(
    @Query("resourceType") resourceType?: string,
    @Query("resourceId") resourceId?: string,
  ) {
    if (!resourceType || !resourceId) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "resourceType and resourceId are required",
      });
    }
    return this.auditService.verifyChain(resourceType, resourceId);
  }

  @ApiOperation({ summary: "Get audit logs" })
  @Get()
  async getAuditLogs(
    @Query(new ValidationPipe({ transform: true })) query: ListAuditDto,
  ) {
    // The export filter names and aliases (from/to/type) apply to the list too.
    const filters = resolveAuditExportFilters(query);
    try {
      return await this.auditService.query({
        ...filters,
        skip: query.skip,
        take: query.take,
        // Optional params are only forwarded when provided so callers using
        // legacy offset pagination / no time filter keep existing behavior.
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(query.limit !== undefined ? { limit: query.limit } : {}),
      });
    } catch (error) {
      if (error instanceof AuditCursorError) {
        // Field-level validation error for the cursor parameter.
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: error.message,
          details: { field: error.field, code: error.code },
        });
      }
      throw error;
    }
  }

  // Issue #1137: 24-hour summary metrics for security dashboards.
  @ApiOperation({ summary: "Summary" })
  @Get("summary")
  async summary() {
    return this.auditService.summary();
  }

  @ApiOperation({ summary: "Prune" })
  @Delete("prune")
  @HttpCode(HttpStatus.OK)
  prune(@Body() dto: PruneAuditLogsDto) {
    return this.auditService.prune(dto.olderThanDays);
  }

  // Backward-compatible legacy alias of POST /audit/prune, now also guarded.
  @ApiOperation({ summary: "Prune legacy" })
  @Delete("prune")
  @UseGuards(OwnerKeyGuard)
  @HttpCode(HttpStatus.OK)
  pruneLegacy(@Body() dto: PruneAuditLogsDto) {
    return this.auditService.prune(dto.olderThanDays);
  }
}

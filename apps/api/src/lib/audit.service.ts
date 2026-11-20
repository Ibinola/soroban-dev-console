/**
 * BE-011: Durable audit trail for workspace and share mutations.
 * BE-702: Retention policy and automated pruning.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service.js";
import {
  redactJsonValue,
  redactText,
} from "../modules/security/services/redaction.service.js";
import { buildAuditCsv } from "../modules/audit/audit-csv.js";
import {
  buildAuditExportManifest,
  normalizeAuditExportFilters,
  resolveAuditExportRowLimit,
  type AuditExportManifest,
} from "../modules/audit/audit-export.js";
import {
  auditStreamKey,
  computeAuditHash,
  verifyAuditChain,
  type ChainVerification,
} from "../modules/audit/audit-hash.js";
import { normalizePagination, toPaginatedEnvelope } from "./pagination.js";

export interface AuditEntry {
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
}

const CURSOR_DEFAULT_LIMIT = 50;
const CURSOR_MAX_LIMIT = 100;

/**
 * #1381: thrown for an invalid cursor; the HTTP layer turns it into a 400 with a
 * field-level error for `cursor`.
 */
export class AuditCursorError extends Error {
  readonly field = "cursor" as const;
  constructor(
    readonly code: "MALFORMED" | "TAMPERED" | "FILTER_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "AuditCursorError";
  }
}

export interface AuditSummary {
  windowHours: number;
  from: string;
  to: string;
  totalEvents: number;
  failedAuth: number;
  mutations: number;
}

/** Issue #1130: default retention is 30 days (configurable via env). */
const DEFAULT_RETENTION_DAYS = 30;

/** #1376: bounds for the runtime-adjustable retention, in days. */
export const MIN_RETENTION_DAYS = 1;
export const MAX_RETENTION_DAYS = 3650;

/** Parse a retention value; returns null unless it is an integer inside the bounds. */
export function parseRetentionDays(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= MIN_RETENTION_DAYS && n <= MAX_RETENTION_DAYS
    ? n
    : null;
}

/** Issue #1137: default rolling window for summary metrics. */
const DEFAULT_METRICS_WINDOW_HOURS = 24;

/** Issue #1137: event actions that denote a failed authentication attempt. */
const FAILED_AUTH_ACTIONS: ReadonlySet<string> = new Set([
  "auth.failed",
  "auth.rejected",
  "owner_key.failed",
  "token.rejected",
  "csrf.rejected",
  "cors.origin.rejected",
]);

/**
 * Issue #1137: actions treated as read-only. Everything else counts as a
 * data mutation for the summary metric.
 */
const READ_ACTION_PREFIXES: ReadonlyArray<string> = [
  "get",
  "list",
  "read",
  "resolve",
  "view",
  "fetch",
  "query",
  "export",
  "find",
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  /** Retention from the environment (or the default); the starting value. */
  private readonly configuredRetentionDays: number;
  /** #1376: runtime override set through the admin endpoint; null means "use the configured value". */
  private runtimeRetentionDays: number | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.configuredRetentionDays =
      parseRetentionDays(process.env.AUDIT_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS) ?? DEFAULT_RETENTION_DAYS;
  }

  /** The retention in effect now: the runtime value if one was set, else the configured one. */
  getRetentionDays(): number {
    return this.runtimeRetentionDays ?? this.configuredRetentionDays;
  }

  /** Read-only view for the admin endpoint. */
  getRetentionSettings() {
    return {
      retentionDays: this.getRetentionDays(),
      source: this.runtimeRetentionDays === null ? "configuration" : "runtime",
      configuredDays: this.configuredRetentionDays,
      min: MIN_RETENTION_DAYS,
      max: MAX_RETENTION_DAYS,
    };
  }

  /**
   * #1376: change the retention at runtime. The value is validated against the
   * bounds and the old and new values are written to audit history.
   * Returns null when the value is out of bounds (nothing is changed).
   */
  async setRetentionDays(value: unknown, actor = "admin") {
    const days = parseRetentionDays(value);
    if (days === null) return null;
    const previous = this.getRetentionDays();
    this.runtimeRetentionDays = days;
    await this.log({
      actor,
      action: "audit.retention.changed",
      resourceType: "audit_retention",
      resourceId: "retention",
      summary: `Audit retention changed from ${previous} to ${days} days`,
      metadata: { oldDays: previous, newDays: days },
    });
    return this.getRetentionSettings();
  }

  async log(entry: AuditEntry): Promise<void> {
    const createdAt = new Date();
    const metadata = entry.metadata
      ? (redactJsonValue(entry.metadata) as Prisma.InputJsonValue)
      : Prisma.JsonNull;
    const stream = auditStreamKey(entry.resourceType, entry.resourceId);

    // #1377: link to the previous event in this stream. The hash covers the
    // stored (redacted) metadata, so verification recomputes from stored data.
    const last = await this.prisma.auditLog.findFirst({
      where: { stream, hash: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { hash: true },
    });
    const prevHash = last?.hash ?? null;
    const hash = computeAuditHash(
      {
        id: "",
        actor: entry.actor,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: metadata === Prisma.JsonNull ? null : metadata,
        createdAt,
      },
      prevHash,
    );

    await this.prisma.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        summary: entry.summary ? redactText(entry.summary) : null,
        metadata,
        createdAt,
        stream,
        hash,
        prevHash,
      },
    });
  }

  /**
   * #1377: verify one stream's hash chain (oldest first). Reports the first
   * broken link and the range affected from there.
   */
  async verifyChain(resourceType: string, resourceId: string): Promise<ChainVerification> {
    const rows = await this.prisma.auditLog.findMany({
      where: { stream: auditStreamKey(resourceType, resourceId) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return verifyAuditChain(
      rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        metadata: row.metadata ?? null,
        createdAt: row.createdAt,
        hash: row.hash ?? null,
        prevHash: row.prevHash ?? null,
      })),
    );
  }

  async findByResource(resourceType: string, resourceId: string) {
    return this.prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAll(retentionDays?: number) {
    const days = retentionDays ?? this.getRetentionDays();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.prisma.auditLog.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
    });
  }

  async prune(olderThanDays?: number) {
    // Reads the effective runtime value at call time, so the scheduled prune
    // always honours the latest retention setting.
    const days = olderThanDays ?? this.getRetentionDays();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(
      `Pruned ${result.count} audit logs older than ${days} days`,
    );

    return { pruned: result.count, olderThanDays: days };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleScheduledPrune() {
    await this.prune();
  }

  /**
   * Issue #1137: Security audit summary over a rolling window (default 24h).
   * Events are classified as "failed auth" via the documented action set and
   * as "mutations" whenever the action does not start with a known read prefix.
   */
  async summary(
    windowHours: number = DEFAULT_METRICS_WINDOW_HOURS,
  ): Promise<AuditSummary> {
    const from = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const windowWhere = { createdAt: { gte: from } };
    const failedAuthActions = [...FAILED_AUTH_ACTIONS];

    const [totalEvents, failedAuth, mutations] = await Promise.all([
      this.prisma.auditLog.count({ where: windowWhere }),
      this.prisma.auditLog.count({
        where: { AND: [windowWhere, { action: { in: failedAuthActions } }] },
      }),
      this.prisma.auditLog.count({
        where: {
          AND: [
            windowWhere,
            {
              NOT: {
                OR: READ_ACTION_PREFIXES.map((prefix) => ({
                  action: { startsWith: prefix },
                })),
              },
            },
          ],
        },
      }),
    ]);

    return {
      windowHours,
      from: from.toISOString(),
      to: new Date().toISOString(),
      totalEvents,
      failedAuth,
      mutations,
    };
  }

  /**
   * Issue #951: Export audit logs to a sanitized JSON document for
   * compliance / security review. Payload values are re-redacted defensively
   * even though entries are already redacted at write time, in case older
   * rows predate a redaction pattern.
   */
  async exportToJson(filters?: {
    actor?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    createdAfter?: string;
    createdBefore?: string;
  }): Promise<{ filename: string; payload: string }> {
    const where = this.buildFilterWhere(filters);

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const sanitized = rows.map((row) => ({
      ...row,
      summary: row.summary ? redactText(row.summary) : row.summary,
      metadata: row.metadata ? redactJsonValue(row.metadata) : row.metadata,
    }));

    const date = new Date().toISOString().slice(0, 10);
    const filename = `audit-log-${date}.json`;
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: sanitized.length,
        records: sanitized,
      },
      null,
      2,
    );

    return { filename, payload };
  }

  /**
   * Issue #1128: Export audit logs as a CSV document with customizable column
   * selection. Respects the same active search and date filters as the JSON
   * export and the on-screen list.
   */
  async exportToCsv(
    filters?: {
      actor?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      createdAfter?: string;
      createdBefore?: string;
    },
    columns?: string[],
  ): Promise<{ filename: string; csv: string }> {
    const where = this.buildFilterWhere(filters);

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // Issue #1273: bound the number of exported rows (default 10,000).
      take: resolveAuditExportRowLimit(),
    });

    const csv = buildAuditCsv(rows, columns);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `audit-log-${date}.csv`;

    return { filename, csv };
  }

  /**
   * #1378: build an export and its manifest from one query, so the digest and
   * row count describe exactly the content returned. `snapshotAt` pins both the
   * upper time bound and the JSON `exportedAt`, so repeating the request with
   * the manifest's `snapshotAt` reproduces the same bytes.
   */
  async exportWithManifest(
    format: "csv" | "json",
    filters?: {
      actor?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      createdAfter?: string;
      createdBefore?: string;
    },
    columns?: string[],
    snapshotAt: Date = new Date(),
  ): Promise<{ filename: string; body: string; manifest: AuditExportManifest }> {
    const effective = normalizeAuditExportFilters({
      ...filters,
      createdBefore: filters?.createdBefore ?? snapshotAt.toISOString(),
    });
    const rows = await this.prisma.auditLog.findMany({
      where: this.buildFilterWhere(effective),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: resolveAuditExportRowLimit(),
    });

    const date = snapshotAt.toISOString().slice(0, 10);
    let body: string;
    if (format === "csv") {
      body = buildAuditCsv(rows, columns);
    } else {
      const records = rows.map((row) => ({
        ...row,
        summary: row.summary ? redactText(row.summary) : row.summary,
        metadata: row.metadata ? redactJsonValue(row.metadata) : row.metadata,
      }));
      body = JSON.stringify(
        { exportedAt: snapshotAt.toISOString(), count: records.length, records },
        null,
        2,
      );
    }
    const filename = `audit-log-${date}.${format}`;
    const manifest = buildAuditExportManifest({
      format,
      filename,
      filters: effective,
      rowCount: rows.length,
      content: body,
      generatedAt: snapshotAt,
    });
    return { filename, body, manifest };
  }

  private buildFilterWhere(filters?: {
    actor?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    createdAfter?: string;
    createdBefore?: string;
  }): Record<string, unknown> {
    const createdAtFilter =
      filters?.createdAfter || filters?.createdBefore
        ? {
            ...(filters.createdAfter && {
              gte: new Date(filters.createdAfter),
            }),
            ...(filters.createdBefore && {
              lte: new Date(filters.createdBefore),
            }),
          }
        : undefined;

    return {
      ...(filters?.actor && { actor: filters.actor }),
      ...(filters?.action && { action: filters.action }),
      ...(filters?.resourceType && { resourceType: filters.resourceType }),
      ...(filters?.resourceId && { resourceId: filters.resourceId }),
      ...(createdAtFilter && { createdAt: createdAtFilter }),
    };
  }

  async query(query: {
    actor?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    page?: number;
    pageSize?: number;
    skip?: number;
    take?: number;
    cursor?: string;
    limit?: number;
    createdAfter?: string;
    createdBefore?: string;
  }) {
    const {
      actor,
      action,
      resourceType,
      resourceId,
      createdAfter,
      createdBefore,
    } = query;

    const createdAtFilter =
      createdAfter || createdBefore
        ? {
            ...(createdAfter && { gte: new Date(createdAfter) }),
            ...(createdBefore && { lte: new Date(createdBefore) }),
          }
        : undefined;

    const where = {
      ...(actor && { actor }),
      ...(action && { action }),
      ...(resourceType && { resourceType }),
      ...(resourceId && { resourceId }),
      ...(createdAtFilter && { createdAt: createdAtFilter }),
    };

    // Cursor-based pagination: stable across concurrent inserts. Ordering is
    // (createdAt desc, id desc) so the cursor uniquely identifies a position.
    if (query.cursor !== undefined || (query.limit !== undefined && query.page === undefined && query.pageSize === undefined && query.skip === undefined && query.take === undefined)) {
      const limit = Math.min(
        Math.max(query.limit ?? CURSOR_DEFAULT_LIMIT, 1),
        CURSOR_MAX_LIMIT,
      );
      // The cursor is bound to the active filters, so it cannot be reused with others.
      const filterKey = { actor, action, resourceType, resourceId, createdAfter, createdBefore };
      let decoded: { createdAt: Date; id: string } | null = null;
      if (query.cursor) {
        const result = decodeAuditCursor(query.cursor, filterKey);
        if (!result.ok) throw new AuditCursorError(result.reason, result.message);
        decoded = result.position;
      }
      const cursorFilter = decoded
        ? {
            OR: [
              { createdAt: { lt: decoded.createdAt } },
              { createdAt: decoded.createdAt, id: { lt: decoded.id } },
            ],
          }
        : {};

      // Fetch one extra row to determine whether another page exists.
      const rows = await this.prisma.auditLog.findMany({
        where: { AND: [where, cursorFilter] },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const total = await this.prisma.auditLog.count({ where });

      return {
        data,
        meta: {
          total,
          page: 1,
          pageSize: limit,
          hasNext: hasMore,
        },
      };
    }

    // Page/offset-based pagination with standard paginated envelope.
    const { page, pageSize, skip, take } = normalizePagination({
      page: query.page,
      pageSize: query.pageSize ?? query.take ?? query.limit,
      skip: query.skip,
      take: query.take ?? query.limit,
    });

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return toPaginatedEnvelope(data, total, page, pageSize);
  }
}

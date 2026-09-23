/**
 * Issue #1128: CSV export with customizable column selection for the audit log.
 *
 * Columns mirror the audit management table: Timestamp, Event Type, User, IP,
 * Details. The transformer is a pure function so it can be unit-tested without
 * a database.
 */

import type { Prisma } from "@prisma/client";

export const AUDIT_CSV_COLUMNS = [
  "timestamp",
  "event",
  "user",
  "ip",
  "details",
] as const;

export type AuditCsvColumn = (typeof AUDIT_CSV_COLUMNS)[number];

const COLUMN_LABELS: Record<AuditCsvColumn, string> = {
  timestamp: "Timestamp",
  event: "Event Type",
  user: "User",
  ip: "IP",
  details: "Details",
};

export interface AuditCsvRow {
  createdAt: Date;
  action: string;
  actor: string;
  resourceType: string;
  summary?: string | null;
  metadata?: Prisma.JsonValue;
}

/**
 * Map a requested column list onto the allowed set. Unknown/duplicate entries
 * are dropped; an empty list yields every column. Matching is case-insensitive.
 */
export function resolveCsvColumns(selected?: string[]): AuditCsvColumn[] {
  if (!selected || selected.length === 0) {
    return [...AUDIT_CSV_COLUMNS];
  }

  const allowed = new Set<string>(AUDIT_CSV_COLUMNS);
  const result: AuditCsvColumn[] = [];
  for (const raw of selected) {
    const column = raw.trim().toLowerCase();
    if ((allowed as Set<string>).has(column) && !result.includes(column as AuditCsvColumn)) {
      result.push(column as AuditCsvColumn);
    }
  }
  return result.length > 0 ? result : [...AUDIT_CSV_COLUMNS];
}

/** Escape a single CSV cell: quote when it contains , " \n \r; double inner quotes. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function extractIp(row: AuditCsvRow): string {
  const metadata = row.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const record = metadata as Record<string, unknown>;
    const ip = record["ip"];
    if (typeof ip === "string") return ip;
    const nested = record["request"];
    if (nested && typeof nested === "object") {
      const nestedIp = (nested as Record<string, unknown>)["ip"];
      if (typeof nestedIp === "string") return nestedIp;
    }
  }
  return "";
}

/** Map an audit row to a CSV row for the selected columns (order preserved). */
export function auditRowToCsvColumns(
  row: AuditCsvRow,
  columns: AuditCsvColumn[],
): string[] {
  const cells: Record<AuditCsvColumn, () => string> = {
    timestamp: () => row.createdAt.toISOString(),
    event: () => row.action,
    user: () => row.actor,
    ip: () => extractIp(row),
    details: () => row.summary ?? "",
  };

  return columns.map((column) => escapeCsvCell(cells[column]()));
}

export function buildAuditCsv(rows: AuditCsvRow[], columns?: string[]): string {
  const resolved = resolveCsvColumns(columns);
  const header = resolved.map((column) => COLUMN_LABELS[column]).join(",");
  const body = rows
    .map((row) => auditRowToCsvColumns(row, resolved).join(","))
    .join("\n");
  return `${header}\n${body}`;
}
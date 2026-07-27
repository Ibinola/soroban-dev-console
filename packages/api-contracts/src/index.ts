// ── Audit Log ────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  summary: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AuditLogPagination {
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  pagination: AuditLogPagination;
}
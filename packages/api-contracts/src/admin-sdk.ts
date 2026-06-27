export interface AdminSdkConfig {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
}

export interface BudgetScopeSummary {
  id: string;
  organizationId: string;
  repoId: string | null;
  capPoints: number;
  usedPoints: number;
  reservedPoints: number;
  headroomPoints: number;
  updatedAt: string;
}

export interface ReservationSummary {
  id: string;
  scopeId: string;
  issueRef: string;
  points: number;
  status: "pending" | "active" | "released" | "cancelled";
  createdAt: string;
}

export interface LedgerBalance {
  contributorId: string;
  totalPoints: number;
  entryCount: number;
}

export interface VerificationRecord {
  id: string;
  contributorId: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt: string | null;
}

export interface AppealRecord {
  id: string;
  contributorId: string;
  issueRef: string;
  status: "open" | "under_review" | "approved" | "rejected";
  submittedAt: string;
  resolvedAt: string | null;
}

export interface WaveStateSummary {
  budgetScopeCount: number;
  activeReservationCount: number;
  contributorLedgerCount: number;
  openAppealCount: number;
  pendingVerificationCount: number;
  asOf: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  summary: string | null;
  createdAt: string;
}

export interface RuntimeConfigEntry {
  key: string;
  value: string;
  updatedAt: string;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  uptime: number;
  dbConnected: boolean;
  version: string;
}

export class AdminSdk {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(config: AdminSdkConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    };
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { headers: this.headers, signal: controller.signal });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AdminSdk GET ${path} failed: ${res.status} ${text}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AdminSdk POST ${path} failed: ${res.status} ${text}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AdminSdk PUT ${path} failed: ${res.status} ${text}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async del<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: this.headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AdminSdk DELETE ${path} failed: ${res.status} ${text}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Budgets ────────────────────────────────────────────────────────────────

  async getBudgetScopes(params?: { orgId?: string; repoId?: string }): Promise<BudgetScopeSummary[]> {
    const qs = new URLSearchParams();
    if (params?.orgId) qs.set("orgId", params.orgId);
    if (params?.repoId) qs.set("repoId", params.repoId);
    return this.get<BudgetScopeSummary[]>(`/admin/budgets?${qs}`);
  }

  async getBudgetScope(scopeId: string): Promise<BudgetScopeSummary> {
    return this.get<BudgetScopeSummary>(`/admin/budgets/${scopeId}`);
  }

  async getReservations(params?: { status?: ReservationSummary["status"] }): Promise<ReservationSummary[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    return this.get<ReservationSummary[]>(`/admin/reservations?${qs}`);
  }

  async reconcileBudget(scopeId: string, dryRun = true): Promise<{ reconciledCount: number; dryRun: boolean }> {
    return this.post(`/admin/budgets/${scopeId}/reconcile`, { dryRun });
  }

  // ── Point ledger ───────────────────────────────────────────────────────────

  async getLedgerBalances(params?: { contributorId?: string }): Promise<LedgerBalance[]> {
    const qs = new URLSearchParams();
    if (params?.contributorId) qs.set("contributorId", params.contributorId);
    return this.get<LedgerBalance[]>(`/admin/ledger?${qs}`);
  }

  async verifyLedgerIntegrity(): Promise<{ ok: boolean; mismatchCount: number; checkedAt: string }> {
    return this.post(`/admin/ledger/verify-integrity`, {});
  }

  async repairLedger(dryRun = true): Promise<{ repairedCount: number; dryRun: boolean }> {
    return this.post(`/admin/ledger/repair`, { dryRun });
  }

  // ── Verifications ──────────────────────────────────────────────────────────

  async getVerifications(params?: { status?: VerificationRecord["status"] }): Promise<VerificationRecord[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    return this.get<VerificationRecord[]>(`/admin/verifications?${qs}`);
  }

  async getVerification(id: string): Promise<VerificationRecord> {
    return this.get<VerificationRecord>(`/admin/verifications/${id}`);
  }

  // ── Appeals ────────────────────────────────────────────────────────────────

  async getAppeals(params?: { status?: AppealRecord["status"] }): Promise<AppealRecord[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    return this.get<AppealRecord[]>(`/admin/appeals?${qs}`);
  }

  async getAppeal(id: string): Promise<AppealRecord> {
    return this.get<AppealRecord>(`/admin/appeals/${id}`);
  }

  // ── Audit Log ──────────────────────────────────────────────────────────────

  async getAuditLogs(params?: { resourceType?: string; resourceId?: string }): Promise<AuditLogEntry[]> {
    const qs = new URLSearchParams();
    if (params?.resourceType) qs.set("resourceType", params.resourceType);
    if (params?.resourceId) qs.set("resourceId", params.resourceId);
    return this.get<AuditLogEntry[]>(`/admin/audit?${qs}`);
  }

  // ── Runtime Config ─────────────────────────────────────────────────────────

  async getRuntimeConfig(): Promise<RuntimeConfigEntry[]> {
    return this.get<RuntimeConfigEntry[]>("/admin/config");
  }

  async setRuntimeConfig(key: string, value: string): Promise<RuntimeConfigEntry> {
    return this.put<RuntimeConfigEntry>(`/admin/config/${key}`, { value });
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    return this.get<HealthStatus>("/admin/health");
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  async getWaveStateSummary(): Promise<WaveStateSummary> {
    return this.get<WaveStateSummary>("/admin/wave/summary");
  }
}

export function createAdminSdk(config: AdminSdkConfig): AdminSdk {
  return new AdminSdk(config);
}

export function createLocalAdminSdk(port = 4000): AdminSdk {
  return new AdminSdk({ baseUrl: `http://localhost:${port}` });
}

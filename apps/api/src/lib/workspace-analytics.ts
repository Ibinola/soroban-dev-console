const DAY_MS = 86_400_000;
const ACTIVE_WINDOW_DAYS = 7;
const TOP_METHODS = 10;
export const ANALYTICS_CACHE_TTL_MS = 5 * 60_000;

export interface AnalyticsWorkspace {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsInteraction {
  workspaceId: string;
  functionName: string;
  createdAt: Date;
}

export interface AnalyticsRange {
  from?: Date;
  to?: Date;
}

export interface WorkspaceAnalytics {
  range: { from: string | null; to: string | null };
  totalWorkspaces: number;
  /** Workspaces updated or invoked within the last 7 days (as of `to`/now). */
  activeWorkspaces: number;
  totalInvocations: number;
  creationTrend: { date: string; count: number }[];
  popularMethods: { method: string; invocations: number }[];
}

function inRange(d: Date, { from, to }: AnalyticsRange): boolean {
  return (!from || d >= from) && (!to || d <= to);
}

export function aggregateWorkspaceAnalytics(
  workspaces: AnalyticsWorkspace[],
  interactions: AnalyticsInteraction[],
  range: AnalyticsRange = {},
  now: Date = new Date(),
): WorkspaceAnalytics {
  const asOf = range.to ?? now;
  const activeSince = new Date(asOf.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);

  const created = workspaces.filter((w) => inRange(w.createdAt, range));
  const scoped = interactions.filter((i) => inRange(i.createdAt, range));

  const active = new Set<string>();
  for (const w of workspaces) {
    if (w.updatedAt >= activeSince && w.updatedAt <= asOf) active.add(w.id);
  }
  for (const i of interactions) {
    if (i.createdAt >= activeSince && i.createdAt <= asOf) active.add(i.workspaceId);
  }

  const perDay = new Map<string, number>();
  for (const w of created) {
    const day = w.createdAt.toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const perMethod = new Map<string, number>();
  for (const i of scoped) perMethod.set(i.functionName, (perMethod.get(i.functionName) ?? 0) + 1);

  return {
    range: { from: range.from?.toISOString() ?? null, to: range.to?.toISOString() ?? null },
    totalWorkspaces: created.length,
    activeWorkspaces: active.size,
    totalInvocations: scoped.length,
    creationTrend: [...perDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    popularMethods: [...perMethod.entries()]
      .sort(([ma, a], [mb, b]) => b - a || ma.localeCompare(mb))
      .slice(0, TOP_METHODS)
      .map(([method, invocations]) => ({ method, invocations })),
  };
}

/** Tiny TTL cache so repeated dashboard loads do not rerun the aggregation. */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number = ANALYTICS_CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrCompute(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;
    const value = await compute();
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    return value;
  }
}

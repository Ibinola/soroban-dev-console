/**
 * FE-013 / FE-014: Typed API client for workspace CRUD and share-link operations.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface ApiWorkspace {
  id: string;
  share_id: string;
  name: string;
  createdAt: string;
  contracts: { contractId: string; network: string }[];
  interactions: { functionName: string; argumentsJson: unknown }[];
}

export interface CreateWorkspacePayload {
  name: string;
  contracts?: { contractId: string; network: string }[];
  interactions?: { functionName: string; argumentsJson: unknown }[];
}

export interface ApiShareLink {
  id: string;
  token: string;
  label?: string;
  snapshotJson: unknown;
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `API error ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export const workspacesApi = {
  list: () => apiFetch<ApiWorkspace[]>("/api/workspaces"),

  create: (payload: CreateWorkspacePayload) =>
    apiFetch<ApiWorkspace>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getByShareId: (shareId: string) =>
    apiFetch<ApiWorkspace>(`/api/workspaces/${shareId}`),
};

// ── Share links ───────────────────────────────────────────────────────────────

export const sharesApi = {
  create: (workspaceId: string, snapshotJson: unknown, label?: string) =>
    apiFetch<ApiShareLink>(`/api/workspaces/${workspaceId}/shares`, {
      method: "POST",
      body: JSON.stringify({ snapshotJson, label }),
    }),

  get: (token: string) =>
    apiFetch<ApiShareLink>(`/api/shares/${token}`),
};

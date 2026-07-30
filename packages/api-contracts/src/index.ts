export * from "./runtime-defaults";
export * from "./warning-envelope";
export * from "./admin-sdk";

export interface ApiEnvelope<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp?: string;
    path?: string;
  };
}

export interface NormalizedTransactionResult {
  status: "success" | "error" | "pending";
  hash?: string;
  ledger?: number;
  resultXdr?: string;
  errorMessage?: string;
}

export interface NormalizedSimulationPayload {
  resultXdr?: string;
  cpuInsns?: string;
  memBytes?: string;
  minResourceFee?: string;
  stateChanges?: unknown[];
  auth?: Array<{ kind: "account" | "contract"; address: string }>;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description?: string;
  selectedNetwork: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  contracts: Array<{ contractId: string; network?: string }>;
  interactions: Array<{ functionName: string; argumentsJson?: Record<string, unknown> }>;
  tags?: string[];
  archived?: boolean;
  revision?: number;
}

export interface CreateWorkspacePayload {
  name: string;
  description?: string;
  selectedNetwork?: string;
  contracts?: Array<{ contractId: string; network?: string }>;
  interactions?: Array<{ functionName: string; argumentsJson?: Record<string, unknown> }>;
}

export interface UpdateWorkspacePayload {
  name?: string;
  description?: string;
  selectedNetwork?: string;
  archived?: boolean;
  revision?: number;
}

export interface ShareSummary {
  token: string;
  workspaceId?: string;
  label?: string;
  viewCount: number;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface ShareDetail extends ShareSummary {
  snapshotJson: string;
  snapshot?: WorkspaceDetail;
}

export interface CreateSharePayload {
  workspaceId: string;
  snapshotJson?: string;
  label?: string;
  expiresInSeconds?: number;
}
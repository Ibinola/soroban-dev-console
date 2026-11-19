/**
 * Shared RPC error classification.
 *
 * Turns whatever a client, provider or fetch call threw into a stable
 * `{ category, retryable, code, message }`. Known codes map to fixed values;
 * anything unrecognised keeps its original code and is classified
 * conservatively (category `unknown`, not retryable). Messages are normalized:
 * URLs, credentials and long text are removed so they are safe to show or log.
 */

export type RpcErrorCategory =
  | "network"
  | "rate_limited"
  | "server"
  | "invalid_request"
  | "unauthorized"
  | "not_found"
  | "simulation"
  | "unknown";

export interface ClassifiedRpcError {
  category: RpcErrorCategory;
  retryable: boolean;
  /** The original numeric/string code, when the error had one. */
  code: string | number | null;
  /** Sanitized, user-presentable message. */
  message: string;
}

interface Rule {
  category: RpcErrorCategory;
  retryable: boolean;
}

/** JSON-RPC 2.0 error codes. */
export const JSON_RPC_CODE_MAP: Readonly<Record<number, Rule>> = Object.freeze({
  [-32700]: { category: "invalid_request", retryable: false }, // parse error
  [-32600]: { category: "invalid_request", retryable: false }, // invalid request
  [-32601]: { category: "invalid_request", retryable: false }, // method not found
  [-32602]: { category: "invalid_request", retryable: false }, // invalid params
  [-32603]: { category: "server", retryable: true }, // internal error
});

/** HTTP statuses with a fixed meaning. */
export const HTTP_STATUS_MAP: Readonly<Record<number, Rule>> = Object.freeze({
  400: { category: "invalid_request", retryable: false },
  401: { category: "unauthorized", retryable: false },
  403: { category: "unauthorized", retryable: false },
  404: { category: "not_found", retryable: false },
  408: { category: "network", retryable: true },
  413: { category: "invalid_request", retryable: false },
  429: { category: "rate_limited", retryable: true },
  500: { category: "server", retryable: true },
  502: { category: "server", retryable: true },
  503: { category: "server", retryable: true },
  504: { category: "server", retryable: true },
});

const NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "UND_ERR_CONNECT_TIMEOUT"]);
const MAX_MESSAGE_LENGTH = 200;

/** Remove URLs, bearer tokens and key/secret/token assignments, then cap the length. */
export function sanitizeRpcMessage(message: string): string {
  const cleaned = message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]")
    .replace(/\b(api[_-]?key|apikey|token|secret|password|authorization|auth)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/\bS[A-Z2-7]{55}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > MAX_MESSAGE_LENGTH ? `${cleaned.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : cleaned;
}

function pick(error: unknown): { status?: number; code?: string | number; message: string } {
  if (typeof error === "string") return { message: error };
  if (!error || typeof error !== "object") return { message: "Unknown error" };
  const e = error as Record<string, unknown>;
  const response = (typeof e.response === "object" && e.response !== null ? e.response : {}) as Record<string, unknown>;
  const status = [e.status, e.statusCode, response.status].find((v) => typeof v === "number") as number | undefined;
  const code = [e.code, (e.error as Record<string, unknown> | undefined)?.code].find(
    (v) => typeof v === "number" || typeof v === "string",
  ) as string | number | undefined;
  const message =
    typeof e.message === "string"
      ? e.message
      : typeof (e.error as Record<string, unknown> | undefined)?.message === "string"
        ? ((e.error as Record<string, unknown>).message as string)
        : "Unknown error";
  return { status, code, message };
}

/** Classify any thrown value. Never throws. */
export function classifyRpcError(error: unknown): ClassifiedRpcError {
  const { status, code, message } = pick(error);
  const safe = sanitizeRpcMessage(message);
  const original = code ?? status ?? null;

  if (typeof code === "number" && JSON_RPC_CODE_MAP[code]) return { ...JSON_RPC_CODE_MAP[code], code, message: safe };
  if (status !== undefined && HTTP_STATUS_MAP[status]) return { ...HTTP_STATUS_MAP[status], code: original, message: safe };
  if (typeof code === "string" && NETWORK_CODES.has(code)) return { category: "network", retryable: true, code, message: safe };
  // Soroban's server-defined range: treat as a server-side problem worth one more try.
  if (typeof code === "number" && code <= -32000 && code >= -32099) return { category: "server", retryable: true, code, message: safe };
  if (/HostError|simulation failed|Error\(Contract/i.test(message)) {
    return { category: "simulation", retryable: false, code: original, message: safe };
  }
  if (/timed? ?out|network|fetch failed|socket hang up/i.test(message)) {
    return { category: "network", retryable: true, code: original, message: safe };
  }
  if (status !== undefined && status >= 500) return { category: "server", retryable: true, code: original, message: safe };
  return { category: "unknown", retryable: false, code: original, message: safe };
}

export interface SignatureTimeoutOptions {
  timeoutMs?: number;
  provider?: string;
  onTimeout?: (timeoutMs: number) => void;
}

const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 60_000;

const globalOverrideKey = "__DEVCONSOLE_SIGNATURE_TIMEOUT_MS__";

export function getSignatureTimeoutMs(override?: number): number {
  const candidate =
    override ??
    (globalThis as Record<string, unknown>)[globalOverrideKey] ??
    DEFAULT_TIMEOUT_MS;
  const value = typeof candidate === "string" ? Number(candidate) : candidate;
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(value)));
}

export class SignatureTimeoutError extends Error {
  readonly provider: string;
  readonly timeoutMs: number;
  readonly retryable = true;

  constructor(provider: string, timeoutMs: number) {
    super(
      `Wallet signature timed out after ${Math.round(timeoutMs / 1000)}s. Review the wallet prompt and retry the action.`,
    );
    this.name = "SignatureTimeoutError";
    this.provider = provider;
    this.timeoutMs = timeoutMs;
  }
}

export function isSignatureTimeoutError(error: unknown): error is SignatureTimeoutError {
  return error instanceof SignatureTimeoutError;
}

export function withSignatureTimeout<T>(
  work: Promise<T> | (() => Promise<T>),
  options: SignatureTimeoutOptions = {},
): Promise<T> {
  const timeoutMs = getSignatureTimeoutMs(options.timeoutMs);
  const provider = options.provider ?? "wallet";
  const pending = typeof work === "function" ? work() : work;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      options.onTimeout?.(timeoutMs);
      reject(new SignatureTimeoutError(provider, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([pending, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

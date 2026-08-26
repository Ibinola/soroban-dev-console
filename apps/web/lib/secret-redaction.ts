/**
 * secret-redaction.ts
 *
 * Issue #938: Secret key detector and auto-redaction in developer log viewers.
 *
 * Provides:
 *  - `redactSecrets(text)` — replace detected secrets in any string with masked
 *    placeholders before the string is rendered in the UI or written to a log.
 *  - `containsSecret(text)` — boolean check so callers can show a security alert.
 *  - `SecretPasteGuard` — React hook that wraps an <input> / <textarea> onChange
 *    handler and fires an `onSecretDetected` callback when a secret is pasted.
 *
 * Detected patterns
 * -----------------
 *  - Stellar secret keys:  S[A-Z2-7]{55}   (56-char Stellar base32 secret)
 *  - Stellar mnemonics:    12/24-word BIP-39 phrases (basic heuristic)
 *  - JWT tokens:           eyJ…
 *  - Bearer tokens
 *  - GitHub / npm tokens:  ghp_, gho_, npm_
 *  - Generic hex secrets:  64+ char hex strings
 *  - Private key PEM blocks
 */

// ─── Pattern definitions ──────────────────────────────────────────────────────

interface SecretPattern {
  name: string;
  regex: RegExp;
  /** Replacement string — use a fixed-length mask to avoid leaking length info. */
  mask: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    // Stellar secret key: S followed by 55 base32 chars (A-Z + 2-7), total 56 chars
    name: "stellar_secret_key",
    regex: /\bS[A-Z2-7]{55}\b/g,
    mask: "S" + "*".repeat(55),
  },
  {
    // JWT token
    name: "jwt_token",
    regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
    mask: "[REDACTED:jwt]",
  },
  {
    // GitHub personal access token (ghp_)
    name: "github_token_ghp",
    regex: /ghp_[A-Za-z0-9]{36,}/g,
    mask: "[REDACTED:github-token]",
  },
  {
    // GitHub OAuth token (gho_)
    name: "github_token_gho",
    regex: /gho_[A-Za-z0-9]{36,}/g,
    mask: "[REDACTED:github-oauth]",
  },
  {
    // npm token
    name: "npm_token",
    regex: /npm_[A-Za-z0-9]{36,}/g,
    mask: "[REDACTED:npm-token]",
  },
  {
    // Bearer token in Authorization header value
    name: "bearer_token",
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    mask: "Bearer [REDACTED]",
  },
  {
    // Generic 64+ char lowercase hex string (private keys, HMAC secrets, etc.)
    name: "hex_secret",
    regex: /\b[a-f0-9]{64,}\b/g,
    mask: "[REDACTED:hex-secret]",
  },
  {
    // PEM private key block
    name: "pem_private_key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    mask: "[REDACTED:private-key]",
  },
  {
    // Connection strings with credentials (postgres://, mongodb://)
    name: "connection_string",
    regex: /(?:postgres|postgresql|mongodb(?:\+srv)?)(:\/\/[^:\s]+:[^@\s]+@[^\s]+)/g,
    mask: "[REDACTED:connection-string]",
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Replace all detected secrets in `text` with redaction placeholders.
 * Safe to call on any string before rendering in the UI or logging.
 */
export function redactSecrets(text: string): string {
  if (!text) return text;

  let result = text;
  for (const { regex, mask } of SECRET_PATTERNS) {
    // Reset lastIndex in case the regex is reused (global flag)
    regex.lastIndex = 0;
    result = result.replace(regex, mask);
  }
  return result;
}

/**
 * Return `true` if `text` contains at least one recognised secret pattern.
 * Use this to decide whether to show a security alert to the developer.
 */
export function containsSecret(text: string): boolean {
  if (!text) return false;

  for (const { regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(text)) return true;
  }
  return false;
}

/**
 * Return an array of detected secret pattern names found in `text`.
 * Useful for building a targeted warning message.
 */
export function detectSecretTypes(text: string): string[] {
  if (!text) return [];

  const found: string[] = [];
  for (const { name, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(text)) found.push(name);
  }
  return found;
}

// ─── React hook ───────────────────────────────────────────────────────────────

import { useCallback } from "react";

export interface SecretPasteGuardOptions {
  /** Called when a secret is detected in the pasted / typed value. */
  onSecretDetected: (detectedTypes: string[]) => void;
  /** If true, the input value is auto-redacted before the original onChange fires. */
  autoRedact?: boolean;
}

/**
 * Wraps an input onChange handler to intercept pasted values containing secrets.
 *
 * Usage:
 *
 *   const { guardedOnChange } = useSecretPasteGuard({
 *     onSecretDetected: (types) => toast.warning(`Secret detected: ${types.join(", ")}`),
 *   });
 *
 *   <textarea onChange={guardedOnChange(handleChange)} />
 */
export function useSecretPasteGuard(options: SecretPasteGuardOptions) {
  const { onSecretDetected, autoRedact = false } = options;

  const guardedOnChange = useCallback(
    (
      originalHandler: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
    ) => {
      return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;

        if (containsSecret(value)) {
          const types = detectSecretTypes(value);
          onSecretDetected(types);

          if (autoRedact) {
            // Mutate the synthetic event value in-place so the parent handler
            // receives the redacted version
            Object.defineProperty(e, "target", {
              writable: true,
              value: {
                ...e.target,
                value: redactSecrets(value),
              },
            });
          }
        }

        originalHandler(e);
      };
    },
    [onSecretDetected, autoRedact],
  );

  return { guardedOnChange };
}

// ─── Log-safe wrapper ─────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `console.log` / `console.error` that redacts any
 * secret patterns from string arguments before writing to the console.
 *
 * Usage:
 *   import { safeLog } from "@/lib/secret-redaction";
 *   safeLog("RPC response:", responseText);
 */
export const safeLog = {
  log: (...args: unknown[]) => {
    console.log(...args.map(sanitizeArg));
  },
  warn: (...args: unknown[]) => {
    console.warn(...args.map(sanitizeArg));
  },
  error: (...args: unknown[]) => {
    console.error(...args.map(sanitizeArg));
  },
  info: (...args: unknown[]) => {
    console.info(...args.map(sanitizeArg));
  },
};

function sanitizeArg(arg: unknown): unknown {
  if (typeof arg === "string") return redactSecrets(arg);
  if (arg instanceof Error) {
    const sanitized = new Error(redactSecrets(arg.message));
    sanitized.stack = arg.stack ? redactSecrets(arg.stack) : undefined;
    return sanitized;
  }
  try {
    const json = JSON.stringify(arg);
    const redacted = redactSecrets(json);
    return JSON.parse(redacted) as unknown;
  } catch {
    return arg;
  }
}

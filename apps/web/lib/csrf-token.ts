/**
 * csrf-token.ts
 *
 * Issue #941: Frontend helper that reads the `csrf-token` cookie set by the
 * backend CsrfGuard and injects the `X-CSRF-Token` header on every mutating
 * API request (POST / PUT / PATCH / DELETE).
 *
 * Usage
 * -----
 * import { csrfHeaders } from "@/lib/csrf-token";
 *
 * fetch("/api/rpc/testnet", {
 *   method: "POST",
 *   headers: {
 *     "Content-Type": "application/json",
 *     ...csrfHeaders(),
 *   },
 *   body: JSON.stringify(payload),
 * });
 *
 * Or use the `fetchWithCsrf` wrapper which handles this automatically.
 */

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Read the CSRF token from the browser's cookie store.
 *
 * Returns `null` when running on the server (SSR) or when the cookie has not
 * yet been set by the backend.
 */
export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!match) return null;
  const token = match.slice(CSRF_COOKIE_NAME.length + 1);
  return token || null;
}

/**
 * Return a headers object containing the `X-CSRF-Token` header.
 *
 * Spread this into your `fetch` headers for mutating requests:
 *
 *   headers: { "Content-Type": "application/json", ...csrfHeaders() }
 */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfTokenFromCookie();
  if (!token) return {};
  return { [CSRF_HEADER_NAME]: token };
}

/**
 * A thin wrapper around `fetch` that automatically injects the CSRF header
 * on mutating requests (POST, PUT, PATCH, DELETE).
 *
 * All other arguments are forwarded unchanged to the underlying `fetch`.
 */
export async function fetchWithCsrf(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();

  if (MUTATING_METHODS.has(method)) {
    const existing = new Headers(init.headers as HeadersInit | undefined);
    const token = getCsrfTokenFromCookie();
    if (token && !existing.has(CSRF_HEADER_NAME)) {
      existing.set(CSRF_HEADER_NAME, token);
    }
    return fetch(input, { ...init, headers: existing });
  }

  return fetch(input, init);
}

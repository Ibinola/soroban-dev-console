/**
 * Issue #949: Session fixation protection.
 *
 * Tracks a client-side correlation token in a cookie that is rotated on
 * every wallet connect/disconnect transition, so a token captured before
 * authentication can never be reused to correlate a post-auth session.
 */

export const SESSION_COOKIE_NAME = "sdc_session_id";

function generateToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Strict`;
}

function expireCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict`;
}

export function getSessionToken(): string | null {
  return readCookie(SESSION_COOKIE_NAME);
}

/** Rotate to a freshly generated session token, replacing any prior value. */
export function regenerateSessionToken(): string {
  const token = generateToken();
  writeCookie(SESSION_COOKIE_NAME, token);
  return token;
}

/** Clear the session cookie without issuing a replacement. */
export function clearSessionToken(): void {
  expireCookie(SESSION_COOKIE_NAME);
}

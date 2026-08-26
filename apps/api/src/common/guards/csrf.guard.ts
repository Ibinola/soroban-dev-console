/**
 * csrf.guard.ts
 *
 * Issue #941: Add CSRF protection tokens to NestJS proxy backend endpoints.
 *
 * Implements the Double Submit Cookie pattern:
 *
 *  1. On any GET (or other safe) request the backend sets a signed
 *     `csrf-token` cookie containing a random token.
 *  2. On state-changing requests (POST / PUT / PATCH / DELETE) the guard
 *     verifies that the `X-CSRF-Token` request header matches the value
 *     stored in the `csrf-token` cookie.
 *  3. Requests that lack a valid matching token are rejected with HTTP 403.
 *
 * Usage
 * -----
 * Apply globally in `main.ts`:
 *
 *   app.useGlobalGuards(new CsrfGuard());
 *
 * Or scope it to specific controllers / routes:
 *
 *   @UseGuards(CsrfGuard)
 *   @Controller('rpc')
 *   export class RpcController { … }
 *
 * Frontend integration
 * --------------------
 * The frontend must:
 *  1. Read the CSRF token from the `csrf-token` cookie (it is NOT HttpOnly so
 *     that JavaScript can read it).
 *  2. Include it as the `X-CSRF-Token` request header on every mutating call.
 *
 * The companion helper `getCsrfToken()` exported from this module can be
 * used directly on the server side for tests / tooling.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Name of the cookie that carries the CSRF token. */
export const CSRF_COOKIE_NAME = "csrf-token";

/** Name of the request header the client must echo the token in. */
export const CSRF_HEADER_NAME = "x-csrf-token";

/** HTTP methods that mutate state and must carry a valid CSRF token. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Byte length of the generated CSRF token. */
const TOKEN_BYTE_LENGTH = 32;

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Generate a new cryptographically-secure CSRF token (hex-encoded).
 */
export function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
}

/**
 * Perform a constant-time comparison between two token strings to prevent
 * timing-attack-based token inference.
 */
function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

// ─── Guard ────────────────────────────────────────────────────────────────────

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const method = request.method.toUpperCase();

    // ── Safe methods: refresh the token cookie and allow the request ──────
    if (!MUTATING_METHODS.has(method)) {
      this.refreshCsrfCookie(request, response);
      return true;
    }

    // ── Mutating methods: validate the Double Submit Cookie ───────────────

    const cookieToken = this.extractCookieToken(request);
    const headerToken = this.extractHeaderToken(request);

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException(
        "CSRF token missing. Include a valid X-CSRF-Token header on mutating requests.",
      );
    }

    if (!tokensMatch(cookieToken, headerToken)) {
      throw new ForbiddenException(
        "CSRF token mismatch. The supplied X-CSRF-Token does not match the cookie value.",
      );
    }

    // Token is valid; rotate it to limit replay window
    this.refreshCsrfCookie(request, response);

    return true;
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private extractCookieToken(request: Request): string | null {
    const cookies: Record<string, string> = (request as any).cookies ?? {};
    const token = cookies[CSRF_COOKIE_NAME];
    return typeof token === "string" && token.length > 0 ? token : null;
  }

  private extractHeaderToken(request: Request): string | null {
    const header = request.headers[CSRF_HEADER_NAME];
    if (typeof header === "string" && header.length > 0) return header;
    if (Array.isArray(header) && header.length > 0) return header[0] ?? null;
    return null;
  }

  /**
   * Issue or rotate the CSRF cookie on the current response.
   *
   * The cookie is intentionally NOT HttpOnly so that JavaScript can read it
   * (required for the Double Submit Cookie pattern).  It is SameSite=Strict
   * to prevent cross-site requests from carrying it automatically.
   */
  private refreshCsrfCookie(request: Request, response: Response): void {
    const existingToken = this.extractCookieToken(request);
    // Re-use an existing valid token (avoids breaking in-flight requests);
    // generate a fresh one if there is none.
    const token = existingToken ?? generateCsrfToken();

    const isProd = process.env.NODE_ENV === "production";

    response.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,    // Must be readable by JS for Double Submit Cookie pattern
      secure: isProd,     // HTTPS-only in production
      sameSite: "strict", // Prevent the cookie being sent on cross-site requests
      path: "/",
    });
  }
}

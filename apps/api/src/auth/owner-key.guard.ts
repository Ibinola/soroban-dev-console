/**
 * MVP Auth Strategy — Owner Key
 *
 * Scope: Private workspace mutation routes only.
 *
 * How it works:
 *   - The client sends an `x-owner-key` header (a secret string the user
 *     controls, e.g. a Stellar public key or a random UUID they generate
 *     locally and store in localStorage).
 *   - The API stores this key as `ownerKey` on the Workspace row.
 *   - Any mutation (create / update / delete / import) requires the header
 *     to match the stored ownerKey.
 *   - Public share-link routes (GET /shares/:token) do NOT require this
 *     header — they are intentionally read-only and unauthenticated.
 *
 * Security Model:
 *   - This is a bearer-token style authentication. Anyone with the key can
 *     mutate the workspace. Treat it like a password.
 *   - The key should be:
 *     - At least 8 characters long
 *     - Not purely whitespace
 *     - Not a common/predictable pattern (e.g., "password", "12345678")
 *   - For production use, consider:
 *     - Stellar signature-based authentication
 *     - JWT with short expiration
 *     - Rate limiting on authentication attempts
 *     - Key rotation mechanisms
 *
 * Limitations (MVP):
 *   - There is no server-side session or JWT. The owner key is bearer-style.
 *   - Key rotation is not supported in this iteration.
 *   - Rate-limiting on the existing middleware provides the only brute-force
 *     protection. A proper auth system (e.g. Stellar signature challenge)
 *     should replace this before production.
 *
 * WARNING: Do NOT use easily guessable keys in production. Generate a random
 * UUID or use a Stellar keypair public key for better security.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class OwnerKeyGuard implements CanActivate {
  // Security: Reject common/predictable keys
  private static readonly FORBIDDEN_PATTERNS = [
    /^(password|12345678|admin|test|demo|key|owner)$/i,
    /^\s+$/,
    /^.{1,7}$/, // Less than 8 characters
    /^.{257,}$/, // More than 256 characters
  ];

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers["x-owner-key"];

    if (!key || typeof key !== "string") {
      throw new UnauthorizedException(
        "Missing x-owner-key header. Provide your workspace owner key to mutate private workspaces.",
      );
    }

    const trimmedKey = key.trim();

    // Validate key length
    if (trimmedKey.length < 8) {
      throw new UnauthorizedException(
        "Invalid x-owner-key header. Owner key must be at least 8 characters long.",
      );
    }

    if (trimmedKey.length > 256) {
      throw new UnauthorizedException(
        "Invalid x-owner-key header. Owner key must not exceed 256 characters.",
      );
    }

    // Reject forbidden patterns
    for (const pattern of OwnerKeyGuard.FORBIDDEN_PATTERNS) {
      if (pattern.test(trimmedKey)) {
        throw new UnauthorizedException(
          "Invalid x-owner-key header. Owner key contains a forbidden pattern or is too weak.",
        );
      }
    }

    // Attach to request so controllers can pass it to the service
    (req as any).ownerKey = trimmedKey;
    return true;
  }
}

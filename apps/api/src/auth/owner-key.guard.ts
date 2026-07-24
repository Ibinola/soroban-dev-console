/**
 * Issue #758: Add API key (owner-key) strength validation to reject weak keys.
 *
 * Validates the x-owner-key header on all protected routes:
 * - Minimum 32 characters (raised from 8)
 * - Must contain at least one uppercase letter, one lowercase letter, one digit
 * - Rejects known weak patterns (common words, all-same-char, etc.)
 * - Returns 400 Bad Request with ApiErrorCode.WEAK_OWNER_KEY on weak keys
 * - Rate limits: max 10 failed attempts per IP per 60s
 */

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

/** Issue #758: Minimum key length raised to 32 characters. */
const MIN_KEY_LENGTH = 32;
const MAX_KEY_LENGTH = 256;

@Injectable()
export class OwnerKeyGuard implements CanActivate {
  private readonly logger = new Logger(OwnerKeyGuard.name);

  private static readonly FORBIDDEN_PATTERNS = [
    /^(password|12345678|admin|test|demo|key|owner|secret|token|auth)$/i,
    /^\s+$/,
    // All same character repeated
    /^(.)\1+$/,
  ];

  private static readonly RATE_LIMIT_WINDOW = 60_000;
  private static readonly MAX_ATTEMPTS = 10;
  private readonly attemptStore = new Map<string, { count: number; windowStart: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers["x-owner-key"];
    const clientIp = req.ip ?? req.socket?.remoteAddress ?? "unknown";

    if (this.isRateLimited(clientIp)) {
      this.logger.warn(`Owner-key rate limit exceeded for ${clientIp}`);
      throw new UnauthorizedException("Too many authentication attempts. Try again later.");
    }

    if (!key || typeof key !== "string") {
      this.recordAttempt(clientIp);
      this.logger.warn(`Missing owner-key header from ${clientIp}`);
      throw new UnauthorizedException(
        "Missing x-owner-key header. Provide your workspace owner key to mutate private workspaces.",
      );
    }

    const trimmedKey = key.trim();

    // Issue #758: Minimum 32 characters
    if (trimmedKey.length < MIN_KEY_LENGTH) {
      this.recordAttempt(clientIp);
      this.logger.warn(`Weak owner-key rejected (too short: ${trimmedKey.length} chars) from ${clientIp}`);
      throw new BadRequestException({
        code: "WEAK_OWNER_KEY",
        message: `Owner key must be at least ${MIN_KEY_LENGTH} characters long. Generate a strong key using: crypto.randomUUID() + crypto.randomUUID()`,
      });
    }

    if (trimmedKey.length > MAX_KEY_LENGTH) {
      this.recordAttempt(clientIp);
      this.logger.warn(`Oversized owner-key rejected from ${clientIp}`);
      throw new BadRequestException({
        code: "WEAK_OWNER_KEY",
        message: `Owner key must not exceed ${MAX_KEY_LENGTH} characters.`,
      });
    }

    // Issue #758: Must contain at least one uppercase, lowercase, and digit
    if (!/[A-Z]/.test(trimmedKey)) {
      this.recordAttempt(clientIp);
      this.logger.warn(`Weak owner-key rejected (no uppercase) from ${clientIp}`);
      throw new BadRequestException({
        code: "WEAK_OWNER_KEY",
        message: "Owner key must contain at least one uppercase letter, one lowercase letter, and one digit.",
      });
    }

    if (!/[a-z]/.test(trimmedKey)) {
      this.recordAttempt(clientIp);
      this.logger.warn(`Weak owner-key rejected (no lowercase) from ${clientIp}`);
      throw new BadRequestException({
        code: "WEAK_OWNER_KEY",
        message: "Owner key must contain at least one uppercase letter, one lowercase letter, and one digit.",
      });
    }

    if (!/[0-9]/.test(trimmedKey)) {
      this.recordAttempt(clientIp);
      this.logger.warn(`Weak owner-key rejected (no digit) from ${clientIp}`);
      throw new BadRequestException({
        code: "WEAK_OWNER_KEY",
        message: "Owner key must contain at least one uppercase letter, one lowercase letter, and one digit.",
      });
    }

    // Forbidden patterns
    for (const pattern of OwnerKeyGuard.FORBIDDEN_PATTERNS) {
      if (pattern.test(trimmedKey)) {
        this.recordAttempt(clientIp);
        this.logger.warn(`Forbidden pattern in owner-key from ${clientIp}`);
        throw new BadRequestException({
          code: "WEAK_OWNER_KEY",
          message: "Owner key contains a forbidden pattern or is too predictable. Use a randomly generated key.",
        });
      }
    }

    (req as any).ownerKey = trimmedKey;
    return true;
  }

  private isRateLimited(key: string): boolean {
    const record = this.attemptStore.get(key);
    if (!record) return false;
    if (Date.now() - record.windowStart > OwnerKeyGuard.RATE_LIMIT_WINDOW) {
      this.attemptStore.delete(key);
      return false;
    }
    return record.count >= OwnerKeyGuard.MAX_ATTEMPTS;
  }

  private recordAttempt(key: string): void {
    const record = this.attemptStore.get(key);
    const now = Date.now();
    if (!record || now - record.windowStart > OwnerKeyGuard.RATE_LIMIT_WINDOW) {
      this.attemptStore.set(key, { count: 1, windowStart: now });
    } else {
      record.count++;
    }
  }
}

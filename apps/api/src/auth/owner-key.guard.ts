import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class OwnerKeyGuard implements CanActivate {
  private readonly logger = new Logger(OwnerKeyGuard.name);

  private static readonly FORBIDDEN_PATTERNS = [
    /^(password|12345678|admin|test|demo|key|owner)$/i,
    /^\s+$/,
    /^.{1,7}$/,
    /^.{257,}$/,
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

    if (trimmedKey.length < 8) {
      this.recordAttempt(clientIp);
      this.logger.warn(`Short owner-key rejected from ${clientIp}`);
      throw new UnauthorizedException(
        "Invalid x-owner-key header. Owner key must be at least 8 characters long.",
      );
    }

    if (trimmedKey.length > 256) {
      this.recordAttempt(clientIp);
      this.logger.warn(`Oversized owner-key rejected from ${clientIp}`);
      throw new UnauthorizedException(
        "Invalid x-owner-key header. Owner key must not exceed 256 characters.",
      );
    }

    for (const pattern of OwnerKeyGuard.FORBIDDEN_PATTERNS) {
      if (pattern.test(trimmedKey)) {
        this.recordAttempt(clientIp);
        this.logger.warn(`Forbidden pattern in owner-key from ${clientIp}`);
        throw new UnauthorizedException(
          "Invalid x-owner-key header. Owner key contains a forbidden pattern or is too weak.",
        );
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
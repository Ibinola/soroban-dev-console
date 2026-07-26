import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

export const REQUIRE_VERIFIED = "requireVerified";

export const RequireVerified = () => SetMetadata(REQUIRE_VERIFIED, true);

@Injectable()
export class VerificationGuard implements CanActivate {
  private readonly logger = new Logger(VerificationGuard.name);

  constructor(private readonly reflector: Reflector) {}

  private static readonly RATE_LIMIT_WINDOW = 60_000;
  private static readonly MAX_ATTEMPTS = 20;
  private readonly attemptStore = new Map<string, { count: number; windowStart: number }>();

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const verifiedKey = req.headers["x-verified-key"];
    const clientIp = req.ip ?? req.socket?.remoteAddress ?? "unknown";

    if (this.isRateLimited(clientIp)) {
      this.logger.warn(`Verification rate limit exceeded for ${clientIp}`);
      throw new ForbiddenException("Too many verification attempts. Try again later.");
    }

    if (!verifiedKey || typeof verifiedKey !== "string" || verifiedKey.trim().length < 8) {
      this.recordAttempt(clientIp);
      this.logger.warn(`Verification guard rejected request from ${clientIp}: invalid verified key`);
      throw new ForbiddenException(
        "This action requires a verified identity. Provide a valid x-verified-key header.",
      );
    }

    (req as any).verifiedKey = verifiedKey.trim();

    const existingVerification = (req as any).existingVerification;
    if (!existingVerification) {
      this.logger.log(`Verification guard passed for ${clientIp} (no stored verification check)`);
    }

    return true;
  }

  private isRateLimited(key: string): boolean {
    const record = this.attemptStore.get(key);
    if (!record) return false;
    if (Date.now() - record.windowStart > VerificationGuard.RATE_LIMIT_WINDOW) {
      this.attemptStore.delete(key);
      return false;
    }
    return record.count >= VerificationGuard.MAX_ATTEMPTS;
  }

  private recordAttempt(key: string): void {
    const record = this.attemptStore.get(key);
    const now = Date.now();
    if (!record || now - record.windowStart > VerificationGuard.RATE_LIMIT_WINDOW) {
      this.attemptStore.set(key, { count: 1, windowStart: now });
    } else {
      record.count++;
    }
  }
}
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Issue #945: Rate limit public share link resolution to prevent
 * brute-force enumeration of shared workspace IDs/tokens.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

function getClientIp(req: Request): string {
  const fallbackIp = req.ip ?? "unknown";
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? fallbackIp;
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.trim() ?? fallbackIp;
  }

  return fallbackIp;
}

@Injectable()
export class ShareResolveRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(ShareResolveRateLimitGuard.name);
  private readonly buckets = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const now = Date.now();
    const ip = getClientIp(request);
    const token = request.params?.token ?? "unknown";
    const existing = this.buckets.get(ip);

    if (!existing || now >= existing.resetAt) {
      this.buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      this.setHeaders(response, MAX_REQUESTS - 1, now + WINDOW_MS);
      return true;
    }

    if (existing.count >= MAX_REQUESTS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      response.setHeader("Retry-After", String(retryAfterSeconds));
      this.logger.warn(
        `Rate limit exceeded for share link resolution from ip=${ip} token=${token}`,
      );
      throw new HttpException("Too many share link resolution requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    this.setHeaders(response, MAX_REQUESTS - existing.count, existing.resetAt);
    return true;
  }

  private setHeaders(response: Response, remaining: number, resetAt: number): void {
    response.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  }
}

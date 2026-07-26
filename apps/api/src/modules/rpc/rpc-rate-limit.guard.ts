import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request, Response } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type SlidingWindowEntry = {
  timestamps: number[];
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

const OWNER_WINDOW_MS = 60_000;
const OWNER_MAX_REQUESTS = parseInt(process.env.RPC_RATE_LIMIT_OWNER_MAX ?? "200", 10);
const OWNER_BURST = parseInt(process.env.RPC_RATE_LIMIT_OWNER_BURST ?? "20", 10);

function getClientIp(req: Request) {
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
export class RpcRateLimitGuard implements CanActivate {
  private readonly ipBuckets = new Map<string, RateLimitEntry>();
  private readonly ownerBuckets = new Map<string, SlidingWindowEntry>();

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const ownerKey = request.headers["x-owner-key"];
    if (typeof ownerKey === "string" && ownerKey.length > 0) {
      return this.checkOwnerRateLimit(ownerKey, response);
    }

    return this.checkIpRateLimit(request, response);
  }

  private checkIpRateLimit(request: Request, response: Response): boolean {
    const now = Date.now();
    const ip = getClientIp(request);
    const existing = this.ipBuckets.get(ip);

    if (!existing || now >= existing.resetAt) {
      this.ipBuckets.set(ip, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
      this.setIpHeaders(response, MAX_REQUESTS - 1, existing?.resetAt ?? now + WINDOW_MS);
      return true;
    }

    if (existing.count >= MAX_REQUESTS) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      );
      response.setHeader("Retry-After", String(retryAfterSeconds));
      throw new HttpException("Too many RPC requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    this.setIpHeaders(response, MAX_REQUESTS - existing.count, existing.resetAt);
    return true;
  }

  private checkOwnerRateLimit(ownerKey: string, response: Response): boolean {
    const now = Date.now();
    const bucket = this.ownerBuckets.get(ownerKey);

    if (!bucket || bucket.timestamps.length === 0) {
      this.ownerBuckets.set(ownerKey, { timestamps: [now] });
      this.setOwnerHeaders(response, OWNER_MAX_REQUESTS - 1, now + OWNER_WINDOW_MS);
      return true;
    }

    // Prune timestamps outside the window
    const windowStart = now - OWNER_WINDOW_MS;
    bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

    // Burst allowance: if under burst limit, allow instantly
    if (bucket.timestamps.length < OWNER_BURST) {
      bucket.timestamps.push(now);
      this.setOwnerHeaders(response, OWNER_MAX_REQUESTS - bucket.timestamps.length, now + OWNER_WINDOW_MS);
      return true;
    }

    // Sliding window: check against max
    const oldestInWindow = bucket.timestamps[0]!;
    if (bucket.timestamps.length >= OWNER_MAX_REQUESTS) {
      const retryAfterMs = oldestInWindow + OWNER_WINDOW_MS - now;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      response.setHeader("Retry-After", String(retryAfterSeconds));
      throw new HttpException("Too many RPC requests (owner key limit)", HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.timestamps.push(now);
    this.setOwnerHeaders(response, OWNER_MAX_REQUESTS - bucket.timestamps.length, oldestInWindow + OWNER_WINDOW_MS);
    return true;
  }

  private setIpHeaders(response: Response, remaining: number, resetAt: number): void {
    response.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  }

  private setOwnerHeaders(response: Response, remaining: number, resetAt: number): void {
    response.setHeader("X-RateLimit-Limit", String(OWNER_MAX_REQUESTS));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  }
}

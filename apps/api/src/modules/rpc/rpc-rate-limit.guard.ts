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

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

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
  private readonly buckets = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    const ip = getClientIp(request);
    const existing = this.buckets.get(ip);

    if (!existing || now >= existing.resetAt) {
      this.buckets.set(ip, {
        count: 1,
        resetAt: now + WINDOW_MS
      });
      return true;
    }

    if (existing.count >= MAX_REQUESTS) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      );
      response.setHeader("Retry-After", String(retryAfterSeconds));
      throw new HttpException("Too many RPC requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    return true;
  }
}

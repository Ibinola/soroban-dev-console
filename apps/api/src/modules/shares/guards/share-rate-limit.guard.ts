import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

// In-memory or Redis-backed store for demonstration (production should use Redis)
interface IPRecord {
  requests: number;
  windowStart: number;
  consecutiveFailures: number;
  blockedUntil?: number;
}

const ipStore = new Map<string, IPRecord>();

@Injectable()
export class ShareRateLimitGuard implements CanActivate {
  private readonly RATE_LIMIT = 10; // 10 requests per minute
  private readonly WINDOW_MS = 60 * 1000;
  private readonly MAX_FAILURES = 5;
  private readonly BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  canActivate(context: ExecutionContext): boolean {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    const clientIp = (request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown') as string;
    const now = Date.now();

    let record = ipStore.get(clientIp);

    // 1. Check if IP is currently blocked due to consecutive failures
    if (record && record.blockedUntil && now < record.blockedUntil) {
      const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      response.setHeader('Retry-After', retryAfterSeconds);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `IP temporarily blocked due to suspicious enumeration attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 2. Initialize or reset rate limit window
    if (!record || now - record.windowStart > this.WINDOW_MS) {
      record = {
        requests: 0,
        windowStart: now,
        consecutiveFailures: record ? record.consecutiveFailures : 0,
      };
      ipStore.set(clientIp, record);
    }

    // 3. Enforce rate limit (10 req/min)
    if (record.requests >= this.RATE_LIMIT) {
      const resetTime = Math.ceil((record.windowStart + this.WINDOW_MS - now) / 1000);
      response.setHeader('X-RateLimit-Limit', this.RATE_LIMIT);
      response.setHeader('X-RateLimit-Remaining', 0);
      response.setHeader('Retry-After', resetTime);
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Rate Limit Exceeded',
          message: 'Rate limit of 10 requests per minute exceeded for share link resolution.',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    record.requests++;
    const remaining = Math.max(0, this.RATE_LIMIT - record.requests);
    response.setHeader('X-RateLimit-Limit', this.RATE_LIMIT);
    response.setHeader('X-RateLimit-Remaining', remaining);

    return true;
  }

  /**
   * Helper called by controller upon an invalid share token resolution attempt.
   * Tracks consecutive failures, triggers 15-minute block at 5 failures, and logs to audit trail. (#1233)
   */
  public static recordFailure(clientIp: string) {
    const now = Date.now();
    let record = ipStore.get(clientIp);

    if (!record) {
      record = { requests: 1, windowStart: now, consecutiveFailures: 0 };
      ipStore.set(clientIp, record);
    }

    record.consecutiveFailures++;

    if (record.consecutiveFailures >= 5) {
      record.blockedUntil = now + (15 * 60 * 1000);
      console.warn(`[SECURITY AUDIT] IP ${clientIp} blocked for 15 minutes after 5 consecutive share token enumeration failures.`);
      // Insert actual audit service logging call here
    }
  }

  public static recordSuccess(clientIp: string) {
    const record = ipStore.get(clientIp);
    if (record) {
      record.consecutiveFailures = 0; // Reset consecutive failures on success
    }
  }
}
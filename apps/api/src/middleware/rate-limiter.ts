import type { Request, RequestHandler } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
};

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

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const buckets = new Map<string, RateLimitEntry>();

  return (req, res, next) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const existing = buckets.get(ip);

    if (!existing || now >= existing.resetAt) {
      buckets.set(ip, {
        count: 1,
        resetAt: now + options.windowMs
      });
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      );

      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: "Too many requests"
      });
      return;
    }

    existing.count += 1;
    next();
  };
}

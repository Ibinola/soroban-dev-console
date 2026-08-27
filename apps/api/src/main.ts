import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module.js";
import { validateEnv } from "./lib/validate-env.js";
import { ApiErrorFilter } from "./lib/api-error.filter.js";
import { ApiResponseInterceptor } from "./lib/api-response.interceptor.js";
import { CorrelationInterceptor } from "./lib/correlation.interceptor.js";
import { DEFAULT_API_PORT } from "@devconsole/api-contracts";
// Issue #941: CSRF protection
import { CsrfGuard } from "./common/guards/csrf.guard.js";

function buildCspHeader(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.stellar.org",
  ];
  return directives.join("; ");
}

function buildCorsOrigin() {
  // Issue #944: ALLOWED_ORIGINS is the documented env var for the proxy
  // backend's CORS allowlist; CORS_ORIGINS is kept as a legacy alias.
  const corsOrigins = process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGINS;
  if (corsOrigins) {
    const allowlist = corsOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowlist.includes(origin)) {
        cb(null, true);
      } else {
        console.warn(`[cors] Blocked origin: ${origin}`);
        cb(null, false);
      }
    };
  }

  if (process.env.NODE_ENV === "production") {
    return (_origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      cb(null, false);
    };
  }

  return process.env.WEB_ORIGIN ?? "http://localhost:3000";
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule, {
    cors: false
  });

  app.enableCors({
    origin: buildCorsOrigin(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // DEVOPS-002: Removed x-owner-key from allowedHeaders to avoid advertising
    // sensitive authentication headers in CORS preflight responses.
    // The header is still accepted and processed by the backend.
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
    credentials: true
  });
  app.setGlobalPrefix("api");

  const cspHeader = buildCspHeader();

  // DEVOPS-002: Add security headers to all responses
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0"); // Modern browsers use CSP instead
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", cspHeader);
    next();
  });
  app.useGlobalFilters(new ApiErrorFilter());
  // DEVOPS-001: Register correlation interceptor first to ensure all requests are traced
  app.useGlobalInterceptors(new CorrelationInterceptor(), new ApiResponseInterceptor());
  // Issue #941: Enforce Double Submit Cookie CSRF protection on all mutating endpoints
  app.useGlobalGuards(new CsrfGuard());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false
    })
  );

  const port = Number(process.env.PORT ?? DEFAULT_API_PORT);
  await app.listen(port);
}

void bootstrap();

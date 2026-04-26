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

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule, {
    cors: false
  });

  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

  app.enableCors({
    origin: webOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // DEVOPS-002: Removed x-owner-key from allowedHeaders to avoid advertising
    // sensitive authentication headers in CORS preflight responses.
    // The header is still accepted and processed by the backend.
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
    credentials: true
  });
  app.setGlobalPrefix("api");
  
  // DEVOPS-002: Add security headers to all responses
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0"); // Modern browsers use CSP instead
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.useGlobalFilters(new ApiErrorFilter());
  // DEVOPS-001: Register correlation interceptor first to ensure all requests are traced
  app.useGlobalInterceptors(new CorrelationInterceptor(), new ApiResponseInterceptor());
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

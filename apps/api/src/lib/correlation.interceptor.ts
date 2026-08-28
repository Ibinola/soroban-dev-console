/**
 * DEVOPS-001: Correlation ID interceptor for NestJS.
 *
 * Extracts or generates correlation IDs for every incoming request,
 * sets them in the async context, and adds them to response headers.
 * This enables end-to-end request tracing across the entire stack.
 *
 * INFRA-823: Standardized cross-service tracing with span propagation.
 * Supports frontend → API → worker tracing via x-request-id and x-span-id headers.
 * Background jobs inherit the correlation context from the originating request.
 *
 * Issue #754: Uses structured JSON logger instead of console.log.
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import {
  buildStructuredLogEntry,
  generateCorrelationId,
  runWithCorrelation,
} from "./request-context.js";
import { createLogger } from "./logger.js";

const log = createLogger("CorrelationInterceptor");

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // Extract correlation ID from header or generate new one
    const correlationId =
      (req.headers["x-request-id"] as string) || generateCorrelationId();

    // Set in response headers so client can reference it
    res.setHeader("x-request-id", correlationId);
    res.setHeader("x-correlation-id", correlationId);

    const startTime = Date.now();

    // Log request with correlation ID
    log.info("request.received", {
      correlationId,
      method: req.method,
      path: req.url,
    });

    // Run the handler within the correlation context
    return runWithCorrelation(correlationId, () => {
      return next.handle().pipe(
        tap({
          next: () => {
            const durationMs = Date.now() - startTime;
            log.info("request.completed", {
              correlationId,
              method: req.method,
              path: req.url,
              statusCode: res.statusCode,
              durationMs,
            });
          },
          error: (error) => {
            const durationMs = Date.now() - startTime;
            log.error("request.failed", {
              correlationId,
              method: req.method,
              path: req.url,
              statusCode: res.statusCode,
              durationMs,
              error: error?.message || "Unknown error",
            });
          },
        }),
      );
    });
  }
}

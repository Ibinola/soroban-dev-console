/**
 * DEVOPS-001: Request context for correlation ID propagation.
 *
 * Uses AsyncLocalStorage to maintain correlation IDs throughout the request
 * lifecycle, enabling end-to-end tracing from frontend through API to RPC calls.
 *
 * INFRA-823: Cross-service tracing with span tracking.
 * - correlationId traces the full request chain (frontend → API → worker)
 * - spanId identifies individual processing steps within a request
 *
 * Usage:
 *   - CorrelationInterceptor sets the ID on incoming requests
 *   - Services can retrieve it via getCorrelationId()
 *   - All logs and upstream calls should include it
 *   - Background workers propagate the span from the originating request
 */

import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

interface RequestContext {
  correlationId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface StructuredLogEntry {
  level: "info" | "error";
  correlationId: string;
  spanId?: string;
  message: string;
  method?: string;
  path?: string;
  statusCode?: number;
  error?: string;
  workerType?: string;
  jobId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current correlation ID from request context.
 * Returns undefined if called outside of a request context.
 */
export function getCorrelationId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.correlationId;
}

/**
 * Get the current span ID from request context.
 */
export function getSpanId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.spanId;
}

/**
 * Create a child span within the current trace context.
 * Used by background workers to inherit tracing context.
 */
export function createChildSpan(): { correlationId: string; spanId: string; parentSpanId?: string } {
  const context = asyncLocalStorage.getStore();
  const spanId = randomUUID();
  return {
    correlationId: context?.correlationId ?? "unknown",
    spanId,
    parentSpanId: context?.spanId,
  };
}

/**
 * Run a function with a specific correlation ID and span ID in context.
 * Used internally by the interceptor and background worker tracing.
 */
export function runWithCorrelation<T>(
  correlationId: string,
  fn: () => T,
  spanId?: string,
): T {
  return asyncLocalStorage.run({ correlationId, spanId: spanId ?? randomUUID() }, fn);
}

/**
 * Generate a new correlation ID (UUID v4).
 * Exported for use in frontend clients.
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

export function buildStructuredLogEntry(
  entry: Omit<StructuredLogEntry, "correlationId"> & { correlationId?: string },
): StructuredLogEntry {
  return {
    level: entry.level,
    correlationId: entry.correlationId ?? "unknown",
    spanId: entry.spanId ?? getSpanId(),
    message: entry.message,
    method: entry.method,
    path: entry.path,
    statusCode: entry.statusCode,
    error: entry.error,
    workerType: entry.workerType,
    jobId: entry.jobId,
  };
}

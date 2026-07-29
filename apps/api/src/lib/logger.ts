/**
 * DEVOPS-001: Structured JSON logger for the API.
 *
 * Replaces direct console.log/console.error calls with structured log entries.
 * Each entry includes: timestamp, level, correlationId, context, message.
 * Log level is configurable via the LOG_LEVEL env var (default: info).
 *
 * Issue #754: Add structured JSON logging to replace console.log calls.
 */

import { buildStructuredLogEntry, getCorrelationId } from "./request-context.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLevel(): LogLevel {
  const raw = (process.env["LOG_LEVEL"] ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw as LogLevel;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  const configured = getConfiguredLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configured];
}

function writeLog(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const correlationId = getCorrelationId() ?? "system";
  const entry = {
    ...buildStructuredLogEntry({ level: level === "error" ? "error" : "info", correlationId, message }),
    timestamp: new Date().toISOString(),
    context,
    ...meta,
  };

  const serialized = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
}

/**
 * Create a structured logger bound to a named context (class or module name).
 */
export function createLogger(context: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => writeLog("debug", context, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => writeLog("info", context, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => writeLog("warn", context, message, meta),
    error: (message: string, meta?: Record<string, unknown>) => writeLog("error", context, message, meta),
  };
}

/** Singleton logger for use in non-class contexts (e.g. validate-env). */
export const logger = createLogger("App");

import { Injectable, Logger } from "@nestjs/common";
import { redactText } from "../modules/security/services/redaction.service.js";

export interface LogEntry {
  level: "log" | "warn" | "error" | "debug" | "verbose";
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LogRedactionService {
  private readonly logger = new Logger(LogRedactionService.name);

  redact(entry: LogEntry): LogEntry {
    return {
      ...entry,
      message: redactText(entry.message),
      metadata: entry.metadata ? this.redactMetadata(entry.metadata) : undefined,
    };
  }

  private redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string") {
        redacted[key] = redactText(value);
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = this.redactMetadata(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }
}

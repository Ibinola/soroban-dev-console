/**
 * AI-927: Analyze logs with an assistant workflow.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const LOG_ANALYZER_MODEL_VERSION = "rules-v1.0.0" as const;

export interface LogTheme {
  theme: string;
  occurrences: number;
  severity: "info" | "warn" | "error";
  sample: string;
}

export interface CorrelatedEvent {
  eventA: string;
  eventB: string;
  correlation: string;
}

export class AnalyzeLogsDto {
  @IsString()
  sessionId!: string;

  @IsString()
  source!: string;

  @IsArray()
  logLines!: string[];
}

const THEME_RULES: Array<{ pattern: RegExp; theme: string; severity: "info" | "warn" | "error" }> = [
  { pattern: /error|exception|failed|failure/i, theme: "Error", severity: "error" },
  { pattern: /timeout|timed out|deadline exceeded/i, theme: "Timeout", severity: "error" },
  { pattern: /unauthorized|forbidden|403|401/i, theme: "AuthFailure", severity: "error" },
  { pattern: /not found|404/i, theme: "NotFound", severity: "warn" },
  { pattern: /warn|warning/i, theme: "Warning", severity: "warn" },
  { pattern: /rpc|soroban|stellar/i, theme: "RpcActivity", severity: "info" },
  { pattern: /db|prisma|query|sql/i, theme: "DbActivity", severity: "info" },
  { pattern: /start|init|ready|listening/i, theme: "Lifecycle", severity: "info" },
];

function buildThemes(lines: string[]): LogTheme[] {
  const themeMap = new Map<string, { count: number; severity: LogTheme["severity"]; sample: string }>();

  for (const line of lines) {
    for (const rule of THEME_RULES) {
      if (rule.pattern.test(line)) {
        const existing = themeMap.get(rule.theme);
        if (existing) {
          existing.count++;
        } else {
          themeMap.set(rule.theme, { count: 1, severity: rule.severity, sample: line.slice(0, 120) });
        }
        break;
      }
    }
  }

  return [...themeMap.entries()]
    .map(([theme, { count, severity, sample }]) => ({ theme, occurrences: count, severity, sample }))
    .sort((a, b) => {
      const order = { error: 0, warn: 1, info: 2 };
      return order[a.severity] - order[b.severity] || b.occurrences - a.occurrences;
    });
}

function correlate(themes: LogTheme[]): CorrelatedEvent[] {
  const events: CorrelatedEvent[] = [];
  const themeNames = themes.map((t) => t.theme);

  if (themeNames.includes("AuthFailure") && themeNames.includes("RpcActivity")) {
    events.push({ eventA: "AuthFailure", eventB: "RpcActivity", correlation: "Auth failures co-occurring with RPC activity may indicate credential issues" });
  }
  if (themeNames.includes("Timeout") && themeNames.includes("DbActivity")) {
    events.push({ eventA: "Timeout", eventB: "DbActivity", correlation: "Timeouts alongside DB activity may point to slow queries" });
  }
  if (themeNames.includes("Error") && themeNames.includes("Lifecycle")) {
    events.push({ eventA: "Error", eventB: "Lifecycle", correlation: "Errors during lifecycle events may indicate startup or shutdown issues" });
  }

  return events;
}

@Injectable()
export class LogAnalyzerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async analyze(dto: AnalyzeLogsDto, actorKey: string) {
    const themes = buildThemes(dto.logLines);
    const correlatedEvents = correlate(themes);
    const errorCount = themes.filter((t) => t.severity === "error").reduce((s, t) => s + t.occurrences, 0);

    const record = await this.prisma.logAnalysisResult.upsert({
      where: { sessionId: dto.sessionId },
      create: {
        sessionId: dto.sessionId,
        source: dto.source,
        lineCount: dto.logLines.length,
        themes: themes as unknown as Prisma.InputJsonValue,
        correlatedEvents: correlatedEvents as unknown as Prisma.InputJsonValue,
        errorCount,
        modelVersion: LOG_ANALYZER_MODEL_VERSION,
      },
      update: {
        source: dto.source,
        lineCount: dto.logLines.length,
        themes: themes as unknown as Prisma.InputJsonValue,
        correlatedEvents: correlatedEvents as unknown as Prisma.InputJsonValue,
        errorCount,
        modelVersion: LOG_ANALYZER_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "log.analysis.completed",
      resourceType: "log_analysis_result",
      resourceId: record.id,
      summary: `Session ${dto.sessionId}: ${dto.logLines.length} lines, ${themes.length} theme(s), ${errorCount} error(s)`,
      metadata: { modelVersion: LOG_ANALYZER_MODEL_VERSION, errorCount } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getBySession(sessionId: string) {
    const record = await this.prisma.logAnalysisResult.findUnique({ where: { sessionId } });
    if (!record) throw new NotFoundException("No log analysis found for this session");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.logAnalysisResult.findMany({ orderBy: { createdAt: "desc" } });
  }
}

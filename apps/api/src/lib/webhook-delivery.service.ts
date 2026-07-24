/**
 * Issue #752: Webhook replay capability for failed deliveries via background jobs.
 *
 * When a webhook delivery fails (non-2xx, timeout), creates a BackgroundJob of
 * type `webhook.retry` with exponential backoff scheduling:
 *   attempt 1 → 1min, attempt 2 → 5min, attempt 3 → 15min, attempt 4 → 1h, attempt 5 → 4h
 *
 * On final failure (maxAttempts exhausted), the job moves to the dead-letter queue
 * with the last HTTP response logged.
 */

import { Injectable } from "@nestjs/common";
import { BackgroundJobService } from "./background-job.service.js";
import { AuditService } from "./audit.service.js";
import { createLogger } from "./logger.js";
import { createHmac } from "node:crypto";

const log = createLogger("WebhookDeliveryService");

/** Retry delay schedule in milliseconds (5 attempts). */
const RETRY_DELAYS_MS = [
  1 * 60 * 1000,   // 1 min
  5 * 60 * 1000,   // 5 min
  15 * 60 * 1000,  // 15 min
  60 * 60 * 1000,  // 1 h
  4 * 60 * 60 * 1000, // 4 h
];

const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

export interface WebhookDeliveryRecord {
  id: string;
  targetUrl: string;
  event: string;
  resourceId: string;
  actor: string;
  timestamp: string;
  statusCode?: number;
  lastError?: string;
  deliveredAt?: string;
  attempts: number;
}

// In-memory delivery log for the GET /api/webhooks/deliveries endpoint.
// In production this would be persisted in the database.
const deliveryLog: WebhookDeliveryRecord[] = [];
const MAX_LOG_SIZE = 500;

function addToLog(record: WebhookDeliveryRecord): void {
  deliveryLog.unshift(record);
  if (deliveryLog.length > MAX_LOG_SIZE) {
    deliveryLog.splice(MAX_LOG_SIZE);
  }
}

@Injectable()
export class WebhookDeliveryService {
  private readonly targetUrl = process.env["WEBHOOK_TARGET_URL"];
  private readonly secret = process.env["WEBHOOK_SECRET"] ?? "";

  constructor(
    private readonly jobs: BackgroundJobService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Attempt to deliver a webhook event immediately.
   * On failure, schedules a background retry job.
   */
  async deliver(event: string, resourceId: string, actor: string): Promise<void> {
    if (!this.targetUrl) {
      log.debug("webhook.delivery.skipped", { event, resourceId, reason: "WEBHOOK_TARGET_URL not configured" });
      return;
    }

    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({ event, resourceId, actor, timestamp });
    const deliveryId = crypto.randomUUID();

    const record: WebhookDeliveryRecord = {
      id: deliveryId,
      targetUrl: this.targetUrl,
      event,
      resourceId,
      actor,
      timestamp,
      attempts: 1,
    };

    try {
      const statusCode = await this.sendHttp(payload);
      record.statusCode = statusCode;
      record.deliveredAt = new Date().toISOString();
      addToLog(record);
      log.info("webhook.delivery.success", { deliveryId, event, resourceId, statusCode });
    } catch (err) {
      const lastError = err instanceof Error ? err.message : String(err);
      record.lastError = lastError;
      addToLog(record);

      log.warn("webhook.delivery.failed", { deliveryId, event, resourceId, error: lastError });

      // Issue #752: Schedule retry via background job
      await this.jobs.enqueue({
        type: "webhook.retry",
        payload: { deliveryId, targetUrl: this.targetUrl, event, resourceId, actor, timestamp, attempt: 1 },
        maxAttempts: MAX_ATTEMPTS,
        scheduledAt: new Date(Date.now() + RETRY_DELAYS_MS[0]),
        queue: "webhooks",
        priority: 10,
      });
    }
  }

  /**
   * Execute a retry attempt for a previously-failed delivery.
   * Called by the background job processor.
   */
  async retryDelivery(
    deliveryId: string,
    targetUrl: string,
    event: string,
    resourceId: string,
    actor: string,
    timestamp: string,
    attempt: number,
  ): Promise<void> {
    const payload = JSON.stringify({ event, resourceId, actor, timestamp });

    // Update the log record for this delivery
    const existing = deliveryLog.find((r) => r.id === deliveryId);
    if (existing) {
      existing.attempts = attempt;
    }

    try {
      const statusCode = await this.sendHttp(payload, targetUrl);
      if (existing) {
        existing.statusCode = statusCode;
        existing.deliveredAt = new Date().toISOString();
        existing.lastError = undefined;
      }
      log.info("webhook.retry.success", { deliveryId, event, resourceId, attempt, statusCode });
    } catch (err) {
      const lastError = err instanceof Error ? err.message : String(err);
      if (existing) {
        existing.lastError = lastError;
      }

      const isLastAttempt = attempt >= MAX_ATTEMPTS;
      if (isLastAttempt) {
        log.error("webhook.retry.dead_letter", { deliveryId, event, resourceId, attempt, error: lastError });
        await this.audit.log({
          actor: "system:webhooks",
          action: "webhook.delivery.exhausted",
          resourceType: "webhook",
          resourceId: deliveryId,
          summary: `Webhook delivery exhausted all ${MAX_ATTEMPTS} attempts for event ${event}`,
          metadata: { event, targetUrl, error: lastError } as any,
        });
      } else {
        const nextDelay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        log.warn("webhook.retry.rescheduled", { deliveryId, event, resourceId, attempt, nextAttempt: attempt + 1, nextDelayMs: nextDelay });
        // Re-enqueue for next attempt — job processor handles this via the job payload
        await this.jobs.enqueue({
          type: "webhook.retry",
          payload: { deliveryId, targetUrl, event, resourceId, actor, timestamp, attempt: attempt + 1 },
          maxAttempts: MAX_ATTEMPTS,
          scheduledAt: new Date(Date.now() + nextDelay),
          queue: "webhooks",
          priority: 10,
        });
      }

      throw err; // Rethrow so the job is marked failed
    }
  }

  /** Get recent delivery attempts (admin use). */
  getDeliveries(limit = 50): WebhookDeliveryRecord[] {
    return deliveryLog.slice(0, Math.min(limit, MAX_LOG_SIZE));
  }

  private async sendHttp(payload: string, targetUrl?: string): Promise<number> {
    const url = targetUrl ?? this.targetUrl;
    if (!url) throw new Error("No target URL configured");

    const signature = this.secret
      ? "sha256=" + createHmac("sha256", this.secret).update(payload).digest("hex")
      : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(signature ? { "x-webhook-signature-256": signature } : {}),
        },
        body: payload,
        signal: controller.signal,
      });

      if (response.status < 200 || response.status >= 300) {
        const body = await response.text().catch(() => "");
        throw new Error(`Upstream returned ${response.status}: ${body.slice(0, 200)}`);
      }

      return response.status;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

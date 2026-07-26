/**
 * Issue #751: Wire the webhook audit service to emit outbound webhooks on
 * workspace and share domain events.
 *
 * Subscribes to: WORKSPACE_CREATED, WORKSPACE_UPDATED, WORKSPACE_DELETED,
 * SHARE_CREATED, SHARE_REVOKED.
 *
 * Each delivery:
 *   - Builds a structured payload: { event, resourceId, actor, timestamp }
 *   - Signs the payload with WEBHOOK_SECRET via WebhookSignatureService's HMAC
 *   - POSTs to WEBHOOK_TARGET_URL
 *   - If WEBHOOK_TARGET_URL is not set, silently skipped
 */

import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { AuditService } from "./audit.service.js";
import { DomainEventBus } from "./domain-event-bus.js";
import {
  WORKSPACE_CREATED,
  WORKSPACE_UPDATED,
  WORKSPACE_DELETED,
  SHARE_CREATED,
  SHARE_REVOKED,
  type WorkspaceCreatedEvent,
  type WorkspaceUpdatedEvent,
  type WorkspaceDeletedEvent,
  type ShareCreatedEvent,
  type ShareRevokedEvent,
} from "./domain-events.js";
import { createHmac } from "node:crypto";

@Injectable()
export class WebhookAuditService implements OnModuleInit {
  private readonly logger = new Logger(WebhookAuditService.name);
  private readonly targetUrl = process.env["WEBHOOK_TARGET_URL"];
  private readonly secret = process.env["WEBHOOK_SECRET"] ?? "";

  constructor(
    private readonly audit: AuditService,
    private readonly events: DomainEventBus,
  ) {}

  // ── Incoming webhook logging (existing) ──────────────────────────────────

  async accepted(provider: string, webhookId: string): Promise<void> {
    await this.audit.log({
      actor: `webhook:${provider}`,
      action: "webhook.accepted",
      resourceType: "webhook",
      resourceId: webhookId,
      summary: `Accepted webhook ${webhookId} from ${provider}`,
    });
  }

  async rejected(provider: string, webhookId: string, reason: string): Promise<void> {
    await this.audit.log({
      actor: `webhook:${provider}`,
      action: "webhook.rejected",
      resourceType: "webhook",
      resourceId: webhookId,
      summary: `Rejected webhook ${webhookId} from ${provider}: ${reason}`,
    });
  }

  // ── Issue #751: Outbound webhook subscriptions ────────────────────────────

  onModuleInit(): void {
    if (!this.targetUrl) {
      this.logger.log("WEBHOOK_TARGET_URL not set — outbound webhook delivery disabled");
      return;
    }

    this.events.on<WorkspaceCreatedEvent>(WORKSPACE_CREATED, (payload) => {
      void this.deliver(WORKSPACE_CREATED, payload.workspaceId, payload.ownerKey);
    });

    this.events.on<WorkspaceUpdatedEvent>(WORKSPACE_UPDATED, (payload) => {
      void this.deliver(WORKSPACE_UPDATED, payload.workspaceId, payload.ownerKey);
    });

    this.events.on<WorkspaceDeletedEvent>(WORKSPACE_DELETED, (payload) => {
      void this.deliver(WORKSPACE_DELETED, payload.workspaceId, payload.ownerKey);
    });

    this.events.on<ShareCreatedEvent>(SHARE_CREATED, (payload) => {
      void this.deliver(SHARE_CREATED, payload.shareId, "system");
    });

    this.events.on<ShareRevokedEvent>(SHARE_REVOKED, (payload) => {
      void this.deliver(SHARE_REVOKED, payload.shareId, "system");
    });

    this.logger.log(`Outbound webhooks wired to ${this.targetUrl}`);
  }

  // ── Private delivery ──────────────────────────────────────────────────────

  private async deliver(event: string, resourceId: string, actor: string): Promise<void> {
    if (!this.targetUrl) return;

    const timestamp = new Date().toISOString();
    const body = JSON.stringify({ event, resourceId, actor, timestamp });

    const signature = this.secret
      ? "sha256=" + createHmac("sha256", this.secret).update(body).digest("hex")
      : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(this.targetUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(signature ? { "x-webhook-signature-256": signature } : {}),
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        this.logger.warn(`Webhook delivery failed for ${event}: HTTP ${response.status} — ${text.slice(0, 200)}`);
      } else {
        this.logger.debug(`Webhook delivered: ${event} for resource ${resourceId}`);
      }

      await this.audit.log({
        actor: "system:webhooks",
        action: "webhook.outbound.delivered",
        resourceType: "webhook",
        resourceId,
        summary: `Outbound webhook ${event} delivered (status: ${response.status})`,
        metadata: { event, targetUrl: this.targetUrl, status: response.status } as any,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook delivery error for ${event}: ${message}`);
      await this.audit.log({
        actor: "system:webhooks",
        action: "webhook.outbound.failed",
        resourceType: "webhook",
        resourceId,
        summary: `Outbound webhook ${event} delivery failed: ${message}`,
        metadata: { event, error: message } as any,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

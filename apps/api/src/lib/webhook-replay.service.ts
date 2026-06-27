import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

type WebhookReplayRequest = Request & {
  headers: Record<string, string | string[] | undefined>;
};

interface PersistedWebhookId {
  id: string;
  expiresAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class WebhookReplayService {
  private readonly logger = new Logger(WebhookReplayService.name);
  private readonly store: Map<string, number> = new Map();

  private static readonly CLEANUP_INTERVAL = 60_000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), WebhookReplayService.CLEANUP_INTERVAL);
    this.cleanupTimer.unref();
  }

  verify(request: WebhookReplayRequest): void {
    const webhookIdHeader = request.headers["x-webhook-id"] ?? request.headers["x-event-id"];
    const webhookId = Array.isArray(webhookIdHeader) ? webhookIdHeader[0] : webhookIdHeader;

    if (!webhookId) {
      this.logger.warn("Webhook rejected: missing replay identifier");
      throw new UnauthorizedException("Missing webhook replay identifier");
    }

    if (this.store.has(webhookId)) {
      const stored = this.store.get(webhookId)!;
      if (stored > Date.now()) {
        this.logger.warn(`Replay detected for webhook event ${webhookId}`);
        throw new UnauthorizedException("Replay detected for webhook event");
      }
      this.store.delete(webhookId);
    }

    this.store.set(webhookId, Date.now() + TTL_MS);
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, expiresAt] of this.store) {
      if (expiresAt <= now) {
        this.store.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired webhook IDs`);
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

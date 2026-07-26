import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

type WebhookRequest = Request & {
  rawBody?: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class WebhookSignatureService {
  private readonly logger = new Logger(WebhookSignatureService.name);
  private readonly webhookSecret = process.env.WEBHOOK_SECRET ?? "";
  private readonly maxTimestampAgeMs = 5 * 60 * 1000; // 5 minutes

  verify(request: WebhookRequest): void {
    const signatureHeader = request.headers["x-webhook-signature-256"] ?? request.headers["x-webhook-signature"];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    if (!signature) {
      this.logger.warn("Webhook rejected: missing signature header");
      throw new UnauthorizedException("Missing webhook signature");
    }

    if (!this.webhookSecret) {
      this.logger.error("Webhook secret is not configured");
      throw new UnauthorizedException("Webhook secret is not configured");
    }

    const timestampHeader = request.headers["x-webhook-timestamp"];
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    if (timestamp) {
      const now = Date.now();
      const eventTime = new Date(timestamp).getTime();
      if (Number.isNaN(eventTime) || now - eventTime > this.maxTimestampAgeMs) {
        this.logger.warn(`Webhook rejected: stale or invalid timestamp ${timestamp}`);
        throw new UnauthorizedException("Webhook timestamp is stale or invalid");
      }
    }

    const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
    const bodyBuffer =
      typeof rawBody === "string" ? Buffer.from(rawBody) : Buffer.from(rawBody);
    const expected = createHmac("sha256", this.webhookSecret).update(bodyBuffer).digest("hex");

    if (signature.length !== expected.length) {
      this.logger.warn("Webhook rejected: signature length mismatch");
      throw new UnauthorizedException("Invalid webhook signature");
    }

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      this.logger.warn("Webhook rejected: signature mismatch");
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }
}

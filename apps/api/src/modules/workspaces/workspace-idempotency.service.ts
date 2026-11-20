import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

@Injectable()
export class WorkspaceIdempotencyService {
  private readonly cache = new Map<string, CachedResponse>();
  private readonly ttlMs: number;

  constructor() {
    const hoursRaw =
      process.env.WORKSPACE_IDEMPOTENCY_TTL_HOURS ??
      process.env.IDEMPOTENCY_TTL_HOURS ??
      "24";
    const hours = Number(hoursRaw);
    this.ttlMs =
      Number.isFinite(hours) && hours > 0
        ? hours * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;
  }

  private now() {
    return Date.now();
  }

  private cleanupIfExpired(key: string) {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt <= this.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry;
  }

  makeKey(
    ownerKey: string,
    idempotencyKey: string,
    method: string,
    path: string,
    body?: unknown,
  ): string {
    const bodyHash = createHash("sha256")
      .update(JSON.stringify(body ?? null))
      .digest("hex")
      .slice(0, 16);
    return [
      ownerKey,
      idempotencyKey.trim(),
      method.toUpperCase(),
      path,
      bodyHash,
    ].join(":");
  }

  get(key: string): CachedResponse | undefined {
    return this.cleanupIfExpired(key);
  }

  set(key: string, status: number, body: unknown): void {
    this.cache.set(key, {
      status,
      body,
      expiresAt: this.now() + this.ttlMs,
    });
  }
}

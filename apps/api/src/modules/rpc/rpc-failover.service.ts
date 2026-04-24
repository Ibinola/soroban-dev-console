/**
 * BE-008: Upstream RPC failover with weighted endpoint selection and flap prevention.
 *
 * Each network can declare multiple upstream URLs (comma-separated env var).
 * On timeout or repeated failure, the proxy marks an endpoint as degraded and
 * tries the next one. Degraded state is held for COOLDOWN_MS to prevent flapping.
 */

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const FAILURE_THRESHOLD = 3;   // consecutive failures before marking degraded
const COOLDOWN_MS = 30_000;    // how long a degraded endpoint is skipped

interface EndpointState {
  url: string;
  failures: number;
  degradedUntil: number; // epoch ms; 0 = healthy
}

@Injectable()
export class RpcFailoverService {
  private readonly endpoints = new Map<string, EndpointState[]>();

  constructor(private readonly configService: ConfigService) {}

  /** Returns the ordered list of healthy endpoints for a network, falling back to degraded ones. */
  getEndpoints(network: string): string[] {
    const states = this.getOrInit(network);
    const now = Date.now();

    const healthy = states.filter((s) => s.degradedUntil === 0 || now > s.degradedUntil);
    const degraded = states.filter((s) => s.degradedUntil > 0 && now <= s.degradedUntil);

    // Reset cooldown for endpoints that have recovered
    for (const s of healthy) {
      if (s.degradedUntil > 0 && now > s.degradedUntil) {
        s.degradedUntil = 0;
        s.failures = 0;
      }
    }

    return [...healthy, ...degraded].map((s) => s.url);
  }

  /** Call after a successful request to reset failure count. */
  recordSuccess(network: string, url: string): void {
    const state = this.findState(network, url);
    if (state) {
      state.failures = 0;
      state.degradedUntil = 0;
    }
  }

  /** Call after a failed request. Returns true if the endpoint is now degraded. */
  recordFailure(network: string, url: string): boolean {
    const state = this.findState(network, url);
    if (!state) return false;

    state.failures += 1;
    if (state.failures >= FAILURE_THRESHOLD) {
      state.degradedUntil = Date.now() + COOLDOWN_MS;
      return true;
    }
    return false;
  }

  private findState(network: string, url: string): EndpointState | undefined {
    return this.getOrInit(network).find((s) => s.url === url);
  }

  private getOrInit(network: string): EndpointState[] {
    if (!this.endpoints.has(network)) {
      const urls = this.parseUrls(network);
      this.endpoints.set(
        network,
        urls.map((url) => ({ url, failures: 0, degradedUntil: 0 })),
      );
    }
    return this.endpoints.get(network)!;
  }

  private parseUrls(network: string): string[] {
    const key = `SOROBAN_RPC_${network.toUpperCase()}_URL`;
    const raw = this.configService.get<string>(key) ?? "";
    return raw
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }
}

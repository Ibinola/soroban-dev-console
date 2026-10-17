export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  /** Consecutive failures that open the circuit. */
  failureThreshold: number;
  /** How long an open circuit fast-fails before half-opening. */
  cooldownMs: number;
}

export const DEFAULT_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  cooldownMs: 30_000,
};

interface Circuit {
  failures: number;
  openedAt: number | null;
  /** True while the single half-open test request is outstanding. */
  probing: boolean;
}

export interface CircuitSnapshot {
  endpoint: string;
  state: CircuitState;
  consecutiveFailures: number;
  /** ms until an open circuit half-opens, 0 otherwise. */
  retryInMs: number;
}

/** Per-endpoint circuit breakers for upstream RPC calls. */
export class CircuitBreakerRegistry {
  private readonly circuits = new Map<string, Circuit>();

  constructor(
    private readonly options: CircuitBreakerOptions = DEFAULT_CIRCUIT_OPTIONS,
    private readonly now: () => number = Date.now,
  ) {}

  private get(endpoint: string): Circuit {
    let c = this.circuits.get(endpoint);
    if (!c) {
      c = { failures: 0, openedAt: null, probing: false };
      this.circuits.set(endpoint, c);
    }
    return c;
  }

  getState(endpoint: string): CircuitState {
    const c = this.get(endpoint);
    if (c.openedAt === null) return "closed";
    return this.now() - c.openedAt >= this.options.cooldownMs ? "half-open" : "open";
  }

  /**
   * Whether a request may be sent. Closed: always. Open: never (fast fail).
   * Half-open: exactly one test request until it reports back.
   */
  canRequest(endpoint: string): boolean {
    const state = this.getState(endpoint);
    if (state === "closed") return true;
    if (state === "open") return false;
    const c = this.get(endpoint);
    if (c.probing) return false;
    c.probing = true;
    return true;
  }

  recordSuccess(endpoint: string): void {
    const c = this.get(endpoint);
    c.failures = 0;
    c.openedAt = null;
    c.probing = false;
  }

  recordFailure(endpoint: string): void {
    const c = this.get(endpoint);
    c.probing = false;
    c.failures++;
    // A failed half-open probe, or reaching the threshold, (re)opens.
    if (c.openedAt !== null || c.failures >= this.options.failureThreshold) {
      c.openedAt = this.now();
    }
  }

  snapshot(): CircuitSnapshot[] {
    return [...this.circuits.entries()].map(([endpoint, c]) => {
      const state = this.getState(endpoint);
      return {
        endpoint,
        state,
        consecutiveFailures: c.failures,
        retryInMs:
          state === "open" && c.openedAt !== null
            ? Math.max(0, this.options.cooldownMs - (this.now() - c.openedAt))
            : 0,
      };
    });
  }
}

/** Process-wide registry shared by the RPC proxy and the health endpoint. */
export const rpcCircuitBreakers = new CircuitBreakerRegistry();

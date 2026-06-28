type ChaosMode = "delay" | "error" | "drop";

interface ChaosConfig {
  target: "job" | "webhook";
  mode: ChaosMode;
  probability: number;
  delayMs?: number;
}

export function buildChaosConfig(overrides: Partial<ChaosConfig> = {}): ChaosConfig {
  return { target: "job", mode: "delay", probability: 0.2, delayMs: 3000, ...overrides };
}

export function shouldInject(probability: number): boolean {
  return Math.random() < probability;
}

export async function withChaos<T>(fn: () => Promise<T>, config: ChaosConfig): Promise<T> {
  if (!shouldInject(config.probability)) return fn();
  if (config.mode === "error") throw new Error("[chaos] Injected error on " + config.target);
  if (config.mode === "drop") {
    console.warn("[chaos] Dropped " + config.target + " request");
    return undefined as T;
  }
  console.warn("[chaos] Delaying " + config.target + " by " + (config.delayMs ?? 1000) + "ms");
  await new Promise((r) => setTimeout(r, config.delayMs ?? 1000));
  return fn();
}

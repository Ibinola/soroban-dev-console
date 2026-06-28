import { describe, it, expect } from "vitest";

function reserveBudget(
  available: number,
  requested: number
): { ok: boolean; remaining: number } {
  if (requested > available) return { ok: false, remaining: available };
  return { ok: true, remaining: available - requested };
}

describe("budget reservation edge cases", () => {
  it("allows reservation within budget", () => {
    expect(reserveBudget(100, 50)).toEqual({ ok: true, remaining: 50 });
  });

  it("rejects reservation exceeding budget", () => {
    expect(reserveBudget(100, 150)).toEqual({ ok: false, remaining: 100 });
  });

  it("allows exact budget usage", () => {
    expect(reserveBudget(100, 100)).toEqual({ ok: true, remaining: 0 });
  });

  it("handles zero-amount request", () => {
    expect(reserveBudget(100, 0)).toEqual({ ok: true, remaining: 100 });
  });

  it("handles zero available budget", () => {
    expect(reserveBudget(0, 10)).toEqual({ ok: false, remaining: 0 });
  });

  it("handles both zero", () => {
    expect(reserveBudget(0, 0)).toEqual({ ok: true, remaining: 0 });
  });
});

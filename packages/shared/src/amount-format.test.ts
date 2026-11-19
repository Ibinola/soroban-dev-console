import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatAmount } from "./amount-format";

const text = (value: string, options: Parameters<typeof formatAmount>[1]) => {
  const r = formatAmount(value, options);
  assert.ok(r.ok, JSON.stringify(r));
  return r.text;
};
const en = { locale: "en-US" };

describe("locale-aware amount formatter (#1400)", () => {
  it("handles zero, large values and fractional precision deterministically", () => {
    assert.equal(text("0", en), "0");
    assert.equal(text("0.00", en), "0");
    assert.equal(text("1234567.891", en), "1,234,567.89");
    assert.equal(text("123456789012345678901234567890.5", { ...en, maxFractionDigits: 1 }), "123,456,789,012,345,678,901,234,567,890.5");
    assert.equal(text("1.5", { ...en, minFractionDigits: 2 }), "1.50");
    assert.equal(text("1", { ...en, minFractionDigits: 7, maxFractionDigits: 7 }), "1.0000000");
    assert.equal(text("12.3456789", { ...en, maxFractionDigits: 7 }), "12.3456789");
  });

  it("rounds half-up on the decimal digits, including carries", () => {
    assert.equal(text("1.005", en), "1.01");
    assert.equal(text("1.004", en), "1");
    assert.equal(text("0.999", { ...en, maxFractionDigits: 2 }), "1");
    assert.equal(text("999.995", en), "1,000");
    assert.equal(text("2.5", { ...en, maxFractionDigits: 0 }), "3");
    assert.equal(text("2.4", { ...en, maxFractionDigits: 0 }), "2");
    assert.equal(text("9.9", { ...en, maxFractionDigits: 0 }), "10");
  });

  it("takes locale and currency symbol as explicit inputs", () => {
    assert.equal(text("1234567.5", { locale: "de-DE", maxFractionDigits: 2 }), "1.234.567,5");
    assert.equal(text("1234.5", { locale: "en-US", currency: { symbol: "XLM" } }), "1,234.5 XLM");
    assert.equal(text("1234.5", { locale: "en-US", currency: { symbol: "$", position: "prefix" } }), "$1,234.5");
    assert.equal(text("-5.25", { locale: "en-US", currency: { symbol: "$", position: "prefix" } }), "-$5.25");
  });

  it("does not show a negative sign for values that round to zero", () => {
    assert.equal(text("-0.001", en), "0");
    assert.equal(text("-0", en), "0");
  });

  it("returns a safe validation result for invalid decimal strings", () => {
    for (const bad of ["", "abc", "1e5", "1,000", " 1", "1.", ".5", "--1", "01", "1.2.3", "NaN"]) {
      const r = formatAmount(bad, en);
      assert.equal(r.ok, false, bad);
      if (!r.ok) assert.equal(r.code, "INVALID_DECIMAL");
    }
    assert.equal(formatAmount(5 as unknown as string, en).ok, false);
  });

  it("validates options without throwing", () => {
    for (const options of [{ locale: "" }, { locale: "en-US", maxFractionDigits: -1 }, { locale: "en-US", maxFractionDigits: 30 }, { locale: "not a locale!!" }]) {
      const r = formatAmount("1", options as never);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "INVALID_OPTIONS");
    }
  });
});

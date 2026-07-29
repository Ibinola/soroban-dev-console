import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactJsonValue, redactText } from "./redaction.service.js";

describe("redaction service", () => {
  it("redacts emails, tokens, ips, and long hex secrets from text", () => {
    const input =
      "user alice@example.com from 10.0.0.8 used eyJabc.def.ghi and deadbeef".repeat(1);

    const output = redactText(input);

    assert.match(output, /\[REDACTED_EMAIL\]/);
    assert.match(output, /\[REDACTED_TOKEN\]/);
    assert.match(output, /\[REDACTED_IP\]/);
    assert.match(
      redactText("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
      /\[REDACTED_SECRET\]/,
    );
  });

  it("redacts nested strings in JSON-like values", () => {
    const value = {
      summary: "contact alice@example.com",
      nested: ["192.168.1.20", { token: "eyJabc.def.ghi" }],
    };

    assert.deepEqual(redactJsonValue(value), {
      summary: "contact [REDACTED_EMAIL]",
      nested: ["[REDACTED_IP]", { token: "[REDACTED_TOKEN]" }],
    });
  });

  it("redacts GitHub tokens", () => {
    const result = redactText("ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd");
    assert.match(result, /\[REDACTED_GITHUB_TOKEN\]/);
  });

  it("redacts wallet seeds and Stellar public keys", () => {
    const result = redactText("wallet: GABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
    assert.match(result, /\[REDACTED_WALLET_KEY\]/);
  });

  it("redacts auth header values", () => {
    const result = redactText("Authorization: Bearer some-token-value");
    assert.match(result, /\[REDACTED\]/);
  });

  it("redacts NPM tokens", () => {
    const result = redactText("npm_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert.match(result, /\[REDACTED_NPM_TOKEN\]/);
  });

  it("redacts phone numbers", () => {
    const result = redactText("call +1-555-123-4567 for help");
    assert.match(result, /\[REDACTED_PHONE\]/);
  });

  it("redacts credit card numbers", () => {
    const result = redactText("card 4111 1111 1111 1111");
    assert.match(result, /\[REDACTED_CARD\]/);
  });

  it("redacts SSNs", () => {
    const result = redactText("ssn 123-45-6789");
    assert.match(result, /\[REDACTED_SSN\]/);
  });

  it("handles unknown types in redactJsonValue", () => {
    assert.equal(redactJsonValue(null), null);
    assert.equal(redactJsonValue(42), 42);
    assert.equal(redactJsonValue(true), true);
    assert.equal(redactJsonValue("hello"), "hello");
  });
});
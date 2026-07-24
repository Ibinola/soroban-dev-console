import { Injectable } from "@nestjs/common";
import { REDACTION_PATTERNS } from "./redaction-patterns.js";

export function redactText(value: string): string {
  let result = value;

  for (const pattern of REDACTION_PATTERNS) {
    result = result.replace(pattern.regex, pattern.replacement);
  }

  return result;
}

export function redactJsonValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        redactJsonValue(item),
      ]),
    );
  }

  return value;
}

@Injectable()
export class RedactionService {
  redactText(value: string): string {
    return redactText(value);
  }

  redactJsonValue(value: unknown): unknown {
    return redactJsonValue(value);
  }
}

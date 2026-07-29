import { BadRequestException } from "@nestjs/common";

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_STRING_LENGTH = 10_000;

function getDepth(value: unknown, current: number, maxDepth: number): number {
  if (current > maxDepth) return current;
  if (value === null || value === undefined) return current;
  if (typeof value !== "object") return current;

  let max = current;
  const entries = Array.isArray(value)
    ? value.map((v) => [null, v] as const)
    : Object.entries(value as Record<string, unknown>);

  for (const [, child] of entries) {
    const childDepth = getDepth(child, current + 1, maxDepth);
    if (childDepth > max) max = childDepth;
    if (max > maxDepth) break;
  }

  return max;
}

function checkStringLength(
  value: unknown,
  maxStringLength: number,
  path: string,
): string | null {
  if (typeof value === "string" && value.length > maxStringLength) {
    return `String at "${path}" exceeds max length of ${maxStringLength} (got ${value.length})`;
  }
  if (value === null || value === undefined || typeof value !== "object") {
    return null;
  }

  const entries = Array.isArray(value)
    ? value.map((v) => [null, v] as const)
    : Object.entries(value as Record<string, unknown>);

  for (const [key, child] of entries) {
    const childPath = key !== null ? `${path}.${key}` : `${path}[]`;
    const error = checkStringLength(child, maxStringLength, childPath);
    if (error) return error;
  }

  return null;
}

export function validateJsonDepth(
  payload: unknown,
  maxDepth: number = DEFAULT_MAX_DEPTH,
  maxStringLength: number = DEFAULT_MAX_STRING_LENGTH,
): void {
  const depth = getDepth(payload, 0, maxDepth);
  if (depth > maxDepth) {
    throw new BadRequestException(
      `JSON nesting depth exceeds limit of ${maxDepth} levels (got ${depth})`,
    );
  }

  const stringError = checkStringLength(payload, maxStringLength, "$");
  if (stringError) {
    throw new BadRequestException(stringError);
  }
}

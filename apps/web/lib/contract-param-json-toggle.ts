/**
 * Utilities for toggling and validating raw JSON representation of complex ScVal contract call parameters.
 */

export interface JsonToggleResult {
  valid: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export function convertScValArgsToJson(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch (err: any) {
    return '{}';
  }
}

export function parseJsonToScValArgs(jsonString: string): JsonToggleResult {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { valid: false, error: 'Input must be a JSON object mapping argument names to values.' };
    }
    return { valid: true, data: parsed };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Invalid JSON syntax' };
  }
}

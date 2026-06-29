/**
 * BE-321: Deterministic serialization to ensure consistent property ordering for JSON fields.
 */
export function sortJsonKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortJsonKeys);
  }

  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};

  for (const key of sortedKeys) {
    result[key] = sortJsonKeys(obj[key]);
  }

  return result;
}

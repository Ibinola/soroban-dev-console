/**
 * Search a decoded XDR tree for nodes matching a field name or value. (#931)
 */
export interface XdrTreeMatch {
  path: string;
  key: string;
  value: unknown;
}

export function searchXdrTree(node: unknown, query: string, path = "root"): XdrTreeMatch[] {
  const matches: XdrTreeMatch[] = [];
  if (node === null || typeof node !== "object") {
    return matches;
  }

  const lowerQuery = query.toLowerCase();
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const currentPath = `${path}.${key}`;
    const keyHit = key.toLowerCase().includes(lowerQuery);
    const valueHit = typeof value !== "object" && String(value).toLowerCase().includes(lowerQuery);

    if (keyHit || valueHit) {
      matches.push({ path: currentPath, key, value });
    }

    if (value && typeof value === "object") {
      matches.push(...searchXdrTree(value, query, currentPath));
    }
  }

  return matches;
}

export function countXdrTreeMatches(node: unknown, query: string): number {
  return searchXdrTree(node, query).length;
}

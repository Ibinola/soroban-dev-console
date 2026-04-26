export type AuthKind = "account" | "contract";

export interface AuthNode {
  id: string;
  kind: AuthKind;
  address: string;
  functionName?: string;
  children: AuthNode[];
}

export function parseAuthEntry(raw: unknown): AuthNode | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;

  const address = String(entry.address ?? entry.contract_address ?? "");
  const kind: AuthKind =
    entry.kind === "contract" || entry.type === "contract" ? "contract" : "account";

  return {
    id: String(entry.id ?? crypto.randomUUID()),
    kind,
    address,
    functionName: entry.function_name ? String(entry.function_name) : undefined,
    children: Array.isArray(entry.sub_auth)
      ? entry.sub_auth.map(parseAuthEntry).filter((n): n is AuthNode => n !== null)
      : [],
  };
}

export function flattenAuthTree(
  node: AuthNode,
  depth = 0,
): Array<{ node: AuthNode; depth: number }> {
  return [
    { node, depth },
    ...node.children.flatMap((child) => flattenAuthTree(child, depth + 1)),
  ];
}

export function getRequiredSigners(root: AuthNode): string[] {
  return flattenAuthTree(root)
    .filter(({ node }) => node.kind === "account")
    .map(({ node }) => node.address)
    .filter((addr, i, arr) => arr.indexOf(addr) === i);
}

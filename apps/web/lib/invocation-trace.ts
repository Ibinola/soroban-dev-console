export interface TraceNode {
  id: string;
  contractId: string;
  functionName: string;
  args: string[];
  result?: string;
  children: TraceNode[];
  expanded: boolean;
}

export function parseTraceData(raw: unknown): TraceNode | null {
  if (!raw || typeof raw !== "object") return null;
  const node = raw as Record<string, unknown>;

  return {
    id: String(node.id ?? crypto.randomUUID()),
    contractId: String(node.contract_id ?? node.contractId ?? ""),
    functionName: String(node.function ?? node.functionName ?? "unknown"),
    args: Array.isArray(node.args) ? node.args.map(String) : [],
    result: node.result != null ? String(node.result) : undefined,
    children: Array.isArray(node.sub_invocations)
      ? node.sub_invocations
          .map(parseTraceData)
          .filter((n): n is TraceNode => n !== null)
      : [],
    expanded: true,
  };
}

export function toggleNode(root: TraceNode, targetId: string): TraceNode {
  if (root.id === targetId) {
    return { ...root, expanded: !root.expanded };
  }
  return {
    ...root,
    children: root.children.map((child) => toggleNode(child, targetId)),
  };
}

export function flattenTrace(
  node: TraceNode,
  depth = 0,
): Array<{ node: TraceNode; depth: number }> {
  const result: Array<{ node: TraceNode; depth: number }> = [{ node, depth }];
  if (node.expanded) {
    for (const child of node.children) {
      result.push(...flattenTrace(child, depth + 1));
    }
  }
  return result;
}

/**
 * Workspace duplication helper creating deep copies with state resets.
 */

export interface WorkspaceItem {
  id: string;
  name: string;
  contracts: Array<{ id: string; name: string }>;
  createdAt: number;
}

export function duplicateWorkspace(source: WorkspaceItem, newName?: string): WorkspaceItem {
  const timestamp = Date.now();
  return {
    ...JSON.parse(JSON.stringify(source)),
    id: `ws_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
    name: newName || `${source.name} (Copy)`,
    createdAt: timestamp,
  };
}

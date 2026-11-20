/**
 * Workspace activity logger tracking contract additions, edits, and deletions.
 */

export type ActivityAction = 'CONTRACT_ADDED' | 'CONTRACT_EDITED' | 'CONTRACT_DELETED' | 'WORKSPACE_LOCK_TOGGLED';

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  contractId?: string;
  timestamp: number;
  description: string;
}

export class WorkspaceActivityTracker {
  private logs: ActivityEntry[] = [];

  public logEvent(action: ActivityAction, description: string, contractId?: string): ActivityEntry {
    const entry: ActivityEntry = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      contractId,
      timestamp: Date.now(),
      description,
    };
    this.logs.unshift(entry);
    return entry;
  }

  public getHistory(): ActivityEntry[] {
    return [...this.logs];
  }
}

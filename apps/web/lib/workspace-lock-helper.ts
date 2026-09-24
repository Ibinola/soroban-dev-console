/**
 * Helper for managing read-only workspace lock state to prevent accidental modifications.
 */

export interface WorkspaceLockState {
  isLocked: boolean;
  lockedAt?: number;
  lockedBy?: string;
}

export function toggleWorkspaceLockState(currentState: WorkspaceLockState): WorkspaceLockState {
  const nextIsLocked = !currentState.isLocked;
  return {
    isLocked: nextIsLocked,
    lockedAt: nextIsLocked ? Date.now() : undefined,
  };
}

export function assertWorkspaceModifiable(state: WorkspaceLockState): void {
  if (state.isLocked) {
    throw new Error('Workspace is locked in read-only mode. Unlock workspace to perform modifications.');
  }
}

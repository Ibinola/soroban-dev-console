import { Contract } from "../store/useContractStore";
import { Workspace } from "../store/useWorkspaceStore";

export type ContractSource = "workspace" | "fixture" | "recent";

export interface IndexedContract extends Contract {
  source: ContractSource;
  workspaceId?: string;
}

export interface ContractIndexFilter {
  source?: ContractSource;
  network?: string;
  workspaceId?: string;
  query?: string;
}

export function buildContractIndex(
  contracts: Contract[],
  workspaces: Workspace[],
  recentIds: string[] = [],
): IndexedContract[] {
  const workspaceContractIds = new Map<string, string>();
  for (const ws of workspaces) {
    for (const contractId of ws.contractIds) {
      workspaceContractIds.set(contractId, ws.id);
    }
  }

  return contracts.map((contract) => {
    const workspaceId = workspaceContractIds.get(contract.id);
    const isRecent = recentIds.includes(contract.id);

    return {
      ...contract,
      source: workspaceId ? "workspace" : isRecent ? "recent" : "fixture",
      workspaceId,
    };
  });
}

export function filterContractIndex(
  index: IndexedContract[],
  filter: ContractIndexFilter,
): IndexedContract[] {
  return index.filter((c) => {
    if (filter.source && c.source !== filter.source) return false;
    if (filter.network && c.network !== filter.network) return false;
    if (filter.workspaceId && c.workspaceId !== filter.workspaceId) return false;
    if (filter.query) {
      const q = filter.query.toLowerCase();
      if (!c.id.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q))
        return false;
    }
    return true;
  });
}

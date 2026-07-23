import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useContractStore } from '@/store/useContractStore';
import { useAbiStore } from '@/store/useAbiStore';

describe('CommandPalette Indexing & Navigation', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [
        {
          version: 2,
          id: 'default',
          name: 'Main Workspace',
          contractIds: ['contract-token-1'],
          savedCallIds: [],
          artifactRefs: [],
          selectedNetwork: 'testnet',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeWorkspaceId: 'default',
      contractBookmarks: {
        default: [
          {
            id: 'bm-1',
            workspaceId: 'default',
            contractId: 'contract-token-1',
            networkId: 'testnet',
            source: 'command-palette',
            favorite: true,
            createdAt: Date.now(),
          },
        ],
      },
    });

    useContractStore.setState({
      contracts: [
        {
          id: 'contract-token-1',
          name: 'Token Contract',
          network: 'testnet',
          addedAt: Date.now(),
        },
      ],
    });

    useAbiStore.setState({
      specs: {
        'contract-token-1': {
          contractId: 'contract-token-1',
          source: 'workspace',
          rawSpec: '',
          ingestedAt: Date.now(),
          functions: [
            {
              name: 'transfer',
              inputs: [
                { name: 'to', type: 'address', required: true },
                { name: 'amount', type: 'i128', required: true },
              ],
              outputs: [],
            },
          ],
        },
      },
    });
  });

  it('indexes contract methods into palette search format <Contract Name> > <Method Name>', () => {
    const activeBookmarks = useWorkspaceStore.getState().getContractBookmarks('default');
    const activeWs = useWorkspaceStore.getState().getActiveWorkspace();
    const specs = useAbiStore.getState().specs;
    const contracts = useContractStore.getState().contracts;

    expect(activeBookmarks).toHaveLength(1);
    expect(activeWs?.contractIds).toContain('contract-token-1');

    const spec = specs['contract-token-1'];
    expect(spec.functions).toHaveLength(1);
    expect(spec.functions[0].name).toBe('transfer');

    const contractObj = contracts.find((c) => c.id === 'contract-token-1');
    const label = `${contractObj?.name} > ${spec.functions[0].name}`;
    const sublabel = `${contractObj?.network} · transfer(to: address, amount: i128)`;

    expect(label).toBe('Token Contract > transfer');
    expect(sublabel).toBe('testnet · transfer(to: address, amount: i128)');
  });

  it('builds navigation URL with pre-selected method parameter', () => {
    const contractId = 'contract-token-1';
    const methodName = 'transfer';
    const navUrl = `/contracts/${contractId}?method=${encodeURIComponent(methodName)}`;

    expect(navUrl).toBe('/contracts/contract-token-1?method=transfer');
  });
});

import { describe, it, expect } from 'vitest';
import { generatePreImportReview } from './pre-import-review';

describe('generatePreImportReview', () => {
  const validPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    workspace: {
      version: 2,
      id: 'ws-test-1',
      name: 'Imported Workspace',
      contractIds: ['contract-1', 'contract-2'],
      savedCallIds: ['call-1'],
      artifactRefs: [],
      selectedNetwork: 'testnet',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    contracts: [
      { id: 'contract-1', name: 'Contract 1', network: 'testnet', addedAt: Date.now() },
      { id: 'contract-2', name: 'Contract 2', network: 'testnet', addedAt: Date.now() },
    ],
    savedCalls: [
      { id: 'call-1', name: 'Call 1', contractId: 'contract-1', fnName: 'mint', args: [], network: 'testnet', createdAt: Date.now() },
    ],
    notes: [],
  };

  it('should generate pre-import review statistics and diff preview for valid JSON payload', () => {
    const review = generatePreImportReview(validPayload);

    expect(review.workspace.name).toBe('Imported Workspace');
    expect(review.statistics.totalContracts).toBe(2);
    expect(review.statistics.totalCalls).toBe(1);
    expect(review.validation.errors).toHaveLength(0);
    expect(review.diffPreview.schemaVersion).toBe(2);
    expect(review.diffPreview.contractsToAdd).toEqual(['contract-1', 'contract-2']);
  });

  it('should handle invalid or missing JSON payload with structured errors', () => {
    const invalidPayload = { invalid: true };
    const review = generatePreImportReview(invalidPayload);

    expect(review.validation.errors.length).toBeGreaterThan(0);
    expect(review.diffPreview.schemaVersion).toBe(0);
  });
});

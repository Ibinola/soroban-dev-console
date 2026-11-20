/**
 * Helper utility for checking browser workspace storage usage against 4MB threshold.
 */

export const STORAGE_WARNING_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4MB

export interface StorageQuotaInfo {
  usedBytes: number;
  thresholdBytes: number;
  percentageUsed: number;
  isNearQuota: boolean;
}

export function calculateStorageSize(data: unknown): number {
  try {
    const str = JSON.stringify(data);
    return new TextEncoder().encode(str).length;
  } catch {
    return 0;
  }
}

export function evaluateWorkspaceQuota(storageData: unknown): StorageQuotaInfo {
  const usedBytes = calculateStorageSize(storageData);
  const percentageUsed = Math.min(100, Number(((usedBytes / STORAGE_WARNING_THRESHOLD_BYTES) * 100).toFixed(2)));
  return {
    usedBytes,
    thresholdBytes: STORAGE_WARNING_THRESHOLD_BYTES,
    percentageUsed,
    isNearQuota: usedBytes >= STORAGE_WARNING_THRESHOLD_BYTES,
  };
}

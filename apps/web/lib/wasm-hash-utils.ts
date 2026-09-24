/**
 * Helper utilities for formatting and copying contract WASM code hashes.
 */

export function truncateWasmHash(hash: string, lead: number = 6, tail: number = 6): string {
  if (!hash || hash.length <= lead + tail) return hash || '';
  return `${hash.slice(0, lead)}...${hash.slice(-tail)}`;
}

export interface WasmBadgeMetadata {
  fullHash: string;
  truncatedHash: string;
  copyToastMessage: string;
}

export function buildWasmBadgeMetadata(hash: string): WasmBadgeMetadata {
  return {
    fullHash: hash,
    truncatedHash: truncateWasmHash(hash),
    copyToastMessage: 'Contract WASM hash copied to clipboard!',
  };
}

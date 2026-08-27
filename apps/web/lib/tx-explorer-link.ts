/**
 * Copy a transaction hash and build its block explorer link. (#913)
 */
export function buildExplorerUrl(hash: string, network: "testnet" | "public" = "testnet"): string {
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

export async function copyHashToClipboard(hash: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(hash);
    return true;
  } catch {
    return false;
  }
}

export function truncateHash(hash: string, length = 8): string {
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

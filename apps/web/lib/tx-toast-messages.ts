/**
 * Build success/error toast copy with a direct explorer link. (#919)
 */
export interface TxToast {
  variant: "success" | "error";
  message: string;
  explorerUrl: string;
}

export function buildExplorerUrl(hash: string, network: "testnet" | "public" = "testnet"): string {
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

export function buildSuccessToast(hash: string, ledger: number, network?: "testnet" | "public"): TxToast {
  return {
    variant: "success",
    message: `Transaction Confirmed in Ledger #${ledger}`,
    explorerUrl: buildExplorerUrl(hash, network),
  };
}

export function buildErrorToast(hash: string, errorCode: string, network?: "testnet" | "public"): TxToast {
  return {
    variant: "error",
    message: `Transaction Failed: ${errorCode}`,
    explorerUrl: buildExplorerUrl(hash, network),
  };
}

"use client";

import { useState } from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { Button } from "@devconsole/ui";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";

/**
 * W7-FE-001 (#675): Surface a dismissible warning when the wallet is
 * configured for a different Stellar network than the one this app
 * currently targets. Without this warning a signer can hit a cryptic
 * transaction failure because the network passphrase embedded in the
 * signed envelope will not match the active network's passphrase.
 *
 * The banner is suppressed when:
 * - No wallet is connected.
 * - The connected provider cannot report its selected network
 *   (e.g. Albedo) — better to stay silent than emit a false positive.
 */
export function WalletNetworkMismatchBanner() {
  const {
    isConnected,
    walletObservedPassphrase,
    walletObservedNetworkName,
    refreshWalletNetworkSnapshot,
  } = useWallet();
  const { getActiveNetworkConfig } = useNetworkStore();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !isConnected) {
    return null;
  }

  // Only render when we have a known wallet passphrase that disagrees with
  // the app's active network.
  if (!walletObservedPassphrase) {
    return null;
  }

  const activeNetwork = getActiveNetworkConfig();
  if (walletObservedPassphrase === activeNetwork.networkPassphrase) {
    return null;
  }

  const quickSwitch =
    walletObservedPassphrase ===
    "Public Global Stellar Network ; September 2015"
      ? "mainnet"
      : walletObservedPassphrase === "Test SDF Network ; September 2015"
        ? "testnet"
        : walletObservedPassphrase === "Test SDF Future Network ; October 2022"
          ? "futurenet"
          : null;

  return (
    <div
      role="alert"
      data-testid="wallet-network-mismatch-banner"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-yellow-300 bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="break-words">
          Wallet is on{" "}
          <strong>{walletObservedNetworkName ?? "an unknown network"}</strong>{" "}
          but this app expects <strong>{activeNetwork.name}</strong>. Signatures
          will fail until they line up.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-yellow-400 px-2 text-xs text-yellow-900 hover:bg-yellow-200 dark:text-yellow-100"
          onClick={() => void refreshWalletNetworkSnapshot()}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Re-check
        </Button>
        {quickSwitch && quickSwitch !== activeNetwork.id && (
          <Button
            size="sm"
            className="h-7 bg-yellow-600 px-2 text-xs text-white hover:bg-yellow-700"
            onClick={() => {
              useNetworkStore.getState().setNetwork(quickSwitch);
            }}
          >
            Switch app to {quickSwitch}
          </Button>
        )}
        <button
          aria-label="Dismiss wallet network mismatch warning"
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-yellow-900 hover:bg-yellow-200 dark:text-yellow-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

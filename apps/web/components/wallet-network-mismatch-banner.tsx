"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore, DEFAULT_NETWORKS } from "@/store/useNetworkStore";
import {
  isWalletNetworkMismatch,
  passphraseToNetworkName,
} from "@/lib/wallet/mismatch";
import { walletProviders } from "@/lib/wallet/provider";
import { AlertTriangle, X, ArrowRightLeft } from "lucide-react";
import { Button } from "@devconsole/ui";

/**
 * W7-FE-002 / #675: A dismissible warning banner shown when the active
 * wallet's network passphrase no longer matches the app's selected
 * network. Identifies both sides and offers a quick-switch action.
 *
 * The dismissal is per-session — refresh to bring it back.
 */
export function WalletNetworkMismatchBanner() {
  const {
    isConnected,
    walletType,
    networkAtConnect,
    networkPassphraseAtConnect,
    sessionStatus,
  } = useWallet();
  const { currentNetwork, customNetworks, setNetwork } = useNetworkStore();

  const [dismissed, setDismissed] = useState(false);
  const [walletPassphrase, setWalletPassphrase] = useState<string | null>(
    networkPassphraseAtConnect,
  );

  // Pull the freshest wallet passphrase whenever the wallet/network changes
  // so re-checks run on every network switch (per #675 criteria).
  useEffect(() => {
    let cancelled = false;

    async function refreshWalletNetwork() {
      if (!isConnected || !walletType) {
        if (!cancelled) setWalletPassphrase(null);
        return;
      }
      const provider = walletProviders[walletType];
      if (!provider?.getNetworkPassphrase) {
        if (!cancelled) setWalletPassphrase(null);
        return;
      }
      try {
        const passphrase = await provider.getNetworkPassphrase();
        if (!cancelled) setWalletPassphrase(passphrase);
      } catch (err) {
        // Network introspection is best-effort — log but don't surface.
        console.warn("Failed to read wallet network", err);
        if (!cancelled) setWalletPassphrase(null);
      }
    }

    void refreshWalletNetwork();
    return () => {
      cancelled = true;
    };
  }, [isConnected, walletType, currentNetwork]);

  // Reset dismissal when the underlying mismatch state changes — we want
  // the banner to reappear if the user resolves a mismatch and then
  // triggers a new one.
  useEffect(() => {
    setDismissed(false);
  }, [walletPassphrase, currentNetwork]);

  if (!isConnected) return null;
  if (sessionStatus !== "mismatch") return null;
  if (dismissed) return null;

  const activeConfig = DEFAULT_NETWORKS[currentNetwork] ??
    customNetworks.find((n) => n.id === currentNetwork);
  if (!activeConfig) return null;

  const mismatch = isWalletNetworkMismatch({
    recordedNetworkId: networkAtConnect,
    recordedNetworkPassphrase: walletPassphrase,
    currentNetworkId: currentNetwork,
    currentNetworkPassphrase: activeConfig.networkPassphrase,
  });

  if (!mismatch) return null;

  const walletNetworkName = passphraseToNetworkName(
    walletPassphrase,
    customNetworks,
  );
  const appNetworkName = activeConfig.name;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-yellow-300 bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          <span className="font-semibold">Network mismatch:</span>{" "}
          your wallet is on{" "}
          <span className="font-mono">{walletNetworkName}</span> but this app
          is set to{" "}
          <span className="font-mono">{appNetworkName}</span>. Transactions
          may fail.
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1 border-yellow-500/60 text-yellow-900 hover:bg-yellow-200 dark:text-yellow-100 dark:hover:bg-yellow-900/50"
          onClick={() => setNetwork(networkAtConnect ?? "testnet")}
          aria-label={`Switch app network to ${walletNetworkName}`}
        >
          <ArrowRightLeft className="h-3 w-3" />
          Switch to {walletNetworkName}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 hover:bg-yellow-200/60 dark:hover:bg-yellow-900/50"
          aria-label="Dismiss mismatch warning"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

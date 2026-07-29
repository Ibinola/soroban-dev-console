"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import { canFundWithProvider, fundWithProvider } from "@/lib/funding";
import { Button } from "@devconsole/ui";
import {
  Dialog as AlertDialog,
  Button as AlertDialogAction,
  DialogContent as AlertDialogContent,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogTrigger as AlertDialogTrigger,
  DialogClose as AlertDialogCancel,
} from "@devconsole/ui";
import { Loader2, Coins, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Horizon } from "@stellar/stellar-sdk";

const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 20; // 60 seconds total

/**
 * Issue #740: Friendbot funding flow with confirmation dialog and balance polling.
 *
 * - Shows a confirmation dialog before calling friendbot (amount, testnet/futurenet only warning)
 * - After funding, polls account balance until it reflects new XLM
 * - Shows success toast with transaction hash and link to the detail page
 * - Handles errors: already funded (409), mainnet blocked, network timeout
 * - Disabled on mainnet
 */
export function FundAccountButton() {
  const { address, isConnected } = useWallet();
  const { getFundingProvider, getActiveNetworkConfig, currentNetwork } = useNetworkStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const provider = getFundingProvider();
  const canFund = canFundWithProvider(provider);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (!isConnected || !address || !canFund) return null;

  const networkName = currentNetwork === "futurenet" ? "Futurenet" : "Testnet";
  const friendbotAmount = "10,000 XLM";

  /**
   * Issue #740: Poll account balance until it reflects the funded amount.
   */
  const pollBalance = (txHash?: string) => {
    const network = getActiveNetworkConfig();
    const horizonUrl = network.horizonUrl ?? "https://horizon-testnet.stellar.org";
    const server = new Horizon.Server(horizonUrl);

    let attempts = 0;
    setIsPolling(true);

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const account = await server.loadAccount(address!);
        const xlm = account.balances.find((b: any) => b.asset_type === "native");
        const bal = parseFloat((xlm as any)?.balance ?? "0");

        if (bal > 0) {
          clearInterval(pollRef.current!);
          setIsPolling(false);

          const explorerBase =
            currentNetwork === "mainnet"
              ? "https://stellar.expert/explorer/public/tx"
              : "https://stellar.expert/explorer/testnet/tx";

          toast.success(
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Account funded! Balance: {bal.toLocaleString()} XLM
              </div>
              {txHash && (
                <a
                  href={`${explorerBase}/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                >
                  View transaction <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>,
            { duration: 8000 },
          );

          setTimeout(() => window.location.reload(), 2000);
        }
      } catch {
        // Account may not be created yet — keep polling
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        clearInterval(pollRef.current!);
        setIsPolling(false);
        toast.warning("Funding may have succeeded but balance polling timed out. Refresh the page to check.");
      }
    }, POLL_INTERVAL_MS);
  };

  const handleFund = async () => {
    setIsLoading(true);
    const toastId = toast.loading("Requesting testnet funding from Friendbot…");

    try {
      const result = await fundWithProvider(address, provider);

      toast.success("Funding request accepted! Waiting for balance to update…", { id: toastId });
      setIsLoading(false);

      // Issue #740: Poll balance until funded amount is reflected
      pollBalance(result.transactionHash);
    } catch (error: any) {
      setIsLoading(false);
      const message: string = error?.message ?? "Funding failed";

      // Issue #740: Handle specific error cases
      if (message.includes("400") || message.includes("already funded") || message.includes("createAccountAlreadyExist")) {
        toast.error("This account is already funded on the testnet.", { id: toastId });
      } else if (message.includes("mainnet")) {
        toast.error("Friendbot is not available on Mainnet.", { id: toastId });
      } else if (message.includes("timeout") || message.includes("network")) {
        toast.error("Network timeout. Check your connection and try again.", { id: toastId });
      } else {
        toast.error(`Funding failed: ${message}`, { id: toastId });
      }
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="secondary"
          disabled={isLoading || isPolling}
          className="gap-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          {isLoading || isPolling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          {isLoading ? "Requesting…" : isPolling ? "Waiting for balance…" : (provider.label ?? "Fund Account")}
        </Button>
      </AlertDialogTrigger>

      {/* Issue #740: Confirmation dialog */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fund Account with Friendbot?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Friendbot will send <strong>{friendbotAmount}</strong> to your account on{" "}
                <strong>{networkName}</strong>.
              </p>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <p className="font-medium">⚠ Testnet / Futurenet Only</p>
                <p className="mt-1 text-xs">
                  Friendbot funds are test tokens with no real value. This action is not
                  available on Mainnet.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                After confirming, the balance will update within a few seconds.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleFund}>
            Confirm &amp; Fund
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

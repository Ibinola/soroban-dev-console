"use client";

/**
 * TokenActionModal
 *
 * Modal for executing SAC (Stellar Asset Contract) token actions
 * such as transfer, burn, mint, and clawback against a deployed token
 * contract. Wired to the unified transaction orchestrator and the
 * connected wallet in PR #652 (W7-FE-003).
 */

import { useState } from "react";
import {
  Contract,
  TransactionBuilder,
  TimeoutInfinite,
  Operation,
  nativeToScVal,
  rpc as SorobanRpc,
  StrKey,
} from "@stellar/stellar-sdk";
import { Button } from "@devconsole/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  orchestrateTx,
  type TxStatus,
} from "@/lib/tx-orchestrator";
import { decodeError, formatErrorForDisplay } from "@/lib/error-decoder";

export type TokenAction = "transfer" | "burn" | "mint" | "clawback";

export interface TokenActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: TokenAction;
  contractId: string;
  /** Required for mint/clawback. Defaults to the connected wallet (assumes
   * the connected wallet is the SAC admin). */
  adminAddress?: string;
  onSuccess?: (txHash: string) => void;
}

const ACTION_LABELS: Record<TokenAction, string> = {
  transfer: "Transfer Tokens",
  burn: "Burn Tokens",
  mint: "Mint Tokens",
  clawback: "Clawback Tokens",
};

const ACTION_DESCRIPTIONS: Record<TokenAction, string> = {
  transfer: "Send tokens from your wallet to a recipient address.",
  burn: "Permanently destroy tokens from your wallet balance.",
  mint: "Issue new tokens to a specified address (requires admin authority).",
  clawback: "Reclaim tokens from a holder address (requires admin authority).",
};

/**
 * Pure helper that constructs the appropriate SAC operation for a token
 * action. Used by both the modal (live flow) and unit tests, so the
 * wiring logic stays in one place.
 */
export function buildSacOperation(
  contract: Contract,
  action: TokenAction,
  from: string,
  to: string,
  amount: bigint,
): Operation {
  const amountSc = nativeToScVal(amount, { type: "i128" });
  switch (action) {
    case "transfer":
      return contract.call(
        "transfer",
        nativeToScVal(from, { type: "address" }),
        nativeToScVal(to, { type: "address" }),
        amountSc,
      );
    case "burn":
      return contract.call(
        "burn",
        nativeToScVal(from, { type: "address" }),
        amountSc,
      );
    case "mint":
      return contract.call(
        "mint",
        nativeToScVal(to, { type: "address" }),
        amountSc,
      );
    case "clawback":
      return contract.call(
        "clawback",
        nativeToScVal(to, { type: "address" }),
        amountSc,
      );
    default:
      throw new Error(`Unknown token action: ${action}`);
  }
}

/** Lightweight Stellar public key validation with a friendly toast. */
function requireValidAddress(label: string, raw: string | null | undefined): string | null {
  if (!raw || !StrKey.isValidEd25519PublicKey(raw.trim())) {
    toast.error(`${label} is not a valid Stellar public key.`);
    return null;
  }
  return raw.trim();
}

export function TokenActionModal({
  open,
  onOpenChange,
  action,
  contractId,
  adminAddress,
  onSuccess,
}: TokenActionModalProps) {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<TxStatus>("idle");

  const { address: walletAddress, isConnected } = useWallet();
  const { getActiveNetworkConfig } = useNetworkStore();

  const needsRecipient = action === "transfer" || action === "mint" || action === "clawback";
  const requiresAdminAuth = action === "mint" || action === "clawback";

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Enter a valid positive amount.");
      return;
    }
    if (needsRecipient && !recipient.trim()) {
      toast.error("Recipient address is required.");
      return;
    }
    if (!isConnected || !walletAddress) {
      toast.error("Connect your wallet to send transactions.");
      return;
    }
    const fromAddr = requireValidAddress("Wallet address", walletAddress);
    if (!fromAddr) return;
    let toAddr: string = fromAddr;
    if (needsRecipient) {
      const validRecipient = requireValidAddress("Recipient address", recipient);
      if (!validRecipient) return;
      toAddr = validRecipient;
    }
    const admin = adminAddress ?? walletAddress;
    if (requiresAdminAuth && admin.toUpperCase() !== fromAddr.toUpperCase()) {
      toast.error(
        "Mint/clawback require admin authority — connect the admin wallet or pass `adminAddress`.",
      );
      return;
    }

    setIsSubmitting(true);
    setStatus("simulating");
    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);
      const sourceAccount = await server.getAccount(fromAddr);

      const op = buildSacOperation(
        new Contract(contractId),
        action,
        fromAddr,
        toAddr,
        BigInt(amount),
      );

      const tx = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(TimeoutInfinite)
        .build();

      const result = await orchestrateTx(
        tx.toXDR(),
        network,
        {},
        (s) => setStatus(s),
      );

      if (result.status === "success") {
        toast.success(
          `${ACTION_LABELS[action]} submitted: ${result.hash?.slice(0, 8)}…`,
        );
        onSuccess?.(result.hash!);
        setAmount("");
        setRecipient("");
        onOpenChange(false);
      } else {
        const decoded = decodeError(result.errorMessage ?? "Transaction failed");
        toast.error(formatErrorForDisplay(decoded));
        setStatus("error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const decoded = decodeError(message);
      toast.error(formatErrorForDisplay(decoded));
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[action]}</DialogTitle>
          <DialogDescription>{ACTION_DESCRIPTIONS[action]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="contract-id">Contract</Label>
            <Input
              id="contract-id"
              value={contractId}
              readOnly
              className="font-mono text-xs text-muted-foreground"
            />
          </div>

          {needsRecipient && (
            <div className="space-y-2">
              <Label htmlFor="recipient">
                {action === "clawback" ? "Holder Address" : "Recipient Address"}
              </Label>
              <Input
                id="recipient"
                placeholder="G..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (stroops / smallest unit)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {requiresAdminAuth && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-700">
              This action requires SAC admin authorization. The connected
              wallet must be the admin signer.
            </p>
          )}

          {status === "awaiting-signature" && (
            <p className="text-xs text-muted-foreground">
              Awaiting wallet signature…
            </p>
          )}
          {status === "submitting" && (
            <p className="text-xs text-muted-foreground">Submitting to network…</p>
          )}
          {status === "polling" && (
            <p className="text-xs text-muted-foreground">Awaiting confirmation…</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ACTION_LABELS[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * TokenActionModal
 *
 * Modal for executing SAC (Stellar Asset Contract) admin token actions
 * (transfer, burn, mint, clawback) against a deployed SAC contract.
 *
 * W7-FE-003: The full submit path is wired to:
 *   1. Build a SAC `Operation` via `buildSacCallOperation`.
 *   2. Build a `TransactionBuilder` from `useWallet`'s connected account.
 *   3. Hand the XDR to `orchestrateTx` which simulates, prepares,
 *      asks the connected wallet to sign, submits, and polls.
 *   4. Surface a normalized status (`simulating | awaiting-signature |
 *      submitting | polling | success | error`) and decode failure
 *      messages through `error-decoder.ts` so the user sees a
 *      categorized summary instead of a raw exception.
 */

import { useMemo, useState } from "react";
import { TransactionBuilder, TimeoutInfinite } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Input,
} from "@devconsole/ui";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import { orchestrateTx, type TxStatus } from "@/lib/tx-orchestrator";
import {
  buildSacCallOperation,
  isPositiveIntString,
} from "@/lib/sac-operations";
import { decodeError, formatErrorForDisplay } from "@/lib/error-decoder";

export type TokenAction = "transfer" | "burn" | "mint" | "clawback";

export interface TokenActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: TokenAction;
  contractId: string;
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

const STATUS_COPY: Record<Exclude<TxStatus, "idle">, string> = {
  simulating: "Simulating…",
  "awaiting-signature": "Awaiting wallet signature…",
  submitting: "Submitting transaction…",
  polling: "Awaiting confirmation…",
  success: "Transaction succeeded",
  error: "Transaction failed",
};

export function TokenActionModal({
  open,
  onOpenChange,
  action,
  contractId,
  onSuccess,
}: TokenActionModalProps) {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");

  const { isConnected, address, isSandboxMode } = useWallet();
  const { getActiveNetworkConfig } = useNetworkStore();

  const needsRecipient =
    action === "transfer" || action === "mint" || action === "clawback";

  // Per-action placeholder hint for the recipient field.
  const recipientLabel = useMemo(() => {
    if (action === "clawback") return "Holder Address";
    if (action === "mint") return "Recipient Address (minted to)";
    return "Recipient Address";
  }, [action]);

  const isBusy = status !== "idle" && status !== "success" && status !== "error";

  const handleClose = (next: boolean) => {
    if (isBusy) return; // Don't close mid-submit.
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!isPositiveIntString(amount)) {
      toast.error("Enter a valid positive integer amount.");
      return;
    }
    if (needsRecipient && !recipient.trim()) {
      toast.error(`${recipientLabel} is required.`);
      return;
    }
    if (!isConnected && !isSandboxMode) {
      toast.error("Connect a wallet or enable sandbox mode first.");
      return;
    }

    setStatus("simulating");
    try {
      const network = getActiveNetworkConfig();
      const server = new Server(network.rpcUrl);
      const sourceAddress = address ?? "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQ4P"; // sandbox placeholder

      // We need a real account for sequence number unless we are in
      // pure simulateOnly flow (which we aren't). Sandbox callers
      // get a dummy account that the RPC will accept only if their
      // tx-orchestrator adapter maps to the actual auth.
      const sourceAccount = await server.getAccount(sourceAddress).catch(() => null);

      let tx;
      try {
        const op = buildSacCallOperation({
          contractId,
          action,
          amount,
          recipient: needsRecipient ? recipient.trim() : undefined,
          from:
            action === "burn" || action === "transfer" || action === "clawback"
              ? address ?? undefined
              : undefined,
        });

        if (sourceAccount) {
          tx = new TransactionBuilder(sourceAccount, {
            fee: "100",
            networkPassphrase: network.networkPassphrase,
          })
            .addOperation(op)
            .setTimeout(TimeoutInfinite)
            .build();
        } else {
          // Build a tx that will only be used for simulation
          tx = new TransactionBuilder(
            {
              accountId: () => sourceAddress,
              sequenceNumber: () => "0",
              incrementSequenceNumber: () => undefined,
            },
            {
              fee: "100",
              networkPassphrase: network.networkPassphrase,
            },
          )
            .addOperation(op)
            .setTimeout(TimeoutInfinite)
            .build();
        }
      } catch (builderErr: unknown) {
        const msg =
          builderErr instanceof Error ? builderErr.message : "Invalid SAC input.";
        toast.error(msg);
        setStatus("error");
        return;
      }

      // Sandbox callers (no connected wallet) get a simulate-only run so
      // they can see validation feedback without triggering a wallet
      // sign-prompt that would always fail.
      const opts = isConnected ? {} : { simulateOnly: true };
      const result = await orchestrateTx(
        tx.toXDR(),
        network,
        opts,
        (next) => setStatus(next),
      );

      if (result.status === "success") {
        const hash = result.hash ?? "(no hash)";
        toast.success(
          `${ACTION_LABELS[action]} succeeded — ${hash.slice(0, 10)}…`,
        );
        onSuccess?.(hash);
        setStatus("success");
        onOpenChange(false);
      } else {
        const decoded = decodeError(result.errorMessage ?? "Unknown error");
        toast.error(formatErrorForDisplay(decoded));
        setStatus("error");
      }
    } catch (err: unknown) {
      const decoded = decodeError(
        err instanceof Error ? err.message : "Unexpected error.",
      );
      toast.error(formatErrorForDisplay(decoded));
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
              <Label htmlFor="recipient">{recipientLabel}</Label>
              <Input
                id="recipient"
                placeholder="G…"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="font-mono text-xs"
                disabled={isBusy}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              disabled={isBusy}
            />
            <p className="text-[10px] text-muted-foreground">
              SAC amounts are i128 — enter the smallest integer unit (e.g.{" "}
              <code>10000000</code> for 1.0 if the asset has 7 decimals).
            </p>
          </div>

          {status !== "idle" && status !== "success" && status !== "error" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {STATUS_COPY[status]}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isBusy}>
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ACTION_LABELS[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

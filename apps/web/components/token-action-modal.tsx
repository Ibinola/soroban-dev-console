"use client";

/**
 * TokenActionModal
 *
 * Modal for executing SAC (Stellar Asset Contract) token actions
 * such as transfer, burn, and mint against a deployed token contract.
 *
 * This component is launched from TokenSacActions and feeds results
 * back to the token dashboard.
 */

import { useState } from "react";
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

export function TokenActionModal({
  open,
  onOpenChange,
  action,
  contractId,
  onSuccess,
}: TokenActionModalProps) {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsRecipient = action === "transfer" || action === "mint" || action === "clawback";

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Enter a valid positive amount.");
      return;
    }
    if (needsRecipient && !recipient.trim()) {
      toast.error("Recipient address is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Wire up to tx-orchestrator / wallet signing flow
      // This is a placeholder — the actual invocation should call
      // the contract via the RPC gateway and prompt wallet signing.
      toast.info(`${ACTION_LABELS[action]} — implementation pending.`);
      onSuccess?.("pending");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Transaction failed.");
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
            <Label htmlFor="amount">Amount</Label>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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

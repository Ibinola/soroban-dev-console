"use client";

import { useState } from "react";
import { Button } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";

export type SACAction = "transfer" | "mint" | "burn" | "balance" | "allowance";

const SAC_ACTIONS: { id: SACAction; label: string; inputs: string[] }[] = [
  { id: "transfer",  label: "Transfer",  inputs: ["from", "to", "amount"] },
  { id: "mint",      label: "Mint",      inputs: ["to", "amount"] },
  { id: "burn",      label: "Burn",      inputs: ["from", "amount"] },
  { id: "balance",   label: "Balance",   inputs: ["id"] },
  { id: "allowance", label: "Allowance", inputs: ["from", "spender"] },
];

interface TokenSacActionsProps {
  contractId: string;
  onExecute: (action: SACAction, args: Record<string, string>) => void;
  /** Called when the contract is not a recognised SAC — falls back to generic flow */
  onFallback?: () => void;
  isKnownSAC?: boolean;
}

/**
 * Spec-aware form for common Stellar Asset Contract (SAC) actions.
 * If `isKnownSAC` is false, renders a fallback prompt instead of the forms.
 */
export function TokenSacActions({
  onExecute,
  onFallback,
  isKnownSAC = true,
}: TokenSacActionsProps) {
  const [selected, setSelected] = useState<SACAction>("transfer");
  const [args, setArgs] = useState<Record<string, string>>({});

  if (!isKnownSAC) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground">
          This contract does not match the standard SAC interface.{" "}
          <button
            className="underline hover:no-underline"
            onClick={onFallback}
          >
            Use generic contract flow
          </button>
        </CardContent>
      </Card>
    );
  }

  const action = SAC_ACTIONS.find((a) => a.id === selected)!;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">SAC Actions</CardTitle>
        <div className="flex flex-wrap gap-2 pt-1">
          {SAC_ACTIONS.map((a) => (
            <Button
              key={a.id}
              size="sm"
              variant={selected === a.id ? "default" : "outline"}
              onClick={() => { setSelected(a.id); setArgs({}); }}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {action.inputs.map((input) => (
          <div key={input} className="space-y-1">
            <Label htmlFor={input}>{input}</Label>
            <Input
              id={input}
              placeholder={input}
              value={args[input] ?? ""}
              onChange={(e) =>
                setArgs((prev) => ({ ...prev, [input]: e.target.value }))
              }
            />
          </div>
        ))}
        <Button
          className="w-full"
          onClick={() => onExecute(selected, args)}
          disabled={action.inputs.some((i) => !args[i])}
        >
          Execute {action.label}
        </Button>
      </CardContent>
    </Card>
  );
}

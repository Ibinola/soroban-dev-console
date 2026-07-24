"use client";

import {
  explainSimulation,
  type SimulationExplanation,
} from "@devconsole/soroban-utils";
import { Badge } from "@devconsole/ui";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

interface SimulationExplainerDisplayProps {
  rawSimulation: unknown;
  connectedAddress?: string | null;
}

export function SimulationExplainerDisplay({
  rawSimulation,
  connectedAddress,
}: SimulationExplainerDisplayProps) {
  const explanation: SimulationExplanation = explainSimulation(rawSimulation as any);

  const normalizedConnected = connectedAddress?.trim().toUpperCase() ?? null;

  const getAuthStatus = (authEntry: { contractId: string; fnName: string }) => {
    const contractUpper = authEntry.contractId.toUpperCase();
    
    if (normalizedConnected && contractUpper === normalizedConnected) {
      return { status: "satisfied", label: "Connected Wallet", color: "bg-green-600" };
    }
    
    if (authEntry.contractId === "unknown") {
      return { status: "requires-signing", label: "Requires Signing", color: "bg-amber-600" };
    }
    
    return { status: "contract-level", label: "Contract Authorization", color: "bg-blue-600" };
  };

  return (
    <div 
      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-4 w-4 text-emerald-700" />
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Simulation Explanation
        </p>
      </div>

      {/* Fees Summary */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-md border bg-background/70 p-2">
          <p className="text-[10px] text-muted-foreground">Inclusion Fee</p>
          <p className="font-mono text-xs font-semibold">{explanation.fees.inclusionFee}</p>
        </div>
        <div className="rounded-md border bg-background/70 p-2">
          <p className="text-[10px] text-muted-foreground">Resource Fee</p>
          <p className="font-mono text-xs font-semibold">{explanation.fees.resourceFee}</p>
        </div>
        <div className="rounded-md border bg-background/70 p-2">
          <p className="text-[10px] text-muted-foreground">Total Fee</p>
          <p className="font-mono text-xs font-semibold">{explanation.fees.totalFee}</p>
        </div>
      </div>

      {/* Output Summary */}
      <div className="mb-3 rounded-md border bg-background/70 p-3">
        <p className="text-[10px] text-muted-foreground mb-1">Output</p>
        <p className="font-mono text-xs">{explanation.outputSummary}</p>
      </div>

      {/* State Changes */}
      {explanation.stateChanges.length > 0 && (
        <div className="mb-3 rounded-md border bg-background/70 p-3">
          <p className="text-[10px] text-muted-foreground mb-1">State Changes</p>
          <ul className="list-disc list-inside text-xs">
            {explanation.stateChanges.map((change, i) => (
              <li key={i}>{change}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Auth Entries - Human Readable */}
      {explanation.authEntries.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-emerald-800 mb-2">
            This transaction requires authorization from:
          </p>
          <div className="space-y-2">
            {explanation.authEntries.map((entry, i) => {
              const authStatus = getAuthStatus(entry);
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border bg-background/70 p-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] break-all">{entry.contractId}</p>
                    <p className="text-[10px] text-muted-foreground">Function: {entry.fnName}</p>
                  </div>
                  <Badge className={`${authStatus.color} text-white`}>
                    {authStatus.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Auth Warning */}
      {explanation.authEntries.length > 1 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">
              Multiple Signers Required
            </p>
            <p className="text-[11px] text-amber-700 mt-1">
              This transaction uses a multi-auth pattern requiring {explanation.authEntries.length} separate authorizations.
            </p>
          </div>
        </div>
      )}

      {/* Warnings */}
      {explanation.warnings.length > 0 && (
        <div className="space-y-2">
          {explanation.warnings.map((warning, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2"
            >
              <AlertTriangle className="h-3 w-3 text-amber-700 mt-0.5" />
              <p className="text-[11px] text-amber-700">{warning}</p>
            </div>
          ))}
        </div>
      )}

      {/* Success indicator */}
      {explanation.success && explanation.warnings.length === 0 && (
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-4 w-4" />
          <p className="text-xs">Simulation successful with no warnings</p>
        </div>
      )}
    </div>
  );
}

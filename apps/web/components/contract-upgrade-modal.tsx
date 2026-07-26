"use client";

import { useState, useMemo } from "react";
import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  TimeoutInfinite,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Alert, AlertDescription, AlertTitle } from "@devconsole/ui";
import {
  Upload,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import { computeSpecDiff, type DiffStatus } from "@/lib/spec-diff";
import type { NormalizedContractSpec } from "@devconsole/soroban-utils";
import { useAbiStore } from "@/store/useAbiStore";

interface ContractUpgradeModalProps {
  contractId: string;
}

function DiffBadge({ status }: { status: DiffStatus }) {
  const styles: Record<DiffStatus, string> = {
    added: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    removed: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    changed: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
    unchanged: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function ContractUpgradeModal({
  contractId,
}: ContractUpgradeModalProps) {
  const { isConnected, address } = useWallet();
  const { getActiveNetworkConfig } = useNetworkStore();
  const { specs } = useAbiStore();

  const [isOpen, setIsOpen] = useState(false);
  const [funcName, setFuncName] = useState("upgrade");
  const [wasmHash, setWasmHash] = useState("");

  const [status, setStatus] = useState<
    "idle" | "simulating" | "ready" | "submitting"
  >("idle");
  const [error, setError] = useState("");
  const [simDetails, setSimDetails] = useState<{
    auth: string[];
    cpu: string;
  } | null>(null);
  const [breakingConfirmed, setBreakingConfirmed] = useState(false);

  const currentSpec: NormalizedContractSpec | undefined = specs[contractId];

  const proposedSpec: NormalizedContractSpec | null = useMemo(() => {
    if (!wasmHash || wasmHash.length !== 64) return null;
    return {
      source: "wasm",
      rawSpec: "",
      functions: currentSpec?.functions.map((f) => ({ ...f })) || [],
      ingestedAt: Date.now(),
    };
  }, [wasmHash, currentSpec]);

  const specDiff = useMemo(() => {
    if (!currentSpec || !proposedSpec) return null;
    return computeSpecDiff(currentSpec, proposedSpec);
  }, [currentSpec, proposedSpec]);

  const resetState = () => {
    setStatus("idle");
    setError("");
    setSimDetails(null);
    setBreakingConfirmed(false);
  };

  const handleSimulate = async () => {
    if (!wasmHash || !funcName) return;
    setStatus("simulating");
    setError("");

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);
      const contract = new Contract(contractId);

      const wasmBuffer = Buffer.from(wasmHash, "hex");
      if (wasmBuffer.length !== 32)
        throw new Error("Invalid WASM Hash (must be 32 bytes hex)");

      const source = address || "GBAB...DUMMY";
      const tx = new TransactionBuilder(
        {
          accountId: () => source,
          sequenceNumber: () => "0",
          incrementSequenceNumber: () => {},
        },
        { fee: "100", networkPassphrase: network.networkPassphrase },
      )
        .addOperation(contract.call(funcName, xdr.ScVal.scvBytes(wasmBuffer)))
        .setTimeout(TimeoutInfinite)
        .build();

      const sim = await server.simulateTransaction(tx);

      if (SorobanRpc.Api.isSimulationSuccess(sim)) {
        setSimDetails({
          auth: sim.result?.auth.map(() => "Authorized") || [],
          cpu: String((sim as unknown as Record<string, unknown>).cost
            ? ((sim as unknown as Record<string, unknown>).cost as Record<string, unknown>).cpuInsns || "0"
            : "0"),
        });
        setStatus("ready");
      } else {
        throw new Error(sim.error || "Simulation failed (Unauthorized?)");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(e);
      setError(message);
      setStatus("idle");
    }
  };

  const handleUpgrade = async () => {
    if (!isConnected || status !== "ready") return;
    setStatus("submitting");

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);
      const contract = new Contract(contractId);
      const wasmBuffer = Buffer.from(wasmHash, "hex");
      const sourceAccount = await server.getAccount(address!);

      const tx = new TransactionBuilder(sourceAccount, {
        fee: "10000",
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(contract.call(funcName, xdr.ScVal.scvBytes(wasmBuffer)))
        .setTimeout(TimeoutInfinite)
        .build();

      const preparedTx = await server.prepareTransaction(tx);
      const signedXdr = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      const res = await server.sendTransaction(
        TransactionBuilder.fromXDR(
          signedXdr.signedTxXdr,
          network.networkPassphrase,
        ),
      );

      if (res.status !== "PENDING")
        throw new Error(`Submission failed: ${res.status}`);

      toast.success("Upgrade transaction sent!");
      setIsOpen(false);
      resetState();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(e);
      toast.error(`Upgrade Failed: ${message}`);
      setStatus("ready");
    }
  };

  const hasBreakingChanges = specDiff?.summary.hasBreakingChanges ?? false;
  const canProceed =
    status === "ready" && (!hasBreakingChanges || breakingConfirmed);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-400 dark:hover:bg-orange-900/20"
        >
          <Upload className="h-4 w-4" />
          Upgrade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Upgrade Contract
          </DialogTitle>
          <DialogDescription>
            Replace the code of this contract instance with a new WASM file.
            <strong> This action is irreversible.</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* WASM Hash Input */}
          <div className="space-y-2">
            <Label>New WASM Hash</Label>
            <Input
              placeholder="e.g. a1b2... (64 hex chars)"
              value={wasmHash}
              onChange={(e) => {
                setWasmHash(e.target.value.trim());
                resetState();
              }}
              className="font-mono text-xs"
            />
          </div>

          {/* Upgrade Function Name */}
          <div className="space-y-2">
            <Label>Upgrade Function Name</Label>
            <Input
              value={funcName}
              onChange={(e) => {
                setFuncName(e.target.value);
                resetState();
              }}
              placeholder="upgrade"
            />
            <p className="text-[10px] text-muted-foreground">
              The function in your contract that calls{" "}
              <code>env.update_current_contract_wasm</code>.
            </p>
          </div>

          {/* WASM Hash Comparison */}
          {currentSpec && wasmHash && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileCode className="h-4 w-4" />
                WASM Hash Comparison
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Current: </span>
                  <span className="break-all">
                    {currentSpec.rawSpec ? "loaded" : "unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">New: </span>
                  <span className="break-all">{wasmHash}</span>
                </div>
              </div>
            </div>
          )}

          {/* Spec Diff */}
          {specDiff && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Function Diff</span>
                <div className="flex gap-2 text-[10px]">
                  {specDiff.summary.added > 0 && (
                    <span className="text-green-600">+{specDiff.summary.added} added</span>
                  )}
                  {specDiff.summary.removed > 0 && (
                    <span className="text-red-600">-{specDiff.summary.removed} removed</span>
                  )}
                  {specDiff.summary.changed > 0 && (
                    <span className="text-yellow-600">~{specDiff.summary.changed} changed</span>
                  )}
                </div>
              </div>

              {hasBreakingChanges && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Breaking Changes Detected</AlertTitle>
                  <AlertDescription>
                    One or more public functions are being removed. This may
                    break existing callers.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {specDiff.functions.map((fn) => (
                  <div
                    key={fn.name}
                    className="flex items-center gap-2 rounded border p-2 text-xs"
                  >
                    <DiffBadge status={fn.status} />
                    <span className="font-mono font-medium">{fn.name}</span>
                    {fn.changes && (
                      <span className="text-muted-foreground">
                        {fn.changes.join("; ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Simulation Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success */}
          {status === "ready" && simDetails && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Ready to Upgrade
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  CPU Cost: {parseInt(simDetails.cpu).toLocaleString()}{" "}
                  instructions
                </p>
                <p>
                  Auth Required:{" "}
                  {simDetails.auth.length > 0 ? "Yes (Admin)" : "None detected"}
                </p>
              </div>
            </div>
          )}

          {/* Breaking Change Confirmation */}
          {hasBreakingChanges && status === "ready" && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
              <input
                type="checkbox"
                id="breaking-confirm"
                checked={breakingConfirmed}
                onChange={(e) => setBreakingConfirmed(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="breaking-confirm" className="text-sm cursor-pointer">
                I understand this upgrade removes public functions and may break
                existing callers
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          {status === "idle" || status === "simulating" ? (
            <Button
              onClick={handleSimulate}
              disabled={!wasmHash || status === "simulating"}
              className="w-full"
            >
              {status === "simulating" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Simulate Upgrade
            </Button>
          ) : (
            <Button
              onClick={handleUpgrade}
              disabled={status === "submitting" || !isConnected || !canProceed}
              variant="destructive"
              className="w-full"
            >
              {status === "submitting" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Upgrade
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

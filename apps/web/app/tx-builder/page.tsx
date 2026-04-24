"use client";

import { signTransaction } from "@stellar/freighter-api";
import {
  Contract,
  TimeoutInfinite,
  TransactionBuilder,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import { Loader2, Send, Terminal, SlidersHorizontal, FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MultiOpCart } from "@/components/multi-op-cart";
import {
  convertToScVal,
  normalizeSimulationResult,
  type NormalizedSimulationResult,
} from "@devconsole/soroban-utils";
import { useNetworkStore } from "@/store/useNetworkStore";
import { SavedCall, useSavedCallsStore } from "@/store/useSavedCallsStore";
import { useWallet } from "@/store/useWallet";
import { Badge } from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";

type SimulationSummary = {
  operationCount: number;
  details: NormalizedSimulationResult;
};

function formatStroops(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Intl.NumberFormat("en-US").format(parsed) : value;
}

function shortKeyBase64(change: NormalizedSimulationResult["stateChanges"][number]) {
  try {
    return change.key.toXDR("base64").slice(0, 24);
  } catch {
    return "unavailable";
  }
}

export default function TxBuilderPage() {
  const { savedCalls, cartItems, addToCart, removeFromCart, moveCartItem, clearCart } =
    useSavedCallsStore();
  const { getActiveNetworkConfig, currentNetwork } = useNetworkStore();
  const { isConnected, address, isSandboxMode, enterSandbox, exitSandbox } = useWallet();

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<SimulationSummary | null>(null);

  // FE-044: fee/resource tuning
  const [showFeeControls, setShowFeeControls] = useState(false);
  const [customFee, setCustomFee] = useState("100");
  const feeOverride = (() => {
    const n = Number(customFee);
    return Number.isFinite(n) && n >= 100 ? String(n) : "100";
  })();

  const networkCalls = useMemo(
    () => savedCalls.filter((call) => call.network === currentNetwork),
    [savedCalls, currentNetwork],
  );

  const resetSimulation = () => {
    setSimulation(null);
    setResult(null);
  };

  const onAddCall = (call: SavedCall) => {
    addToCart(call);
    resetSimulation();
  };

  const onRemoveItem = (cartItemId: string) => {
    removeFromCart(cartItemId);
    resetSimulation();
  };

  const onMoveItem = (cartItemId: string, direction: "up" | "down") => {
    moveCartItem(cartItemId, direction);
    resetSimulation();
  };

  const onClear = () => {
    clearCart();
    resetSimulation();
  };

  const buildOperations = () =>
    cartItems.map((item) => {
      const contract = new Contract(item.contractId);
      const scArgs = item.args.map((arg) => convertToScVal(arg.type, arg.value));
      return contract.call(item.fnName, ...scArgs);
    });

  const handleSimulate = async () => {
    if (cartItems.length < 2) {
      toast.error("Add at least two calls to build a multi-operation transaction.");
      return;
    }
    if (cartItems.some((item) => item.network !== currentNetwork)) {
      toast.error("All operations must match the currently selected network.");
      return;
    }

    setIsLoading(true);
    setResult(null);
    setSimulation(null);

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);
      const operations = buildOperations();

      const source =
        address || "GBZXN7PIRZGNMHGA7MUUUFFAUYVSF74BWXME4R37P2N6F5N4AUM5546F";
      const account = await server.getAccount(source).catch(() => null);
      const sequence = account ? account.sequenceNumber() : "0";

      const txBuilder = new TransactionBuilder(
        {
          accountId: () => source,
          sequenceNumber: () => sequence,
          incrementSequenceNumber: () => {},
        },
        // FE-044: apply fee override
        { fee: feeOverride, networkPassphrase: network.networkPassphrase },
      );

      operations.forEach((op) => txBuilder.addOperation(op));
      const tx = txBuilder.setTimeout(TimeoutInfinite).build();

      const sim = await server.simulateTransaction(tx);
      const normalized = normalizeSimulationResult(sim);
      if (!normalized.ok) throw new Error(normalized.error || "Unknown simulation error");

      setSimulation({ operationCount: operations.length, details: normalized });
      setResult("Simulation success for batched transaction.");
      toast.success("Simulation success");
    } catch (error: any) {
      setSimulation(null);
      setResult(`Simulation failed: ${error.message}`);
      toast.error(`Simulation failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      toast.error("Connect wallet to sign and submit.");
      return;
    }
    if (cartItems.length < 2) {
      toast.error("Add at least two calls to submit a multi-operation transaction.");
      return;
    }
    if (cartItems.some((item) => item.network !== currentNetwork)) {
      toast.error("All operations must match the currently selected network.");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);
      const operations = buildOperations();

      const sourceAccount = await server.getAccount(address);
      const txBuilder = new TransactionBuilder(sourceAccount, {
        // FE-044: apply fee override
        fee: feeOverride,
        networkPassphrase: network.networkPassphrase,
      });
      operations.forEach((op) => txBuilder.addOperation(op));

      const tx = txBuilder.setTimeout(TimeoutInfinite).build();
      const sim = await server.simulateTransaction(tx);
      const normalized = normalizeSimulationResult(sim);
      if (!normalized.ok) {
        throw new Error(`Pre-flight simulation failed: ${normalized.error || "Unknown"}`);
      }

      setSimulation({ operationCount: operations.length, details: normalized });

      const preparedTx = SorobanRpc.assembleTransaction(tx, sim).build();
      const signedResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      const sendResult = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedResult.signedTxXdr, network.networkPassphrase),
      );

      if (sendResult.status !== "PENDING") {
        throw new Error(`Submission failed: ${sendResult.status}`);
      }

      setResult(`Transaction submitted. Hash: ${sendResult.hash}`);
      toast.success("Multi-operation transaction submitted.");
    } catch (error: any) {
      setResult(`Submission failed: ${error.message}`);
      toast.error(`Submission failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Multi-Operation Builder</h1>
        <p className="text-muted-foreground">
          Batch saved contract calls into one atomic transaction. Cart is saved locally.
        </p>
      </div>

      <MultiOpCart
        availableCalls={networkCalls}
        cartItems={cartItems}
        currentNetwork={currentNetwork}
        onAddCall={onAddCall}
        onRemoveItem={onRemoveItem}
        onMoveItem={onMoveItem}
        onClear={onClear}
      />

      <Card>
        <CardHeader>
          <CardTitle>Simulate, Sign, Submit</CardTitle>
          <CardDescription>
            Build one transaction containing all operations in your cart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* FE-043: sandbox banner */}
          {isSandboxMode && (
            <div className="flex items-center justify-between rounded-md border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm">
              <div className="flex items-center gap-2 text-blue-700">
                <FlaskConical className="h-4 w-4" />
                <span>Sandbox mode — simulation only</span>
              </div>
              <Button variant="ghost" size="sm" className="text-blue-700" onClick={exitSandbox}>
                Exit
              </Button>
            </div>
          )}
          {!isConnected && !isSandboxMode && (
            <div className="flex items-center justify-between rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground">
              <span>No wallet — simulate in sandbox mode</span>
              <Button variant="outline" size="sm" onClick={enterSandbox}>
                <FlaskConical className="mr-1 h-3 w-3" />
                Enter Sandbox
              </Button>
            </div>
          )}

          {/* FE-044: fee controls toggle */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground"
              onClick={() => setShowFeeControls((v) => !v)}
            >
              <SlidersHorizontal className="h-3 w-3" />
              {showFeeControls ? "Hide fee controls" : "Fee controls"}
            </Button>
          </div>

          {showFeeControls && (
            <div className="rounded-md border border-dashed p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Advanced Fee Override
              </p>
              <div className="max-w-xs space-y-1">
                <Label className="text-xs">Base Fee (stroops, min 100)</Label>
                <Input
                  type="number"
                  min={100}
                  value={customFee}
                  onChange={(e) => setCustomFee(e.target.value)}
                  placeholder="100"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tuned fee stays consistent between simulation and submission.
              </p>
            </div>
          )}
          {simulation && (
            <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge>{simulation.operationCount} operations</Badge>
                {simulation.details.minResourceFee && (
                  <Badge variant="secondary">
                    Min Fee: {formatStroops(simulation.details.minResourceFee)} stroops
                  </Badge>
                )}
                <Badge variant="secondary">
                  {simulation.details.stateChangesCount} state changes
                </Badge>
                {simulation.details.cpuInsns !== undefined && (
                  <Badge variant="secondary">
                    CPU: {formatStroops(String(simulation.details.cpuInsns))}
                  </Badge>
                )}
              </div>

              {simulation.details.stateChanges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No state changes returned by simulation.
                </p>
              ) : (
                <div className="grid gap-2">
                  {simulation.details.stateChanges.map((change, index) => (
                    <div
                      key={`${change.type}-${index}`}
                      className="rounded border bg-background/60 p-2 font-mono text-xs"
                    >
                      <span className="mr-2 font-semibold">{change.type}</span>
                      <span className="text-muted-foreground">
                        key:{shortKeyBase64(change)}…
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="break-all rounded-md border-l-4 border-blue-500 bg-muted p-4 font-mono text-xs">
              {result}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleSimulate}
              disabled={isLoading || cartItems.length < 2}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Terminal className="mr-2 h-4 w-4" />
              )}
              {isSandboxMode ? "Simulate Batch (Sandbox)" : "Simulate Batch"}
            </Button>

            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isLoading || cartItems.length < 2 || !isConnected || isSandboxMode}
              title={isSandboxMode ? "Connect a wallet to submit" : undefined}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Sign &amp; Submit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

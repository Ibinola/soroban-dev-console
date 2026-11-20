"use client";

import { useState } from "react";
import {
  TransactionBuilder,
  TimeoutInfinite,
  Operation,
  Address,
} from "@stellar/stellar-sdk";
import { Server as SorobanServer } from "@stellar/stellar-sdk/rpc";
import { signTransaction } from "@stellar/freighter-api";
import {
  Wand2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Copy,
  Plus,
  Trash2,
  Code2,
} from "lucide-react";
import { Button } from "@devconsole/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { Switch } from "@devconsole/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@devconsole/ui";
import { toast } from "sonner";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useWasmStore, type WasmEntry } from "@/store/useWasmStore";
import { useContractStore } from "@/store/useContractStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  extractContractIdFromDeployResult,
  generateRandomSaltHex,
  validateSaltHex,
  computeContractAddress,
  buildBundledDeployAndInitTx,
  convertToScVal,
  type ArgType,
  type ContractArg,
} from "@devconsole/soroban-utils";
import { copyContractId } from "@/lib/contract-explorer-link";

type Step = "select" | "configure" | "confirm" | "done";

interface InstantiateWizardProps {
  /** Pre-select a specific WASM hash */
  preselectedHash?: string;
}

export function InstantiateWizard({ preselectedHash }: InstantiateWizardProps) {
  const { isConnected, address } = useWallet();
  const { getActiveNetworkConfig } = useNetworkStore();
  const { wasms, associateContract, pinArtifact } = useWasmStore();
  const { addContract } = useContractStore();
  const { activeWorkspaceId, attachArtifact } = useWorkspaceStore();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [selectedHash, setSelectedHash] = useState(preselectedHash ?? "");
  const [salt, setSalt] = useState<string>(() => generateRandomSaltHex());
  const [saltError, setSaltError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultContractId, setResultContractId] = useState<string | null>(null);

  // Issue #1092: Constructor / initialization args
  const [enableInit, setEnableInit] = useState(false);
  const [initFunctionName, setInitFunctionName] = useState("");
  const [constructorArgs, setConstructorArgs] = useState<ContractArg[]>([]);

  const selectedEntry: WasmEntry | undefined = wasms.find((w) => w.hash === selectedHash);

  // Issue #1093: Predicted contract address
  const predictedAddress = (() => {
    if (!address || !salt) return null;
    const saltVal = validateSaltHex(salt);
    if (!saltVal.valid) return null;
    try {
      const network = getActiveNetworkConfig();
      return computeContractAddress(address, salt, network.networkPassphrase);
    } catch {
      return null;
    }
  })();

  const reset = () => {
    setStep("select");
    setSelectedHash(preselectedHash ?? "");
    setSalt(generateRandomSaltHex());
    setSaltError(null);
    setResultContractId(null);
    setEnableInit(false);
    setInitFunctionName("");
    setConstructorArgs([]);
  };

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (!v) reset();
  };

  const handleSaltChange = (val: string) => {
    setSalt(val);
    const check = validateSaltHex(val);
    setSaltError(check.valid ? null : (check.error ?? "Invalid salt"));
  };

  const handleGenerateSalt = () => {
    const newSalt = generateRandomSaltHex();
    setSalt(newSalt);
    setSaltError(null);
    toast.success("Generated 32-byte cryptographically secure salt.");
  };

  const addConstructorArg = () => {
    setConstructorArgs((prev) => [
      ...prev,
      {
        id: `arg-${Date.now()}-${prev.length}`,
        name: `param_${prev.length + 1}`,
        type: "string",
        value: "",
      },
    ]);
  };

  const removeConstructorArg = (id: string) => {
    setConstructorArgs((prev) => prev.filter((a) => a.id !== id));
  };

  const updateConstructorArg = (id: string, field: keyof ContractArg, value: any) => {
    setConstructorArgs((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    );
  };

  const handleInstantiate = async () => {
    if (!address || !isConnected || !selectedHash) return;

    const saltCheck = validateSaltHex(salt);
    if (!saltCheck.valid) {
      toast.error(saltCheck.error ?? "Invalid salt hex");
      return;
    }

    setBusy(true);
    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanServer(network.rpcUrl);
      const sourceAccount = await server.getAccount(address);

      let tx;
      if (enableInit && initFunctionName.trim()) {
        const initArgs = constructorArgs.map((a) => convertToScVal(a.type, a.value));
        tx = buildBundledDeployAndInitTx({
          sourceAccount,
          networkPassphrase: network.networkPassphrase,
          wasmHash: selectedHash,
          deployerAddress: address,
          salt,
          initFunction: initFunctionName.trim(),
          initArgs,
        });
      } else {
        const saltBytes = Buffer.from(salt, "hex");
        tx = new TransactionBuilder(sourceAccount, {
          fee: "10000",
          networkPassphrase: network.networkPassphrase,
        })
          .addOperation(
            Operation.createCustomContract({
              wasmHash: Buffer.from(selectedHash, "hex"),
              address: new Address(address),
              salt: saltBytes,
            }),
          )
          .setTimeout(TimeoutInfinite)
          .build();
      }

      const preparedTx = await server.prepareTransaction(tx);
      const signedXdr = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      const res = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedXdr.signedTxXdr, network.networkPassphrase),
      );

      if (res.status !== "PENDING") throw new Error("Submission failed");

      let contractId: string | null = null;
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await server.getTransaction(res.hash);
        if (status.status === "SUCCESS") {
          contractId = status.resultMetaXdr
            ? extractContractIdFromDeployResult(status.resultMetaXdr)
            : null;
          break;
        }
        if (status.status === "FAILED") throw new Error("Transaction failed");
      }

      const finalId = contractId ?? predictedAddress ?? res.hash;
      const relationship = contractId ? "confirmed" : "inferred";

      associateContract(selectedHash, finalId, relationship);
      pinArtifact(selectedHash, activeWorkspaceId);
      attachArtifact(activeWorkspaceId, { kind: "wasm", id: selectedHash, contractId: finalId, relationship });
      addContract(finalId, network.id);

      setResultContractId(finalId);
      setStep("done");
      toast.success("Contract instantiated!");
    } catch (e: any) {
      toast.error(`Instantiation failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!isConnected}>
          <Wand2 className="mr-2 h-4 w-4" />
          Instantiate Wizard
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Contract Instantiation Wizard
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {(["select", "configure", "confirm", "done"] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span className={step === s ? "font-semibold text-foreground" : ""}>{s}</span>
              {i < 3 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </div>

        {/* Step: select */}
        {step === "select" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose a stored WASM artifact to instantiate.
            </p>
            {wasms.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No WASM artifacts found. Upload one first.
              </p>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {wasms.map((w) => (
                  <button
                    key={w.hash}
                    onClick={() => {
                      setSelectedHash(w.hash);
                      if (w.functions && w.functions.some((f) => f === "init" || f === "__constructor" || f === "initialize")) {
                        setEnableInit(true);
                        setInitFunctionName(w.functions.find((f) => f === "init" || f === "__constructor" || f === "initialize") || "");
                      }
                    }}
                    className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                      selectedHash === w.hash ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{w.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        v{w.version}
                      </Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {w.hash.slice(0, 16)}…
                    </p>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="secondary" className="text-[10px]">{w.network}</Badge>
                      {w.deployedContractId && (
                        <Badge className="text-[10px]">deployed</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!selectedHash}
                onClick={() => setStep("configure")}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: configure */}
        {step === "configure" && selectedEntry && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{selectedEntry.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{selectedEntry.hash.slice(0, 20)}…</p>
            </div>

            {selectedEntry.functions && selectedEntry.functions.length > 0 && (
              <div>
                <Label className="text-xs">Exported Functions</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedEntry.functions.map((fn) => (
                    <Badge key={fn} variant="secondary" className="text-[10px]">{fn}()</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Issue #1093: Salt Parameter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="salt" className="text-xs font-medium">Deterministic Salt (64-char hex)</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={handleGenerateSalt}
                >
                  <Sparkles className="mr-1 h-3 w-3 text-amber-500" />
                  Random Salt
                </Button>
              </div>
              <Input
                id="salt"
                className="font-mono text-xs"
                placeholder="32-byte hex string (64 characters)"
                value={salt}
                maxLength={64}
                onChange={(e) => handleSaltChange(e.target.value)}
              />
              {saltError ? (
                <p className="text-[11px] text-destructive">{saltError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Exact 64 hexadecimal characters ({salt.length}/64).
                </p>
              )}
            </div>

            {/* Predicted Contract Address */}
            {predictedAddress && (
              <div className="rounded border bg-muted/20 p-2 text-xs">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Predicted Address: </span>
                <span className="font-mono">{predictedAddress}</span>
              </div>
            )}

            {/* Issue #1092: Constructor / Init Configuration */}
            <div className="rounded-md border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-primary" />
                  <Label className="text-xs font-medium">Constructor / Init Call</Label>
                </div>
                <Switch checked={enableInit} onCheckedChange={setEnableInit} />
              </div>

              {enableInit && (
                <div className="space-y-2 border-t pt-2">
                  <Input
                    placeholder="Function name (e.g. init, __constructor)"
                    value={initFunctionName}
                    onChange={(e) => setInitFunctionName(e.target.value)}
                    className="h-7 text-xs font-mono"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Parameters</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px]"
                      onClick={addConstructorArg}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                  </div>

                  {constructorArgs.map((arg) => (
                    <div key={arg.id} className="flex items-center gap-1.5">
                      <Input
                        placeholder="Name"
                        value={arg.name ?? ""}
                        onChange={(e) => updateConstructorArg(arg.id, "name", e.target.value)}
                        className="h-7 w-1/3 text-xs font-mono"
                      />
                      <Select
                        value={arg.type}
                        onValueChange={(val) => updateConstructorArg(arg.id, "type", val)}
                      >
                        <SelectTrigger className="h-7 w-1/4 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="address">address</SelectItem>
                          <SelectItem value="symbol">symbol</SelectItem>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="i32">i32</SelectItem>
                          <SelectItem value="u32">u32</SelectItem>
                          <SelectItem value="i128">i128</SelectItem>
                          <SelectItem value="u128">u128</SelectItem>
                          <SelectItem value="bool">bool</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Value"
                        value={arg.value}
                        onChange={(e) => updateConstructorArg(arg.id, "value", e.target.value)}
                        className="h-7 flex-1 text-xs font-mono"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeConstructorArg(arg.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button size="sm" variant="outline" onClick={() => setStep("select")}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button size="sm" disabled={!!saltError} onClick={() => setStep("confirm")}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: confirm */}
        {step === "confirm" && selectedEntry && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Review and confirm instantiation.</p>
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Artifact</span>
                <span className="font-medium">{selectedEntry.name} v{selectedEntry.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <Badge variant="outline" className="text-[10px]">{selectedEntry.network}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salt</span>
                <span className="font-mono text-xs">{salt.slice(0, 10)}…{salt.slice(-10)}</span>
              </div>
              {predictedAddress && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Predicted ID</span>
                  <span className="font-mono text-xs">{predictedAddress.slice(0, 10)}…</span>
                </div>
              )}
              {enableInit && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Initialization</span>
                  <span className="font-mono text-xs">{initFunctionName || "None"} ({constructorArgs.length} args)</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deployer</span>
                <span className="font-mono text-xs">{address?.slice(0, 10)}…</span>
              </div>
            </div>
            <div className="flex justify-between">
              <Button size="sm" variant="outline" onClick={() => setStep("configure")}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button size="sm" onClick={handleInstantiate} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {busy ? "Instantiating…" : "Instantiate"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: done */}
        {step === "done" && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="font-semibold">Contract Instantiated!</p>
            {resultContractId && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                <p className="flex-1 break-all font-mono text-xs">
                  {resultContractId}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    copyContractId(resultContractId);
                    toast.success("Contract ID copied!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              The contract has been linked to your workspace.
            </p>
            <Button size="sm" onClick={() => handleOpen(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

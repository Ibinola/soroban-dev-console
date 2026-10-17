"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useContractStore } from "@/store/useContractStore";
import {
  rpc as SorobanRpc,
  TransactionBuilder,
  TimeoutInfinite,
  hash,
  Address,
  Operation,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import {
  UploadCloud,
  FileCode,
  Loader2,
  CheckCircle,
  Copy,
  ChevronRight,
  ChevronLeft,
  FlaskConical,
  AlertCircle,
  Cpu,
  MemoryStick,
  DollarSign,
} from "lucide-react";
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
import { Badge } from "@devconsole/ui";
import { toast } from "sonner";
import { computeContractAddress, normalizeSimulationResult } from "@devconsole/soroban-utils";
import {
  DEPLOY_STEPS,
  DEPLOY_STEP_LABELS,
  clampRestoredStep,
  nextStep,
  previousStep,
  resolveSaltHex,
  validateStep,
  type DeployStep,
} from "@/lib/deploy-wizard";
import { useDeployWizardStore } from "@/store/useDeployWizardStore";

// #687/#1308: Deploy wizard steps (shared definitions live in lib/deploy-wizard.ts)
const STEP_ORDER = DEPLOY_STEPS;
const STEP_LABELS = DEPLOY_STEP_LABELS;

interface SimulationPreview {
  ok: boolean;
  minResourceFee?: string;
  cpuInsns?: number;
  memBytes?: number;
  error?: string;
}

function formatInt(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "N/A";
  if (bytes < 1024) return `${formatInt(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${units[unitIndex]}`;
}

export default function DeployPage() {
  const { isConnected, address } = useWallet();
  const { getActiveNetworkConfig } = useNetworkStore();
  const { addContract } = useContractStore();

  // Step state (persisted for the session so it survives navigating away)
  const { step: storedStep, saltMode, saltHex, setStep, setSaltMode, setSaltHex } =
    useDeployWizardStore();
  const step: DeployStep = DEPLOY_STEPS.includes(storedStep) ? storedStep : "upload";

  // Step 1: upload
  const [file, setFile] = useState<File | null>(null);

  // Step 2: simulate
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationPreview, setSimulationPreview] = useState<SimulationPreview | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [wasmBuffer, setWasmBuffer] = useState<Buffer | null>(null);

  // Step 3: review + submit
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedId, setDeployedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const draft = {
    hasFile: file !== null,
    saltMode,
    saltHex,
    simulationOk: simulationPreview?.ok === true,
  };

  // The selected file cannot be restored from storage, so a resumed wizard
  // falls back to the furthest step whose inputs are still available.
  useEffect(() => {
    const clamped = clampRestoredStep(step, draft);
    if (clamped !== step && !isDeploying && !deployedId) setStep(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, file, simulationPreview?.ok]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith(".wasm")) {
        toast.error("Please upload a .wasm file");
        return;
      }
      setFile(selected);
      // Reset downstream state if file changes
      setSimulationPreview(null);
      setSimulationError(null);
      setWasmBuffer(null);
    }
  };

  const handleRunSimulation = async () => {
    if (!file || !address || !isConnected) return;
    setIsSimulating(true);
    setSimulationPreview(null);
    setSimulationError(null);

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);

      const arrayBuffer = await file.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      setWasmBuffer(buf);

      const sourceAccount = await server.getAccount(address);

      const installOp = Operation.uploadContractWasm({ wasm: buf });
      const tx = new TransactionBuilder(sourceAccount, {
        fee: "10000",
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(installOp)
        .setTimeout(TimeoutInfinite)
        .build();

      const sim = await server.simulateTransaction(tx);
      const normalized = normalizeSimulationResult(sim);

      if (!normalized.ok) {
        setSimulationError(normalized.error ?? "Simulation failed");
        setSimulationPreview({ ok: false, error: normalized.error });
        return;
      }

      setSimulationPreview({
        ok: true,
        minResourceFee: normalized.minResourceFee,
        cpuInsns: normalized.cpuInsns,
        memBytes: normalized.memBytes,
      });
      toast.success("Simulation succeeded — review the details below");
    } catch (e: any) {
      const msg = e.message ?? "Unknown simulation error";
      setSimulationError(msg);
      setSimulationPreview({ ok: false, error: msg });
      toast.error(`Simulation failed: ${msg}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const deployContract = async () => {
    if (!wasmBuffer || !address || !isConnected) return;

    setIsDeploying(true);
    setDeployedId(null);
    setStatus("Uploading WASM to network…");

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);

      const sourceAccount = await server.getAccount(address);

      const installOp = Operation.uploadContractWasm({ wasm: wasmBuffer });
      const tx = new TransactionBuilder(sourceAccount, {
        fee: "10000",
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(installOp)
        .setTimeout(TimeoutInfinite)
        .build();

      const preparedTx = await server.prepareTransaction(tx);
      const signedXdr = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      setStatus("Submitting WASM…");
      const sendRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedXdr.signedTxXdr, network.networkPassphrase),
      );

      if (sendRes.status !== "PENDING") throw new Error(`WASM upload failed: ${sendRes.status}`);

      setStatus("Waiting for WASM confirmation…");
      let wasmHash = "";
      const getTxStatus = async (txHash: string) => {
        const res = await server.getTransaction(txHash);
        if (res.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return res;
        return null;
      };

      let attempts = 0;
      while (attempts < 10) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await getTxStatus(sendRes.hash);
        if (res) {
          wasmHash = hash(wasmBuffer).toString("hex");
          break;
        }
        attempts++;
      }
      if (!wasmHash) wasmHash = hash(wasmBuffer).toString("hex");

      setStatus("Instantiating contract…");
      const sourceAccount2 = await server.getAccount(address);
      const createOp = Operation.createCustomContract({
        wasmHash: Buffer.from(wasmHash, "hex"),
        address: Address.fromString(address),
        salt: Buffer.from(resolveSaltHex({ saltMode, saltHex }), "hex"),
      });

      const createTx = new TransactionBuilder(sourceAccount2, {
        fee: "10000",
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(createOp)
        .setTimeout(TimeoutInfinite)
        .build();

      const preparedCreate = await server.prepareTransaction(createTx);
      const signedCreate = await signTransaction(preparedCreate.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      const createRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedCreate.signedTxXdr, network.networkPassphrase),
      );
      if (createRes.status !== "PENDING") throw new Error("Instantiation failed");

      setStatus("Finalizing deployment…");
      attempts = 0;
      while (attempts < 10) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await server.getTransaction(createRes.hash);
        if (res.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
          const contractId = computeContractAddress(
            address,
            resolveSaltHex({ saltMode, saltHex }),
            network.networkPassphrase,
          );
          setDeployedId(contractId);
          addContract(contractId, network.id);
          toast.success("Contract deployed successfully!");
          break;
        }
        attempts++;
      }
    } catch (e: any) {
      toast.error(`Deployment failed: ${e.message}`);
    } finally {
      setIsDeploying(false);
      setStatus("");
    }
  };

  const currentStepIndex = STEP_ORDER.indexOf(step);

  if (!isConnected) {
    return (
      <div className="container max-w-2xl p-6">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Deploy Contract</h1>
        <Card className="border-dashed">
          <CardContent className="flex h-40 flex-col items-center justify-center">
            <p className="text-muted-foreground">Connect wallet to deploy contracts</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deploy Contract</h1>
        <p className="text-muted-foreground">
          Upload, simulate, and deploy your Soroban smart contract.
        </p>
      </div>

      {/* #687: Step progress indicator */}
      <div className="flex items-center gap-1">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i < currentStepIndex
                  ? "bg-primary text-primary-foreground"
                  : i === currentStepIndex
                    ? "bg-primary/90 text-primary-foreground ring-2 ring-primary/30"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < currentStepIndex ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-xs ${
                i === currentStepIndex ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {STEP_LABELS[s]}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Configure */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Upload WASM</CardTitle>
            <CardDescription>Upload your compiled Soroban smart contract (.wasm)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="wasm">Contract File</Label>
              <Input id="wasm" type="file" accept=".wasm" onChange={handleFileChange} />
            </div>

            {file && (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                <FileCode className="h-5 w-5 text-blue-500" />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
                <Badge variant="outline">WASM</Badge>
              </div>
            )}

            <div className="flex justify-end">
              <Button disabled={!validateStep("upload", draft).valid} onClick={() => setStep(nextStep("upload", draft))}>
                Next: Configure
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Configure */}
      {step === "configure" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Configure</CardTitle>
            <CardDescription>
              Choose the salt used to derive the contract address. The default salt is all zeros.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="salt-mode">Salt</Label>
              <select
                id="salt-mode"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={saltMode}
                onChange={(e) => setSaltMode(e.target.value === "custom" ? "custom" : "default")}
              >
                <option value="default">Default (zero salt)</option>
                <option value="custom">Custom (32-byte hex)</option>
              </select>
            </div>
            {saltMode === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="salt-hex">Salt (64 hex characters)</Label>
                <Input
                  id="salt-hex"
                  className="font-mono text-xs"
                  value={saltHex}
                  onChange={(e) => setSaltHex(e.target.value)}
                  aria-invalid={!validateStep("configure", draft).valid}
                />
                {!validateStep("configure", draft).valid && (
                  <p className="text-xs text-destructive">{validateStep("configure", draft).error}</p>
                )}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(previousStep("configure"))}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                disabled={!validateStep("configure", draft).valid}
                onClick={() => setStep(nextStep("configure", draft))}
              >
                Next: Review &amp; simulate
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & simulate */}
      {step === "simulate" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review &amp; simulate</CardTitle>
            <CardDescription>
              Run a dry-run simulation to preview fees and resource usage before committing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {file && (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
                <FileCode className="h-4 w-4 text-blue-500" />
                <span className="truncate font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{(file.size / 1024).toFixed(2)} KB</span>
              </div>
            )}

            {isSimulating && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running simulation…
              </div>
            )}

            {simulationError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Simulation Failed</p>
                  <p className="mt-1 font-mono text-xs">{simulationError}</p>
                </div>
              </div>
            )}

            {simulationPreview?.ok && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">Simulation Succeeded</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {simulationPreview.minResourceFee && (
                    <div className="rounded-md border bg-background/70 p-3">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <DollarSign className="h-3 w-3" /> Est. Fee
                      </div>
                      <p className="font-mono text-sm font-semibold">
                        {formatInt(Number(simulationPreview.minResourceFee))} str
                      </p>
                    </div>
                  )}
                  {simulationPreview.cpuInsns !== undefined && (
                    <div className="rounded-md border bg-background/70 p-3">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Cpu className="h-3 w-3" /> CPU
                      </div>
                      <p className="font-mono text-sm font-semibold">
                        {formatInt(simulationPreview.cpuInsns)}
                      </p>
                    </div>
                  )}
                  {simulationPreview.memBytes !== undefined && (
                    <div className="rounded-md border bg-background/70 p-3">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MemoryStick className="h-3 w-3" /> Memory
                      </div>
                      <p className="font-mono text-sm font-semibold">
                        {formatBytes(simulationPreview.memBytes)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(previousStep("simulate"))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleRunSimulation}
                disabled={isSimulating || !file}
                variant={simulationPreview?.ok ? "outline" : "default"}
              >
                {isSimulating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="mr-2 h-4 w-4" />
                )}
                {simulationPreview?.ok ? "Re-Simulate" : "Run Simulation"}
              </Button>
              {simulationPreview?.ok && (
                <Button onClick={() => setStep(nextStep("simulate", draft))}>
                  Next: Deploy
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Deploy */}
      {step === "deploy" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Deploy</CardTitle>
            <CardDescription>
              Confirm the simulation results and deploy your contract on-chain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File</span>
                <span className="font-medium">{file?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span className="font-mono">{file ? (file.size / 1024).toFixed(2) : "—"} KB</span>
              </div>
              {simulationPreview?.minResourceFee && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Fee</span>
                  <span className="font-mono">
                    {formatInt(Number(simulationPreview.minResourceFee))} stroops
                  </span>
                </div>
              )}
              {simulationPreview?.cpuInsns !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU Instructions</span>
                  <span className="font-mono">{formatInt(simulationPreview.cpuInsns)}</span>
                </div>
              )}
              {simulationPreview?.memBytes !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory</span>
                  <span className="font-mono">{formatBytes(simulationPreview.memBytes)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Salt</span>
                <span className="break-all font-mono text-xs">
                  {saltMode === "custom" ? resolveSaltHex({ saltMode, saltHex }) : "default (zero salt)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium">{getActiveNetworkConfig().id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deployer</span>
                <span className="font-mono">{address?.slice(0, 10)}…</span>
              </div>
            </div>

            {isDeploying && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {status}
                </div>
              </div>
            )}

            {deployedId ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:bg-green-900/20">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="font-semibold text-green-700 dark:text-green-400">
                    Deployment Complete!
                  </div>
                </div>
                <p className="mb-2 text-sm text-muted-foreground">Contract ID:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded border bg-background px-2 py-1 font-mono text-xs">
                    {deployedId}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(deployedId);
                      toast.success("Copied!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(previousStep("deploy"))}
                  disabled={isDeploying}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button onClick={deployContract} disabled={isDeploying}>
                  {isDeploying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="mr-2 h-4 w-4" />
                  )}
                  {isDeploying ? "Deploying…" : "Deploy Contract"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

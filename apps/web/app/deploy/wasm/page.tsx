"use client";

import { Fragment, useState, useEffect, useRef, type ChangeEvent, type DragEvent } from "react";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useWasmStore, type WasmEntry, type ProvenanceNode, type DeployPhase } from "@/store/useWasmStore";
import { useContractStore } from "@/store/useContractStore";
import { useDeploymentLogStore } from "@/store/useDeploymentLogStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  TransactionBuilder,
  TimeoutInfinite,
  hash,
  Operation,
  Address,
} from "@stellar/stellar-sdk";
import { Server as SorobanServer } from "@stellar/stellar-sdk/rpc";
import { orchestrateTx } from "@/lib/tx-orchestrator";
import {
  UploadCloud,
  FileCode,
  Loader2,
  Copy,
  Play,
  Trash2,
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  Link,
  CheckCircle2,
  XCircle,
  Circle,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  FlaskConical,
  Eye,
  ExternalLink,
  Sparkles,
  Plus,
  Settings2,
  Code2,
} from "lucide-react";
import { Button } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Switch } from "@devconsole/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@devconsole/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@devconsole/ui";
import { toast } from "sonner";
import { Badge } from "@devconsole/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@devconsole/ui";
import {
  createNormalizedContractSpecFromFunctionNames,
  extractContractIdFromDeployResult,
  fetchMaxWasmSize,
  validateWasmSize,
  DEFAULT_MAX_WASM_SIZE_BYTES,
  validateWasmBinary,
  formatWasmFileSize,
  parseWasmClientSpec,
  type WasmParsedSpec,
  generateRandomSaltHex,
  validateSaltHex,
  computeContractAddress,
  buildBundledDeployAndInitTx,
  convertToScVal,
  type ArgType,
  type ContractArg,
  SOROBAN_WASM_WARN_LIMIT_BYTES,
} from "@devconsole/soroban-utils";
import { parseWasmSectionSizes, type WasmSectionSizes } from "@/lib/artifact-introspection";
import { buildContractExplorerHref, copyContractId } from "@/lib/contract-explorer-link";
import { registerSource } from "@/lib/source-registry";
import { InstantiateWizard } from "@/components/instantiate-wizard";
import { ActionGuard } from "@/components/action-guard";
import { FixtureFallbackIndicator } from "@/components/fixture-fallback-indicator";

// ── Provenance panel ──────────────────────────────────────────────────────────

function ProvenancePanel({ nodes }: { nodes: ProvenanceNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 rounded-md border bg-muted/40 p-2">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
        <GitBranch className="h-3 w-3" /> Provenance
      </p>
      {nodes.map((n) => (
        <div key={n.contractId} className="flex items-center gap-2 text-[11px]">
          <span className="font-mono text-muted-foreground">{n.contractId.slice(0, 10)}…</span>
          <Badge
            variant={n.relationship === "confirmed" ? "default" : "secondary"}
            className="text-[9px]"
          >
            {n.relationship}
          </Badge>
          <span className="text-muted-foreground">{n.network}</span>
        </div>
      ))}
    </div>
  );
}

// ── Verification badge ────────────────────────────────────────────────────────

function VerificationBadge({ entry }: { entry: WasmEntry }) {
  const confirmed = (entry.provenance ?? []).some((p) => p.relationship === "confirmed");
  if (!entry.deployedContractId) return null;
  return confirmed ? (
    <span title="Source verified" className="text-green-500">
      <ShieldCheck className="h-3.5 w-3.5" />
    </span>
  ) : (
    <span title="Verification pending" className="text-yellow-500">
      <ShieldAlert className="h-3.5 w-3.5" />
    </span>
  );
}

// ── Verify source panel ───────────────────────────────────────────────────────

function VerifySourcePanel({
  entry,
  onVerified,
}: {
  entry: WasmEntry;
  onVerified: (contractId: string) => void;
}) {
  const { getActiveNetworkConfig } = useNetworkStore();
  const { address } = useWallet();
  const [repoUrl, setRepoUrl] = useState("");
  const [verifying, setVerifying] = useState(false);

  const registryId = process.env.NEXT_PUBLIC_CONTRACT_SOURCE_REGISTRY ?? null;
  const isConfirmed = (entry.provenance ?? []).some((p) => p.relationship === "confirmed");

  if (!entry.deployedContractId || isConfirmed || !registryId) return null;

  const handleVerify = async () => {
    if (!repoUrl || !address) return;
    setVerifying(true);
    try {
      const network = getActiveNetworkConfig();
      const ok = await registerSource(
        { rpcUrl: network.rpcUrl, networkPassphrase: network.networkPassphrase },
        registryId,
        address,
        entry.deployedContractId!,
        repoUrl,
      );
      if (ok) {
        onVerified(entry.deployedContractId!);
        toast.success("Source registered — provenance confirmed.");
      } else {
        toast.error("Source registration failed.");
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        className="h-7 text-xs"
        placeholder="https://github.com/org/repo"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
      />
      <Button size="sm" variant="outline" onClick={handleVerify} disabled={verifying || !repoUrl}>
        {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link className="h-3 w-3" />}
        <span className="ml-1 text-xs">Verify</span>
      </Button>
    </div>
  );
}

// ── FE-048: Deploy pipeline panel ─────────────────────────────────────────────

const PIPELINE_STEPS: { phase: DeployPhase; label: string }[] = [
  { phase: "install", label: "Install WASM" },
  { phase: "instantiate", label: "Instantiate Contract" },
  { phase: "publish", label: "Publish Artifact" },
];

function DeployPipelinePanel() {
  const { pipeline, resetPipeline } = useWasmStore();
  if (pipeline.phase === "idle") return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Deploy Pipeline</span>
        {(pipeline.phase === "done" || pipeline.phase === "error") && (
          <Button variant="ghost" size="sm" onClick={resetPipeline}>
            <RotateCcw className="mr-1 h-3 w-3" /> Reset
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {PIPELINE_STEPS.map((step, i) => {
          const isActive = pipeline.phase === step.phase;
          const isDone =
            pipeline.phase === "done" ||
            PIPELINE_STEPS.findIndex((s) => s.phase === pipeline.phase) > i;
          const isError = pipeline.phase === "error" && isActive;

          return (
            <div key={step.phase} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-border" />}
              <div className="flex flex-col items-center gap-1">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : isError ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
                <span className={`text-xs ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
        {pipeline.phase === "done" && (
          <div className="flex items-center gap-2">
            <div className="h-px w-6 bg-border" />
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-xs font-medium text-green-600">Done</span>
          </div>
        )}
      </div>
      {pipeline.error && (
        <p className="mt-2 text-xs text-destructive">{pipeline.error}</p>
      )}
      {pipeline.contractId && pipeline.phase === "done" && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Contract: {pipeline.contractId}
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WasmRegistryPage() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isConnected, address, isSandboxMode } = useWallet();
  const { getActiveNetworkConfig, currentNetwork } = useNetworkStore();
  const { wasms, addWasm, removeWasm, associateContract, addProvenanceNode, advancePipeline, resetPipeline } = useWasmStore();
  const { activeWorkspaceId, attachArtifact } = useWorkspaceStore();
  const { addContract } = useContractStore();
  const { entries: deploymentLog, logDeployment } = useDeploymentLogStore();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [wasmName, setWasmName] = useState("");
  const [deployingHash, setDeployingHash] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState<{ contractId: string; txHash: string | null } | null>(null);

  // Issue #1098: optional per-WASM-hash contract alias
  const [contractAliases, setContractAliases] = useState<Record<string, string>>({});
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [previewFunctions, setPreviewFunctions] = useState<string[]>([]);
  const [parsedSpec, setParsedSpec] = useState<WasmParsedSpec | null>(null);
  const [wasmStats, setWasmStats] = useState<{ size: number; hash: string; sections: WasmSectionSizes } | null>(null);
  const [maxWasmSize, setMaxWasmSize] = useState<number>(DEFAULT_MAX_WASM_SIZE_BYTES);

  // Issue #1090: Drag-and-drop state & validation alert
  const [isDragging, setIsDragging] = useState(false);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);

  // Issue #1093: Deterministic salt generator & address predictor
  const [saltHex, setSaltHex] = useState<string>(() => generateRandomSaltHex());
  const [saltError, setSaltError] = useState<string | null>(null);

  // Issue #1092: Constructor argument builder & atomic deployment
  const [enableInit, setEnableInit] = useState(false);
  const [initFunctionName, setInitFunctionName] = useState("");
  const [constructorArgs, setConstructorArgs] = useState<ContractArg[]>([]);

  // Calculate predicted contract address whenever deployer, salt, or network changes
  const predictedAddress = (() => {
    if (!address || !saltHex) return null;
    const saltVal = validateSaltHex(saltHex);
    if (!saltVal.valid) return null;
    try {
      const network = getActiveNetworkConfig();
      return computeContractAddress(address, saltHex, network.networkPassphrase);
    } catch {
      return null;
    }
  })();

  const processFile = async (selected: File) => {
    setFileValidationError(null);

    try {
      const arrayBuffer = await selected.arrayBuffer();
      const wasmBuffer = Buffer.from(arrayBuffer);

      // Issue #1090: Instant WASM magic header byte validation (\0asm)
      const binaryCheck = validateWasmBinary(wasmBuffer);
      if (!binaryCheck.valid) {
        const errorMsg = binaryCheck.error || "Selected file is not a valid compiled WASM binary.";
        setFileValidationError(errorMsg);
        toast.error(errorMsg);
        setFile(null);
        setWasmStats(null);
        setPreviewFunctions([]);
        setParsedSpec(null);
        return;
      }

      setFile(selected);

      // Issue #1091: Client-side parsing of spec, signatures, and size
      const specResult = await parseWasmClientSpec(wasmBuffer);
      setParsedSpec(specResult);
      setPreviewFunctions(specResult.functions);

      setWasmStats({
        size: wasmBuffer.length,
        hash: hash(wasmBuffer).toString("hex"),
        sections: parseWasmSectionSizes(new Uint8Array(wasmBuffer)),
      });

      // Issue #1092: Detect constructor/init function
      if (specResult.hasConstructor && specResult.constructorFunction) {
        setEnableInit(true);
        setInitFunctionName(specResult.constructorFunction.name);
        if (specResult.constructorFunction.inputs.length > 0) {
          setConstructorArgs(
            specResult.constructorFunction.inputs.map((inp, idx) => ({
              id: `arg-${idx}`,
              name: inp.name,
              type: (inp.type as ArgType) || "string",
              value: "",
            })),
          );
        }
      } else {
        const potentialInit = specResult.functions.find(
          (fn) => fn.toLowerCase() === "init" || fn.toLowerCase() === "initialize",
        );
        if (potentialInit) {
          setEnableInit(true);
          setInitFunctionName(potentialInit);
        }
      }

      if (!wasmName) setWasmName(selected.name.replace(".wasm", ""));
    } catch (err: any) {
      console.error("WASM processing error:", err);
      setFileValidationError("Could not parse WASM metadata. File may be corrupted.");
      setFile(null);
      setWasmStats(null);
      setPreviewFunctions([]);
      setParsedSpec(null);
      toast.error("Could not parse WASM file.");
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  // Issue #1090: Drag and drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only reset if left the container target
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      await processFile(droppedFile);
    }
  };

  // Issue #1093: Salt change handler
  const handleSaltChange = (value: string) => {
    setSaltHex(value);
    const validation = validateSaltHex(value);
    setSaltError(validation.valid ? null : (validation.error ?? "Invalid salt"));
  };

  const handleGenerateSalt = () => {
    const newSalt = generateRandomSaltHex();
    setSaltHex(newSalt);
    setSaltError(null);
    toast.success("Generated 32-byte cryptographically secure salt.");
  };

  // Issue #1092: Constructor argument management
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

  // Refresh network max WASM size
  useEffect(() => {
    let cancelled = false;
    fetchMaxWasmSize(getActiveNetworkConfig().rpcUrl).then((size) => {
      if (!cancelled) setMaxWasmSize(size);
    });
    return () => {
      cancelled = true;
    };
  }, [currentNetwork]);

  const handleInstall = async () => {
    if (!file || !address || !isConnected) return;

    if (wasmStats) {
      const sizeCheck = validateWasmSize(wasmStats.size, maxWasmSize);
      if (!sizeCheck.valid) {
        toast.error(sizeCheck.message);
        return;
      }
    }
    setIsUploading(true);
    advancePipeline("install");

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanServer(network.rpcUrl);
      const arrayBuffer = await file.arrayBuffer();
      const wasmBuffer = Buffer.from(arrayBuffer);

      const sourceAccount = await server.getAccount(address);
      const tx = new TransactionBuilder(sourceAccount, {
        fee: "10000",
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(Operation.uploadContractWasm({ wasm: wasmBuffer }))
        .setTimeout(TimeoutInfinite)
        .build();

      const txResult = await orchestrateTx(tx.toXDR(), network);

      if (txResult.status !== "success") {
        throw new Error(txResult.errorMessage ?? "Upload failed");
      }

      const wasmHash = hash(wasmBuffer).toString("hex");

      addWasm({
        hash: wasmHash,
        name: wasmName || file.name,
        network: network.id,
        installedAt: Date.now(),
        functions: previewFunctions.length > 0 ? previewFunctions : undefined,
        parseError: previewFunctions[0] === "Parsing failed",
        workspaceId: activeWorkspaceId,
      });
      attachArtifact(activeWorkspaceId, { kind: "wasm", id: wasmHash });

      advancePipeline("instantiate", { wasmHash, txHash: txResult.hash });

      toast.success("WASM Uploaded & Saved!");
      setFile(null);
      setWasmName("");
      setWasmStats(null);
      setPreviewFunctions([]);
      setParsedSpec(null);
    } catch (e: any) {
      console.error(e);
      advancePipeline("error", { error: e.message });
      toast.error(`Install failed: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeploy = async (wasmHash: string) => {
    if (!address || !isConnected) return;

    // Issue #1093: Validate salt
    const saltValidation = validateSaltHex(saltHex);
    if (!saltValidation.valid) {
      toast.error(saltValidation.error ?? "Invalid salt parameter");
      return;
    }

    setDeployingHash(wasmHash);

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanServer(network.rpcUrl);
      const sourceAccount = await server.getAccount(address);
      const wasmFileName = wasms.find((w) => w.hash === wasmHash)?.name ?? wasmHash;

      let tx;
      // Issue #1092: Bundle atomic deployment and initialization invocation if configured
      if (enableInit && initFunctionName.trim()) {
        const initArgs = constructorArgs.map((arg) => convertToScVal(arg.type, arg.value));
        tx = buildBundledDeployAndInitTx({
          sourceAccount,
          networkPassphrase: network.networkPassphrase,
          wasmHash,
          deployerAddress: address,
          salt: saltHex,
          initFunction: initFunctionName.trim(),
          initArgs,
        });
      } else {
        const saltBuffer = Buffer.from(saltHex, "hex");
        tx = new TransactionBuilder(sourceAccount, {
          fee: "10000",
          networkPassphrase: network.networkPassphrase,
        })
          .addOperation(
            Operation.createCustomContract({
              wasmHash: Buffer.from(wasmHash, "hex"),
              address: new Address(address),
              salt: saltBuffer,
            }),
          )
          .setTimeout(TimeoutInfinite)
          .build();
      }

      const txResult = await orchestrateTx(tx.toXDR(), network, {}, (status) => {
        if (status === "awaiting-signature") {
          toast.info("Awaiting wallet signature…");
        }
        if (status === "submitting") {
          toast.info("Submitting deploy transaction…");
        }
        if (status === "polling") {
          toast.info("Waiting for contract deployment confirmation…");
        }
      });

      if (txResult.status !== "success") {
        throw new Error(txResult.errorMessage ?? "Deploy submission failed");
      }

      const realContractId = txResult.resultMetaXdr
        ? extractContractIdFromDeployResult(txResult.resultMetaXdr)
        : null;
      const contractId = realContractId ?? predictedAddress ?? txResult.hash ?? wasmHash;
      const relationship = realContractId ? "confirmed" : "inferred";

      associateContract(wasmHash, contractId, relationship);
      attachArtifact(activeWorkspaceId, {
        kind: "wasm",
        id: wasmHash,
        contractId,
        relationship,
      });
      addContract(contractId, network.id, contractAliases[wasmHash]);
      toast.success(`Contract deployed! ID: ${contractId.slice(0, 10)}…`);
      advancePipeline("publish", { contractId, txHash: txResult.hash ?? null });
      setTimeout(() => advancePipeline("done", { contractId }), 800);
      toast.success("Contract instantiated successfully!");
      setDeploySuccess({ contractId, txHash: txResult.hash ?? null });
      logDeployment({
        wasmFileName,
        wasmHash,
        salt: saltHex,
        contractId,
        txHash: txResult.hash ?? null,
        status: "success",
        network: network.id,
      });
    } catch (e: any) {
      console.error(e);
      advancePipeline("error", { error: e.message });
      toast.error(`Deploy failed: ${e.message}`);
      logDeployment({
        wasmFileName: wasms.find((w) => w.hash === wasmHash)?.name ?? wasmHash,
        wasmHash,
        salt: saltHex,
        contractId: null,
        txHash: null,
        status: "failed",
        errorMessage: e?.message,
        network: getActiveNetworkConfig().id,
      });
    } finally {
      setDeployingHash(null);
    }
  };

  const handleSourceVerified = (wasmHash: string, contractId: string) => {
    const network = getActiveNetworkConfig();
    addProvenanceNode({
      wasmHash,
      contractId,
      relationship: "confirmed",
      network: network.id,
      deployedAt: Date.now(),
    });
    attachArtifact(activeWorkspaceId, {
      kind: "wasm",
      id: wasmHash,
      contractId,
      relationship: "confirmed",
    });
  };

  return (
    <div className="container mx-auto space-y-8 p-6">
      {/* Deployment Success Modal */}
      <Dialog open={!!deploySuccess} onOpenChange={(open) => !open && setDeploySuccess(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Contract Deployed
            </DialogTitle>
            <DialogDescription>
              Your contract instance was created successfully.
            </DialogDescription>
          </DialogHeader>
          {deploySuccess && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Contract ID
                </Label>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                  <Badge variant="outline" className="flex-1 justify-start truncate font-mono text-xs">
                    {deploySuccess.contractId}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    aria-label="Copy contract ID"
                    onClick={() => {
                      copyContractId(deploySuccess.contractId);
                      toast.success("Contract ID copied to clipboard");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <NextLink
              href={deploySuccess ? buildContractExplorerHref(deploySuccess.contractId) : "#"}
              className="inline-flex items-center gap-2 text-sm text-blue-500 hover:underline"
              onClick={() => setDeploySuccess(null)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Explorer
            </NextLink>
            <Button variant="outline" onClick={() => setDeploySuccess(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WASM Registry</h1>
          <p className="text-muted-foreground">Upload, manage, and deploy contract code.</p>
        </div>
        <InstantiateWizard />
      </div>

      <FixtureFallbackIndicator />
      <DeployPipelinePanel />

      {pathname?.startsWith("/share/") && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-700">
          <Eye className="h-4 w-4" />
          <span>Read-only shared workspace — execution and editing are disabled.</span>
        </div>
      )}
      {isSandboxMode && (
        <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <FlaskConical className="h-4 w-4" />
            <span>Sandbox mode — simulation only, no wallet required</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-700 hover:text-amber-900"
            onClick={resetPipeline}
          >
            Reset Pipeline
          </Button>
        </div>
      )}
      {!isConnected && !isSandboxMode && !pathname?.startsWith("/share/") && (
        <div className="flex items-center justify-between rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>No wallet connected — connect or enter sandbox to enable interactions</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => useWallet.getState().enterSandbox()}>
            <FlaskConical className="mr-1 h-3 w-3" />
            Enter Sandbox
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Upload & Configuration Card */}
        <Card className="h-fit lg:col-span-1">
          <CardHeader>
            <CardTitle>Install New Code</CardTitle>
            <CardDescription>Upload and validate a .wasm smart contract binary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Issue #1090: Drag-and-Drop Zone with Visual Drag State & Header Validation */}
            <div
              data-testid="wasm-dropzone"
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.01]"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".wasm"
                className="hidden"
                onChange={handleFileChange}
              />
              <UploadCloud
                className={`h-10 w-10 mb-2 transition-transform duration-200 ${
                  isDragging ? "scale-110 text-primary animate-bounce" : "text-muted-foreground"
                }`}
              />
              <p className="text-sm font-medium">
                {isDragging ? "Drop WASM binary here" : "Drag & drop WASM file here, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts compiled WebAssembly (*.wasm) with \0asm header
              </p>
            </div>

            {/* Issue #1090: Validation Error Alert */}
            {fileValidationError && (
              <div
                data-testid="wasm-validation-error"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Invalid WebAssembly Binary</p>
                  <p>{fileValidationError}</p>
                </div>
              </div>
            )}

            {/* Issue #1091: WASM File Size, Exported Functions, and Limits Preview */}
            {wasmStats && file && (
              <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-medium text-muted-foreground">File Name</span>
                  <span className="truncate max-w-[160px] font-mono">{file.name}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Size</span>
                  <span
                    className={
                      wasmStats.size > maxWasmSize
                        ? "font-bold text-destructive"
                        : wasmStats.size > SOROBAN_WASM_WARN_LIMIT_BYTES
                          ? "font-semibold text-amber-500"
                          : "font-medium"
                    }
                  >
                    {formatWasmFileSize(wasmStats.size)}
                  </span>
                </div>

                {/* Issue #1091: 64 KB warning threshold */}
                {wasmStats.size > SOROBAN_WASM_WARN_LIMIT_BYTES && wasmStats.size <= maxWasmSize && (
                  <div className="flex items-start gap-1.5 rounded bg-amber-500/10 p-2 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      WASM size ({formatWasmFileSize(wasmStats.size)}) exceeds the recommended 64 KB limit.
                    </span>
                  </div>
                )}

                {/* Hard network maximum error */}
                {wasmStats.size > maxWasmSize && (
                  <div className="flex items-start gap-1.5 rounded bg-destructive/10 p-2 text-[11px] text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{validateWasmSize(wasmStats.size, maxWasmSize).message}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">SHA-256</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {wasmStats.hash.slice(0, 10)}...{wasmStats.hash.slice(-10)}
                  </span>
                </div>

                {/* Exported Functions Preview */}
                <div className="space-y-1 border-t pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Exported Functions</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {previewFunctions.length}
                    </Badge>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                    {parsedSpec && parsedSpec.parsedFunctions.length > 0 ? (
                      parsedSpec.parsedFunctions.map((fn) => (
                        <div
                          key={fn.name}
                          className="flex items-center justify-between rounded bg-background/60 px-2 py-1 font-mono text-[11px]"
                        >
                          <span className={fn.isConstructor ? "text-primary font-semibold" : ""}>
                            {fn.signature}
                          </span>
                          {fn.isConstructor && (
                            <Badge variant="outline" className="text-[9px] text-primary">
                              constructor
                            </Badge>
                          )}
                        </div>
                      ))
                    ) : previewFunctions.length > 0 ? (
                      previewFunctions.map((fn) => (
                        <Badge key={fn} variant="secondary" className="text-[10px] mr-1 mb-1">
                          {fn}()
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground italic">No functions found</span>
                    )}
                  </div>
                </div>

                {/* Section breakdown */}
                <div className="space-y-1 border-t pt-2">
                  <span className="font-semibold text-muted-foreground">WASM Sections</span>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Code</span>
                    <span>{formatWasmFileSize(wasmStats.sections.code)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data</span>
                    <span>{formatWasmFileSize(wasmStats.sections.data)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custom</span>
                    <span>{formatWasmFileSize(wasmStats.sections.custom)}</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-muted-foreground"
                  onClick={() => {
                    setFile(null);
                    setWasmStats(null);
                    setPreviewFunctions([]);
                    setParsedSpec(null);
                    setFileValidationError(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Clear Selection
                </Button>
              </div>
            )}

            <div className="grid w-full items-center gap-1.5">
              <Label>WASM Artifact Name (Optional)</Label>
              <Input
                placeholder="e.g. Token v2"
                value={wasmName}
                onChange={(e) => setWasmName(e.target.value)}
              />
            </div>

            <ActionGuard action="submit">
              <Button
                className="w-full"
                onClick={handleInstall}
                disabled={!file || isUploading || (!!wasmStats && wasmStats.size > maxWasmSize)}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}
                Install WASM
              </Button>
            </ActionGuard>
          </CardContent>
        </Card>

        {/* Library and Deployment Parameters Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Deployment &amp; Library</CardTitle>
            <CardDescription>
              Configure deterministic parameters, constructor arguments, and deploy contract instances.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Issue #1093: Salt Parameter Generator & Address Predictor */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  <Label className="text-xs font-semibold uppercase tracking-wider">
                    Deterministic Deployment Salt
                  </Label>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateSalt}
                  className="h-7 text-xs"
                >
                  <Sparkles className="mr-1.5 h-3 w-3 text-amber-500" />
                  Generate Random Salt
                </Button>
              </div>

              <div className="space-y-1">
                <Input
                  data-testid="salt-input"
                  className="font-mono text-xs"
                  placeholder="64-character hex string (32 bytes)"
                  value={saltHex}
                  maxLength={64}
                  onChange={(e) => handleSaltChange(e.target.value)}
                />
                {saltError ? (
                  <p className="text-[11px] text-destructive">{saltError}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    32-byte hexadecimal salt ({saltHex.length}/64 characters).
                  </p>
                )}
              </div>

              {/* Predicted Contract Address */}
              {predictedAddress && (
                <div className="flex items-center justify-between rounded-md border bg-background p-2.5">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      Predicted Contract ID
                    </span>
                    <p className="font-mono text-xs font-medium text-foreground">
                      {predictedAddress}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      copyContractId(predictedAddress);
                      toast.success("Predicted contract ID copied!");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Issue #1092: Constructor / Initialization Argument Builder */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" />
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider">
                      Constructor / Initialization Call
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Atomic contract deployment &amp; initialization invocation
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="enable-init" className="text-xs">
                    {enableInit ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id="enable-init"
                    checked={enableInit}
                    onCheckedChange={setEnableInit}
                  />
                </div>
              </div>

              {enableInit && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Init Function Name</Label>
                      <Input
                        placeholder="e.g. __constructor, init, initialize"
                        value={initFunctionName}
                        onChange={(e) => setInitFunctionName(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Constructor Arguments</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={addConstructorArg}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Add Argument
                      </Button>
                    </div>

                    {constructorArgs.length === 0 ? (
                      <p className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                        No arguments configured for initialization. Click &quot;Add Argument&quot; if the function requires parameters.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {constructorArgs.map((arg) => (
                          <div key={arg.id} className="flex items-center gap-2">
                            <Input
                              placeholder="Name"
                              value={arg.name ?? ""}
                              onChange={(e) => updateConstructorArg(arg.id, "name", e.target.value)}
                              className="h-8 w-1/4 text-xs font-mono"
                            />
                            <Select
                              value={arg.type}
                              onValueChange={(val) => updateConstructorArg(arg.id, "type", val)}
                            >
                              <SelectTrigger className="h-8 w-1/4 text-xs">
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
                              className="h-8 flex-1 text-xs font-mono"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeConstructorArg(arg.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* WASM Library Table */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider">
                Installed WASM Binaries
              </Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Deployed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wasms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No WASM code uploaded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    wasms.map((entry) => (
                      <Fragment key={entry.hash}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedHash(expandedHash === entry.hash ? null : entry.hash)
                          }
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileCode className="h-4 w-4 text-blue-500" />
                              {entry.name}
                              {entry.parseError && (
                                <Badge variant="destructive" className="text-[10px]">
                                  parse error
                                </Badge>
                              )}
                              <VerificationBadge entry={entry} />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {entry.hash.slice(0, 12)}...{entry.hash.slice(-12)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {entry.network}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {entry.deployedContractId ? (
                              <span className="font-mono">
                                {entry.deployedContractId.slice(0, 10)}…
                              </span>
                            ) : (
                              <span className="italic">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <ActionGuard action="deploy">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeploy(entry.hash);
                                  }}
                                  disabled={!!deployingHash || !!saltError}
                                >
                                  {deployingHash === entry.hash ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Play className="mr-1 h-3 w-3" />
                                  )}
                                  Deploy
                                </Button>
                              </ActionGuard>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(entry.hash);
                                  toast.success("WASM hash copied");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeWasm(entry.hash);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedHash === entry.hash && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/20 pb-3 pt-0">
                              {!entry.deployedContractId && (
                                <div className="space-y-1 py-2" onClick={(e) => e.stopPropagation()}>
                                  <Label htmlFor={`alias-${entry.hash}`} className="text-[10px] font-bold uppercase">
                                    Contract Alias Name (Optional)
                                  </Label>
                                  <Input
                                    id={`alias-${entry.hash}`}
                                    placeholder="e.g. My Custom Token"
                                    className="max-w-xs"
                                    value={contractAliases[entry.hash] ?? ""}
                                    onChange={(e) =>
                                      setContractAliases((prev) => ({ ...prev, [entry.hash]: e.target.value }))
                                    }
                                  />
                                </div>
                              )}
                              <ProvenancePanel nodes={entry.provenance ?? []} />
                              <VerifySourcePanel
                                entry={entry}
                                onVerified={(contractId) =>
                                  handleSourceVerified(entry.hash, contractId)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Deployment Log</CardTitle>
            <CardDescription>History of contract deployment attempts in this workspace.</CardDescription>
          </div>
          {deploymentLog.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => useDeploymentLogStore.getState().clearLog()}>
              <Trash2 className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {deploymentLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>WASM File</TableHead>
                  <TableHead>Salt</TableHead>
                  <TableHead>Contract ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tx Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deploymentLog.map((entry) => (
                  <TableRow key={entry.id} data-testid="deployment-log-row">
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate font-mono text-xs">{entry.wasmFileName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.salt ? `${entry.salt.slice(0, 8)}…` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.contractId ? `${entry.contractId.slice(0, 10)}…` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.status === "success" ? "outline" : "destructive"} className="text-[10px]">
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.txHash ? (
                        <NextLink
                          href={`/tx/${entry.txHash}`}
                          className="font-mono text-xs text-blue-500 hover:underline"
                        >
                          {entry.txHash.slice(0, 10)}…
                        </NextLink>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

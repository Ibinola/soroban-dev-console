"use client";

import { useEffect, useState } from "react";
import {
  Contract,
  TransactionBuilder,
  TimeoutInfinite,
  rpc as SorobanRpc,
  Keypair,
} from "@stellar/stellar-sdk";
import { Switch } from "@devconsole/ui";
import {
  Play,
  Send,
  Plus,
  Trash2,
  Loader2,
  Terminal,
  Save,
  Bookmark,
  FlaskConical,
  SlidersHorizontal,
  Eye,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  GripVertical,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSavedCallsStore, SavedCall } from "@/store/useSavedCallsStore";
import {
  SimulationVariant,
  createVariant,
  ArgType,
  ContractArg,
  convertToScVal,
  normalizeSimulationResult,
  type NormalizedSimulationResult,
  type NormalizedContractSpec,
} from "@devconsole/soroban-utils";
import { signTransaction } from "@stellar/freighter-api";
import { SavedCallsSheet } from "./saved-calls-sheet";
import { AbiInputField } from "./abi-input-field";
import { SimulationExplainerDisplay } from "./simulation-explainer-display";
import { useAbiStore } from "@/store/useAbiStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Badge } from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@devconsole/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@devconsole/ui";
import { ActionGuard } from "./action-guard";
import { StateDiffViewer } from "./state-diff-viewer";
import { toast } from "sonner";
import { useResultBundlesStore } from "@/store/useResultBundlesStore";
import { exportResultBundle } from "@/lib/result-bundles";
import { stateChangesToDiffs } from "@/lib/diff-utils";

interface ContractCallFormProps {
  contractId: string;
}

// #688: Batch invocation types
interface BatchCallItem {
  id: string;
  fnName: string;
  args: ContractArg[];
  status: "pending" | "running" | "success" | "error";
  result?: string;
  error?: string;
}

const DEFAULT_TOKEN_SPEC: NormalizedContractSpec = {
  contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  source: "workspace",
  rawSpec: "",
  ingestedAt: Date.now(),
  functions: [
    {
      name: "balance",
      inputs: [{ name: "id", type: "address", required: true }],
      outputs: [{ name: "balance", type: "i128", required: true }],
    },
    {
      name: "decimals",
      inputs: [],
      outputs: [{ name: "decimals", type: "u32", required: true }],
    },
    {
      name: "name",
      inputs: [],
      outputs: [{ name: "name", type: "string", required: true }],
    },
    {
      name: "symbol",
      inputs: [],
      outputs: [{ name: "symbol", type: "symbol", required: true }],
    },
    {
      name: "transfer",
      inputs: [
        { name: "from", type: "address", required: true },
        { name: "to", type: "address", required: true },
        { name: "amount", type: "i128", required: true },
      ],
      outputs: [],
    },
    {
      name: "mint",
      inputs: [
        { name: "to", type: "address", required: true },
        { name: "amount", type: "i128", required: true },
      ],
      outputs: [],
    },
    {
      name: "burn",
      inputs: [
        { name: "from", type: "address", required: true },
        { name: "amount", type: "i128", required: true },
      ],
      outputs: [],
    },
  ],
};

function toContractArg(field: NonNullable<NormalizedContractSpec["functions"][number]>["inputs"][number]): ContractArg {
  return {
    id: crypto.randomUUID(),
    name: field.name,
    type:
      field.type === "unknown" || field.type === "bytes"
        ? "string"
        : field.type,
    value: "",
  };
}

export function ContractCallForm({ contractId }: ContractCallFormProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMethod = searchParams?.get("method");
  
  const genId = () => Math.random().toString(36).substring(2, 9);
  const { isConnected, address, isSandboxMode, enterSandbox, exitSandbox } = useWallet();
  const { getActiveNetworkConfig } = useNetworkStore();

  const [fnName, setFnName] = useState(initialMethod || "");
  const [args, setArgs] = useState<ContractArg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoExecute, setAutoExecute] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [simulation, setSimulation] =
    useState<NormalizedSimulationResult | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [rpcLatencyMs, setRpcLatencyMs] = useState<number | null>(null);
  const { saveCall, savePreset, presets } = useSavedCallsStore();
  const contractPresets = presets.filter(p => p.contractId === contractId && p.fnName === activeVariant?.fnName);
  const { addBundle } = useResultBundlesStore();
  const { activeWorkspaceId, linkSavedCall } = useWorkspaceStore();
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [pinnedVariants, setPinnedVariants] = useState<SimulationVariant[]>([]);
  const { getSpec, setSpec } = useAbiStore();
  const spec = getSpec(contractId);
  const selectedFunction = spec?.functions.find((entry) => entry.name === fnName);
  const usesAbiInputs = Boolean(selectedFunction && selectedFunction.inputs.length > 0);

  // FE-044: advanced fee/resource tuning state
  const [showFeeControls, setShowFeeControls] = useState(false);
  const [customFee, setCustomFee] = useState("100");
  const [customCpuLimit, setCustomCpuLimit] = useState("");
  const [customMemLimit, setCustomMemLimit] = useState("");

  // Fee bump state
  const [enableFeeBump, setEnableFeeBump] = useState(false);
  const [sponsorType, setSponsorType] = useState<"secret" | "wallet">("wallet");
  const [sponsorSecretKey, setSponsorSecretKey] = useState("");

  // Simulation failure state
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [showSimulationWarning, setShowSimulationWarning] = useState(false);
  const [pendingTxToOverride, setPendingTxToOverride] = useState<any>(null);
  // #737: state diff viewer collapsible state
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  // #688: batch invocation state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchQueue, setBatchQueue] = useState<BatchCallItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // FE-044: validate overrides before use
  const feeOverride = (() => {
    const n = Number(customFee);
    return Number.isFinite(n) && n >= 100 ? String(n) : "100";
  })();

  const formatInt = (value: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes < 0) return "N/A";
    if (bytes < 1024) return `${formatInt(bytes)} B`;

    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value)} ${units[unitIndex]}`;
  };

  const normalizedConnectedAddress = address?.trim().toUpperCase() ?? null;
  const isConnectedWalletAuthorized =
    normalizedConnectedAddress !== null &&
    (simulation?.requiredAuthKeys ?? []).some(
      (key) => key.toUpperCase() === normalizedConnectedAddress,
    );

  const methodParam = searchParams?.get("method");

  useEffect(() => {
    if (
      contractId ===
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" &&
      !spec
    ) {
      setSpec(contractId, DEFAULT_TOKEN_SPEC);
    }
  }, [contractId, spec, setSpec]);

  useEffect(() => {
    if (methodParam && spec?.functions.some((f) => f.name === methodParam)) {
      if (fnName !== methodParam) {
        setFnName(methodParam);
        setSimulation(null);
        const nextFunction = spec.functions.find((entry) => entry.name === methodParam);
        setArgs(nextFunction?.inputs.map(toContractArg) ?? []);
      }
    }
  }, [methodParam, spec, fnName]);

  const handleFnChange = (name: string) => {
    setFnName(name);
    setSimulation(null);
    const nextFunction = spec?.functions.find((entry) => entry.name === name);

    setArgs(nextFunction?.inputs.map(toContractArg) ?? []);
    
    const url = new URL(window.location.href);
    url.searchParams.set("method", name);
    url.searchParams.set("network", getActiveNetworkConfig().id);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const addArg = () => {
    setSimulation(null);
    setArgs([...args, { id: genId(), type: "symbol", value: "" }]);
  };

  const removeArg = (id: string) => {
    setSimulation(null);
    setArgs(args.filter((a) => a.id !== id));
  };

  const updateArg = (id: string, field: keyof ContractArg, val: string) => {
    setSimulation(null);
    setArgs(args.map((a) => (a.id === id ? { ...a, [field]: val } : a)));
  };

  const handleSimulate = async () => {
    setIsLoading(true);
    setResult(null);
    setSimulation(null);
    setExecutionTimeMs(null);
    setRpcLatencyMs(null);
    const startTime = performance.now();
    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);

      const contract = new Contract(contractId);
      const scArgs = args.map((a) => convertToScVal(a.type, a.value));

      const operation = contract.call(fnName, ...scArgs);

      // FE-043: sandbox uses a well-known public key when no wallet is connected
      const source =
        address || "GBZXN7PIRZGNMHGA7MUUUFFAUYVSF74BWXME4R37P2N6F5N4AUM5546F";

      const account = await server.getAccount(source).catch(() => null);

      const sequence = account ? account.sequenceNumber() : "0";

      const tx = new TransactionBuilder(
        {
          accountId: () => source,
          sequenceNumber: () => sequence,
          incrementSequenceNumber: () => {},
        },
        // FE-044: apply fee override
        { fee: feeOverride, networkPassphrase: network.networkPassphrase },
      )
        .addOperation(operation)
        .setTimeout(TimeoutInfinite)
        .build();

      const sim = await server.simulateTransaction(tx);
      const normalized = normalizeSimulationResult(sim);
      setSimulation(normalized);

      addBundle({
        kind: "single-call",
        title: `Simulation · ${fnName || "unknown"}`,
        networkId: network.id,
        workspaceId: activeWorkspaceId,
        contractId,
        payload: {
          mode: "simulate",
          fnName,
          args,
          simulation: normalized,
        },
      });

      if (normalized.ok) {
        setResult("Simulation succeeded.");
        toast.success(`Simulation Success!`);
      } else {
        setResult(`Simulation failed: ${normalized.error || "Unknown error"}`);
        toast.error(`Simulation Failed: ${normalized.error || "Unknown error"}`);
      }
      setExecutionTimeMs(Math.round(performance.now() - startTime));
      setRpcLatencyMs(Math.round(performance.now() - startTime));
    } catch (e: any) {
      console.error(e);
      setSimulation({
        ok: false,
        error: e.message,
        auth: [],
        requiredAuthKeys: [],
        stateChangesCount: 0,
        stateChanges: [],
      });
      setResult(`Error: ${e.message}`);
      toast.error(`Simulation Error: ${e.message}`);
      setExecutionTimeMs(Math.round(performance.now() - startTime));
    } finally {
      setIsLoading(false);
    }
  };

  const wrapAndSignFeeBump = async (
    signedInnerTxXdr: string,
    network: any,
    innerTxFee: string
  ) => {
    const signedInnerTx = TransactionBuilder.fromXDR(
      signedInnerTxXdr,
      network.networkPassphrase
    ) as any;

    let sponsorPublicKey = "";
    let sponsorKeypair: Keypair | null = null;

    if (sponsorType === "secret") {
      try {
        sponsorKeypair = Keypair.fromSecret(sponsorSecretKey.trim());
        sponsorPublicKey = sponsorKeypair.publicKey();
      } catch {
        throw new Error("Invalid Sponsor Secret Key");
      }
    } else {
      sponsorPublicKey = address!;
    }

    const feeBumpFee = (Number(innerTxFee) + 100).toString();

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorPublicKey,
      feeBumpFee,
      signedInnerTx,
      network.networkPassphrase
    );

    let finalXdr = "";
    if (sponsorType === "secret") {
      feeBumpTx.sign(sponsorKeypair!);
      finalXdr = feeBumpTx.toXDR();
    } else {
      const outerResult = await signTransaction(feeBumpTx.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });
      finalXdr = typeof outerResult === "object" && outerResult && "signedTxXdr" in outerResult
        ? (outerResult as any).signedTxXdr
        : (outerResult as unknown as string);
    }

    return finalXdr;
  };

  const handleSend = async () => {
    if (!isConnected || !address) {
      toast.error("Connect wallet to send transactions");
      return;
    }

    setIsLoading(true);
    setResult(null);
    setExecutionTimeMs(null);
    setRpcLatencyMs(null);
    setSimulationError(null);
    setPendingTxToOverride(null);
    const sendStart = performance.now();

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);

      const contract = new Contract(contractId);
      const scArgs = args.map((a) => convertToScVal(a.type, a.value));

      const sourceAccount = await server.getAccount(address);

      const tx = new TransactionBuilder(sourceAccount, {
        fee: feeOverride,
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(contract.call(fnName, ...scArgs))
        .setTimeout(TimeoutInfinite)
        .build();

      const sim = await server.simulateTransaction(tx);
      if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
        setSimulationError(sim.error || "Simulation failed");
        setPendingTxToOverride(tx);
        setShowSimulationWarning(true);
        setIsLoading(false);
        return;
      }

      const preparedTx = SorobanRpc.assembleTransaction(tx, sim).build();

      const signedResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      let finalTxXdr = signedResult.signedTxXdr;
      if (enableFeeBump) {
        finalTxXdr = await wrapAndSignFeeBump(signedResult.signedTxXdr, network, preparedTx.fee);
      }

      const sendRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(
          finalTxXdr,
          network.networkPassphrase,
        ),
      );

      addBundle({
        kind: "single-call",
        title: `Transaction · ${fnName || "unknown"}${enableFeeBump ? " (Sponsored)" : ""}`,
        networkId: network.id,
        workspaceId: activeWorkspaceId,
        contractId,
        txHash: sendRes.hash,
        payload: {
          mode: "submit",
          fnName,
          args,
          sendStatus: sendRes.status,
          simulation: normalizeSimulationResult(sim),
        },
      });

      if (sendRes.status !== "PENDING") {
        throw new Error(`Submission failed: ${sendRes.status}`);
      }

      setResult(`Transaction Submitted! Hash: ${sendRes.hash}`);
      toast.success("Transaction sent to network");
      setExecutionTimeMs(Math.round(performance.now() - sendStart));
      setRpcLatencyMs(Math.round(performance.now() - sendStart));
    } catch (e: any) {
      console.error(e);
      setResult(`Submission Error: ${e.message}`);
      toast.error(`Submission Error: ${e.message}`);
      setExecutionTimeMs(Math.round(performance.now() - sendStart));
      setRpcLatencyMs(Math.round(performance.now() - sendStart));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOverride = async (txToSign: any) => {
    setIsLoading(true);
    setShowSimulationWarning(false);
    setResult(null);
    const sendStart = performance.now();

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);

      const signedResult = await signTransaction(txToSign.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      let finalTxXdr = signedResult.signedTxXdr;
      if (enableFeeBump) {
        finalTxXdr = await wrapAndSignFeeBump(signedResult.signedTxXdr, network, txToSign.fee);
      }

      const sendRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(
          finalTxXdr,
          network.networkPassphrase,
        ),
      );

      addBundle({
        kind: "single-call",
        title: `Transaction · ${fnName || "unknown"} (Override)${enableFeeBump ? " (Sponsored)" : ""}`,
        networkId: network.id,
        workspaceId: activeWorkspaceId,
        contractId,
        txHash: sendRes.hash,
        payload: {
          mode: "submit",
          fnName,
          args,
          sendStatus: sendRes.status,
          simulation: { ok: false, error: simulationError || "Simulation failed" } as any,
        },
      });

      if (sendRes.status !== "PENDING") {
        throw new Error(`Submission failed: ${sendRes.status}`);
      }

      setResult(`Transaction Submitted! Hash: ${sendRes.hash}`);
      toast.success("Transaction sent to network (simulation bypassed)");
      setExecutionTimeMs(Math.round(performance.now() - sendStart));
      setRpcLatencyMs(Math.round(performance.now() - sendStart));
    } catch (e: any) {
      console.error(e);
      setResult(`Submission Error: ${e.message}`);
      toast.error(`Submission Error: ${e.message}`);
      setExecutionTimeMs(Math.round(performance.now() - sendStart));
      setRpcLatencyMs(Math.round(performance.now() - sendStart));
    } finally {
      setIsLoading(false);
      setPendingTxToOverride(null);
    }
  };

  const handleSave = () => {
    if (!saveName.trim()) return;

    const savedCall = saveCall({
      name: saveName,
      contractId,
      fnName,
      args,
      network: getActiveNetworkConfig().id,
    });
    linkSavedCall(activeWorkspaceId, savedCall.id);

    setIsSaveOpen(false);
    setSaveName("");
    toast.success("Interaction saved!");
  };

  const handlePin = () => {
    if (!result) return;
    const label = `Variant ${pinnedVariants.length + 1}`;
    const v = createVariant(
      label,
      fnName,
      args.map((a) => a.value),
      result,
      null,
      simulation?.cpuInsns,
      simulation?.memBytes,
    );
    setPinnedVariants((prev) => [...prev.slice(-1), v]);
    toast.success(`Pinned as ${label}`);
  };

  const handleLoad = (call: SavedCall) => {
    setFnName(call.fnName);
    setSimulation(null);

    const newArgs = call.args.map((a) => ({ ...a, id: crypto.randomUUID() }));
    setArgs(newArgs);
    toast.info(`Loaded: ${call.name}`);
  };

  const handleSavePreset = () => {
    if (!fnName) return;
    const network = getActiveNetworkConfig();
    savePreset({
      name: saveName.trim() || `${fnName} preset`,
      contractId,
      fnName,
      args,
      network: network.id,
      source: "custom",
    });
    toast.success("Operation preset saved");
  };

  const handleExportBundle = () => {
    const network = getActiveNetworkConfig();
    const bundle = addBundle({
      kind: "single-call",
      title: `Export · ${fnName || "contract-call"}`,
      networkId: network.id,
      workspaceId: activeWorkspaceId,
      contractId,
      payload: {
        mode: "manual-export",
        fnName,
        args,
        result,
        simulation,
      },
    });
    exportResultBundle(bundle);
    toast.success("Result bundle exported");
  };

  // #688: Add current call config to batch queue
  const handleAddToBatch = () => {
    if (!fnName) return;
    const item: BatchCallItem = {
      id: crypto.randomUUID(),
      fnName,
      args: args.map((a) => ({ ...a, id: crypto.randomUUID() })),
      status: "pending",
    };
    setBatchQueue((q) => [...q, item]);
    toast.success(`Added "${fnName}" to batch queue`);
  };

  const handleRemoveFromBatch = (id: string) => {
    setBatchQueue((q) => q.filter((item) => item.id !== id));
  };

  const handleMoveBatchItem = (id: string, direction: "up" | "down") => {
    setBatchQueue((q) => {
      const idx = q.findIndex((item) => item.id === id);
      if (idx < 0) return q;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= q.length) return q;
      const next = [...q];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleExecuteBatch = async () => {
    if (batchQueue.length === 0) return;
    setIsBatchRunning(true);

    const network = getActiveNetworkConfig();
    const server = new SorobanRpc.Server(network.rpcUrl);
    const source = address || "GBZXN7PIRZGNMHGA7MUUUFFAUYVSF74BWXME4R37P2N6F5N4AUM5546F";

    for (let i = 0; i < batchQueue.length; i++) {
      const item = batchQueue[i];
      // Mark as running
      setBatchQueue((q) =>
        q.map((qItem) => qItem.id === item.id ? { ...qItem, status: "running" } : qItem),
      );

      try {
        const contract = new Contract(contractId);
        const scArgs = item.args.map((a) => convertToScVal(a.type, a.value));
        const operation = contract.call(item.fnName, ...scArgs);
        const account = await server.getAccount(source).catch(() => null);
        const sequence = account ? account.sequenceNumber() : "0";

        const tx = new TransactionBuilder(
          {
            accountId: () => source,
            sequenceNumber: () => sequence,
            incrementSequenceNumber: () => {},
          },
          { fee: feeOverride, networkPassphrase: network.networkPassphrase },
        )
          .addOperation(operation)
          .setTimeout(TimeoutInfinite)
          .build();

        const sim = await server.simulateTransaction(tx);
        const normalized = normalizeSimulationResult(sim);

        setBatchQueue((q) =>
          q.map((qItem) =>
            qItem.id === item.id
              ? {
                  ...qItem,
                  status: normalized.ok ? "success" : "error",
                  result: normalized.ok ? `Simulation OK — ${normalized.stateChangesCount} state change(s)` : undefined,
                  error: normalized.ok ? undefined : normalized.error,
                }
              : qItem,
          ),
        );
      } catch (e: any) {
        setBatchQueue((q) =>
          q.map((qItem) =>
            qItem.id === item.id ? { ...qItem, status: "error", error: e.message } : qItem,
          ),
        );
      }
    }

    // Persist batch results to saved interactions
    const batchResults = batchQueue.map((item) => ({ fnName: item.fnName, args: item.args }));
    const savedCall = saveCall({
      name: `Batch (${batchQueue.length} calls) · ${new Date().toLocaleTimeString()}`,
      contractId,
      fnName: batchQueue.map((b) => b.fnName).join(", "),
      args: batchQueue[0]?.args ?? [],
      network: network.id,
    });
    linkSavedCall(activeWorkspaceId, savedCall.id);

    setIsBatchRunning(false);
    toast.success("Batch execution complete");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Interact</CardTitle>
        <CardDescription>Call functions on this contract.</CardDescription>
        <SavedCallsSheet contractId={contractId} onSelect={handleLoad} />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* FE-064: Action context banners */}
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
              onClick={exitSandbox}
            >
              Exit
            </Button>
          </div>
        )}
        {!isConnected && !isSandboxMode && !pathname?.startsWith("/share/") && (
          <div className="flex items-center justify-between rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>No wallet connected — connect or enter sandbox to enable interactions</span>
            </div>
            <Button variant="outline" size="sm" onClick={enterSandbox}>
              <FlaskConical className="mr-1 h-3 w-3" />
              Enter Sandbox
            </Button>
          </div>
        )}
        <div className="space-y-2">
          <Label>Function Name</Label>
          {spec ? (
            <Select value={fnName} onValueChange={handleFnChange}>
              <SelectTrigger aria-describedby={selectedFunction?.doc ? "method-description" : undefined}>
                <SelectValue placeholder="Select a function..." />
              </SelectTrigger>
              <SelectContent>
                {spec.functions.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="e.g. initialize, increment, transfer"
              value={fnName}
              onChange={(e) => setFnName(e.target.value)}
            />
          )}
        </div>

        <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
          <ActionGuard action="submit">
            <div className="flex gap-2">
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  title="Save Interaction"
                  aria-label="Save Interaction"
                  disabled={!fnName}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <Button
                variant="outline"
                size="sm"
                title="Save reusable operation preset"
                aria-label="Save reusable operation preset"
                disabled={!fnName}
                onClick={handleSavePreset}
              >
                Save Preset
              </Button>
            </div>
          </ActionGuard>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Interaction</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>Name this bookmark</Label>
              <Input
                placeholder="e.g. Mint Test Tokens"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleSave}>Save Bookmark</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Arguments ({args.length})</Label>
            {!usesAbiInputs && (
              <Button size="sm" variant="outline" onClick={addArg}>
                <Plus className="mr-1 h-3 w-3" /> Add Arg
              </Button>
            )}
          </div>

          {selectedFunction?.doc && (
            <p id="method-description" className="text-sm text-muted-foreground">{selectedFunction.doc}</p>
          )}

          {args.length === 0 && selectedFunction && (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {usesAbiInputs
                ? "This function does not require any arguments."
                : "No ABI-defined inputs were found for this function. Add manual arguments only if the contract expects them."}
            </div>
          )}

          {args.map((arg) => (
            <div key={arg.id} className="flex items-start gap-2">
              {!usesAbiInputs && (
                <div className="w-[120px]">
                  <Select
                    value={arg.type}
                    onValueChange={(v: ArgType) => updateArg(arg.id, "type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="symbol">Symbol</SelectItem>
                      <SelectItem value="address">Address</SelectItem>
                      <SelectItem value="i32">i32 (Int)</SelectItem>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="bool">Bool</SelectItem>
                      <SelectItem value="vec">Vec (JSON)</SelectItem>
                      <SelectItem value="map">Map (JSON)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <AbiInputField
                arg={arg}
                onChange={(id, val) => updateArg(id, "value", val)}
              />
              {!usesAbiInputs && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  aria-label={`Remove argument ${arg.name || "unnamed"}`}
                  onClick={() => removeArg(arg.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div aria-live="polite" className="space-y-4 w-full">
          {result && (
            <div className="break-all rounded-md border-l-4 border-blue-500 bg-muted p-4 font-mono text-xs">
              {result}
            </div>
          )}

          {(executionTimeMs != null || rpcLatencyMs != null) && (
            <div className="flex flex-wrap items-center gap-2">
              {executionTimeMs != null && (
                <Badge variant="secondary" title="Execution duration">
                  <Clock className="mr-1 h-3 w-3" />
                  {executionTimeMs}ms
                </Badge>
              )}
              {rpcLatencyMs != null && (
                <Badge
                  variant={rpcLatencyMs > 2000 ? "destructive" : "secondary"}
                  title="RPC round-trip latency"
                >
                  RPC {rpcLatencyMs}ms
                </Badge>
              )}
            </div>
          )}

          {simulation && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={simulation.ok ? "default" : "destructive"}>
                {simulation.ok ? "Simulation Succeeded" : "Simulation Failed"}
              </Badge>
              {simulation.minResourceFee && (
                <Badge variant="secondary">
                  Min Fee: {formatInt(Number(simulation.minResourceFee))} stroops
                </Badge>
              )}
              <Badge variant="secondary">
                {simulation.stateChangesCount} state change
                {simulation.stateChangesCount === 1 ? "" : "s"}
              </Badge>
              <Badge variant="secondary">
                {simulation.auth.length} auth entr
                {simulation.auth.length === 1 ? "y" : "ies"}
              </Badge>
            </div>

            {!simulation.ok && simulation.error && (
              <div className="mt-3 rounded-md border border-destructive/30 bg-background/70 p-3 text-sm">
                <p className="font-semibold text-destructive">Simulation Error</p>
                <p className="mt-1 font-mono text-xs">{simulation.error}</p>
              </div>
            )}

            {simulation.ok && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-background/70 p-3">
                  <p className="text-muted-foreground text-xs">CPU Instructions</p>
                  <p className="font-mono text-sm font-semibold">
                    {simulation.cpuInsns !== undefined
                      ? formatInt(simulation.cpuInsns)
                      : "N/A"}
                  </p>
                </div>
                <div className="rounded-md border bg-background/70 p-3">
                  <p className="text-muted-foreground text-xs">Memory Bytes</p>
                  <p className="font-mono text-sm font-semibold">
                    {simulation.memBytes !== undefined
                      ? `${formatInt(simulation.memBytes)} B (${formatBytes(simulation.memBytes)})`
                      : "N/A"}
                  </p>
                </div>
                <div className="rounded-md border bg-background/70 p-3 sm:col-span-2">
                  <p className="text-muted-foreground text-xs">Return Value XDR</p>
                  <p className="mt-1 break-all font-mono text-xs">
                    {simulation.resultXdr ?? "No return value provided by simulation."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {simulation && simulation.auth.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Required Authorization Keys
              </p>
              <Badge className="border-amber-300 bg-amber-200/40 text-amber-800">
                {simulation.requiredAuthKeys.length} key
                {simulation.requiredAuthKeys.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              {simulation.auth.map((entry) => {
                const isConnectedWallet =
                  normalizedConnectedAddress === entry.address.toUpperCase();
                const isSigningKey = entry.kind === "account";

                return (
                  <div
                    key={`${entry.kind}-${entry.address}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/70 p-3"
                  >
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs font-medium">
                        {entry.address}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {entry.kind === "account"
                          ? isConnectedWallet
                            ? "Matches connected wallet"
                            : "Required signer"
                          : "Contract authorization entry"}
                      </p>
                    </div>
                    {isConnectedWallet ? (
                      <Badge className="bg-green-600 hover:bg-green-700">
                        Connected
                      </Badge>
                    ) : isSigningKey ? (
                      <Badge variant="secondary">Missing</Badge>
                    ) : (
                      <Badge variant="secondary">Contract</Badge>
                    )}
                  </div>
                );
              })}
            </div>
            {simulation.requiredAuthKeys.length > 0 &&
              isConnected &&
              address &&
              !isConnectedWalletAuthorized && (
              <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-700">
                Connected wallet is not authorized for this invocation.
              </p>
            )}
          </div>
        )}
        </div>

        {/* Simulation Explainer - Human-readable auth requirements */}
        {simulation && (
          <SimulationExplainerDisplay
            rawSimulation={simulation}
            connectedAddress={address}
          />
        )}

        {/* #737: State Diff Viewer — collapsible section */}
        {simulation && simulation.ok && (
          <div className="rounded-md border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/30 transition-colors"
              onClick={() => setIsDiffOpen((v) => !v)}
              aria-expanded={isDiffOpen}
            >
              <span>
                State Changes ({simulation.stateChangesCount})
              </span>
              {isDiffOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {isDiffOpen && (
              <div className="border-t px-4 py-3">
                <StateDiffViewer
                  diffs={stateChangesToDiffs(simulation.stateChanges)}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {/* FE-044: fee/resource tuning toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground"
            onClick={() => setShowFeeControls((v) => !v)}
            title="Advanced fee and resource controls"
          >
            <SlidersHorizontal className="h-3 w-3" />
            {showFeeControls ? "Hide" : "Fee & Resources"}
          </Button>
        </div>

        {/* FE-044: advanced fee and resource controls */}
        {showFeeControls && (
          <div className="rounded-md border border-dashed p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Advanced Fee &amp; Resource Overrides
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
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
              <div className="space-y-1">
                <Label className="text-xs">CPU Limit (instructions)</Label>
                <Input
                  type="number"
                  min={0}
                  value={customCpuLimit}
                  onChange={(e) => setCustomCpuLimit(e.target.value)}
                  placeholder="auto"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Memory Limit (bytes)</Label>
                <Input
                  type="number"
                  min={0}
                  value={customMemLimit}
                  onChange={(e) => setCustomMemLimit(e.target.value)}
                  placeholder="auto"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              CPU and memory limits are advisory — the network enforces protocol maximums.
              Unsafe values are validated before signing.
            </p>

            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between pb-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Enable Fee Sponsorship (Fee Bump)</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Sponsor the gas fees of this transaction using a secondary account.
                  </p>
                </div>
                <Switch
                  checked={enableFeeBump}
                  onCheckedChange={setEnableFeeBump}
                />
              </div>

              {enableFeeBump && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Sponsor Method</Label>
                    <Select
                      value={sponsorType}
                      onValueChange={(val: "secret" | "wallet") => setSponsorType(val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select sponsor method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wallet">Sign with Sponsor Wallet</SelectItem>
                        <SelectItem value="secret">Sponsor Secret Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {sponsorType === "secret" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Sponsor Secret Key (S...)</Label>
                      <Input
                        type="password"
                        placeholder="SA..."
                        value={sponsorSecretKey}
                        onChange={(e) => setSponsorSecretKey(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <ActionGuard action="simulate" className="flex-1">
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleSimulate}
              disabled={isLoading || !fnName}
              aria-label={isSandboxMode ? "Simulate Contract Call in Sandbox" : "Simulate Contract Call"}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Terminal className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {isSandboxMode ? "Simulate (Sandbox)" : "Simulate"}
            </Button>
          </ActionGuard>

          <ActionGuard action="submit" className="flex-1">
            <Button
              className="w-full"
              onClick={handleSend}
              disabled={isLoading || !fnName}
              aria-label="Send Transaction"
              aria-busy={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Send Transaction
            </Button>
          </ActionGuard>
        </div>

        {/* #688: Batch mode toggle */}
        <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Batch Mode</span>
            {isBatchMode && batchQueue.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {batchQueue.length} queued
              </Badge>
            )}
          </div>
          <Button
            variant={isBatchMode ? "default" : "ghost"}
            size="sm"
            className="h-6 text-xs"
            onClick={() => {
              setIsBatchMode((v) => !v);
              if (isBatchMode) setBatchQueue([]);
            }}
          >
            {isBatchMode ? "Exit Batch" : "Enable"}
          </Button>
        </div>

        {/* #688: Batch queue panel */}
        {isBatchMode && (
          <div className="space-y-3 rounded-md border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                Batch Queue ({batchQueue.length})
              </p>
              {batchQueue.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleExecuteBatch}
                  disabled={isBatchRunning || batchQueue.length === 0}
                >
                  {isBatchRunning ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-1 h-3 w-3" />
                  )}
                  Execute Batch
                </Button>
              )}
            </div>

            {batchQueue.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Configure a function call above and click "Add to Batch" to queue it.
              </p>
            ) : (
              <div className="space-y-2">
                {batchQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border bg-background/70 px-3 py-2 text-xs"
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="flex-1 font-mono font-medium">
                      {item.fnName}({item.args.map((a) => a.value || `<${a.type}>`).join(", ")})
                    </span>
                    {item.status === "running" && (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    )}
                    {item.status === "success" && (
                      <span title={item.result}>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      </span>
                    )}
                    {item.status === "error" && (
                      <span title={item.error}>
                        <XCircle className="h-3 w-3 text-destructive" />
                      </span>
                    )}
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        disabled={idx === 0}
                        onClick={() => handleMoveBatchItem(item.id, "up")}
                        title="Move up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        disabled={idx === batchQueue.length - 1}
                        onClick={() => handleMoveBatchItem(item.id, "down")}
                        title="Move down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-destructive"
                        onClick={() => handleRemoveFromBatch(item.id)}
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Per-call result details */}
            {batchQueue.some((item) => item.status === "success" || item.status === "error") && (
              <div className="space-y-1 border-t pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Results</p>
                {batchQueue.map((item) =>
                  item.result || item.error ? (
                    <div
                      key={`result-${item.id}`}
                      className={`rounded-md px-2 py-1 font-mono text-[10px] ${
                        item.status === "success"
                          ? "bg-green-500/10 text-green-700"
                          : "bg-red-500/10 text-destructive"
                      }`}
                    >
                      <span className="font-semibold">{item.fnName}: </span>
                      {item.result ?? item.error}
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        )}
        {result && (
          <ActionGuard action="submit">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePin}
                title="Pin this result for comparison"
              >
                <Bookmark className="mr-1 h-3 w-3" /> Pin Result
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportBundle}
                title="Export structured result bundle"
              >
                <Download className="mr-1 h-3 w-3" /> Export Bundle
              </Button>
            </div>
          </ActionGuard>
        )}

        {pinnedVariants.length >= 2 && (
          <div className="rounded-md border border-purple-500/40 bg-purple-500/5 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-purple-700">
              Simulation Comparison
            </p>
            <div className="grid grid-cols-2 gap-3">
              {pinnedVariants.map((v) => (
                <div key={v.capturedAt} className="space-y-1 rounded-md border bg-background/70 p-3">
                  <p className="text-xs font-semibold">{v.label}</p>
                  <p className="break-all font-mono text-[10px] text-muted-foreground">
                    {v.result ?? v.error}
                  </p>
                  {v.cpuInsns !== undefined && (
                    <p className="font-mono text-[10px]">
                      CPU: {formatInt(v.cpuInsns)} | Mem: {formatBytes(v.memBytes ?? 0)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs text-muted-foreground"
              onClick={() => setPinnedVariants([])}
            >
              Clear comparison
            </Button>
          </div>
        )}

      </CardContent>

      <Dialog open={showSimulationWarning} onOpenChange={setShowSimulationWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Simulation Failed
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm space-y-2">
            <p>The transaction pre-flight simulation failed with the following error:</p>
            <div className="rounded bg-muted p-2 font-mono text-xs text-destructive-foreground overflow-auto max-h-40">
              {simulationError || "Unknown error"}
            </div>
            <p>Do you want to override the simulation pre-check and sign the transaction anyway?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSimulationWarning(false);
                setPendingTxToOverride(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingTxToOverride) {
                  handleSendOverride(pendingTxToOverride);
                }
              }}
            >
              Sign Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

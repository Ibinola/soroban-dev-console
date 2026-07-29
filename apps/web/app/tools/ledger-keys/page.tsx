"use client";

import { useState, useEffect, useCallback } from "react";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  buildLedgerKeyXdr,
  fetchLedgerEntry,
  type LedgerKeyType,
  type LedgerKeyInput,
  type ContractDataKeyInput,
  type ContractCodeKeyInput,
  type AccountKeyInput,
  type LedgerQueryResult,
} from "@/lib/ledger-key-builder";
import {
  Copy,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  History,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@devconsole/ui";
import { Alert, AlertDescription } from "@devconsole/ui";
import { toast } from "sonner";

interface QueryHistoryItem {
  id: string;
  timestamp: number;
  keyType: LedgerKeyType;
  input: LedgerKeyInput;
  keyXdr: string;
  found: boolean;
}

const HISTORY_KEY = "ledger-key-query-history";
const MAX_HISTORY = 20;

export default function LedgerKeyInspectorPage() {
  const { currentNetwork, getActiveNetworkConfig } = useNetworkStore();

  // Key type selection
  const [keyType, setKeyType] = useState<LedgerKeyType>("ContractData");

  // ContractData fields
  const [contractId, setContractId] = useState("");
  const [storageKeyType, setStorageKeyType] = useState<string>("symbol");
  const [storageKeyValue, setStorageKeyValue] = useState("");
  const [durability, setDurability] = useState<"persistent" | "temporary">("persistent");

  // ContractCode fields
  const [wasmHash, setWasmHash] = useState("");

  // Account fields
  const [accountId, setAccountId] = useState("");

  // Results
  const [keyXdr, setKeyXdr] = useState<string | null>(null);
  const [result, setResult] = useState<LedgerQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // History
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Build key when inputs change
  useEffect(() => {
    setError(null);
    setKeyXdr(null);
    setResult(null);

    try {
      const input = buildInput();
      if (input) {
        const xdr = buildLedgerKeyXdr(input);
        setKeyXdr(xdr);
      }
    } catch (e: any) {
      if (hasRequiredFields()) {
        setError(e.message);
      }
    }
  }, [keyType, contractId, storageKeyType, storageKeyValue, durability, wasmHash, accountId]);

  function buildInput(): LedgerKeyInput | null {
    switch (keyType) {
      case "ContractData":
        if (!contractId || !storageKeyValue) return null;
        return {
          type: "ContractData",
          contractId,
          storageKeyType: storageKeyType as any,
          storageKeyValue,
          durability,
        };
      case "ContractCode":
        if (!wasmHash) return null;
        return { type: "ContractCode", wasmHash };
      case "Account":
        if (!accountId) return null;
        return { type: "Account", accountId };
    }
  }

  function hasRequiredFields(): boolean {
    switch (keyType) {
      case "ContractData":
        return !!contractId && !!storageKeyValue;
      case "ContractCode":
        return !!wasmHash;
      case "Account":
        return !!accountId;
    }
  }

  const handleFetch = useCallback(async () => {
    if (!keyXdr) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const network = getActiveNetworkConfig();
      const fetchResult = await fetchLedgerEntry(network.id, keyXdr);
      setResult(fetchResult);

      // Add to history
      const input = buildInput();
      if (input) {
        const newItem: QueryHistoryItem = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          keyType,
          input,
          keyXdr,
          found: fetchResult.found,
        };
        const updatedHistory = [newItem, ...history.slice(0, MAX_HISTORY - 1)];
        setHistory(updatedHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
      }

      if (fetchResult.found) {
        toast.success("Ledger entry found");
      } else {
        toast.info("No ledger entry found for this key");
      }
    } catch (e: any) {
      setError(e.message);
      toast.error(`Fetch failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [keyXdr, keyType, contractId, storageKeyType, storageKeyValue, durability, wasmHash, accountId, history, getActiveNetworkConfig]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const loadFromHistory = (item: QueryHistoryItem) => {
    setKeyType(item.keyType);
    switch (item.keyType) {
      case "ContractData": {
        const input = item.input as ContractDataKeyInput;
        setContractId(input.contractId);
        setStorageKeyType(input.storageKeyType);
        setStorageKeyValue(input.storageKeyValue);
        setDurability(input.durability);
        break;
      }
      case "ContractCode":
        setWasmHash((item.input as ContractCodeKeyInput).wasmHash);
        break;
      case "Account":
        setAccountId((item.input as AccountKeyInput).accountId);
        break;
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    toast.success("History cleared");
  };

  const formatJson = (obj: unknown): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <div className="container max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          Ledger Key Inspector
        </h1>
        <p className="mt-2 text-muted-foreground">
          Construct and query arbitrary ledger keys against the Soroban RPC.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Input Column */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Key Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Ledger Key Type</Label>
                <Select value={keyType} onValueChange={(v: LedgerKeyType) => setKeyType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ContractData">Contract Data</SelectItem>
                    <SelectItem value="ContractCode">Contract Code</SelectItem>
                    <SelectItem value="Account">Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {keyType === "ContractData" && (
                <>
                  <div className="space-y-2">
                    <Label>Contract ID</Label>
                    <Input
                      placeholder="C..."
                      value={contractId}
                      onChange={(e) => setContractId(e.target.value.trim())}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1 space-y-2">
                      <Label>Key Type</Label>
                      <Select value={storageKeyType} onValueChange={setStorageKeyType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="symbol">Symbol</SelectItem>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="address">Address</SelectItem>
                          <SelectItem value="i32">i32</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Key Value</Label>
                      <Input
                        placeholder="e.g. Counter, Admin..."
                        value={storageKeyValue}
                        onChange={(e) => setStorageKeyValue(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Durability</Label>
                    <Select
                      value={durability}
                      onValueChange={(v: "persistent" | "temporary") => setDurability(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="persistent">Persistent</SelectItem>
                        <SelectItem value="temporary">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {keyType === "ContractCode" && (
                <div className="space-y-2">
                  <Label>WASM Hash (64 hex chars)</Label>
                  <Input
                    placeholder="abc123..."
                    value={wasmHash}
                    onChange={(e) => setWasmHash(e.target.value.trim())}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              {keyType === "Account" && (
                <div className="space-y-2">
                  <Label>Account ID</Label>
                  <Input
                    placeholder="G..."
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value.trim())}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleFetch}
                disabled={!keyXdr || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Fetch Ledger Entry
              </Button>
            </CardContent>
          </Card>

          {/* Query History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Queries
              </CardTitle>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearHistory}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No queries yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      className="w-full rounded-md border p-2 text-left hover:bg-muted"
                      onClick={() => loadFromHistory(item)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{item.keyType}</span>
                        <span
                          className={`text-[10px] ${
                            item.found ? "text-green-600" : "text-muted-foreground"
                          }`}
                        >
                          {item.found ? "Found" : "Not found"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate font-mono">
                        {item.keyXdr.slice(0, 40)}...
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Result Column */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>Ledger Key XDR</CardTitle>
              <CardDescription>Base64 encoded LedgerKey</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {error ? (
                <div className="flex flex-1 items-center justify-center rounded-md border border-red-200 bg-red-50 p-4 text-center text-sm text-red-500 dark:bg-red-900/10">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  {error}
                </div>
              ) : !keyXdr ? (
                <div className="flex flex-1 items-center justify-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
                  Enter details to generate key...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="flex min-h-[80px] items-center break-all rounded-md bg-slate-950 p-4 font-mono text-xs text-slate-50">
                      {keyXdr}
                    </div>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-2 h-6 w-6"
                      onClick={() => copyToClipboard(keyXdr)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">
                      External Tools
                    </Label>
                    <Button variant="outline" className="w-full justify-between" asChild>
                      <a
                        href={`https://stellar.expert/explorer/${currentNetwork}/contract/${contractId || "root"}/storage`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          View on Stellar.Expert
                        </span>
                        <ArrowRight className="h-4 w-4 opacity-50" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Query Result */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.found ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  Query Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.found ? (
                  <div className="space-y-4">
                    {result.entries.map((entry, i) => (
                      <div key={i} className="space-y-2">
                        {entry.lastModifiedLedgerSeq && (
                          <p className="text-xs text-muted-foreground">
                            Last modified ledger: {entry.lastModifiedLedgerSeq}
                          </p>
                        )}
                        {entry.liveUntilLedgerSeq && (
                          <p className="text-xs text-muted-foreground">
                            Live until ledger: {entry.liveUntilLedgerSeq}
                          </p>
                        )}
                        <div className="relative">
                          <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 font-mono text-xs text-slate-50">
                            {entry.value ? formatJson(JSON.parse(entry.value)) : "No decoded value"}
                          </pre>
                          {entry.value && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="absolute right-2 top-2 h-6 w-6"
                              onClick={() => copyToClipboard(entry.value!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No ledger entry found for this key.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

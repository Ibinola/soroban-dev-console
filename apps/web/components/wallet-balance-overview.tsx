"use client";

import { useEffect, useState, useCallback } from "react";
import { Horizon, Contract, rpc as SorobanRpc, Address, TransactionBuilder, TimeoutInfinite, scValToNative } from "@stellar/stellar-sdk";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useTrackedTokensStore } from "@/store/useTrackedTokensStore";
import { Button } from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@devconsole/ui";
import { Coins, Plus, Trash2, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export function WalletBalanceOverview() {
  const { isConnected, address } = useWallet();
  const { getActiveNetworkConfig, currentNetwork, getHorizonUrl } = useNetworkStore();
  const { tokens, addToken, removeToken } = useTrackedTokensStore();

  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [newContractId, setNewContractId] = useState("");
  const [addingToken, setAddingToken] = useState(false);

  const activeTokens = tokens.filter((t) => t.networkId === currentNetwork);

  const fetchBalances = useCallback(async () => {
    if (!isConnected || !address) return;
    setLoading(true);

    const network = getActiveNetworkConfig();

    // 1. Fetch XLM Balance via Horizon
    try {
      const horizonUrl = getHorizonUrl();
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(address);
      const native = account.balances.find((b) => b.asset_type === "native");
      if (native) {
        setXlmBalance(
          parseFloat(native.balance).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })
        );
      } else {
        setXlmBalance("0.00");
      }
    } catch (err) {
      console.error("Failed to fetch XLM balance", err);
      setXlmBalance("0.00"); // Fallback for 404 or unfunded
    }

    // 2. Fetch Tracked Token Balances via Soroban RPC
    const balances: Record<string, string> = {};
    const server = new SorobanRpc.Server(network.rpcUrl);

    await Promise.all(
      activeTokens.map(async (token) => {
        try {
          const contract = new Contract(token.contractId);
          const addressArg = new Address(address).toScVal();

          const tx = new TransactionBuilder(
            {
              accountId: () => address,
              sequenceNumber: () => "0",
              incrementSequenceNumber: () => {},
            },
            { fee: "100", networkPassphrase: network.networkPassphrase }
          )
            .addOperation(contract.call("balance", addressArg))
            .setTimeout(TimeoutInfinite)
            .build();

          const sim = await server.simulateTransaction(tx);
          if (SorobanRpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
            const rawBalance = scValToNative(sim.result.retval);
            const divisor = Math.pow(10, token.decimals);
            const fmt = (Number(rawBalance) / divisor).toLocaleString(undefined, {
              maximumFractionDigits: token.decimals,
            });
            balances[token.contractId] = `${fmt} ${token.symbol}`;
          } else {
            balances[token.contractId] = `0.00 ${token.symbol}`;
          }
        } catch (e) {
          console.error(`Failed to fetch balance for token ${token.contractId}`, e);
          balances[token.contractId] = `Error ${token.symbol}`;
        }
      })
    );

    setTokenBalances(balances);
    setLoading(false);
  }, [isConnected, address, currentNetwork, activeTokens, getActiveNetworkConfig, getHorizonUrl]);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalances();
    } else {
      setXlmBalance(null);
      setTokenBalances({});
    }
  }, [isConnected, address, currentNetwork, fetchBalances]);

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractId || !address) return;

    setAddingToken(true);
    const network = getActiveNetworkConfig();

    try {
      await addToken(
        newContractId.trim(),
        currentNetwork,
        network.rpcUrl,
        network.networkPassphrase,
        address
      );
      setNewContractId("");
      toast.success("Custom SAC token tracked successfully!");
      fetchBalances();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add token. Verify the contract ID is a valid SAC.");
    } finally {
      setAddingToken(false);
    }
  };

  if (!isConnected || !address) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 font-mono">
          <Coins className="h-4 w-4 text-primary" />
          <span>{xlmBalance !== null ? `${xlmBalance} XLM` : "0.00 XLM"}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-3">
        <div className="flex items-center justify-between pb-2">
          <DropdownMenuLabel className="p-0">Account Balances</DropdownMenuLabel>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={fetchBalances}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <DropdownMenuSeparator />

        {/* XLM Balance Display */}
        <div className="flex items-center justify-between py-2 font-mono text-sm">
          <span className="text-muted-foreground">Stellar Lumens</span>
          <span className="font-bold">{xlmBalance !== null ? `${xlmBalance} XLM` : "0.00 XLM"}</span>
        </div>

        <DropdownMenuSeparator />

        {/* Custom Tokens Section */}
        <div className="space-y-1 py-1 max-h-48 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1">
            Soroban Assets (SAC)
          </p>

          {activeTokens.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No custom SAC tokens tracked.
            </p>
          ) : (
            activeTokens.map((token) => (
              <div key={token.contractId} className="flex items-center justify-between py-1.5">
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-xs truncate max-w-[160px]" title={token.name}>
                    {token.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">
                    {token.contractId.slice(0, 6)}...{token.contractId.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold">
                    {tokenBalances[token.contractId] || `... ${token.symbol}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => {
                      removeToken(token.contractId, currentNetwork);
                      toast.success(`Stopped tracking ${token.symbol}`);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Add Custom Token Form */}
        <form onSubmit={handleAddToken} className="pt-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block pb-1.5">
            Add Custom Token (SAC ID)
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="C..."
              value={newContractId}
              onChange={(e) => setNewContractId(e.target.value)}
              className="h-8 text-xs font-mono"
              required
            />
            <Button size="sm" className="h-8 px-2.5" disabled={addingToken || !newContractId}>
              {addingToken ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState } from "react";
import { Horizon } from "@stellar/stellar-sdk";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  FileJson,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Link from "next/link";

// Helper to get Horizon URL based on network ID
const getHorizonUrl = (networkId: string) => {
  switch (networkId) {
    case "mainnet":
      return "https://horizon.stellar.org";
    case "testnet":
      return "https://horizon-testnet.stellar.org";
    case "futurenet":
      return "https://horizon-futurenet.stellar.org";
    case "local":
      return "http://localhost:8000";
    default:
      return "https://horizon-testnet.stellar.org";
  }
};

export default function TransactionLookupPage() {
  const { currentNetwork } = useNetworkStore();
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [txData, setTxData] = useState<any | null>(null);

  const handleSearch = async () => {
    const cleanHash = hash.trim();
    if (!cleanHash) return;

    setLoading(true);
    setTxData(null);

    try {
      const serverUrl = getHorizonUrl(currentNetwork);
      const server = new Horizon.Server(serverUrl);

      const tx = await server.transactions().transaction(cleanHash).call();
      setTxData(tx);
    } catch (error: any) {
      console.error(error);
      if (error.response?.status === 404) {
        toast.error("Transaction not found on this network.");
      } else {
        toast.error("Failed to fetch transaction.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Transaction Lookup
          </h1>
          <p className="text-muted-foreground">
            Search for any transaction hash on the {currentNetwork} network.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="Paste Transaction Hash (e.g. 7b3...)"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              className="font-mono"
            />
            <Button onClick={handleSearch} disabled={!hash || loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Search</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {txData && (
        <Card className="animate-in fade-in-50 slide-in-from-bottom-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Transaction Details
                  {txData.successful ? (
                    <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Success
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" /> Failed
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="font-mono text-xs mt-2 break-all">
                  {txData.hash}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="grid gap-6 pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Created At
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {new Date(txData.created_at).toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Ledger
                </p>
                <p className="text-sm font-mono">{txData.ledger_attr}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Fee Charged
                </p>
                <p className="text-sm font-mono">
                  {txData.fee_charged} stroops
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Operation Count
                </p>
                <p className="text-sm font-mono">{txData.operation_count}</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Source Account
              </p>
              <p className="text-sm font-mono break-all bg-muted p-2 rounded-md">
                {txData.source_account}
              </p>
            </div>

            {txData.memo && txData.memo_type !== "none" && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Memo ({txData.memo_type})
                </p>
                <p className="text-sm p-2 border rounded-md">{txData.memo}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Envelope XDR
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() =>
                    navigator.clipboard.writeText(txData.envelope_xdr)
                  }
                >
                  <FileJson className="h-3 w-3" /> Copy XDR
                </Button>
              </div>
              <div className="bg-muted/50 p-3 rounded-md overflow-x-auto">
                <pre className="text-xs font-mono">{txData.envelope_xdr}</pre>
              </div>
              <div className="flex justify-end">
                <Button variant="link" size="sm" asChild className="px-0">
                  <Link href="/tools/xdr">Decode in XDR Tool →</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

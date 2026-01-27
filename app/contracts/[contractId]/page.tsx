// app/contracts/[contractId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { rpc as SorobanRpc, Address, xdr } from "@stellar/stellar-sdk";
import {
  ArrowLeft,
  Box,
  Database,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ContractCallForm } from "@/components/contract-call-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractEvents } from "@/components/contract-events";

// Hardcoded for Wave 1 - moved to a constant
const RPC_URL = "https://soroban-testnet.stellar.org:443";

interface ContractData {
  exists: boolean;
  wasmHash?: string;
  lastModified?: number;
  ledgerSeq?: number;
}

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = params.contractId as string;

  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchContract() {
      if (!contractId) return;

      try {
        const server = new SorobanRpc.Server(RPC_URL);

        try {
          Address.fromString(contractId);
        } catch {
          throw new Error("Invalid Contract ID format.");
        }

        const ledgerKey = xdr.LedgerKey.contractData(
          new xdr.LedgerKeyContractData({
            contract: new Address(contractId).toScAddress(),
            key: xdr.ScVal.scvLedgerKeyContractInstance(),
            durability: xdr.ContractDataDurability.persistent(),
          }),
        );

        const response = await server.getLedgerEntries(ledgerKey);

        if (!response.entries || response.entries.length === 0) {
          setData({ exists: false });
        } else {
          const entry = response.entries[0];
          setData({
            exists: true,
            lastModified: entry.lastModifiedLedgerSeq,
            ledgerSeq: entry.lastModifiedLedgerSeq,
          });
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to fetch contract data");
      } finally {
        setLoading(false);
      }
    }

    fetchContract();
  }, [contractId]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Navigation Header */}
      <div className="flex items-center gap-4">
        <Link href="/contracts">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Contract Details
            {loading ? (
              <Skeleton className="h-6 w-20 rounded-full" />
            ) : data?.exists ? (
              <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
            ) : error ? (
              <Badge variant="destructive">Error</Badge>
            ) : (
              <Badge variant="secondary">Not Found</Badge>
            )}
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            {contractId}
          </p>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Contract</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview & Interaction</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="code" disabled>
            Code (Coming Soon)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ... The existing Contract Overview Card & Interaction Form go here ... */}
            {/* Copy paste your existing layout code here */}
          </div>
        </TabsContent>

        <TabsContent value="events">
          <ContractEvents contractId={contractId} />
        </TabsContent>
      </Tabs>
      ;
    </div>
  );
}

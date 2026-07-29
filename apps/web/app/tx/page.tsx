"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useContractStore } from "@/store/useContractStore";
import { fetchRecentTransactions, type NormalizedTx } from "@/lib/history-utils";
import { exportToCSV } from "@/lib/export-csv";
import {
  Search,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
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
import { Badge } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { toast } from "sonner";

import { DEFAULT_LOCAL_HORIZON_URL } from "@devconsole/api-contracts";

const PAGE_SIZE = 20;

const HORIZON_URL: Record<string, string> = {
  mainnet: "https://horizon.stellar.org",
  testnet: "https://horizon-testnet.stellar.org",
  futurenet: "https://horizon-futurenet.stellar.org",
  local: DEFAULT_LOCAL_HORIZON_URL,
};

type StatusFilter = "all" | "success" | "error" | "pending";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function isInDateRange(tx: NormalizedTx, from: string, to: string): boolean {
  if (!from && !to) return true;
  const ts = new Date(tx.createdAt).getTime();
  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs = to ? new Date(to + "T23:59:59").getTime() : Infinity;
  return ts >= fromMs && ts <= toMs;
}

export default function TxHistoryPage() {
  const { currentNetwork } = useNetworkStore();
  const { contracts } = useContractStore();

  const [address, setAddress] = useState("");
  const [allRecords, setAllRecords] = useState<NormalizedTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Filters
  const [methodFilter, setMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  const horizonUrl = HORIZON_URL[currentNetwork] ?? HORIZON_URL.testnet;

  const handleFetch = async () => {
    const cleanAddress = address.trim();
    if (!cleanAddress) {
      toast.error("Enter an account address to load history");
      return;
    }

    setLoading(true);
    setFetched(false);
    try {
      const { records } = await fetchRecentTransactions(cleanAddress, horizonUrl);
      setAllRecords(records);
      setPage(1);
      setFetched(true);
      if (records.length === 0) {
        toast.info("No transactions found for this account on the current network.");
      }
    } catch (e: any) {
      toast.error(`Failed to load transactions: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Apply all filters
  const filtered = useMemo(() => {
    return allRecords.filter((tx) => {
      if (methodFilter && !tx.operationSummary.toLowerCase().includes(methodFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter === "success" && !tx.successful) return false;
      if (statusFilter === "error" && tx.successful) return false;
      if (contractFilter !== "all" && !tx.sourceAccount.includes(contractFilter)) {
        return false;
      }
      if (!isInDateRange(tx, dateFrom, dateTo)) return false;
      return true;
    });
  }, [allRecords, methodFilter, statusFilter, contractFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No records to export");
      return;
    }
    exportToCSV(filtered, `tx-history-${currentNetwork}-${Date.now()}`);
    toast.success(`Exported ${filtered.length} transactions`);
  };

  const handleClearFilters = () => {
    setMethodFilter("");
    setStatusFilter("all");
    setContractFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="container max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
        <p className="text-muted-foreground">
          Browse, filter, and export transactions for any account on the {currentNetwork} network.
        </p>
      </div>

      {/* Address + Fetch */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="Stellar account address (G…)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              className="font-mono"
            />
            <Button onClick={handleFetch} disabled={loading || !address}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Load</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {fetched && (
        <>
          {/* Filter toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="mr-1 h-3 w-3" />
              Filters
              {(methodFilter || statusFilter !== "all" || contractFilter !== "all" || dateFrom || dateTo) && (
                <Badge className="ml-1 h-4 w-4 rounded-full p-0 text-[10px]">!</Badge>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-3 w-3" />
              Export CSV
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          {showFilters && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Filter Transactions</CardTitle>
                <CardDescription className="text-xs">
                  Narrow results by method, status, contract, or date range.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Method (text search)</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                    <Input
                      className="pl-6 text-xs"
                      placeholder="e.g. Contract Call"
                      value={methodFilter}
                      onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={(v: StatusFilter) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {contracts.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Contract (source match)</Label>
                    <Select value={contractFilter} onValueChange={(v) => { setContractFilter(v); setPage(1); }}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {contracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.id.slice(0, 12)}…
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Date From</Label>
                  <Input
                    type="date"
                    className="text-xs"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Date To</Label>
                  <Input
                    type="date"
                    className="text-xs"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  />
                </div>

                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs">
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Table */}
          <Card>
            <CardContent className="p-0">
              {paginated.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No transactions match the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Hash</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Method</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Fee</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            {tx.successful ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/tx/${tx.hash}`}
                              className="font-mono text-xs text-primary hover:underline underline-offset-2"
                            >
                              {tx.hash.slice(0, 12)}…
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px]">
                              {tx.operationSummary}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {tx.feePaid} str
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(tx.createdAt)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} ({filtered.length} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-3 w-3" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

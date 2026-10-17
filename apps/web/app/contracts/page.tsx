"use client";

import { useEffect, useState } from "react";
import { useContractStore } from "@/store/useContractStore";
import {
  Trash2,
  Plus,
  Search,
  FileCode,
  FlaskConical,
  BookmarkPlus,
  Star,
  Wrench,
  Network,
} from "lucide-react";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { getDeployedFixtures } from "@/lib/fixture-manifest";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { FixtureFallbackIndicator } from "@/components/fixture-fallback-indicator";

import { useTranslations } from "@/i18n/locale-provider";
export default function ContractsPage() {
  const t = useTranslations();
  const { contracts, addContract, removeContract } = useContractStore();
  const { currentNetwork } = useNetworkStore();
  const {
    activeWorkspaceId,
    bookmarkContract,
    getContractBookmarks,
    toggleBookmarkFavorite,
    removeContractBookmark,
    repairBookmarkNetwork,
  } = useWorkspaceStore();
  const [inputVal, setInputVal] = useState("");
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const fixtures = getDeployedFixtures();
  const bookmarks = getContractBookmarks(activeWorkspaceId);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleAdd = () => {
    const id = inputVal.trim();

    if (!id.startsWith("C") || id.length !== 56) {
      toast.error(t("contracts.errors.invalidId"));
      setError(t("contracts.errors.invalidId"));
      return;
    }

    addContract(id, currentNetwork);
    bookmarkContract(activeWorkspaceId, id, currentNetwork, "manual");
    setInputVal("");
    setError("");
    toast.success(t("contracts.toasts.added"));
  };

  if (!isMounted) return null;

  return (
    <div className="container mx-auto space-y-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("contracts.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("contracts.subtitle")}
          </p>
        </div>
        <Link href="/contracts/graph">
          <Button variant="outline" className="gap-2">
            <Network className="h-4 w-4" />
            {t("contracts.dependencyGraph")}
          </Button>
        </Link>
      </div>

      {/* Add Contract Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("contracts.track.title")}</CardTitle>
          <CardDescription>
            {t("contracts.track.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="C..."
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setError("");
                }}
                className={error ? "border-red-500" : ""}
              />
              {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            </div>
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("contracts.track.add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[400px]">{t("contracts.table.contractId")}</TableHead>
              <TableHead>{t("contracts.table.network")}</TableHead>
              <TableHead>{t("contracts.table.dateAdded")}</TableHead>
              <TableHead className="text-right">{t("contracts.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("contracts.table.empty")}
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-mono text-sm font-medium">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="flex items-center gap-2 transition-colors hover:text-blue-500 hover:underline"
                    >
                      <FileCode className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="flex flex-col">
                        {/* Issue #1098: show the deploy-time alias, when set, above the raw ID */}
                        {contract.name && !contract.name.startsWith("Contract ") && (
                          <span className="font-sans text-xs font-semibold text-foreground">
                            {contract.name}
                          </span>
                        )}
                        <span>{contract.id}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      {contract.network}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(contract.addedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          bookmarkContract(
                            activeWorkspaceId,
                            contract.id,
                            contract.network,
                            "contracts-page",
                          );
                          toast.success(t("contracts.toasts.bookmarked"));
                        }}
                        className="text-muted-foreground hover:text-blue-500"
                      >
                        <BookmarkPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          removeContract(contract.id);
                          toast.success(t("contracts.toasts.removed"));
                        }}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* FE-063: Fallback state indicator for fixture manifest */}
      <FixtureFallbackIndicator />

      {/* FE-015: Fixture contracts from manifest */}
      {fixtures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4" />
              {t("contracts.fixtures.title")}
              <FixtureFallbackIndicator compact />
            </CardTitle>
            <CardDescription>
              {t("contracts.fixtures.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {fixtures.map((f) => (
                <div
                  key={f.key}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.description}
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {f.contractId}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      addContract(f.contractId!, f.network);
                      bookmarkContract(
                        activeWorkspaceId,
                        f.contractId!,
                        f.network,
                        "fixture",
                      );
                      toast.success(t("contracts.toasts.fixtureAdded", { label: f.label }));
                    }}
                    disabled={contracts.some((c) => c.id === f.contractId)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {t("contracts.fixtures.add")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("contracts.bookmarks.title")}</CardTitle>
          <CardDescription>
            {t("contracts.bookmarks.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("contracts.bookmarks.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {bookmarks.map((bookmark) => {
                const isStale = !contracts.some(
                  (contract) =>
                    contract.id === bookmark.contractId &&
                    contract.network === bookmark.networkId,
                );

                return (
                  <div
                    key={bookmark.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/contracts/${bookmark.contractId}`}
                        className="truncate font-mono text-xs hover:text-blue-500 hover:underline"
                      >
                        {bookmark.contractId}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {t("contracts.bookmarks.meta", { network: bookmark.networkId, source: bookmark.source })}
                        {isStale ? ` · ${t("contracts.bookmarks.stale")}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          toggleBookmarkFavorite(activeWorkspaceId, bookmark.id)
                        }
                        className={
                          bookmark.favorite
                            ? "text-amber-500"
                            : "text-muted-foreground"
                        }
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                      {isStale && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            addContract(bookmark.contractId, bookmark.networkId);
                            repairBookmarkNetwork(
                              activeWorkspaceId,
                              bookmark.id,
                              bookmark.networkId,
                            );
                            toast.success(t("contracts.toasts.repaired"));
                          }}
                          className="text-blue-600"
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          removeContractBookmark(activeWorkspaceId, bookmark.id)
                        }
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

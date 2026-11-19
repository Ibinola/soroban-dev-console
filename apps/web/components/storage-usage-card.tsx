"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@devconsole/ui";
import { toast } from "sonner";
import { useTranslations } from "@/i18n/locale-provider";
import { useAbiStore } from "@/store/useAbiStore";
import { useArtifactStore } from "@/store/useArtifactStore";
import { useContractStore } from "@/store/useContractStore";
import { useContractVersionStore } from "@/store/useContractVersionStore";
import { useDeploymentLogStore } from "@/store/useDeploymentLogStore";
import { useFavoriteContractsStore } from "@/store/useFavoriteContractsStore";
import { useResultBundlesStore } from "@/store/useResultBundlesStore";
import { useSavedCallsStore } from "@/store/useSavedCallsStore";
import { useWorkspaceActivityStore } from "@/store/useWorkspaceActivityStore";
import { useWorkspaceNotesStore } from "@/store/useWorkspaceNotesStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useWasmStore } from "@/store/useWasmStore";

const LOCAL_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

const STORAGE_CATEGORIES = {
  workspaces: [
    "soroban-workspaces",
    "soroban-workspace-notes",
    "soroban-workspace-activity",
  ],
  contracts: [
    "soroban-contracts-storage",
    "soroban-contract-versions",
    "soroban-abi-storage",
    "soroban-artifact-storage",
    "soroban-wasm-storage",
    "soroban-favorite-contracts",
    "soroban-saved-calls",
    "soroban-result-bundles",
  ],
  deploymentLogs: ["soroban-deployment-log-storage"],
} as const;

type StorageCategory = keyof typeof STORAGE_CATEGORIES;
type StorageUsage = Record<StorageCategory | "total", number>;

const EMPTY_USAGE: StorageUsage = {
  workspaces: 0,
  contracts: 0,
  deploymentLogs: 0,
  total: 0,
};

function measureLocalStorage(): StorageUsage {
  const usage = { ...EMPTY_USAGE };

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key === null) continue;

    const value = window.localStorage.getItem(key) ?? "";
    const bytes = (key.length + value.length) * 2;
    usage.total += bytes;

    for (const [category, keys] of Object.entries(STORAGE_CATEGORIES) as [
      StorageCategory,
      readonly string[],
    ][]) {
      if (keys.includes(key)) {
        usage[category] += bytes;
        break;
      }
    }
  }

  return usage;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function StorageUsageCard() {
  const t = useTranslations();
  const [usage, setUsage] = useState(EMPTY_USAGE);
  const [selected, setSelected] = useState<StorageCategory[]>([]);

  useEffect(() => {
    let timeout: ReturnType<typeof window.setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        setUsage(measureLocalStorage());
        timeout = undefined;
      }, 0);
    };

    const unsubscribe = [
      useWorkspaceStore.subscribe(scheduleRefresh),
      useWorkspaceNotesStore.subscribe(scheduleRefresh),
      useWorkspaceActivityStore.subscribe(scheduleRefresh),
      useContractStore.subscribe(scheduleRefresh),
      useContractVersionStore.subscribe(scheduleRefresh),
      useAbiStore.subscribe(scheduleRefresh),
      useArtifactStore.subscribe(scheduleRefresh),
      useWasmStore.subscribe(scheduleRefresh),
      useFavoriteContractsStore.subscribe(scheduleRefresh),
      useSavedCallsStore.subscribe(scheduleRefresh),
      useResultBundlesStore.subscribe(scheduleRefresh),
      useDeploymentLogStore.subscribe(scheduleRefresh),
    ];

    window.addEventListener("storage", scheduleRefresh);
    scheduleRefresh();

    return () => {
      unsubscribe.forEach((remove) => remove());
      window.removeEventListener("storage", scheduleRefresh);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, []);

  const percent = (usage.total / LOCAL_STORAGE_LIMIT_BYTES) * 100;
  const progress = Math.min(percent, 100);
  const warning = percent > 80;

  const toggleCategory = (category: StorageCategory) => {
    setSelected((current) =>
      current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    );
  };

  const clearSelected = () => {
    if (selected.length === 0 || !window.confirm(t("settings.storage.confirm"))) {
      return;
    }

    try {
      if (selected.includes("workspaces")) {
        useWorkspaceStore.getState().clearLocalData();
        useWorkspaceNotesStore.setState({ notes: [] });
        useWorkspaceActivityStore.setState({ events: [], newEntryIds: new Set() });
      }
      if (selected.includes("contracts")) {
        useContractStore.setState({ contracts: [], undoStack: [], redoStack: [] });
        useContractVersionStore.setState({ snapshots: [] });
        useAbiStore.setState({ specs: {} });
        useArtifactStore.setState({ artifacts: {} });
        useWasmStore.setState({ wasms: [] });
        useFavoriteContractsStore.setState({ ids: [] });
        useSavedCallsStore.setState({ savedCalls: [], cartItems: [], presets: [] });
        useResultBundlesStore.getState().clearBundles();
      }
      if (selected.includes("deploymentLogs")) {
        useDeploymentLogStore.getState().clearLog();
      }

      setSelected([]);
      toast.success(t("settings.storage.clearSuccess"));
    } catch (error) {
      console.error("Failed to clear selected local storage data", error);
      toast.error(t("settings.storage.clearFailed"));
    }
  };

  const categories: { id: StorageCategory; label: string }[] = [
    { id: "workspaces", label: t("settings.storage.workspaces") },
    { id: "contracts", label: t("settings.storage.contracts") },
    { id: "deploymentLogs", label: t("settings.storage.deploymentLogs") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.storage.title")}</CardTitle>
        <CardDescription>{t("settings.storage.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span>
              {formatBytes(usage.total)} / {formatBytes(LOCAL_STORAGE_LIMIT_BYTES)}
            </span>
            <span className="flex items-center gap-1">
              {warning && (
                <AlertTriangle
                  className="h-4 w-4 text-amber-600"
                  aria-label={t("settings.storage.warning")}
                />
              )}
              {percent.toFixed(1)}%
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t("settings.storage.usage")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(Math.round(percent), 100)}
          >
            <div
              className={`h-full rounded-full transition-[width] ${
                warning ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("settings.storage.limitNote")}
          </p>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {categories.map(({ id, label }) => (
            <div key={id} className="rounded-md border p-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{formatBytes(usage[id])}</dd>
            </div>
          ))}
        </dl>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            {t("settings.storage.clearLabel")}
          </legend>
          {categories.map(({ id, label }) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={() => toggleCategory(id)}
                className="h-4 w-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <Button
          variant="outline"
          onClick={clearSelected}
          disabled={selected.length === 0}
        >
          {t("settings.storage.clearCache")}
        </Button>
      </CardContent>
    </Card>
  );
}

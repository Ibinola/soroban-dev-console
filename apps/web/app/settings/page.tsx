"use client";

import { useState } from "react";
import { useNetworkStore, DEFAULT_NETWORKS } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useTheme } from "next-themes";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Switch } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@devconsole/ui";
import {
  Trash2,
  Plus,
  Wifi,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { DataManagement } from "@/components/data-management";
import { RuntimeConfigStatus } from "@/components/runtime-config-status";
import { SupportBundleCard } from "@/components/support-bundle-card";
import { toast } from "sonner";
import { FixtureFallbackIndicator } from "@/components/fixture-fallback-indicator";

import { useTranslations } from "@/i18n/locale-provider";
import { LanguageSelector } from "@/components/language-selector";
// Issue #747: SSR-safe theme button group
function ThemeSelector() {
  const t = useTranslations();
  const { setTheme: setNextTheme } = useTheme();
  const { theme, setTheme } = useSettingsStore();

  const handleSelect = (value: "light" | "dark" | "system") => {
    setTheme(value);
    setNextTheme(value);
  };

  const options = [
    { value: "light" as const, label: t("settings.appearance.light"), icon: Sun },
    { value: "dark" as const, label: t("settings.appearance.dark"), icon: Moon },
    { value: "system" as const, label: t("settings.appearance.system"), icon: Monitor },
  ];

  return (
    <div className="flex gap-2">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => handleSelect(value)}
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
            theme === value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:bg-muted"
          }`}
          aria-pressed={theme === value}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations();
  const { customNetworks, addCustomNetwork, removeCustomNetwork, autoFailover, setAutoFailover, degradationThresholdMs, setDegradationThreshold, failoverNetworkId, setFailoverNetworkId } =
    useNetworkStore();
  const { defaultNetwork, setDefaultNetwork, autoRunSimulation, setAutoRunSimulation } =
    useSettingsStore();

  const [formData, setFormData] = useState({
    name: "",
    rpcUrl: "",
    passphrase: "Test SDF Network ; September 2015",
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  const handleTestConnection = async () => {
    if (!formData.rpcUrl) return;
    setIsTesting(true);
    setTestStatus("idle");

    try {
      const server = new SorobanRpc.Server(formData.rpcUrl);
      const health = await server.getHealth();
      if (health.status !== "healthy")
        throw new Error("Network reported unhealthy");
      setTestStatus("success");
      toast.success(t("settings.toasts.connected"));
    } catch (e) {
      console.error(e);
      setTestStatus("error");
      toast.error(t("settings.toasts.connectFailed"));
    } finally {
      setIsTesting(false);
    }
  };

  const handleAdd = () => {
    if (!formData.name || !formData.rpcUrl || !formData.passphrase) {
      toast.error(t("settings.toasts.fillAll"));
      return;
    }

    if (testStatus !== "success") {
      toast.warning(t("settings.toasts.testFirst"));
    }

    const newId = `custom-${Date.now()}`;
    addCustomNetwork({
      id: newId,
      name: formData.name,
      rpcUrl: formData.rpcUrl,
      networkPassphrase: formData.passphrase,
    });

    setFormData({ name: "", rpcUrl: "", passphrase: "" });
    setTestStatus("idle");
    toast.success(t("settings.toasts.networkAdded"));
  };

  return (
    <div className="container max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </div>

      {/* FE-063: Fallback state indicator for fixture manifest */}
      <FixtureFallbackIndicator />

      {/* Issue #747: Appearance section */}
      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.appearance.title")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.appearance.theme")}</CardTitle>
            <CardDescription>
              {t("settings.appearance.themeDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>
      </div>

      {/* #1293: language selector */}
      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.language.title")}</h2>
        <Card>
          <CardContent className="pt-6">
            <LanguageSelector />
          </CardContent>
        </Card>
      </div>

      {/* Issue #747: Editor section */}
      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.editor.title")}</h2>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="default-network">{t("settings.editor.defaultNetwork")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.editor.defaultNetworkHint")}
              </p>
              <select
                id="default-network"
                value={defaultNetwork}
                onChange={(e) => setDefaultNetwork(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="testnet">{t("settings.networks.testnet")}</option>
                <option value="mainnet">{t("settings.networks.mainnet")}</option>
                <option value="futurenet">{t("settings.networks.futurenet")}</option>
                <option value="local">{t("settings.networks.local")}</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-run-simulation">{t("settings.editor.autoRun")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.editor.autoRunHint")}
                </p>
              </div>
              <Switch
                id="auto-run-simulation"
                checked={autoRunSimulation}
                onCheckedChange={setAutoRunSimulation}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-failover configuration */}
      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.failover.title")}</h2>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-failover-toggle">{t("settings.failover.enable")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.failover.enableHint")}
                </p>
              </div>
              <Switch
                id="auto-failover-toggle"
                checked={autoFailover}
                onCheckedChange={setAutoFailover}
              />
            </div>

            <div className="rounded-md border p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="failover-threshold">{t("settings.failover.threshold")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.failover.thresholdHint", { ms: degradationThresholdMs })}
                </p>
                <input
                  id="failover-threshold"
                  type="range"
                  min={500}
                  max={10000}
                  step={100}
                  value={degradationThresholdMs}
                  onChange={(e) => setDegradationThreshold(Number(e.target.value))}
                  className="w-full"
                  aria-label={t("settings.failover.thresholdAria")}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>500ms</span>
                  <span>10000ms</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4 space-y-2">
              <Label htmlFor="failover-network">{t("settings.failover.network")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.failover.networkHint")}
              </p>
              <select
                id="failover-network"
                value={failoverNetworkId}
                onChange={(e) => setFailoverNetworkId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {Object.values(DEFAULT_NETWORKS).map((net) => (
                  <option key={net.id} value={net.id}>{net.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced: Custom RPC networks */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.custom.addTitle")}</CardTitle>
            <CardDescription>
              {t("settings.custom.addDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.custom.name")}</Label>
              <Input
                placeholder={t("settings.custom.namePlaceholder")}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t("settings.custom.rpcUrl")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={formData.rpcUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, rpcUrl: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("settings.custom.passphrase")}</Label>
              <Input
                value={formData.passphrase}
                onChange={(e) =>
                  setFormData({ ...formData, passphrase: e.target.value })
                }
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting || !formData.rpcUrl}
                className="flex-1"
              >
                {isTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="mr-2 h-4 w-4" />
                )}
                {t("settings.custom.test")}
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                <Plus className="mr-2 h-4 w-4" />
                {t("settings.custom.add")}
              </Button>
            </div>

            {testStatus === "success" && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> {t("settings.custom.testOk")}
              </div>
            )}
            {testStatus === "error" && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" /> {t("settings.custom.testFailed")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* List Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.custom.listTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {customNetworks.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                {t("settings.custom.empty")}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("settings.custom.tableName")}</TableHead>
                      <TableHead>{t("settings.custom.rpcUrl")}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customNetworks.map((net) => (
                      <TableRow key={net.id}>
                        <TableCell className="font-medium">
                          {net.name}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                          {net.rpcUrl}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-red-500"
                            onClick={() => removeCustomNetwork(net.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.runtime.title")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.runtime.status")}</CardTitle>
            <CardDescription>
              {t("settings.runtime.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RuntimeConfigStatus showDetails={true} />
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.data.title")}</h2>
        <DataManagement />
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.diagnostics.title")}</h2>
        <SupportBundleCard />
      </div>
    </div>
  );
}

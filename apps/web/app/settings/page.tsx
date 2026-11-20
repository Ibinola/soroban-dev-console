"use client";

import { useMemo, useState } from "react";
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
  Pencil,
  Copy,
  Check,
  X,
} from "lucide-react";
import { DataManagement } from "@/components/data-management";
import { RuntimeConfigStatus } from "@/components/runtime-config-status";
import { SupportBundleCard } from "@/components/support-bundle-card";
import { toast } from "sonner";
import { FixtureFallbackIndicator } from "@/components/fixture-fallback-indicator";

import { useTranslations } from "@/i18n/locale-provider";
import { LanguageSelector } from "@/components/language-selector";
import { StorageUsageCard } from "@/components/storage-usage-card";
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
  const {
    profiles,
    activeProfileId,
    setActiveProfile,
    addProfile,
    updateProfile,
    duplicateProfile,
    removeProfile,
    autoFailover,
    setAutoFailover,
    degradationThresholdMs,
    setDegradationThreshold,
    failoverNetworkId,
    setFailoverNetworkId,
  } = useNetworkStore();
  const { defaultNetwork, setDefaultNetwork, autoRunSimulation, setAutoRunSimulation } =
    useSettingsStore();

  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileFormState>(emptyForm);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? profiles[0],
    [profiles, activeProfileId],
  );

  const resetForm = () => {
    setFormMode("create");
    setEditingId(null);
    setFormData(emptyForm);
    setTestStatus("idle");
  };

  const startEdit = (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    setFormMode("edit");
    setEditingId(id);
    setFormData({
      name: profile.name,
      rpcUrl: profile.rpcUrl,
      passphrase: profile.networkPassphrase,
      horizonUrl: profile.horizonUrl ?? "",
    });
    setTestStatus("idle");
  };

  const handleTestConnection = async () => {
    if (!formData.rpcUrl) return;
    setIsTesting(true);
    setTestStatus("idle");

    try {
      const server = new SorobanRpc.Server(formData.rpcUrl);
      const health = await server.getHealth();
      if (health.status !== "healthy") throw new Error("Network reported unhealthy");
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

  const handleSave = () => {
    if (!formData.name || !formData.rpcUrl || !formData.passphrase) {
      toast.error(t("settings.toasts.fillAll"));
      return;
    }

    if (formMode === "edit" && editingId) {
      updateProfile(editingId, {
        name: formData.name,
        rpcUrl: formData.rpcUrl,
        networkPassphrase: formData.passphrase,
        horizonUrl: formData.horizonUrl || undefined,
      });
      toast.success("Profile updated");
      resetForm();
      return;
    }

    const newId = addProfile({
      name: formData.name,
      rpcUrl: formData.rpcUrl,
      networkPassphrase: formData.passphrase,
      horizonUrl: formData.horizonUrl || undefined,
    });
    if (testStatus !== "success") {
      toast.warning(t("settings.toasts.testFirst"));
    }
    setActiveProfile(newId);
    toast.success(t("settings.toasts.networkAdded"));
    resetForm();
  };

  const handleDuplicate = (id: string) => {
    const newId = duplicateProfile(id);
    if (newId) {
      toast.success("Profile duplicated");
      startEdit(newId);
    }
  };

  const handleRemove = (id: string) => {
    if (profiles.length <= 1) {
      toast.error("At least one profile is required");
      return;
    }
    removeProfile(id);
    if (editingId === id) resetForm();
    toast.success("Profile removed");
  };

  const handleSetActive = (id: string) => {
    setActiveProfile(id);
    const p = profiles.find((x) => x.id === id);
    toast.success(`Active profile: ${p?.name ?? id}`);
  };

  return (
    <div className="container max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <FixtureFallbackIndicator />

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.appearance.title")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.appearance.theme")}</CardTitle>
            <CardDescription>{t("settings.appearance.themeDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.language.title")}</h2>
        <Card>
          <CardContent className="pt-6">
            <LanguageSelector />
          </CardContent>
        </Card>
      </div>

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
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-run-simulation">{t("settings.editor.autoRun")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.editor.autoRunHint")}</p>
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

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.failover.title")}</h2>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-failover-toggle">{t("settings.failover.enable")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.failover.enableHint")}</p>
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
              <p className="text-xs text-muted-foreground">{t("settings.failover.networkHint")}</p>
              <select
                id="failover-network"
                value={failoverNetworkId}
                onChange={(e) => setFailoverNetworkId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(profiles.length ? profiles : Object.values(DEFAULT_NETWORKS)).map((net) => (
                  <option key={net.id} value={net.id}>
                    {net.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Network Profiles</h2>
            <p className="text-sm text-muted-foreground">
              Create, edit, duplicate, and remove named profiles. Switching profiles updates RPC URL
              and passphrase together.
            </p>
          </div>
          {activeProfile && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Active profile: </span>
              <span className="font-medium">{activeProfile.name}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{formMode === "edit" ? "Edit Profile" : t("settings.custom.addTitle")}</CardTitle>
              <CardDescription>
                {formMode === "edit"
                  ? "Update profile name, RPC URL, and network passphrase."
                  : t("settings.custom.addDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("settings.custom.name")}</Label>
                <Input
                  placeholder={t("settings.custom.namePlaceholder")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("settings.custom.rpcUrl")}</Label>
                <Input
                  placeholder="https://..."
                  value={formData.rpcUrl}
                  onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("settings.custom.passphrase")}</Label>
                <Input
                  value={formData.passphrase}
                  onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Horizon URL (optional)</Label>
                <Input
                  placeholder="https://horizon..."
                  value={formData.horizonUrl}
                  onChange={(e) => setFormData({ ...formData, horizonUrl: e.target.value })}
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
                <Button onClick={handleSave} className="flex-1">
                  {formMode === "edit" ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                  {formMode === "edit" ? "Save Changes" : t("settings.custom.add")}
                </Button>
              </div>

              {formMode === "edit" && (
                <Button variant="ghost" onClick={resetForm} className="w-full">
                  <X className="mr-2 h-4 w-4" /> Cancel Edit
                </Button>
              )}

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

          <Card>
            <CardHeader>
              <CardTitle>Saved Profiles</CardTitle>
              <CardDescription>
                Named profiles for local, test, and custom networks. The active profile is used for RPC and passphrase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                  {t("settings.custom.empty")}
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("settings.custom.tableName")}</TableHead>
                        <TableHead>{t("settings.custom.rpcUrl")}</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((net) => {
                        const isActive = net.id === activeProfileId;
                        return (
                          <TableRow key={net.id} className={isActive ? "bg-muted/30" : undefined}>
                            <TableCell className="font-medium">
                              <div>{net.name}</div>
                              <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                                {net.networkPassphrase}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                              {net.rpcUrl}
                            </TableCell>
                            <TableCell>
                              {isActive ? (
                                <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">
                                  Active
                                </span>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleSetActive(net.id)}>
                                  Set Active
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" title="Edit profile" onClick={() => startEdit(net.id)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Duplicate profile" onClick={() => handleDuplicate(net.id)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Remove profile"
                                  className="text-muted-foreground hover:text-red-500"
                                  onClick={() => handleRemove(net.id)}
                                  disabled={profiles.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.runtime.title")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.runtime.status")}</CardTitle>
            <CardDescription>{t("settings.runtime.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RuntimeConfigStatus showDetails={true} />
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">{t("settings.storage.sectionTitle")}</h2>
        <StorageUsageCard />
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

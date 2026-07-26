"use client";

import { useState } from "react";
import { useNetworkStore } from "@/store/useNetworkStore";
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

// Issue #747: SSR-safe theme button group
function ThemeSelector() {
  const { setTheme: setNextTheme } = useTheme();
  const { theme, setTheme } = useSettingsStore();

  const handleSelect = (value: "light" | "dark" | "system") => {
    setTheme(value);
    setNextTheme(value);
  };

  const options = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
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
  const { customNetworks, addCustomNetwork, removeCustomNetwork } =
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
      toast.success("Connection Successful!");
    } catch (e) {
      console.error(e);
      setTestStatus("error");
      toast.error("Could not connect to RPC URL");
    } finally {
      setIsTesting(false);
    }
  };

  const handleAdd = () => {
    if (!formData.name || !formData.rpcUrl || !formData.passphrase) {
      toast.error("Please fill all fields");
      return;
    }

    if (testStatus !== "success") {
      toast.warning("We recommend testing the connection first");
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
    toast.success("Network added!");
  };

  return (
    <div className="container max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your preferences, custom RPC connections, and configurations.
        </p>
      </div>

      {/* FE-063: Fallback state indicator for fixture manifest */}
      <FixtureFallbackIndicator />

      {/* Issue #747: Appearance section */}
      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">Appearance</h2>
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>
              Choose your preferred color scheme. System follows your OS preference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>
      </div>

      {/* Issue #747: Editor section */}
      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">Editor</h2>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="default-network">Default Network</Label>
              <p className="text-xs text-muted-foreground">
                New workspaces will use this network by default.
              </p>
              <select
                id="default-network"
                value={defaultNetwork}
                onChange={(e) => setDefaultNetwork(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
                <option value="futurenet">Futurenet</option>
                <option value="local">Local</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-run-simulation">Auto-run Simulation</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically simulate contract calls when a method is selected.
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

      {/* Advanced: Custom RPC networks */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>Add Custom Network</CardTitle>
            <CardDescription>
              Connect to a private node or QuickNode instance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Network Name</Label>
              <Input
                placeholder="e.g. My Private Node"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>RPC URL</Label>
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
              <Label>Network Passphrase</Label>
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
                Test Connection
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                <Plus className="mr-2 h-4 w-4" />
                Add Network
              </Button>
            </div>

            {testStatus === "success" && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Endpoint is reachable and
                healthy.
              </div>
            )}
            {testStatus === "error" && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" /> Connection failed. Check
                CORS or URL.
              </div>
            )}
          </CardContent>
        </Card>

        {/* List Section */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Networks</CardTitle>
          </CardHeader>
          <CardContent>
            {customNetworks.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                No custom networks added.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>RPC URL</TableHead>
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
        <h2 className="mb-4 text-xl font-semibold">Runtime Configuration</h2>
        <Card>
          <CardHeader>
            <CardTitle>Configuration Status</CardTitle>
            <CardDescription>
              Monitor and manage the application's runtime configuration and fallback behavior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RuntimeConfigStatus showDetails={true} />
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">Application Data</h2>
        <DataManagement />
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">Diagnostics</h2>
        <SupportBundleCard />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { customNetworks, addCustomNetwork, removeCustomNetwork } =
    useNetworkStore();

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
      toast.success("Connection Successful!");
    } catch (e) {
      console.error(e);
      setTestStatus("error");
      toast.error("Could not connect to RPC URL");
    } finally {
      setIsTesting(false);
    }
  };

  const handleAdd = () => {
    if (!formData.name || !formData.rpcUrl || !formData.passphrase) {
      toast.error("Please fill all fields");
      return;
    }

    if (testStatus !== "success") {
      toast.warning("We recommend testing the connection first");
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
    toast.success("Network added!");
  };

  return (
    <div className="container max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your custom RPC connections and configurations.
        </p>
      </div>

      {/* FE-063: Fallback state indicator for fixture manifest */}
      <FixtureFallbackIndicator />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>Add Custom Network</CardTitle>
            <CardDescription>
              Connect to a private node or QuickNode instance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Network Name</Label>
              <Input
                placeholder="e.g. My Private Node"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>RPC URL</Label>
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
              <Label>Network Passphrase</Label>
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
                Test Connection
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                <Plus className="mr-2 h-4 w-4" />
                Add Network
              </Button>
            </div>

            {testStatus === "success" && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Endpoint is reachable and
                healthy.
              </div>
            )}
            {testStatus === "error" && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" /> Connection failed. Check
                CORS or URL.
              </div>
            )}
          </CardContent>
        </Card>

        {/* List Section */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Networks</CardTitle>
          </CardHeader>
          <CardContent>
            {customNetworks.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                No custom networks added.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>RPC URL</TableHead>
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
        <h2 className="mb-4 text-xl font-semibold">Runtime Configuration</h2>
        <Card>
          <CardHeader>
            <CardTitle>Configuration Status</CardTitle>
            <CardDescription>
              Monitor and manage the application's runtime configuration and fallback behavior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RuntimeConfigStatus showDetails={true} />
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">Application Data</h2>
        <DataManagement />
      </div>

      <div className="max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">Diagnostics</h2>
        <SupportBundleCard />
      </div>
    </div>
  );
}

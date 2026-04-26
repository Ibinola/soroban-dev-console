"use client";

import { useState } from "react";
import { useNetworkStore } from "@/store/useNetworkStore";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
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
} from "lucide-react";
import { DataManagement } from "@/components/data-management";
import { toast } from "sonner";
import { FixtureFallbackIndicator } from "@/components/fixture-fallback-indicator";

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
        <h2 className="mb-4 text-xl font-semibold">Application Data</h2>
        <DataManagement />
      </div>
    </div>
  );
}

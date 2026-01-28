'use client';

import { useState } from 'react';
import { useNetworkStore } from '@/store/useNetworkStore';
import { rpc as SorobanRpc } from '@stellar/stellar-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Wifi, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DataManagement } from '@/components/data-management';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { customNetworks, addCustomNetwork, removeCustomNetwork } = useNetworkStore();

  const [formData, setFormData] = useState({
    name: '',
    rpcUrl: '',
    passphrase: 'Test SDF Network ; September 2015', // Default suggestion
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleTestConnection = async () => {
    if (!formData.rpcUrl) return;
    setIsTesting(true);
    setTestStatus('idle');

    try {
      const server = new SorobanRpc.Server(formData.rpcUrl);
      const health = await server.getHealth();
      if (health.status !== 'healthy') throw new Error('Network reported unhealthy');
      setTestStatus('success');
      toast.success('Connection Successful!');
    } catch (e) {
      console.error(e);
      setTestStatus('error');
      toast.error('Could not connect to RPC URL');
    } finally {
      setIsTesting(false);
    }
  };

  const handleAdd = () => {
    if (!formData.name || !formData.rpcUrl || !formData.passphrase) {
      toast.error('Please fill all fields');
      return;
    }

    if (testStatus !== 'success') {
      toast.warning('We recommend testing the connection first');
    }

    const newId = `custom-${Date.now()}`;
    addCustomNetwork({
      id: newId,
      name: formData.name,
      rpcUrl: formData.rpcUrl,
      networkPassphrase: formData.passphrase,
    });

    setFormData({ name: '', rpcUrl: '', passphrase: '' });
    setTestStatus('idle');
    toast.success('Network added!');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your custom RPC connections and configurations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>Add Custom Network</CardTitle>
            <CardDescription>Connect to a private node or QuickNode instance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Network Name</Label>
              <Input
                placeholder="e.g. My Private Node"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>RPC URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={formData.rpcUrl}
                  onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Network Passphrase</Label>
              <Input
                value={formData.passphrase}
                onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
              />
            </div>

            <div className="pt-2 flex gap-3">
              <Button variant="outline" onClick={handleTestConnection} disabled={isTesting || !formData.rpcUrl} className="flex-1">
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Add Network
              </Button>
            </div>

            {testStatus === 'success' && (
              <div className="text-sm text-green-600 flex items-center gap-2 mt-2">
                <CheckCircle2 className="h-4 w-4" /> Endpoint is reachable and healthy.
              </div>
            )}
            {testStatus === 'error' && (
              <div className="text-sm text-red-500 flex items-center gap-2 mt-2">
                <AlertCircle className="h-4 w-4" /> Connection failed. Check CORS or URL.
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
              <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-md">
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
                        <TableCell className="font-medium">{net.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
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
        <h2 className="text-xl font-semibold mb-4">Application Data</h2>
        <DataManagement />
      </div>
    </div>
  );
}
'use client';

import { signTransaction } from '@stellar/freighter-api'; // Assuming Freighter for now
import { Contract, rpc as SorobanRpc, TimeoutInfinite, TransactionBuilder } from '@stellar/stellar-sdk';
import { Loader2, Play, Plus, Send, Terminal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArgType, ContractArg, convertToScVal } from '@/lib/soroban-types';
import { useNetworkStore } from '@/store/useNetworkStore';
import { useWallet } from '@/store/useWallet';

interface ContractCallFormProps {
  contractId: string;
}

export function ContractCallForm({ contractId }: ContractCallFormProps) {
  const { isConnected, address } = useWallet();
  const { getActiveNetworkConfig } = useNetworkStore();

  const [fnName, setFnName] = useState('');
  const [args, setArgs] = useState<ContractArg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Add a new argument row
  const addArg = () => {
    setArgs([...args, { id: crypto.randomUUID(), type: 'symbol', value: '' }]);
  };

  // Remove an argument row
  const removeArg = (id: string) => {
    setArgs(args.filter((a) => a.id !== id));
  };

  // Update argument data
  const updateArg = (id: string, field: keyof ContractArg, val: string) => {
    setArgs(args.map((a) => (a.id === id ? { ...a, [field]: val } : a)));
  };

  // 1. SIMULATE (Read-Only)
  const handleSimulate = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);

      const contract = new Contract(contractId);
      const scArgs = args.map((a) => convertToScVal(a.type, a.value));

      const operation = contract.call(fnName, ...scArgs);

      // Use a dummy source for simulation if wallet not connected
      const source = address || 'GBAB...DUMMY';

      // Build a basic transaction just for simulation
      const account = await server.getAccount(source).catch(() => null);
      // Fallback for non-existent account (common in simulation)
      const sequence = account ? account.sequenceNumber() : '0';

      const tx = new TransactionBuilder(
        // @ts-ignore - Minimal account object for builder
        { accountId: source, sequenceNumber: sequence, incrementSequenceNumber: () => {} },
        { fee: '100', networkPassphrase: network.networkPassphrase }
      )
        .addOperation(operation)
        .setTimeout(TimeoutInfinite)
        .build();

      const sim = await server.simulateTransaction(tx);

      if (SorobanRpc.Api.isSimulationSuccess(sim)) {
        // We'll just dump the result XDR to string for now
        // In a real app, use scValToNative(sim.result.retval)
        setResult(`Simulation Success! Result XDR available.`);
      } else {
        setResult(`Simulation Failed: ${sim.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error(e);
      setResult(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. SEND (Write / Submit to Chain)
  const handleSend = async () => {
    if (!isConnected || !address) {
      toast.error('Connect wallet to send transactions');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);

      const contract = new Contract(contractId);
      const scArgs = args.map((a) => convertToScVal(a.type, a.value));

      const sourceAccount = await server.getAccount(address);

      const tx = new TransactionBuilder(sourceAccount, {
        fee: '100', // In production, calculate dynamic fees
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(contract.call(fnName, ...scArgs))
        .setTimeout(TimeoutInfinite)
        .build();

      // 1. Simulate first to get footprint/resources
      const sim = await server.simulateTransaction(tx);
      if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
        throw new Error(`Pre-flight simulation failed: ${sim.error}`);
      }

      // 2. Prepare transaction data (resources)
      const preparedTx = SorobanRpc.assembleTransaction(tx, sim).build();

      // 3. Sign with Wallet (Freighter)
      const signedResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      // 4. Submit
      const sendRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedResult.signedTxXdr, network.networkPassphrase)
      );

      if (sendRes.status !== 'PENDING') {
        throw new Error(`Submission failed: ${sendRes.status}`);
      }

      setResult(`Transaction Submitted! Hash: ${sendRes.hash}`);
      toast.success('Transaction sent to network');
    } catch (e: any) {
      console.error(e);
      setResult(`Submission Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Interact</CardTitle>
        <CardDescription>Call functions on this contract.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Function Name Input */}
        <div className="space-y-2">
          <Label>Function Name</Label>
          <Input
            placeholder="e.g. initialize, increment, transfer"
            value={fnName}
            onChange={(e) => setFnName(e.target.value)}
          />
        </div>

        {/* Dynamic Arguments List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Arguments ({args.length})</Label>
            <Button size="sm" variant="outline" onClick={addArg}>
              <Plus className="mr-1 h-3 w-3" /> Add Arg
            </Button>
          </div>

          {args.map((arg, idx) => (
            <div key={arg.id} className="flex items-start gap-2">
              <div className="w-[120px]">
                <Select value={arg.type} onValueChange={(v) => updateArg(arg.id, 'type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="symbol">Symbol</SelectItem>
                    <SelectItem value="address">Address</SelectItem>
                    <SelectItem value="i32">i32 (Int)</SelectItem>
                    <SelectItem value="string">String</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="flex-1"
                placeholder="Value..."
                value={arg.value}
                onChange={(e) => updateArg(arg.id, 'value', e.target.value)}
              />
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeArg(arg.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Result Display */}
        {result && (
          <div className="bg-muted break-all rounded-md border-l-4 border-blue-500 p-4 font-mono text-xs">{result}</div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={handleSimulate} disabled={isLoading || !fnName}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Terminal className="mr-2 h-4 w-4" />}
            Simulate
          </Button>

          <Button className="flex-1" onClick={handleSend} disabled={isLoading || !fnName || !isConnected}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Transaction
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
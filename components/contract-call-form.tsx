'use client';

import { useState } from 'react';
import {
  Contract,
  TransactionBuilder,
  TimeoutInfinite,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';
import {
  Play,
  Send,
  Plus,
  Trash2,
  Loader2,
  Terminal,
  Save,
  Bookmark,
} from 'lucide-react';
import { useWallet } from '@/store/useWallet';
import { useNetworkStore } from '@/store/useNetworkStore';
import { useSavedCallsStore, SavedCall } from '@/store/useSavedCallsStore';
import { ArgType, ContractArg, convertToScVal } from '@/lib/soroban-types';
import { signTransaction } from '@stellar/freighter-api';
import { SavedCallsSheet } from './saved-calls-sheet';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

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
  const { saveCall } = useSavedCallsStore();
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  const addArg = () => {
    setArgs([...args, { id: crypto.randomUUID(), type: 'symbol', value: '' }]);
  };

  const removeArg = (id: string) => {
    setArgs(args.filter((a) => a.id !== id));
  };

  const updateArg = (id: string, field: keyof ContractArg, val: string) => {
    setArgs(args.map((a) => (a.id === id ? { ...a, [field]: val } : a)));
  };

  const handleSimulate = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const network = getActiveNetworkConfig();
      const server = new SorobanRpc.Server(network.rpcUrl);

      const contract = new Contract(contractId);
      const scArgs = args.map((a) => convertToScVal(a.type, a.value));

      const operation = contract.call(fnName, ...scArgs);

      const source = address || 'GBAB...DUMMY';

      const account = await server.getAccount(source).catch(() => null);

      const sequence = account ? account.sequenceNumber() : '0';

      const tx = new TransactionBuilder(
        {
          accountId: () => source,
          sequenceNumber: () => sequence,
          incrementSequenceNumber: () => {},
        },
        { fee: '100', networkPassphrase: network.networkPassphrase },
      )
        .addOperation(operation)
        .setTimeout(TimeoutInfinite)
        .build();

      const sim = await server.simulateTransaction(tx);

      if (SorobanRpc.Api.isSimulationSuccess(sim)) {
        setResult(`Simulation Success! Result XDR available.`);
        toast.success(`Simulation Success!`);
      } else {
        setResult(`Simulation Failed: ${sim.error || 'Unknown error'}`);
        toast.error(`Simulation Failed: ${sim.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error(e);
      setResult(`Error: ${e.message}`);
      toast.error(`Simulation Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

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
        fee: '100',
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(contract.call(fnName, ...scArgs))
        .setTimeout(TimeoutInfinite)
        .build();

      const sim = await server.simulateTransaction(tx);
      if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
        throw new Error(`Pre-flight simulation failed: ${sim.error}`);
      }

      const preparedTx = SorobanRpc.assembleTransaction(tx, sim).build();

      const signedResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: network.networkPassphrase,
      });

      const sendRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(
          signedResult.signedTxXdr,
          network.networkPassphrase,
        ),
      );

      if (sendRes.status !== 'PENDING') {
        throw new Error(`Submission failed: ${sendRes.status}`);
      }

      setResult(`Transaction Submitted! Hash: ${sendRes.hash}`);
      toast.success('Transaction sent to network');
    } catch (e: any) {
      console.error(e);
      setResult(`Submission Error: ${e.message}`);
      toast.error(`Submission Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!saveName.trim()) return;

    saveCall({
      name: saveName,
      contractId,
      fnName,
      args,
      network: getActiveNetworkConfig().id,
    });

    setIsSaveOpen(false);
    setSaveName('');
    toast.success('Interaction saved!');
  };

  const handleLoad = (call: SavedCall) => {
    setFnName(call.fnName);

    const newArgs = call.args.map((a) => ({ ...a, id: crypto.randomUUID() }));
    setArgs(newArgs);
    toast.info(`Loaded: ${call.name}`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Interact</CardTitle>
        <CardDescription>Call functions on this contract.</CardDescription>
        <SavedCallsSheet contractId={contractId} onSelect={handleLoad} />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Function Name</Label>
          <Input
            placeholder="e.g. initialize, increment, transfer"
            value={fnName}
            onChange={(e) => setFnName(e.target.value)}
          />
        </div>

        <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              title="Save Interaction"
              disabled={!fnName}
            >
              <Save className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Interaction</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>Name this bookmark</Label>
              <Input
                placeholder="e.g. Mint Test Tokens"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleSave}>Save Bookmark</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                <Select
                  value={arg.type}
                  onValueChange={(v: ArgType) => updateArg(arg.id, 'type', v)}
                >
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
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeArg(arg.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {result && (
          <div className="bg-muted break-all rounded-md border-l-4 border-blue-500 p-4 font-mono text-xs">
            {result}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleSimulate}
            disabled={isLoading || !fnName}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Terminal className="mr-2 h-4 w-4" />
            )}
            Simulate
          </Button>

          <Button
            className="flex-1"
            onClick={handleSend}
            disabled={isLoading || !fnName || !isConnected}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Transaction
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

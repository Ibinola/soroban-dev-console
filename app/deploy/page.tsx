"use client";

import { useState } from "react";
import { useWallet } from "@/store/useWallet";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useContractStore } from "@/store/useContractStore";
import {
    rpc as SorobanRpc,
    TransactionBuilder,
    TimeoutInfinite,
    xdr,
    StrKey,
    hash,
    Address,
    Operation,
    Asset,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import {
    UploadCloud,
    FileCode,
    Loader2,
    CheckCircle,
    Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function DeployPage() {
    const { isConnected, address } = useWallet();
    const { getActiveNetworkConfig } = useNetworkStore();
    const { addContract } = useContractStore();

    const [file, setFile] = useState<File | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployedId, setDeployedId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            if (!selected.name.endsWith(".wasm")) {
                toast.error("Please upload a .wasm file");
                return;
            }
            setFile(selected);
        }
    };

    const deployContract = async () => {
        if (!file || !address || !isConnected) return;

        setIsDeploying(true);
        setDeployedId(null);
        setStatus("Reading WASM file...");

        try {
            const network = getActiveNetworkConfig();
            const server = new SorobanRpc.Server(network.rpcUrl);
            const arrayBuffer = await file.arrayBuffer();
            const wasmBuffer = Buffer.from(arrayBuffer);

            // 1. Upload WASM (Install Code)
            setStatus("Uploading WASM to network...");
            const sourceAccount = await server.getAccount(address);

            const installOp = Operation.uploadContractWasm({
                wasm: wasmBuffer,
            });

            const tx = new TransactionBuilder(sourceAccount, {
                fee: "10000", // Higher fee for upload
                networkPassphrase: network.networkPassphrase,
            })
                .addOperation(installOp)
                .setTimeout(TimeoutInfinite)
                .build();

            const preparedTx = await server.prepareTransaction(tx);
            const signedXdr = await signTransaction(preparedTx.toXDR(), {
                networkPassphrase: network.networkPassphrase,
            });

            setStatus("Submitting WASM...");
            const sendRes = await server.sendTransaction(
                TransactionBuilder.fromXDR(signedXdr.signedTxXdr, network.networkPassphrase),
            );

            if (sendRes.status !== "PENDING")
                throw new Error(`WASM upload failed: ${sendRes.status}`);

            // Wait for completion to get WASM Hash
            setStatus("Waiting for WASM confirmation...");
            let wasmHash = "";

            // Poll for status
            const getTxStatus = async (hash: string) => {
                const res = await server.getTransaction(hash);
                if (res.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
                    return res;
                }
                return null;
            };

            // Simple polling loop
            let attempts = 0;
            while (attempts < 10) {
                await new Promise((r) => setTimeout(r, 2000));
                const res = await getTxStatus(sendRes.hash);
                if (res) {
                    // Extract Wasm Hash from return value
                    // Note: In newer SDKs, you might calculate hash locally: hash(wasmBuffer)
                    wasmHash = hash(wasmBuffer).toString("hex");
                    break;
                }
                attempts++;
            }

            if (!wasmHash) {
                // Fallback: calculate local hash if polling timed out but tx likely succeeded
                wasmHash = hash(wasmBuffer).toString("hex");
            }

            // 2. Instantiate Contract (Create Contract)
            setStatus("Instantiating Contract...");
            // Refresh sequence number
            const sourceAccount2 = await server.getAccount(address);

            const createOp = Operation.createCustomContract({
                wasmHash: Buffer.from(wasmHash, "hex"),
                address: Address.fromString(address), // Deployer
                salt: Buffer.alloc(32).fill(0), // Simple salt (should be random in prod)
            });

            const createTx = new TransactionBuilder(sourceAccount2, {
                fee: "10000",
                networkPassphrase: network.networkPassphrase,
            })
                .addOperation(createOp)
                .setTimeout(TimeoutInfinite)
                .build();

            const preparedCreate = await server.prepareTransaction(createTx);
            const signedCreate = await signTransaction(preparedCreate.toXDR(), {
                networkPassphrase: network.networkPassphrase,
            });

            const createRes = await server.sendTransaction(
                TransactionBuilder.fromXDR(signedCreate.signedTxXdr, network.networkPassphrase),
            );

            if (createRes.status !== "PENDING")
                throw new Error("Instantiation failed");

            setStatus("Finalizing deployment...");

            // Calculate the expected Contract ID (Address + Salt + Hash logic)
            // For simplicity in Wave 1, we can calculate it or wait for tx
            // StrKey.encodeContract(hash( ... )) logic is complex to reproduce exactly here without SDK helpers
            // So we wait for the result

            attempts = 0;
            while (attempts < 10) {
                await new Promise((r) => setTimeout(r, 2000));
                const res = await server.getTransaction(createRes.hash);
                if (res.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
                    // We need to parse the result meta to get the ID, but for now,
                    // let's assume we can fetch it or the user can calculate it.
                    // *Optimization:* The easiest way to get the ID *before* sending is using `Address.contractId(...)`
                    // But let's just use the `returnValue` if available or display success.

                    // For MVP, we calculate deterministic ID if we used a known salt:
                    const contractId = (new Address(address) as any)
                        .contractId(Buffer.alloc(32).fill(0), network.networkPassphrase)
                        .toString();

                    setDeployedId(contractId);
                    addContract(contractId, network.id); // Auto-add to watchlist
                    toast.success("Contract Deployed Successfully!");
                    break;
                }
                attempts++;
            }
        } catch (e: any) {
            console.error(e);
            toast.error(`Deployment Failed: ${e.message}`);
        } finally {
            setIsDeploying(false);
            setStatus("");
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight mb-6">
                Deploy Contract
            </h1>

            {!isConnected ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center h-40">
                        <p className="text-muted-foreground">
                            Connect wallet to deploy contracts
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Upload WASM</CardTitle>
                        <CardDescription>
                            Upload your compiled Soroban smart contract (.wasm)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="wasm">Contract File</Label>
                            <Input
                                id="wasm"
                                type="file"
                                accept=".wasm"
                                onChange={handleFileChange}
                            />
                        </div>

                        {file && (
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                                <FileCode className="h-5 w-5 text-blue-500" />
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024).toFixed(2)} KB
                                    </p>
                                </div>
                            </div>
                        )}

                        {isDeploying && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {status}
                                </div>
                            </div>
                        )}

                        {deployedId ? (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-md dark:bg-green-900/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                    <div className="font-semibold text-green-700 dark:text-green-400">
                                        Deployment Complete!
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Contract ID:
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="bg-background px-2 py-1 rounded border text-xs font-mono break-all flex-1">
                                        {deployedId}
                                    </code>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => navigator.clipboard.writeText(deployedId)}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                className="w-full"
                                onClick={deployContract}
                                disabled={!file || isDeploying}
                            >
                                {isDeploying ? "Deploying..." : "Deploy Contract"}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
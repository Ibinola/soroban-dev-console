'use client';

import { useEffect, useState } from 'react';
import { Horizon } from '@stellar/stellar-sdk';
import { useWallet } from '@/store/useWallet';
import { useNetworkStore } from '@/store/useNetworkStore';
import {
    Activity,
    CheckCircle2,
    XCircle,
    ExternalLink,
    Clock,
    ArrowRightLeft,
    Box
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const getHorizonUrl = (networkId: string) => {
    switch (networkId) {
        case 'mainnet': return 'https://horizon.stellar.org';
        case 'testnet': return 'https://horizon-testnet.stellar.org';
        case 'futurenet': return 'https://horizon-futurenet.stellar.org';
        case 'local': return 'http://localhost:8000';
        default: return 'https://horizon-testnet.stellar.org';
    }
};

interface TxRecord {
    id: string;
    hash: string;
    successful: boolean;
    created_at: string;
    operation_count: number;
    memo?: string;
}

export function TransactionFeed() {
    const { address, isConnected } = useWallet();
    const { currentNetwork } = useNetworkStore();

    const [transactions, setTransactions] = useState<TxRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

        async function fetchTransactions() {
            if (!address || !isConnected) return;

            try {
                const serverUrl = getHorizonUrl(currentNetwork);
                const server = new Horizon.Server(serverUrl);

                // Fetch last 15 transactions, descending order
                const response = await server.transactions()
                    .forAccount(address)
                    .limit(15)
                    .order('desc')
                    .call();

                if (isMounted) {
                    setTransactions(response.records.map(rec => ({
                        id: rec.id,
                        hash: rec.hash,
                        successful: rec.successful,
                        created_at: rec.created_at,
                        operation_count: rec.operation_count,
                        memo: rec.memo,
                    })));
                    setLastUpdated(new Date());
                }
            } catch (error) {
                console.error("Failed to fetch transactions:", error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                    // Poll every 5 seconds
                    timeoutId = setTimeout(fetchTransactions, 5000);
                }
            }
        }

        // Initial fetch
        setLoading(true);
        fetchTransactions();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [address, isConnected, currentNetwork]);

    // Format helper
    const formatTime = (dateStr: string) => {
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date(dateStr));
    };

    if (!isConnected) {
        return (
            <Card className="h-full border-dashed">
                <CardContent className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
                    <Activity className="h-8 w-8 opacity-50" />
                    <p>Connect wallet to view transactions</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full h-full flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="h-4 w-4 text-blue-500" />
                            Live Activity
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Auto-updating every 5s • {currentNetwork}
                        </CardDescription>
                    </div>
                    {lastUpdated && (
                        <Badge variant="outline" className="text-[10px] font-mono opacity-70">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-[400px]">
                    <div className="flex flex-col divide-y">
                        {transactions.length === 0 && !loading ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                No recent transactions found on this network.
                            </div>
                        ) : (
                            transactions.map((tx) => (
                                <div key={tx.id} className="p-4 hover:bg-muted/50 transition-colors flex items-center gap-3">

                                    {/* Status Icon */}
                                    <div className="shrink-0">
                                        {tx.successful ? (
                                            <div className="h-8 w-8 rounded-full bg-green-500/15 flex items-center justify-center">
                                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-red-500/15 flex items-center justify-center">
                                                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Transaction Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium truncate">
                                                Smart Contract Call
                                            </span>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {tx.hash.slice(0, 4)}...{tx.hash.slice(-4)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatTime(tx.created_at)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Box className="h-3 w-3" />
                                                {tx.operation_count} Ops
                                            </span>
                                        </div>
                                    </div>

                                    {/* External Link */}
                                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground">
                                        <a
                                            href={`https://stellar.expert/explorer/${currentNetwork}/tx/${tx.hash}`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
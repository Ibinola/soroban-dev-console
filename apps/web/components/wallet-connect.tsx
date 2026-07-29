"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/store/useWallet";
import { walletProviderList, type WalletProviderId } from "@/lib/wallet/provider";
import { Button } from "@devconsole/ui";
import { Skeleton } from "@devconsole/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@devconsole/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { Wallet, LogOut, Copy, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function ConnectWalletButton() {
  const {
    isConnected,
    address,
    walletType,
    sessionStatus,
    connect,
    disconnectWallet,
    revalidateSession,
    getCapabilities,
    autoReconnect,
    setAutoReconnect,
    attemptReconnect,
    reconnectAttempts,
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [freighterAvailable, setFreighterAvailable] = useState(false);

  useEffect(() => {
    setFreighterAvailable(typeof window !== "undefined" && typeof (window as any).freighter !== "undefined");
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // FE-042: revalidate on mount if we have a persisted session
  useEffect(() => {
    if (isConnected) {
      revalidateSession().then((status) => {
        if (status === "stale") {
          toast.warning("Wallet session expired. Please reconnect.");
        } else if (status === "mismatch") {
          toast.warning("Network changed since last connection. Please verify.");
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  const handleConnect = async (provider: WalletProviderId) => {
    try {
      await connect(provider);
      setIsOpen(false);
      toast.success("Wallet connected!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to connect wallet.");
    }
  };

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard!");
    }
  };

  if (!isMounted) {
    return <Skeleton className="h-9 w-[140px] rounded-md" />;
  }

  if (isConnected && address) {
    const caps = getCapabilities();
    // FE-042: session status indicator
    const statusColor =
      sessionStatus === "valid"
        ? "bg-green-500"
        : sessionStatus === "mismatch"
          ? "bg-yellow-500"
          : "bg-red-500";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 font-mono">
            <div className={`h-2 w-2 rounded-full ${statusColor}`} />
            {shortAddress}
            {/* FE-042: show mismatch warning inline */}
            {sessionStatus === "mismatch" && (
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          {/* FE-041: capability badges */}
          {caps && (
            <div className="flex flex-wrap gap-1 px-2 pb-2">
              {caps.canSign && (
                <Badge variant="secondary" className="text-[10px]">
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                  Sign
                </Badge>
              )}
              {caps.canSignAuthEntries && (
                <Badge variant="secondary" className="text-[10px]">
                  Auth Entries
                </Badge>
              )}
              {caps.requiresExtension && (
                <Badge variant="outline" className="text-[10px]">
                  Extension
                </Badge>
              )}
            </div>
          )}
          {/* FE-042: session status row */}
          {sessionStatus !== "valid" && (
            <div className="px-2 pb-2">
              <Badge
                variant={sessionStatus === "mismatch" ? "outline" : "destructive"}
                className="w-full justify-center text-[10px]"
              >
                {sessionStatus === "mismatch"
                  ? "Network mismatch — verify before signing"
                  : "Session stale — reconnect"}
              </Badge>
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" asChild>
            <a
              href={`https://stellar.expert/explorer/testnet/account/${address}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View on Explorer
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={disconnectWallet}
            className="cursor-pointer text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const reconnectLabel = !isConnected && autoReconnect
    ? `Reconnecting attempt ${reconnectAttempts}/3...`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Connect Wallet</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect your wallet</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Freighter extension status */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
            <span className="text-muted-foreground">Freighter extension</span>
            {freighterAvailable ? (
              <Badge variant="default" className="text-[10px]">Installed</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Not detected</Badge>
            )}
          </div>

          {!isConnected && autoReconnect && (
            <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              <span className="text-amber-700">{reconnectLabel}</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setAutoReconnect(false); attemptReconnect(); }}>
                Retry now
              </Button>
            </div>
          )}

          {walletProviderList.map((provider) => (
            <Button
              key={provider.id}
              variant="outline"
              className="h-auto justify-start gap-4 border-2 px-6 py-3 hover:border-primary/50"
              onClick={() => handleConnect(provider.id)}
            >
              <Wallet className={`h-6 w-6 shrink-0 ${provider.accentClassName}`} />
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">{provider.label}</span>
                <span className="text-xs text-muted-foreground">
                  {provider.description}
                </span>
                {/* FE-041: show capability summary in picker */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {provider.capabilities.canSign && (
                    <Badge variant="secondary" className="text-[10px]">Sign</Badge>
                  )}
                  {provider.capabilities.canSignAuthEntries && (
                    <Badge variant="secondary" className="text-[10px]">Auth Entries</Badge>
                  )}
                  {provider.capabilities.requiresExtension && (
                    <Badge variant="outline" className="text-[10px]">Extension required</Badge>
                  )}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

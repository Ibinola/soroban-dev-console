"use client";

import { useState, useEffect } from "react";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import { Skeleton } from "@devconsole/ui";
import { ChevronDown, AlertTriangle, Wifi, Settings } from "lucide-react";
import Link from "next/link";
import { useWallet } from "@/store/useWallet";

export function NetworkSwitcher() {
  const { currentNetwork, setNetwork, getAllNetworks } = useNetworkStore();
  const { refreshWalletNetworkSnapshot } = useWallet();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const allNetworks = getAllNetworks();
  const activeNet =
    allNetworks.find((n) => n.id === currentNetwork) || allNetworks[0];

  const handleSwitch = (id: string) => {
    setNetwork(id);
    // W7-FE-001 (#675): after an app-level network switch, refresh the
    // wallet's reported passphrase so the mismatch banner updates without
    // requiring a wallet reconnect.
    void refreshWalletNetworkSnapshot();
    window.location.reload();
  };

  const getNetworkColor = (id: string) => {
    if (id.includes("custom")) return "bg-blue-500";
    switch (id) {
      case "mainnet":
        return "bg-green-500";
      case "testnet":
        return "bg-orange-500";
      case "futurenet":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!isMounted) {
    return <Skeleton className="h-9 w-[140px] rounded-md" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="min-w-[140px] justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${getNetworkColor(activeNet.id)}`}
            />
            <span className="hidden max-w-[100px] truncate font-medium sm:inline-block">
              {activeNet.name}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {allNetworks.map((network) => (
          <DropdownMenuItem
            key={network.id}
            onClick={() => handleSwitch(network.id)}
            className="cursor-pointer gap-2"
          >
            <div
              className={`h-2 w-2 rounded-full ${getNetworkColor(network.id)}`}
            />
            <span className="max-w-[150px] truncate">{network.name}</span>
            {currentNetwork === network.id && (
              <Wifi className="ml-auto h-3 w-3 opacity-50" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex w-full cursor-pointer items-center gap-2"
          >
            <Settings className="h-3 w-3" />
            Manage Networks
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

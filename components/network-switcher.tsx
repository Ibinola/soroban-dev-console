
// components/network-switcher.tsx
'use client';

import { AlertTriangle, ChevronDown, Wifi } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NetworkId, NETWORKS, useNetworkStore } from '@/store/useNetworkStore';

export function NetworkSwitcher() {
  const { currentNetwork, setNetwork } = useNetworkStore();

  const handleSwitch = (id: NetworkId) => {
    // Optional: Add a confirmation dialog here if switching to Mainnet
    setNetwork(id);
    // Reloading page is often safer to ensure all stale RPC connections are cleared
    // window.location.reload();
  };

  const getNetworkColor = (id: NetworkId) => {
    switch (id) {
      case 'mainnet':
        return 'bg-green-500';
      case 'testnet':
        return 'bg-orange-500';
      case 'futurenet':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[140px] justify-between gap-2">
          <div className="flex items-center gap-2">
            {currentNetwork === 'mainnet' ? (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            ) : (
              <div className={`h-2 w-2 rounded-full ${getNetworkColor(currentNetwork)}`} />
            )}
            <span className="hidden font-medium sm:inline-block">{NETWORKS[currentNetwork].name}</span>
            <span className="font-medium sm:hidden">{NETWORKS[currentNetwork].name.slice(0, 4)}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.values(NETWORKS).map((network) => (
          <DropdownMenuItem key={network.id} onClick={() => handleSwitch(network.id)} className="cursor-pointer gap-2">
            <div className={`h-2 w-2 rounded-full ${getNetworkColor(network.id)}`} />
            {network.name}
            {currentNetwork === network.id && <Wifi className="ml-auto h-3 w-3 opacity-50" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

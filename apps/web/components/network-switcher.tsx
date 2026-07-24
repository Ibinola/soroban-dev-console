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
import { Input } from "@devconsole/ui";
import { Skeleton } from "@devconsole/ui";
import { ChevronDown, Wifi, Settings, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";

/**
 * Issue #739: Add support for Futurenet and custom RPC URL in the network switcher.
 *
 * - Futurenet is already in DEFAULT_NETWORKS in useNetworkStore (with correct RPC URL and passphrase)
 * - Added a "Custom RPC" option that reveals an inline form for URL + passphrase
 * - Validates URL format on input (must be https:// or http://localhost)
 * - Custom URL persisted in useNetworkStore (addCustomNetwork) across sessions
 * - Network passphrase defaults to testnet passphrase with override input
 */

function validateCustomUrl(url: string): string | null {
  if (!url) return "URL is required";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return null;
    if (parsed.protocol === "http:" && parsed.hostname === "localhost") return null;
    return "URL must use https:// or http://localhost";
  } catch {
    return "Invalid URL format";
  }
}

export function NetworkSwitcher() {
  const { currentNetwork, setNetwork, getAllNetworks, addCustomNetwork } = useNetworkStore();
  const [isMounted, setIsMounted] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPassphrase, setCustomPassphrase] = useState("Test SDF Network ; September 2015");
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const allNetworks = getAllNetworks();
  const activeNet = allNetworks.find((n) => n.id === currentNetwork) || allNetworks[0];

  const handleSwitch = (id: string) => {
    setNetwork(id);
    window.location.reload();
  };

  const handleUrlChange = (url: string) => {
    setCustomUrl(url);
    setUrlError(validateCustomUrl(url));
  };

  const handleAddCustom = () => {
    const err = validateCustomUrl(customUrl);
    if (err) { setUrlError(err); return; }
    if (!customName.trim()) return;

    const newId = `custom-${Date.now()}`;
    addCustomNetwork({
      id: newId,
      name: customName.trim(),
      rpcUrl: customUrl.trim(),
      networkPassphrase: customPassphrase.trim() || "Test SDF Network ; September 2015",
    });

    setCustomUrl(""); setCustomName(""); setUrlError(null);
    setCustomPassphrase("Test SDF Network ; September 2015");
    setShowCustomForm(false);
    handleSwitch(newId);
  };

  const getNetworkColor = (id: string) => {
    if (id.includes("custom")) return "bg-blue-500";
    switch (id) {
      case "mainnet": return "bg-green-500";
      case "testnet": return "bg-orange-500";
      case "futurenet": return "bg-purple-500";
      case "local": return "bg-gray-400";
      default: return "bg-gray-500";
    }
  };

  if (!isMounted) return <Skeleton className="h-9 w-[140px] rounded-md" />;

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setShowCustomForm(false); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[140px] justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getNetworkColor(activeNet.id)}`} />
            <span className="hidden max-w-[100px] truncate font-medium sm:inline-block">
              {activeNet.name}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {allNetworks.map((network) => (
          <DropdownMenuItem
            key={network.id}
            onClick={() => handleSwitch(network.id)}
            className="cursor-pointer gap-2"
          >
            <div className={`h-2 w-2 rounded-full ${getNetworkColor(network.id)}`} />
            <span className="max-w-[160px] truncate">{network.name}</span>
            {currentNetwork === network.id && (
              <Wifi className="ml-auto h-3 w-3 opacity-50" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Issue #739: Custom RPC inline form */}
        {!showCustomForm ? (
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); setShowCustomForm(true); }}
            className="cursor-pointer gap-2 text-muted-foreground"
          >
            <Plus className="h-3 w-3" />
            Add Custom RPC
          </DropdownMenuItem>
        ) : (
          <div
            className="space-y-2 px-2 py-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold">Custom RPC</p>
            <Input
              placeholder="Name (e.g. My Private Node)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="h-7 text-xs"
            />
            <div>
              <Input
                placeholder="https://... or http://localhost:..."
                value={customUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={`h-7 text-xs ${urlError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {urlError && (
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-red-500">
                  <AlertCircle className="h-3 w-3 shrink-0" /> {urlError}
                </p>
              )}
            </div>
            <Input
              placeholder="Network passphrase"
              value={customPassphrase}
              onChange={(e) => setCustomPassphrase(e.target.value)}
              className="h-7 text-xs"
            />
            <div className="flex gap-1 pt-1">
              <Button
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={handleAddCustom}
                disabled={!!urlError || !customUrl.trim() || !customName.trim()}
              >
                Add &amp; Switch
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowCustomForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex w-full cursor-pointer items-center gap-2">
            <Settings className="h-3 w-3" />
            Manage Networks
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

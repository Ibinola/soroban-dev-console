"use client";

import { useEffect, useState } from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw,
  WifiOff,
  Info
} from "lucide-react";
import { Button } from "@devconsole/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@devconsole/ui";
import { cn } from "@devconsole/ui";
import {
  getRuntimeConfigState,
  refreshRuntimeConfig,
  type RuntimeConfigWithState,
  type RuntimeConfigState,
} from "@/lib/api/runtime-config";

interface RuntimeConfigStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function RuntimeConfigStatus({ className, showDetails = false }: RuntimeConfigStatusProps) {
  const [configState, setConfigState] = useState<RuntimeConfigWithState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setConfigState(getRuntimeConfigState());
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const newState = await refreshRuntimeConfig();
      setConfigState(newState);
    } catch (error) {
      console.error("Failed to refresh runtime config:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!configState) {
    return null;
  }

  const statusConfig = {
    loading: {
      icon: Loader2,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      label: "Loading",
      description: "Fetching runtime configuration...",
    },
    live: {
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
      label: "Live",
      description: "Using live API configuration",
    },
    fallback: {
      icon: WifiOff,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      label: "Fallback",
      description: "Using local fallback configuration",
    },
    error: {
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
      label: "Error",
      description: "Failed to load configuration",
    },
  };

  const currentStatus = statusConfig[configState.state];
  const StatusIcon = currentStatus.icon;

  const statusBadge = (
    <div className={cn("flex items-center gap-2 rounded-md px-2 py-1", currentStatus.bgColor, className)}>
      <StatusIcon className={cn("h-4 w-4", currentStatus.color, {
        "animate-spin": configState.state === "loading" || isRefreshing,
      })} />
      <span className="text-sm font-medium">{currentStatus.label}</span>
      {configState.state !== "loading" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 ml-1"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-3 w-3", {
            "animate-spin": isRefreshing,
          })} />
        </Button>
      )}
    </div>
  );

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {statusBadge}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-sm">{currentStatus.description}</p>
            {configState.lastFetch && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {configState.lastFetch.toLocaleTimeString()}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {statusBadge}
          <div>
            <h3 className="font-medium">Runtime Configuration</h3>
            <p className="text-sm text-muted-foreground">{currentStatus.description}</p>
          </div>
        </div>
      </div>

      {configState.errorMessage && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Error Details</p>
              <p className="text-sm text-red-600">{configState.errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {configState.state === "fallback" && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Using Fallback Configuration</p>
              <p className="text-sm text-yellow-600">
                The application is using local fallback settings because the API configuration service is unavailable. 
                Some features may not work as expected.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">Profile:</span>
          <span className="ml-2 text-muted-foreground">{configState.config.profile}</span>
        </div>
        <div>
          <span className="font-medium">Version:</span>
          <span className="ml-2 text-muted-foreground">{configState.config.version}</span>
        </div>
        <div>
          <span className="font-medium">Networks:</span>
          <span className="ml-2 text-muted-foreground">{configState.config.networks.length}</span>
        </div>
        <div>
          <span className="font-medium">Fixtures:</span>
          <span className="ml-2 text-muted-foreground">{configState.config.fixtures.length}</span>
        </div>
      </div>
    </div>
  );
}

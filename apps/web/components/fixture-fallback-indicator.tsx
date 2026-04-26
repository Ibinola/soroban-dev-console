"use client";

import { AlertCircle, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { 
  isFixtureManifestUsingFallback, 
  getFixtureManifestError, 
  fetchFixtureManifest,
  resetFixtureManifestCache 
} from "@/lib/fixture-manifest";
import { useState } from "react";
import { toast } from "sonner";

interface FixtureFallbackIndicatorProps {
  className?: string;
  compact?: boolean;
}

export function FixtureFallbackIndicator({ 
  className = "", 
  compact = false 
}: FixtureFallbackIndicatorProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isUsingFallback = isFixtureManifestUsingFallback();
  const error = getFixtureManifestError();

  if (!isUsingFallback) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      resetFixtureManifestCache();
      await fetchFixtureManifest();
      toast.success("Fixture manifest refreshed successfully!");
    } catch (error) {
      toast.error("Failed to refresh fixture manifest");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (compact) {
    return (
      <Badge variant="secondary" className={`${className} text-xs`}>
        <WifiOff className="mr-1 h-3 w-3" />
        Fallback Data
      </Badge>
    );
  }

  return (
    <div className={`rounded-md border border-amber-500/40 bg-amber-500/10 p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">
              Using Local Fixture Data
            </h4>
            <p className="mt-1 text-sm text-amber-700">
              The fixture manifest API is currently unavailable. Showing pre-configured 
              local fixtures instead of live server data.
            </p>
            {error && (
              <p className="mt-1 text-xs text-amber-600 font-mono">
                Error: {error}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-amber-700 border-amber-300 hover:bg-amber-50"
        >
          {isRefreshing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

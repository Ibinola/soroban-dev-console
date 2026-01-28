"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Download,
  Upload,
  AlertTriangle,
  Loader2,
  FileJson,
} from "lucide-react";
import { toast } from "sonner";

// The keys defined in your Zustand 'persist' middleware options
const STORAGE_KEYS = {
  CONTRACTS: "soroban-contracts-storage",
  SAVED_CALLS: "soroban-saved-calls",
  NETWORKS: "soroban-network-storage",
};

export function DataManagement() {
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = () => {
    try {
      // 1. Retrieve raw data from LocalStorage
      const contractsRaw = localStorage.getItem(STORAGE_KEYS.CONTRACTS);
      const savedCallsRaw = localStorage.getItem(STORAGE_KEYS.SAVED_CALLS);
      const networksRaw = localStorage.getItem(STORAGE_KEYS.NETWORKS);

      // 2. Parse to ensure valid JSON (or default to empty)
      const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        contracts: contractsRaw ? JSON.parse(contractsRaw) : null,
        savedCalls: savedCallsRaw ? JSON.parse(savedCallsRaw) : null,
        networks: networksRaw ? JSON.parse(networksRaw) : null,
      };

      // 3. Create Blob and Download Link
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `soroban-console-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup downloaded successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export data");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Basic Validation: Check if it looks like our schema
        if (!json.contracts && !json.savedCalls && !json.networks) {
          throw new Error("Invalid backup file format");
        }

        // Restore Data
        if (json.contracts)
          localStorage.setItem(
            STORAGE_KEYS.CONTRACTS,
            JSON.stringify(json.contracts),
          );
        if (json.savedCalls)
          localStorage.setItem(
            STORAGE_KEYS.SAVED_CALLS,
            JSON.stringify(json.savedCalls),
          );
        if (json.networks)
          localStorage.setItem(
            STORAGE_KEYS.NETWORKS,
            JSON.stringify(json.networks),
          );

        toast.success("Data imported successfully! Reloading...");

        // Reload to force Zustand stores to rehydrate with new data
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        console.error(err);
        toast.error(`Import failed: ${err.message}`);
        setIsImporting(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Data Management
        </CardTitle>
        <CardDescription>
          Export your local data (contracts, saved interactions, networks) for
          backup or to transfer to another browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Export Button */}
          <Button
            onClick={handleExport}
            variant="outline"
            className="flex-1 gap-2 h-20 sm:h-auto py-4"
          >
            <Download className="h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">Export Backup</div>
              <div className="text-xs text-muted-foreground font-normal">
                Download .json file
              </div>
            </div>
          </Button>

          {/* Import Button (Hidden Input Wrapper) */}
          <div className="flex-1">
            <input
              type="file"
              id="import-file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
              disabled={isImporting}
            />
            <label htmlFor="import-file">
              <Button
                variant="outline"
                className="w-full gap-2 h-20 sm:h-full py-4 cursor-pointer"
                asChild
                disabled={isImporting}
              >
                <span>
                  {isImporting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                  <div className="text-left">
                    <div className="font-semibold">Import Backup</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      Restore from .json file
                    </div>
                  </div>
                </span>
              </Button>
            </label>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md flex items-start gap-3 text-sm text-yellow-800 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            <strong>Warning:</strong> Importing data will{" "}
            <strong>overwrite</strong> your current contracts, saved calls, and
            custom networks. This action cannot be undone.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
